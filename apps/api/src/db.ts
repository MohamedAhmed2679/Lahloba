import pg from 'pg';

// int8 -> number only when it is a safe integer; otherwise fail loudly rather than lose precision.
pg.types.setTypeParser(20, (v: string) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new RangeError('bigint value exceeds safe integer range');
  return n;
});
// numeric -> number (quantities are stored with 4 decimals; money is never numeric).
pg.types.setTypeParser(1700, (v: string) => Number(v));
// date -> ISO date string, not a timezone-shifted Date.
pg.types.setTypeParser(1082, (v: string) => v);

export type Pool = pg.Pool;
export type DbClient = pg.PoolClient;
export type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString, max, application_name: 'lahloba-api' });
}

/** Runs fn in a transaction. External network calls must NOT happen inside (doc 05 §5.4). */
export async function withTx<T>(pool: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
