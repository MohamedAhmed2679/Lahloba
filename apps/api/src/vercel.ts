import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { loadServerConfig } from '@lahloba/config';
import { buildApp } from './app';
import { createPool } from './db';
import { createIdentityProvider } from './identity/provider';
import { createEvidenceStorage } from './storage/evidence';

/**
 * Vercel Function entry: one Fastify instance per warm instance, requests forwarded to it.
 * The dev identity stub is refused outside development/test by the config loader itself.
 */
let ready: Promise<FastifyInstance> | null = null;
function app(): Promise<FastifyInstance> {
  if (!ready) {
    ready = (async () => {
      const config = loadServerConfig();
      const pool = createPool(config.databaseUrl, 5);
      const a = await buildApp({
        config, pool, identity: createIdentityProvider(config),
        evidence: createEvidenceStorage(config.evidenceStorage, { localDir: config.storage.localDir ?? undefined }),
        logger: true,
      });
      await a.ready();
      return a;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const a = await app();
    a.server.emit('request', req, res);
  } catch (e) {
    console.error(JSON.stringify({ msg: 'api failed to start', error: (e as Error).message }));
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Service is starting or misconfigured' } }));
  }
}
