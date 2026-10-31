import type { FastifyInstance } from 'fastify';
import {
  CASOS_VALIDACION,
  HECHOS_DE_EDAD,
  evaluarCasos,
  validarReglas,
  type ReglaExperta,
} from '@siarf/expert';
import {
  actualizarReglaSchema,
  crearReglaSchema,
  type ProblemaReglaDto,
  type ReglaDto,
} from '@siarf/shared';
import type { Requerir } from '../auth/guardas';
import { ErrorHttp, parsear, parsearId } from '../errores';
import { cargarNombres, cargarReglas } from '../servicios/experto';

interface FilaRegla {
  id: number;
  codigo: string;
  descripcion: string | null;
  concluye_tipo: 'especialidad' | 'hecho';
  concluye_valor: string;
  cf: string;
  prioridad: number;
  urgencia: boolean;
  activa: boolean;
}

/** Edición de la base de conocimiento (solo admin). */
export async function rutasReglas(app: FastifyInstance, requerir: Requerir) {
  const soloAdmin = { preHandler: requerir('admin') };

  async function listar(id?: number): Promise<ReglaDto[]> {
    const { rows } = await app.db.query<FilaRegla>(
      `select id, codigo, descripcion, concluye_tipo, concluye_valor, cf, prioridad, urgencia, activa
         from reglas ${id ? 'where id = $1' : ''} order by codigo`,
      id ? [id] : [],
    );
    const conds = await app.db.query<{ regla_id: number; hecho: string; negada: boolean }>(
      'select regla_id, hecho, negada from regla_condiciones order by regla_id, hecho',
    );
    return rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      concluyeTipo: r.concluye_tipo,
      concluyeValor: r.concluye_valor,
      cf: Number(r.cf),
      prioridad: r.prioridad,
      urgencia: r.urgencia,
      activa: r.activa,
      condiciones: conds.rows.filter((c) => c.regla_id === r.id && !c.negada).map((c) => c.hecho),
      exclusiones: conds.rows.filter((c) => c.regla_id === r.id && c.negada).map((c) => c.hecho),
    }));
  }

  /** Revisa la base de conocimiento actual (duplicados, CF inválidos, ciclos, hechos desconocidos). */
  async function revisar(reglas: ReglaExperta[]): Promise<ProblemaReglaDto[]> {
    const [s, e] = await Promise.all([
      app.db.query<{ codigo: string }>('select codigo from sintomas'),
      app.db.query<{ codigo: string }>('select codigo from especialidades'),
    ]);
    return validarReglas(reglas, {
      sintomas: s.rows.map((x) => x.codigo),
      especialidades: e.rows.map((x) => x.codigo),
      hechosExtra: HECHOS_DE_EDAD,
    });
  }

  app.get('/reglas', soloAdmin, async () => listar());

  app.post('/reglas', soloAdmin, async (req, reply) => {
    const d = parsear(crearReglaSchema, req.body);

    // Validar la regla nueva junto con las existentes antes de guardarla.
    const actuales = await cargarReglas(app.db);
    const candidata: ReglaExperta = {
      codigo: d.codigo,
      ...(d.descripcion ? { descripcion: d.descripcion } : {}),
      condiciones: d.condiciones,
      exclusiones: d.exclusiones,
      concluye: { tipo: d.concluyeTipo, valor: d.concluyeValor },
      cf: d.cf,
      prioridad: d.prioridad,
      urgencia: d.urgencia,
    };
    const errores = (await revisar([...actuales, candidata])).filter((p) => p.nivel === 'error');
    if (errores.length > 0) throw new ErrorHttp(400, 'La regla genera errores en la base de conocimiento', errores);

    try {
      const id = await app.db.tx(async (q) => {
        const r = await q.query<{ id: number }>(
          `insert into reglas (codigo, descripcion, concluye_tipo, concluye_valor, cf, prioridad, urgencia, activa)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [d.codigo, d.descripcion ?? null, d.concluyeTipo, d.concluyeValor, d.cf, d.prioridad, d.urgencia, d.activa],
        );
        const nuevo = r.rows[0]!.id;
        for (const h of d.condiciones)
          await q.query('insert into regla_condiciones (regla_id, hecho, negada) values ($1, $2, false) on conflict do nothing', [nuevo, h]);
        for (const h of d.exclusiones)
          await q.query('insert into regla_condiciones (regla_id, hecho, negada) values ($1, $2, true) on conflict do nothing', [nuevo, h]);
        return nuevo;
      });
      reply.code(201);
      return (await listar(id))[0];
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') throw new ErrorHttp(409, 'Ya existe una regla con ese código');
      throw e;
    }
  });

  app.patch('/reglas/:id', soloAdmin, async (req) => {
    const id = parsearId(req.params);
    const d = parsear(actualizarReglaSchema, req.body);
    const sets: string[] = [];
    const params: unknown[] = [];
    const agregar = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (d.descripcion !== undefined) agregar('descripcion', d.descripcion);
    if (d.cf !== undefined) agregar('cf', d.cf);
    if (d.prioridad !== undefined) agregar('prioridad', d.prioridad);
    if (d.urgencia !== undefined) agregar('urgencia', d.urgencia);
    if (d.activa !== undefined) agregar('activa', d.activa);
    if (sets.length === 0) throw new ErrorHttp(400, 'No hay cambios');
    params.push(id);
    const r = await app.db.query(`update reglas set ${sets.join(', ')} where id = $${params.length} returning id`, params);
    if (r.rows.length === 0) throw new ErrorHttp(404, 'Regla no encontrada');
    return (await listar(id))[0];
  });

  app.get('/reglas/validar', soloAdmin, async (): Promise<ProblemaReglaDto[]> => revisar(await cargarReglas(app.db)));

  /**
   * Exactitud del sistema experto contra los casos clínicos de ejemplo
   * (packages/expert/src/casos-validacion.ts). Útil para la sección de
   * resultados del artículo, una vez que el médico valide los casos.
   */
  app.get('/reglas/evaluar-casos', soloAdmin, async () => {
    const [reglas, nombres] = await Promise.all([cargarReglas(app.db), cargarNombres(app.db)]);
    return evaluarCasos(reglas, CASOS_VALIDACION, { nombres, especialidadPorDefecto: 'medicina_general' });
  });
}
