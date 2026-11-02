import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { ServerConfig } from '@lahloba/config';

/** Verified identity. The API never accepts identity, roles or user IDs from request bodies. */
export interface VerifiedIdentity {
  subject: string;
  displayName: string | null;
}

export interface IdentityProvider {
  readonly kind: 'oidc' | 'clerk' | 'dev-stub';
  verify(bearerToken: string): Promise<VerifiedIdentity | null>;
}

const SUBJECT = /^[A-Za-z0-9|@._:-]{1,255}$/;

/** Production adapter: verifies provider-issued JWTs against the provider's JWKS. */
export class OidcIdentityProvider implements IdentityProvider {
  readonly kind = 'oidc' as const;
  private readonly jwks: JWTVerifyGetKey;
  constructor(private readonly cfg: { issuer: string; audience: string; jwksUrl: string }, jwks?: JWTVerifyGetKey) {
    this.jwks = jwks ?? createRemoteJWKSet(new URL(cfg.jwksUrl));
  }
  async verify(token: string): Promise<VerifiedIdentity | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.cfg.issuer,
        audience: this.cfg.audience,
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        clockTolerance: 30,
      });
      if (typeof payload.sub !== 'string' || !SUBJECT.test(payload.sub)) return null;
      const name = typeof payload.name === 'string' ? payload.name.slice(0, 80) : null;
      return { subject: `oidc:${payload.sub}`, displayName: name };
    } catch {
      return null;
    }
  }
}

/**
 * Clerk session tokens: RS256 JWTs issued by the instance's Frontend API, verified against its
 * public JWKS. Clerk session tokens carry no `aud`; browser tokens carry `azp` (the origin), which
 * must be one of the configured authorized parties. Native-app tokens have no `azp`.
 */
export class ClerkIdentityProvider implements IdentityProvider {
  readonly kind = 'clerk' as const;
  private readonly jwks: JWTVerifyGetKey;
  constructor(private readonly cfg: { issuer: string; jwksUrl: string; authorizedParties: string[] }, jwks?: JWTVerifyGetKey) {
    this.jwks = jwks ?? createRemoteJWKSet(new URL(cfg.jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
  }
  async verify(token: string): Promise<VerifiedIdentity | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.cfg.issuer, algorithms: ['RS256'], clockTolerance: 10 });
      if (typeof payload.sub !== 'string' || !SUBJECT.test(payload.sub)) return null;
      const azp = payload.azp;
      if (azp !== undefined && this.cfg.authorizedParties.length > 0 && !this.cfg.authorizedParties.includes(String(azp))) return null;
      const name = typeof payload.name === 'string' ? payload.name.slice(0, 80) : null;
      return { subject: `clerk:${payload.sub}`, displayName: name };
    } catch {
      return null;
    }
  }
}

const DEV_ISSUER = 'lahloba-dev-stub';
const DEV_AUDIENCE = 'lahloba-dev';

/**
 * DEVELOPMENT/TEST ONLY. HS256 tokens signed with a local secret. Config loading refuses this
 * provider outside development/test and without LAHLOBA_DEV_IDENTITY_STUB=true.
 * Subjects are namespaced "dev:" so they can never collide with real identities.
 */
export class DevStubIdentityProvider implements IdentityProvider {
  readonly kind = 'dev-stub' as const;
  private readonly key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }
  async issue(subject: string, displayName?: string, ttlSeconds = 8 * 3600): Promise<string> {
    return new SignJWT({ name: displayName ?? subject })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setIssuer(DEV_ISSUER)
      .setAudience(DEV_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.key);
  }
  async verify(token: string): Promise<VerifiedIdentity | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: DEV_ISSUER, audience: DEV_AUDIENCE, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || !SUBJECT.test(payload.sub)) return null;
      return { subject: `dev:${payload.sub}`, displayName: typeof payload.name === 'string' ? payload.name.slice(0, 80) : null };
    } catch {
      return null;
    }
  }
}

export function createIdentityProvider(config: ServerConfig): IdentityProvider {
  if (config.identity.kind === 'dev-stub') {
    if (config.env !== 'development' && config.env !== 'test') throw new Error('dev identity stub forbidden');
    return new DevStubIdentityProvider(config.identity.signingSecret);
  }
  if (config.identity.kind === 'clerk') return new ClerkIdentityProvider(config.identity);
  return new OidcIdentityProvider(config.identity);
}
