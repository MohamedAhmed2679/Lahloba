import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

interface Migration { id: string; up: string; down: string; checksum: string }

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir);
  const ids = [...new Set(files.filter((f) => f.endsWith('.up.sql')).map((f) => f.replace(/\.up\.sql$/, '')))].sort();
  return ids.map((id) => {
    const up = readFileSync(join(dir, `${id}.up.sql`), 'utf8');
    if (!files.includes(`${id}.down.sql`)) throw new Error(`Migration ${id} is missing its .down.sql rollback`);
    const down = readFileSync(join(dir, `${id}.down.sql`), 'utf8');
    return { id, up, down, checksum: createHash('sha256').update(up).digest('hex') };
  });
}

const LOCK_ID = 727274; // advisory lock: one migrator at a time

async function ensureTable(c: pg.ClientBase) {
  await c.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
}

/** Applies pending migrations, each in its own transaction. Refuses if an applied file changed. */
export async function migrateUp(client: pg.ClientBase, dir?: string): Promise<string[]> {
  const migrations = loadMigrations(dir);
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
  try {
    await ensureTable(client);
    const applied = new Map((await client.query<{ id: string; checksum: string }>('SELECT id, checksum FROM schema_migrations')).rows.map((r) => [r.id, r.checksum]));
    for (const [id, sum] of applied) {
      const m = migrations.find((x) => x.id === id);
      if (!m) throw new Error(`Applied migration ${id} is missing from disk`);
      if (m.checksum !== sum) throw new Error(`Applied migration ${id} was modified after being applied`);
    }
    const done: string[] = [];
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.up);
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [m.id, m.checksum]);
        await client.query('COMMIT');
        done.push(m.id);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${m.id} failed: ${(e as Error).message}`);
      }
    }
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
  }
}

/** Rolls back the most recent `steps` migrations. Destructive; dev/disposable or reviewed recovery only. */
export async function migrateDown(client: pg.ClientBase, steps = 1, dir?: string): Promise<string[]> {
  const migrations = loadMigrations(dir);
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
  try {
    await ensureTable(client);
    const applied = (await client.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id DESC LIMIT $1', [steps])).rows;
    const done: string[] = [];
    for (const { id } of applied) {
      const m = migrations.find((x) => x.id === id);
      if (!m) throw new Error(`Cannot roll back ${id}: file missing`);
      await client.query('BEGIN');
      try {
        await client.query(m.down);
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [id]);
        await client.query('COMMIT');
        done.push(id);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Rollback ${id} failed: ${(e as Error).message}`);
      }
    }
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
  }
}
