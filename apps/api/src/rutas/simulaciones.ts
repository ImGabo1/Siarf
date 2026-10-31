import type { FastifyInstance } from 'fastify';
import {
  ESPECIALIDADES_SIM_DEFECTO,
  compararEscenarios,
  configPorDefecto,
  simular,
  type SimConfig,
} from '@siarf/sim';
import {
  compararSimulacionSchema,
  crearSimulacionSchema,
  type SimConfigInput,
  type SimulacionResumenDto,
} from '@siarf/shared';
import type { Requerir } from '../auth/guardas';
import { ErrorHttp, parsear, parsearId } from '../errores';

/** Convierte la entrada validada (con opcionales explícitos) al tipo que usa el simulador. */
function aSimConfig(c: SimConfigInput): SimConfig {
  return {
    semilla: c.semilla,
    duracionMin: c.duracionMin,
    llegadasPorHora: c.llegadasPorHora,
    perfilHorario: c.perfilHorario,
    puestosRecepcion: c.puestosRecepcion,
    registroMin: c.registroMin,
    proporcionUrgentes: c.proporcionUrgentes,
    especialidades: c.especialidades,
  };
}

/** Simulaciones del panel de administración. */
export async function rutasSimulaciones(app: FastifyInstance, requerir: Requerir) {
  const soloAdmin = { preHandler: requerir('admin') };

  /**
   * Configuración de partida: los consultorios salen de la base de datos real
   * (las especialidades y consultorios activos); el resto son supuestos por defecto.
   */
  app.get('/simulaciones/parametros', soloAdmin, async (): Promise<SimConfig> => {
    const { rows } = await app.db.query<{ codigo: string; nombre: string; consultorios: number }>(
      `select e.codigo, e.nombre, count(c.id)::int as consultorios
         from especialidades e left join consultorios c on c.especialidad_id = e.id and c.activo
        where e.activa group by e.id order by e.nombre`,
    );
    const base = configPorDefecto();
    const defecto = new Map(ESPECIALIDADES_SIM_DEFECTO.map((e) => [e.codigo, e]));
    return {
      ...base,
      especialidades: rows
        .filter((r) => r.consultorios > 0)
        .map((r) => {
          const d = defecto.get(r.codigo);
          return {
            codigo: r.codigo,
            nombre: r.nombre,
            peso: d?.peso ?? 0.05,
            consultorios: r.consultorios,
            consultaMin: d?.consultaMin ?? { media: 15, desv: 5 },
          };
        }),
    };
  });

  /** Ejecuta, guarda y devuelve una simulación (con la línea de tiempo para animarla). */
  app.post('/simulaciones', soloAdmin, async (req, reply) => {
    const d = parsear(crearSimulacionSchema, req.body);
    let resultado;
    try {
      resultado = simular(aSimConfig(d.config));
    } catch (e) {
      throw new ErrorHttp(400, e instanceof Error ? e.message : 'Configuración inválida');
    }
    const { timeline, ...resumen } = resultado;
    const nombre = d.nombre?.trim() || `Simulación ${new Date().toLocaleString('es-VE', { timeZone: app.config.tzNegocio })}`;
    const { rows } = await app.db.query<{ id: number; creado_en: Date }>(
      `insert into simulaciones (nombre, creada_por, parametros, resultados, linea_tiempo)
       values ($1, $2, $3, $4, $5) returning id, creado_en`,
      [nombre, req.usuario!.sub, JSON.stringify(d.config), JSON.stringify(resumen), JSON.stringify(timeline)],
    );
    reply.code(201);
    return { id: rows[0]!.id, nombre, config: d.config, resultado };
  });

  /**
   * Compara la configuración base contra escenarios "qué pasaría si…",
   * promediando varias réplicas por escenario. No se guarda.
   */
  app.post('/simulaciones/comparar', soloAdmin, async (req) => {
    const d = parsear(compararSimulacionSchema, req.body);
    try {
      return compararEscenarios(aSimConfig(d.base), d.escenarios, d.replicas);
    } catch (e) {
      throw new ErrorHttp(400, e instanceof Error ? e.message : 'Configuración inválida');
    }
  });

  app.get('/simulaciones', soloAdmin, async (): Promise<SimulacionResumenDto[]> => {
    const { rows } = await app.db.query<{
      id: number;
      nombre: string;
      creado_en: Date;
      resultados: { llegados: number; atendidos: number; cuelloBotella: { nombre: string } | null };
    }>('select id, nombre, creado_en, resultados from simulaciones order by id desc limit 50');
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      creadoEn: r.creado_en.toISOString(),
      llegados: r.resultados.llegados,
      atendidos: r.resultados.atendidos,
      cuelloBotella: r.resultados.cuelloBotella?.nombre ?? null,
    }));
  });

  app.get('/simulaciones/:id', soloAdmin, async (req) => {
    const id = parsearId(req.params);
    const { rows } = await app.db.query<{
      id: number;
      nombre: string;
      parametros: SimConfigInput;
      resultados: object;
      linea_tiempo: unknown[];
    }>('select id, nombre, parametros, resultados, linea_tiempo from simulaciones where id = $1', [id]);
    const f = rows[0];
    if (!f) throw new ErrorHttp(404, 'Simulación no encontrada');
    return { id: f.id, nombre: f.nombre, config: f.parametros, resultado: { ...f.resultados, timeline: f.linea_tiempo } };
  });
}
