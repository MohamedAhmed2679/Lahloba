import { z } from 'zod';

/**
 * Typed server configuration. Secrets are read from the environment only and never
 * shipped to clients. Client apps read only EXPO_PUBLIC_* / VITE_* values, which must
 * never contain secrets.
 */
export const AppEnv = z.enum(['development', 'test', 'staging', 'production']);
export type AppEnv = z.infer<typeof AppEnv>;

const csv = z
  .string()
  .default('')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const RawConfig = z.object({
  LAHLOBA_ENV: AppEnv,
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: csv,
  IDENTITY_PROVIDER: z.enum(['oidc', 'clerk', 'dev-stub']).default('oidc'),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_AUTHORIZED_PARTIES: csv,
  LAHLOBA_DEV_IDENTITY_STUB: z.string().optional(),
  DEV_STUB_SIGNING_SECRET: z.string().optional(),
  OIDC_ISSUER: z.string().optional(),
  OIDC_AUDIENCE: z.string().optional(),
  OIDC_JWKS_URL: z.string().optional(),
  EVIDENCE_STORAGE: z.enum(['disabled', 'dev-metadata-only', 'local-disk', 'vercel-blob']).default('disabled'),
  STORAGE_LOCAL_DIR: z.string().optional(),
  STORAGE_SIGNING_SECRET: z.string().optional(),
  PAYMENTS_PROVIDER: z.enum(['disabled', 'simulator']).default('disabled'),
  PAYMENTS_SIMULATOR_SECRET: z.string().optional(),
  PUBLIC_API_URL: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(2000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(8),
});

export interface ServerConfig {
  env: AppEnv;
  databaseUrl: string;
  apiHost: string;
  apiPort: number;
  corsOrigins: string[];
  identity:
    | { kind: 'oidc'; issuer: string; audience: string; jwksUrl: string }
    | { kind: 'clerk'; issuer: string; jwksUrl: string; authorizedParties: string[] }
    | { kind: 'dev-stub'; signingSecret: string };
  evidenceStorage: 'disabled' | 'dev-metadata-only' | 'local-disk' | 'vercel-blob';
  storage: { localDir: string | null; signingSecret: string | null };
  payments: { provider: 'disabled' } | { provider: 'simulator'; webhookSecret: string };
  publicApiUrl: string | null;
  worker: { pollIntervalMs: number; maxAttempts: number };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Clerk publishable keys encode the instance's Frontend API host: pk_(test|live)_<base64("host$")>.
 * The issuer of session tokens is https://<host>; its JWKS is public. No secret key is needed.
 */
export function clerkIssuerFromPublishableKey(key: string): string {
  const m = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/.exec(key.trim());
  if (!m) throw new ConfigError('CLERK_PUBLISHABLE_KEY must look like pk_test_... or pk_live_...');
  const decoded = Buffer.from(m[2]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const host = decoded.replace(/\$$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) throw new ConfigError('CLERK_PUBLISHABLE_KEY does not decode to a valid host');
  return `https://${host}`;
}

const isLocalEnv = (env: AppEnv) => env === 'development' || env === 'test';

/** Validates the environment and refuses unsafe combinations (fail closed). */
export function loadServerConfig(source: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = RawConfig.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new ConfigError(`Invalid configuration: ${fields}`);
  }
  const raw = parsed.data;
  const env = raw.LAHLOBA_ENV;

  let identity: ServerConfig['identity'];
  if (raw.IDENTITY_PROVIDER === 'dev-stub') {
    if (!isLocalEnv(env)) {
      throw new ConfigError('The development identity stub is forbidden outside development/test.');
    }
    if (raw.LAHLOBA_DEV_IDENTITY_STUB !== 'true') {
      throw new ConfigError('IDENTITY_PROVIDER=dev-stub requires LAHLOBA_DEV_IDENTITY_STUB=true (explicit flag).');
    }
    const secret = raw.DEV_STUB_SIGNING_SECRET ?? '';
    if (secret.length < 32) throw new ConfigError('DEV_STUB_SIGNING_SECRET must be at least 32 characters.');
    identity = { kind: 'dev-stub', signingSecret: secret };
  } else if (raw.IDENTITY_PROVIDER === 'clerk') {
    if (raw.LAHLOBA_DEV_IDENTITY_STUB === 'true' && !isLocalEnv(env)) {
      throw new ConfigError('LAHLOBA_DEV_IDENTITY_STUB must not be set outside development/test.');
    }
    const issuer = clerkIssuerFromPublishableKey(raw.CLERK_PUBLISHABLE_KEY ?? '');
    if (!isLocalEnv(env) && raw.CLERK_AUTHORIZED_PARTIES.length === 0) {
      throw new ConfigError('CLERK_AUTHORIZED_PARTIES (allowed web origins) is required outside development/test.');
    }
    identity = { kind: 'clerk', issuer, jwksUrl: `${issuer}/.well-known/jwks.json`, authorizedParties: raw.CLERK_AUTHORIZED_PARTIES };
  } else {
    if (raw.LAHLOBA_DEV_IDENTITY_STUB === 'true' && !isLocalEnv(env)) {
      throw new ConfigError('LAHLOBA_DEV_IDENTITY_STUB must not be set outside development/test.');
    }
    const { OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URL } = raw;
    if (!OIDC_ISSUER || !OIDC_AUDIENCE || !OIDC_JWKS_URL) {
      throw new ConfigError('OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URL are required for IDENTITY_PROVIDER=oidc.');
    }
    if (!isLocalEnv(env) && !OIDC_JWKS_URL.startsWith('https://')) {
      throw new ConfigError('OIDC_JWKS_URL must use https outside development/test.');
    }
    identity = { kind: 'oidc', issuer: OIDC_ISSUER, audience: OIDC_AUDIENCE, jwksUrl: OIDC_JWKS_URL };
  }

  if ((raw.EVIDENCE_STORAGE === 'dev-metadata-only' || raw.EVIDENCE_STORAGE === 'local-disk') && !isLocalEnv(env)) {
    throw new ConfigError(`EVIDENCE_STORAGE=${raw.EVIDENCE_STORAGE} is forbidden outside development/test.`);
  }
  const fileStorage = raw.EVIDENCE_STORAGE === 'local-disk' || raw.EVIDENCE_STORAGE === 'vercel-blob';
  if (fileStorage && (raw.STORAGE_SIGNING_SECRET ?? '').length < 32) {
    throw new ConfigError('STORAGE_SIGNING_SECRET (32+ characters) is required when files are stored.');
  }
  let payments: ServerConfig['payments'] = { provider: 'disabled' };
  if (raw.PAYMENTS_PROVIDER === 'simulator') {
    // The simulator moves no money. It must never stand in for a real provider in production.
    if (env === 'production') throw new ConfigError('PAYMENTS_PROVIDER=simulator is forbidden in production.');
    if ((raw.PAYMENTS_SIMULATOR_SECRET ?? '').length < 32) throw new ConfigError('PAYMENTS_SIMULATOR_SECRET (32+ characters) is required for the payment simulator.');
    payments = { provider: 'simulator', webhookSecret: raw.PAYMENTS_SIMULATOR_SECRET! };
  }
  if (!isLocalEnv(env) && raw.CORS_ORIGINS.some((o) => o === '*')) {
    throw new ConfigError('Wildcard CORS origin is forbidden outside development/test.');
  }

  return {
    env,
    databaseUrl: raw.DATABASE_URL,
    apiHost: raw.API_HOST,
    apiPort: raw.API_PORT,
    corsOrigins: raw.CORS_ORIGINS,
    identity,
    evidenceStorage: raw.EVIDENCE_STORAGE,
    storage: { localDir: raw.STORAGE_LOCAL_DIR ?? null, signingSecret: fileStorage ? raw.STORAGE_SIGNING_SECRET! : null },
    payments,
    publicApiUrl: raw.PUBLIC_API_URL ?? null,
    worker: { pollIntervalMs: raw.WORKER_POLL_INTERVAL_MS, maxAttempts: raw.WORKER_MAX_ATTEMPTS },
  };
}

/** Redacted view for logs. Never log the full config. */
export function describeConfig(c: ServerConfig) {
  return {
    env: c.env,
    apiHost: c.apiHost,
    apiPort: c.apiPort,
    identity: c.identity.kind,
    evidenceStorage: c.evidenceStorage,
    payments: c.payments.provider,
    corsOrigins: c.corsOrigins,
  };
}
