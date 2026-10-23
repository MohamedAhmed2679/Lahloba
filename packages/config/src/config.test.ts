import { describe, expect, it } from 'vitest';
import { ConfigError, loadServerConfig } from './index';

const base = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db',
  DEV_STUB_SIGNING_SECRET: 'x'.repeat(32),
};

describe('server configuration separation', () => {
  it('allows the dev stub only with the explicit flag in development', () => {
    const c = loadServerConfig({ ...base, LAHLOBA_ENV: 'development', IDENTITY_PROVIDER: 'dev-stub', LAHLOBA_DEV_IDENTITY_STUB: 'true' });
    expect(c.identity.kind).toBe('dev-stub');
  });

  it('rejects the dev stub without the explicit flag', () => {
    expect(() => loadServerConfig({ ...base, LAHLOBA_ENV: 'development', IDENTITY_PROVIDER: 'dev-stub' })).toThrow(ConfigError);
  });

  it.each(['staging', 'production'])('rejects the dev stub in %s even with the flag', (env) => {
    expect(() =>
      loadServerConfig({ ...base, LAHLOBA_ENV: env, IDENTITY_PROVIDER: 'dev-stub', LAHLOBA_DEV_IDENTITY_STUB: 'true' }),
    ).toThrow(/forbidden/);
  });

  it('rejects the stub flag lingering in staging with oidc', () => {
    expect(() =>
      loadServerConfig({
        ...base, LAHLOBA_ENV: 'staging', IDENTITY_PROVIDER: 'oidc', LAHLOBA_DEV_IDENTITY_STUB: 'true',
        OIDC_ISSUER: 'https://id.example', OIDC_AUDIENCE: 'lahloba', OIDC_JWKS_URL: 'https://id.example/jwks',
      }),
    ).toThrow(ConfigError);
  });

  it('requires https JWKS and forbids dev evidence storage in production', () => {
    const prod = {
      ...base, LAHLOBA_ENV: 'production', IDENTITY_PROVIDER: 'oidc',
      OIDC_ISSUER: 'https://id.example', OIDC_AUDIENCE: 'lahloba', OIDC_JWKS_URL: 'http://id.example/jwks',
    };
    expect(() => loadServerConfig(prod)).toThrow(/https/);
    expect(() => loadServerConfig({ ...prod, OIDC_JWKS_URL: 'https://id.example/jwks', EVIDENCE_STORAGE: 'dev-metadata-only' })).toThrow(/forbidden/);
    expect(loadServerConfig({ ...prod, OIDC_JWKS_URL: 'https://id.example/jwks' }).identity.kind).toBe('oidc');
  });

  it('rejects wildcard CORS outside local environments', () => {
    expect(() =>
      loadServerConfig({
        ...base, LAHLOBA_ENV: 'staging', CORS_ORIGINS: '*',
        OIDC_ISSUER: 'https://id.example', OIDC_AUDIENCE: 'lahloba', OIDC_JWKS_URL: 'https://id.example/jwks',
      }),
    ).toThrow(/CORS/);
  });

  it('reports invalid field names without echoing values', () => {
    try {
      loadServerConfig({ LAHLOBA_ENV: 'prod', DATABASE_URL: 'secret-value' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toContain('LAHLOBA_ENV');
      expect(String(e)).not.toContain('secret-value');
    }
  });

  it('derives the Clerk issuer from a publishable key and requires authorized parties in production', () => {
    const key = `pk_test_${Buffer.from('happy-otter-12.clerk.accounts.dev$').toString('base64')}`;
    const dev = loadServerConfig({ ...base, LAHLOBA_ENV: 'development', IDENTITY_PROVIDER: 'clerk', CLERK_PUBLISHABLE_KEY: key });
    expect(dev.identity).toEqual({ kind: 'clerk', issuer: 'https://happy-otter-12.clerk.accounts.dev', jwksUrl: 'https://happy-otter-12.clerk.accounts.dev/.well-known/jwks.json', authorizedParties: [] });
    expect(() => loadServerConfig({ ...base, LAHLOBA_ENV: 'production', IDENTITY_PROVIDER: 'clerk', CLERK_PUBLISHABLE_KEY: key })).toThrow(/AUTHORIZED_PARTIES/);
    expect(() => loadServerConfig({ ...base, LAHLOBA_ENV: 'development', IDENTITY_PROVIDER: 'clerk', CLERK_PUBLISHABLE_KEY: 'sk_test_secret' })).toThrow(/pk_test/);
  });
});
