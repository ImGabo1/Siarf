import bcrypt from 'bcryptjs';
import { ESPECIALIDADES_INICIALES, REGLAS_INICIALES, SINTOMAS_INICIALES } from '@siarf/expert';
import type { Db } from './cliente';

export interface OpcionesSeed {
  adminEmail?: string | undefined;
  adminPassword?: string | undefined;
}

export interface ResumenSeed {
  reglasNuevas: number;
  adminCreado: boolean;
}

/**
 * Siembra los datos iniciales. Es IDEMPOTENTE: no pisa lo que el equipo ya
 * editó (las reglas existentes, por código, no se modifican) y solo crea los
 * consultorios si la tabla está vacía.
 *
 * El contenido proviene de `packages/expert/src/conocimiento-inicial.ts`.
 */
export async function sembrarDatos(db: Db, opciones: OpcionesSeed = {}): Promise<ResumenSeed> {
  let reglasNuevas = 0;

  await db.tx(async (q) => {
    for (const e of ESPECIALIDADES_INICIALES) {
      await q.query('insert into especialidades (codigo, nombre) values ($1, $2) on conflict (codigo) do nothing', [
        e.codigo,
        e.nombre,
      ]);
    }

    const { rows } = await q.query<{ n: number }>('select count(*)::int as n from consultorios');
    if ((rows[0]?.n ?? 0) === 0) {
      for (const e of ESPECIALIDADES_INICIALES) {
        for (let i = 1; i <= e.consultorios; i++) {
          await q.query(
            `insert into consultorios (nombre, especialidad_id)
             select $1, id from especialidades where codigo = $2`,
            [`${e.nombre} ${i}`, e.codigo],
          );
        }
      }
    }

    for (const s of SINTOMAS_INICIALES) {
      await q.query('insert into sintomas (codigo, nombre, categoria) values ($1, $2, $3) on conflict (codigo) do nothing', [
        s.codigo,
        s.nombre,
        s.categoria,
      ]);
    }

    for (const r of REGLAS_INICIALES) {
      const ins = await q.query<{ id: number }>(
        `insert into reglas (codigo, descripcion, concluye_tipo, concluye_valor, cf, prioridad, urgencia)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (codigo) do nothing
         returning id`,
        [r.codigo, r.descripcion ?? null, r.concluye.tipo, r.concluye.valor, r.cf, r.prioridad, Boolean(r.urgencia)],
      );
      const id = ins.rows[0]?.id;
      if (id === undefined) continue; // ya existía
      reglasNuevas++;
      for (const hecho of r.condiciones) {
        await q.query('insert into regla_condiciones (regla_id, hecho, negada) values ($1, $2, false)', [id, hecho]);
      }
      for (const hecho of r.exclusiones ?? []) {
        await q.query('insert into regla_condiciones (regla_id, hecho, negada) values ($1, $2, true)', [id, hecho]);
      }
    }
  });

  let adminCreado = false;
  if (opciones.adminEmail && opciones.adminPassword) {
    const email = opciones.adminEmail.trim().toLowerCase();
    const existe = await db.query('select 1 from usuarios where email = $1', [email]);
    if (existe.rows.length === 0) {
      const hash = await bcrypt.hash(opciones.adminPassword, 10);
      await db.query(
        `insert into usuarios (nombre, email, password_hash, rol) values ('Administrador', $1, $2, 'admin')`,
        [email, hash],
      );
      adminCreado = true;
    }
  }

  return { reglasNuevas, adminCreado };
}
