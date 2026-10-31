import type { FastifyInstance } from 'fastify';
import type { MetricasRealesDto } from '@siarf/shared';
import type { Requerir } from '../auth/guardas';

const numero = (v: string | null): number | null => (v === null ? null : Math.round(Number(v) * 10) / 10);

/**
 * Métricas del flujo REAL (visitas registradas en el sistema). Sirven para
 * comparar con la simulación y para calibrar sus parámetros.
 */
export async function rutasMetricas(app: FastifyInstance, requerir: Requerir) {
  app.get('/metricas', { preHandler: requerir('admin') }, async (req): Promise<MetricasRealesDto> => {
    const dias = Math.min(365, Math.max(1, Number((req.query as { dias?: unknown } | undefined)?.dias) || 7));
    const desde = new Date(Date.now() - dias * 86_400_000);
    const tz = app.config.tzNegocio;

    const [global, porEsp, porHora] = await Promise.all([
      app.db.query<{ total: number; atendidas: number; espera: string | null; consulta: string | null }>(
        `select count(*)::int as total,
                count(*) filter (where estado = 'atendida')::int as atendidas,
                avg(extract(epoch from (hora_inicio_consulta - hora_llegada)) / 60)::text as espera,
                avg(extract(epoch from (hora_fin_consulta - hora_inicio_consulta)) / 60)::text as consulta
           from visitas where hora_llegada >= $1 and estado <> 'cancelada'`,
        [desde],
      ),
      app.db.query<{ codigo: string; nombre: string; total: number; espera: string | null; consulta: string | null }>(
        `select e.codigo, e.nombre, count(v.id)::int as total,
                avg(extract(epoch from (v.hora_inicio_consulta - v.hora_llegada)) / 60)::text as espera,
                avg(extract(epoch from (v.hora_fin_consulta - v.hora_inicio_consulta)) / 60)::text as consulta
           from especialidades e
           left join visitas v on v.especialidad_asignada_id = e.id and v.hora_llegada >= $1 and v.estado <> 'cancelada'
          where e.activa group by e.id order by total desc, e.nombre`,
        [desde],
      ),
      app.db.query<{ hora: number; total: number }>(
        `select extract(hour from hora_llegada at time zone $2)::int as hora, count(*)::int as total
           from visitas where hora_llegada >= $1 and estado <> 'cancelada'
          group by 1 order by 1`,
        [desde, tz],
      ),
    ]);

    const g = global.rows[0]!;
    return {
      desde: desde.toISOString(),
      total: g.total,
      atendidas: g.atendidas,
      esperaPromedioMin: numero(g.espera),
      consultaPromedioMin: numero(g.consulta),
      porEspecialidad: porEsp.rows.map((r) => ({
        codigo: r.codigo,
        nombre: r.nombre,
        total: r.total,
        esperaPromedioMin: numero(r.espera),
        consultaPromedioMin: numero(r.consulta),
      })),
      porHora: porHora.rows,
    };
  });
}
