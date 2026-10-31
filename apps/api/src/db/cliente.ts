import pg from 'pg';

export interface ResultadoConsulta<T> {
  rows: T[];
  rowCount: number | null;
}

/** Algo que sabe ejecutar SQL (el pool, o una transacción). */
export interface Consulta {
  query<T = Record<string, unknown>>(texto: string, params?: unknown[]): Promise<ResultadoConsulta<T>>;
}

/**
 * Acceso a la base de datos. Es una interfaz mínima para poder usar `pg` en
 * producción y PGlite (Postgres en WebAssembly) en las pruebas.
 */
export interface Db extends Consulta {
  /** Ejecuta `fn` dentro de una transacción (BEGIN/COMMIT, ROLLBACK si falla). */
  tx<T>(fn: (q: Consulta) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

function envolver(ejecutor: { query: (t: string, p?: unknown[]) => Promise<pg.QueryResult> }): Consulta {
  return {
    async query<T>(texto: string, params?: unknown[]) {
      const r = await ejecutor.query(texto, params);
      return { rows: r.rows as T[], rowCount: r.rowCount };
    },
  };
}

export function crearDbPg(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Neon puede tardar unos segundos en despertar tras un periodo sin uso.
    connectionTimeoutMillis: 15_000,
  });
  // Evita que el proceso se caiga si el servidor cierra una conexión inactiva.
  pool.on('error', (err) => {
    console.error('Error en conexión inactiva de PostgreSQL:', err.message);
  });

  const base = envolver(pool);
  return {
    query: base.query,
    async tx(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await fn(envolver(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (e) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        cliente.release();
      }
    },
    cerrar: () => pool.end(),
  };
}
