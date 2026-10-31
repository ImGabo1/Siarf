import { hechosPorEdad, inferir, type OpcionesMotor, type ReglaExperta, type Recomendacion } from '@siarf/expert';
import type { RecomendacionDto, SintomaEntrada } from '@siarf/shared';
import type { Consulta } from '../db/cliente';

interface FilaRegla {
  id: number;
  codigo: string;
  descripcion: string | null;
  concluye_tipo: 'especialidad' | 'hecho';
  concluye_valor: string;
  cf: string; // numeric llega como texto
  prioridad: number;
  urgencia: boolean;
}

/** Carga de la base de datos las reglas ACTIVAS con sus condiciones y exclusiones. */
export async function cargarReglas(q: Consulta): Promise<ReglaExperta[]> {
  const reglas = await q.query<FilaRegla>(
    `select id, codigo, descripcion, concluye_tipo, concluye_valor, cf, prioridad, urgencia
       from reglas where activa order by codigo`,
  );
  const conds = await q.query<{ regla_id: number; hecho: string; negada: boolean }>(
    `select rc.regla_id, rc.hecho, rc.negada
       from regla_condiciones rc join reglas r on r.id = rc.regla_id
      where r.activa
      order by rc.regla_id, rc.hecho`,
  );
  const porRegla = new Map<number, { condiciones: string[]; exclusiones: string[] }>();
  for (const c of conds.rows) {
    const e = porRegla.get(c.regla_id) ?? { condiciones: [], exclusiones: [] };
    (c.negada ? e.exclusiones : e.condiciones).push(c.hecho);
    porRegla.set(c.regla_id, e);
  }
  return reglas.rows.map((r): ReglaExperta => {
    const c = porRegla.get(r.id) ?? { condiciones: [], exclusiones: [] };
    return {
      codigo: r.codigo,
      ...(r.descripcion ? { descripcion: r.descripcion } : {}),
      condiciones: c.condiciones,
      exclusiones: c.exclusiones,
      concluye: { tipo: r.concluye_tipo, valor: r.concluye_valor },
      cf: Number(r.cf),
      prioridad: r.prioridad,
      urgencia: r.urgencia,
    };
  });
}

/** Nombres legibles (síntomas y especialidades) para las explicaciones. */
export async function cargarNombres(q: Consulta): Promise<Record<string, string>> {
  const s = await q.query<{ codigo: string; nombre: string }>('select codigo, nombre from sintomas');
  const e = await q.query<{ codigo: string; nombre: string }>('select codigo, nombre from especialidades');
  return Object.fromEntries([...s.rows, ...e.rows].map((x) => [x.codigo, x.nombre]));
}

export interface ResultadoInferencia {
  recomendacion: Recomendacion;
  dto: RecomendacionDto;
}

/** Ejecuta el sistema experto con las reglas y nombres vigentes en la base de datos. */
export async function evaluarSintomas(
  q: Consulta,
  sintomas: SintomaEntrada[],
  edad: number | undefined,
): Promise<ResultadoInferencia> {
  const [reglas, nombres, esp] = await Promise.all([
    cargarReglas(q),
    cargarNombres(q),
    q.query<{ id: number; codigo: string }>('select id, codigo from especialidades where activa'),
  ]);
  const idPorCodigo = new Map(esp.rows.map((e) => [e.codigo, e.id]));

  const opciones: OpcionesMotor = { nombres, especialidadPorDefecto: 'medicina_general' };
  const recomendacion = inferir(
    reglas,
    {
      sintomas: sintomas.map((s) => ({
        codigo: s.codigo,
        intensidad: s.intensidad,
        ...(s.duracionDias !== undefined ? { duracionDias: s.duracionDias } : {}),
      })),
      hechosExtra: hechosPorEdad(edad),
    },
    opciones,
  );

  const dto: RecomendacionDto = {
    especialidades: recomendacion.especialidades.map((e) => ({
      especialidad: e.especialidad,
      nombre: nombres[e.especialidad] ?? e.especialidad,
      especialidadId: idPorCodigo.get(e.especialidad) ?? null,
      certeza: e.certeza,
      reglas: e.reglas,
    })),
    urgente: recomendacion.urgente,
    hechosDerivados: recomendacion.hechosDerivados,
    explicacion: recomendacion.explicacion,
    sinCoincidencia: recomendacion.sinCoincidencia,
    advertencia: recomendacion.advertencia,
  };
  return { recomendacion, dto };
}

/** Edad en años cumplidos a partir de la fecha de nacimiento (AAAA-MM-DD). */
export function calcularEdad(fechaNacimiento: string, hoy = new Date()): number {
  const [a, m, d] = fechaNacimiento.split('-').map(Number) as [number, number, number];
  let edad = hoy.getUTCFullYear() - a;
  const cumpleEsteAno = hoy.getUTCMonth() + 1 > m || (hoy.getUTCMonth() + 1 === m && hoy.getUTCDate() >= d);
  if (!cumpleEsteAno) edad--;
  return Math.max(0, edad);
}
