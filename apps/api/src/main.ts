import { describeConfig, loadServerConfig } from '@lahloba/config';
import { buildApp } from './app';
import { createPool } from './db';
import { createIdentityProvider } from './identity/provider';
import { createEvidenceStorage } from './storage/evidence';

const config = loadServerConfig();
const pool = createPool(config.databaseUrl);
const app = await buildApp({
  config,
  pool,
  identity: createIdentityProvider(config),
  evidence: createEvidenceStorage(config.evidenceStorage),
  logger: true,
});
app.log.info({ config: describeConfig(config) }, 'starting Lahloba API');
if (config.identity.kind === 'dev-stub') app.log.warn('DEVELOPMENT IDENTITY STUB ENABLED — never expose this server publicly');

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.apiHost, port: config.apiPort });
