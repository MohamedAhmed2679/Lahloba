import { cpSync, mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, loadMigrations, migrateDown, migrateUp } from '../src/migrator';
import { ClerkIdentityProvider, DevStubIdentityProvider, OidcIdentityProvider } from '../src/identity/provider';
import { TEST_DB_ADMIN_URL, createDisposableDatabase, createTestContext } from '../src/testing';
import { call } from './helpers';

describe.skipIf(!TEST_DB_ADMIN_URL)('migrations in a disposable database', () => {
  it('apply, roll back fully, and re-apply cleanly', async () => {
    const db = await createDisposableDatabase();
    const c = new pg.Client({ connectionString: db.url });
    await c.connect();
    try {
      const ids = loadMigrations().map((m) => m.id);
      expect(ids.length).toBeGreaterThanOrEqual(5);
      expect(await migrateUp(c)).toEqual(ids);
      expect(await migrateUp(c)).toEqual([]);
      expect(await migrateDown(c, ids.length)).toEqual([...ids].reverse());
      const left = await c.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`);
      expect(left.rows[0].n).toBe(0);
      const fns = await c.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`);
      expect(fns.rows[0].n).toBe(0);
      expect(await migrateUp(c)).toHaveLength(ids.length);
    } finally {
      await c.end();
      await db.drop();
    }
  });

  it('refuses to run when an applied migration file was modified', async () => {
    const db = await createDisposableDatabase();
    const dir = mkdtempSync(join(tmpdir(), 'lahloba-mig-'));
    cpSync(MIGRATIONS_DIR, dir, { recursive: true });
    const c = new pg.Client({ connectionString: db.url });
    await c.connect();
    try {
      await migrateUp(c, dir);
      appendFileSync(join(dir, '0001_identity_partners_platform.up.sql'), '\n-- tampered\n');
      await expect(migrateUp(c, dir)).rejects.toThrow(/modified/);
    } finally {
      await c.end();
      await db.drop();
    }
  });

  it('rate limits are enforced (unscaled limits)', async () => {
    const ctx = await createTestContext({ seed: false, rateLimitScale: 1 });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 32; i++) statuses.push((await call(ctx, 'POST', '/v1/dev/tokens', { body: { subject: 'rate-user' }, key: null })).status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(30);
      expect(statuses.at(-1)).toBe(429);
    } finally {
      await ctx.close();
    }
  });
});

describe('identity adapters', () => {
  it('OIDC adapter verifies issuer, audience and signature; namespaces subjects', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const p = new OidcIdentityProvider({ issuer: 'https://id.example', audience: 'lahloba', jwksUrl: 'https://id.example/jwks' }, jwks);
    const sign = (claims: { iss?: string; aud?: string; sub?: string }) =>
      new SignJWT({ name: 'Mona' }).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(claims.iss ?? 'https://id.example')
        .setAudience(claims.aud ?? 'lahloba').setSubject(claims.sub ?? 'user-1').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    expect(await p.verify(await sign({}))).toEqual({ subject: 'oidc:user-1', displayName: 'Mona' });
    expect(await p.verify(await sign({ iss: 'https://evil.example' }))).toBeNull();
    expect(await p.verify(await sign({ aud: 'other-app' }))).toBeNull();
    expect(await p.verify(await sign({ sub: 'bad subject with spaces' }))).toBeNull();
    // A dev-stub HS256 token is never accepted by the OIDC adapter.
    const dev = await new DevStubIdentityProvider('x'.repeat(40)).issue('user-1');
    expect(await p.verify(dev)).toBeNull();
  });

  it('Clerk adapter verifies issuer/signature, enforces azp for browsers and accepts native tokens without azp', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'c1', alg: 'RS256' }] });
    const issuer = 'https://happy-otter-12.clerk.accounts.dev';
    const p = new ClerkIdentityProvider({ issuer, jwksUrl: `${issuer}/.well-known/jwks.json`, authorizedParties: ['https://lahloba.vercel.app'] }, jwks);
    const sign = (claims: Record<string, unknown>, iss = issuer) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'c1' }).setIssuer(iss).setSubject('user_2abc')
        .setIssuedAt().setExpirationTime('1m').sign(privateKey);
    expect(await p.verify(await sign({ azp: 'https://lahloba.vercel.app' }))).toEqual({ subject: 'clerk:user_2abc', displayName: null });
    expect(await p.verify(await sign({}))).toEqual({ subject: 'clerk:user_2abc', displayName: null });
    expect(await p.verify(await sign({ azp: 'https://evil.example' }))).toBeNull();
    expect(await p.verify(await sign({}, 'https://other.clerk.accounts.dev'))).toBeNull();
    const expired = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'c1' }).setIssuer(issuer).setSubject('user_2abc')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600).setExpirationTime(Math.floor(Date.now() / 1000) - 300).sign(privateKey);
    expect(await p.verify(expired)).toBeNull();
  });

  it('dev stub tokens from a different secret are rejected', async () => {
    const a = new DevStubIdentityProvider('a'.repeat(40));
    const b = new DevStubIdentityProvider('b'.repeat(40));
    expect(await b.verify(await a.issue('someone'))).toBeNull();
    expect(await a.verify(await a.issue('someone'))).toEqual({ subject: 'dev:someone', displayName: 'someone' });
  });
});
