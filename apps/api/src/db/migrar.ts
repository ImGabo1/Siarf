import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './cliente';

/** Busca db/migrations subiendo desde distintos puntos de partida. */
export function encontrarCarpetaMigraciones(): string {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const candidatas = [
    process.env['MIGRATIONS_DIR'],
    path.resolve(process.cwd(), 'db/migrations'),
    path.resolve(process.cwd(), '../../db/migrations'),
    path.resolve(aqui, '../../../../db/migrations'), // desde src/db/
    path.resolve(aqui, '../../../db/migrations'), // desde dist/
  ].filter((c): c is string => Boolean(c));
  const encontrada = candidatas.find((c) => existsSync(c));
  if (!encontrada) {
    throw new Error(`No se encontró la carpeta db/migrations. Probé:\n${candidatas.join('\n')}`);
  }
  return encontrada;
}

/**
 * Aplica las migraciones .sql pendientes, en orden alfabético, cada una en su
 * transacción. Devuelve los nombres de las que se aplicaron ahora.
 */
export async function ejecutarMigraciones(db: Db, carpeta = encontrarCarpetaMigraciones()): Promise<string[]> {
  await db.query(
    `create table if not exists migraciones (
       nombre text primary key,
       aplicada_en timestamptz not null default now()
     )`,
  );
  const hechas = new Set(
    (await db.query<{ nombre: string }>('select nombre from migraciones')).rows.map((r) => r.nombre),
  );
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();

  const nuevas: string[] = [];
  for (const archivo of archivos) {
    if (hechas.has(archivo)) continue;
    const sql = await readFile(path.join(carpeta, archivo), 'utf8');
    await db.tx(async (q) => {
      await q.query(sql);
      await q.query('insert into migraciones (nombre) values ($1)', [archivo]);
    });
    nuevas.push(archivo);
  }
  return nuevas;
}
