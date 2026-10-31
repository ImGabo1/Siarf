import type { FastifyInstance } from 'fastify';
import {
  cerrarVisitaSchema,
  crearVisitaSchema,
  inferenciaSchema,
  type EstadoVisita,
  type Prioridad,
  type RecomendacionDto,
  type VisitaColaDto,
  type VisitaCreadaDto,
  type VisitaDetalleDto,
} from '@siarf/shared';
import type { Requerir } from '../auth/guardas';
import { ErrorHttp, parsear, parsearId } from '../errores';
import { calcularEdad, evaluarSintomas } from '../servicios/experto';
import { pacienteDto } from './pacientes';

const UNIQUE = '23505';
const FOREIGN_KEY = '23503';
const codigoPg = (e: unknown) => (e as { code?: string })?.code;

interface FilaCola {
  id: number;
  paciente_nombre: string;
  cedula: string;
  fecha_nacimiento: string;
  especialidad_id: number;
  especialidad_codigo: string;
  especialidad_nombre: string;
  prioridad: Prioridad;
  estado: EstadoVisita;
  hora_llegada: Date;
  minutos_espera: string;
}

export async function rutasVisitas(app: FastifyInstance, requerir: Requerir) {
  const recepcion = { preHandler: requerir('admin', 'recepcionista') };
  const doctor = { preHandler: requerir('doctor') };
  const lectura = { preHandler: requerir('admin', 'recepcionista', 'doctor') };

  /** Vista previa: ejecuta el sistema experto sin guardar nada. */
  app.post('/inferencia', recepcion, async (req): Promise<RecomendacionDto> => {
    const d = parsear(inferenciaSchema, req.body);
    let edad = d.edad;
    if (d.pacienteId !== undefined) {
      const { rows } = await app.db.query<{ f: string }>(
        `select to_char(fecha_nacimiento, 'YYYY-MM-DD') as f from pacientes where id = $1`,
        [d.pacienteId],
      );
      if (!rows[0]) throw new ErrorHttp(404, 'Paciente no encontrado');
      edad = calcularEdad(rows[0].f);
    }
    return (await evaluarSintomas(app.db, d.sintomas, edad)).dto;
  });

  /** Registra la llegada del paciente: guarda síntomas, aplica el sistema experto y lo encola. */
  app.post('/visitas', recepcion, async (req, reply): Promise<VisitaCreadaDto> => {
    const d = parsear(crearVisitaSchema, req.body);

    const pac = await app.db.query<{ f: string }>(
      `select to_char(fecha_nacimiento, 'YYYY-MM-DD') as f from pacientes where id = $1`,
      [d.pacienteId],
    );
    if (!pac.rows[0]) throw new ErrorHttp(404, 'Paciente no encontrado');

    const codigos = [...new Set(d.sintomas.map((s) => s.codigo))];
    if (codigos.length !== d.sintomas.length) throw new ErrorHttp(400, 'Hay síntomas repetidos');
    const conocidos = await app.db.query<{ codigo: string }>('select codigo from sintomas where codigo = any($1::text[])', [codigos]);
    const faltan = codigos.filter((c) => !conocidos.rows.some((r) => r.codigo === c));
    if (faltan.length > 0) throw new ErrorHttp(400, `Síntomas desconocidos: ${faltan.join(', ')}`);

    const { recomendacion, dto } = await evaluarSintomas(app.db, d.sintomas, calcularEdad(pac.rows[0].f));

    const sugerida = dto.especialidades[0];
    const especialidadId = d.especialidadAsignadaId ?? sugerida?.especialidadId;
    if (!especialidadId) throw new ErrorHttp(400, 'No se pudo determinar la especialidad; indique especialidadAsignadaId');
    const esp = await app.db.query<{ nombre: string }>('select nombre from especialidades where id = $1 and activa', [especialidadId]);
    if (!esp.rows[0]) throw new ErrorHttp(400, 'Especialidad inexistente');

    const prioridad: Prioridad = recomendacion.urgente || d.forzarUrgente ? 'urgente' : 'normal';

    try {
      const id = await app.db.tx(async (q) => {
        const v = await q.query<{ id: number }>(
          `insert into visitas (paciente_id, registrada_por, especialidad_sugerida, especialidad_asignada_id, prioridad)
           values ($1, $2, $3, $4, $5) returning id`,
          [d.pacienteId, req.usuario!.sub, sugerida?.especialidad ?? null, especialidadId, prioridad],
        );
        const visitaId = v.rows[0]!.id;
        for (const s of d.sintomas) {
          await q.query(
            'insert into visita_sintomas (visita_id, sintoma_codigo, intensidad, duracion_dias) values ($1, $2, $3, $4)',
            [visitaId, s.codigo, s.intensidad, s.duracionDias ?? null],
          );
        }
        for (const disp of recomendacion.disparos) {
          await q.query(
            `insert into visita_inferencias (visita_id, regla_codigo, conclusion, cf, explicacion)
             values ($1, $2, $3, $4, $5)`,
            [visitaId, disp.regla, `${disp.concluye.tipo}:${disp.concluye.valor}`, disp.cf, disp.explicacion],
          );
        }
        return visitaId;
      });
      reply.code(201);
      return { id, prioridad, especialidadId, especialidadNombre: esp.rows[0].nombre, recomendacion: dto };
    } catch (e) {
      if (codigoPg(e) === UNIQUE) throw new ErrorHttp(409, 'El paciente ya tiene una visita activa');
      if (codigoPg(e) === FOREIGN_KEY) throw new ErrorHttp(400, 'Referencia inválida (paciente, síntoma o especialidad)');
      throw e;
    }
  });

  /**
   * Cola de espera. Un doctor ve la de su especialidad (más lo que está
   * atendiendo); recepción/admin ven todas o filtran con ?especialidadId=.
   */
  app.get('/visitas/cola', lectura, async (req): Promise<VisitaColaDto[]> => {
    const u = req.usuario!;
    let especialidadId: number | null = null;
    if (u.rol === 'doctor') {
      const r = await app.db.query<{ especialidad_id: number }>('select especialidad_id from doctores where usuario_id = $1', [u.sub]);
      if (!r.rows[0]) throw new ErrorHttp(400, 'El doctor no tiene especialidad asignada');
      especialidadId = r.rows[0].especialidad_id;
    } else {
      const q = Number((req.query as { especialidadId?: unknown } | undefined)?.especialidadId);
      if (Number.isInteger(q) && q > 0) especialidadId = q;
    }

    const { rows } = await app.db.query<FilaCola>(
      `select v.id, p.nombre as paciente_nombre, p.cedula,
              to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento,
              e.id as especialidad_id, e.codigo as especialidad_codigo, e.nombre as especialidad_nombre,
              v.prioridad, v.estado, v.hora_llegada,
              round(extract(epoch from (now() - v.hora_llegada)) / 60)::text as minutos_espera
         from visitas v
         join pacientes p on p.id = v.paciente_id
         join especialidades e on e.id = v.especialidad_asignada_id
        where v.estado in ('espera', 'en_consulta')
          and ($1::int is null or v.especialidad_asignada_id = $1)
          and (v.estado = 'espera' or $2::int is null or v.doctor_id = $2)
        order by (v.estado = 'en_consulta') desc, (v.prioridad = 'urgente') desc, v.hora_llegada
        limit 200`,
      [especialidadId, u.rol === 'doctor' ? u.sub : null],
    );
    return rows.map((f) => ({
      id: f.id,
      pacienteNombre: f.paciente_nombre,
      cedula: f.cedula,
      edad: calcularEdad(f.fecha_nacimiento),
      especialidadId: f.especialidad_id,
      especialidadCodigo: f.especialidad_codigo,
      especialidadNombre: f.especialidad_nombre,
      prioridad: f.prioridad,
      estado: f.estado,
      horaLlegada: f.hora_llegada.toISOString(),
      minutosEspera: Number(f.minutos_espera),
    }));
  });

  /** Historia de la visita: paciente, síntomas, explicación del sistema experto y consultas previas. */
  app.get('/visitas/:id', lectura, async (req): Promise<VisitaDetalleDto> => {
    const id = parsearId(req.params);
    const v = await app.db.query<{
      id: number;
      estado: EstadoVisita;
      prioridad: Prioridad;
      hora_llegada: Date;
      hora_inicio_consulta: Date | null;
      hora_fin_consulta: Date | null;
      especialidad_id: number;
      especialidad_codigo: string;
      especialidad_nombre: string;
      especialidad_sugerida: string | null;
      doctor_nombre: string | null;
      diagnostico: string | null;
      notas: string | null;
      paciente_id: number;
      cedula: string;
      pnombre: string;
      fecha_nacimiento: string;
      sexo: 'F' | 'M';
      telefono: string | null;
    }>(
      `select v.id, v.estado, v.prioridad, v.hora_llegada, v.hora_inicio_consulta, v.hora_fin_consulta,
              e.id as especialidad_id, e.codigo as especialidad_codigo, e.nombre as especialidad_nombre,
              v.especialidad_sugerida, d.nombre as doctor_nombre, v.diagnostico, v.notas,
              p.id as paciente_id, p.cedula, p.nombre as pnombre,
              to_char(p.fecha_nacimiento, 'YYYY-MM-DD') as fecha_nacimiento, p.sexo, p.telefono
         from visitas v
         join pacientes p on p.id = v.paciente_id
         join especialidades e on e.id = v.especialidad_asignada_id
         left join usuarios d on d.id = v.doctor_id
        where v.id = $1`,
      [id],
    );
    const f = v.rows[0];
    if (!f) throw new ErrorHttp(404, 'Visita no encontrada');

    const [sintomas, inferencias, historial] = await Promise.all([
      app.db.query<{ codigo: string; nombre: string; intensidad: number; duracion_dias: number | null }>(
        `select s.codigo, s.nombre, vs.intensidad, vs.duracion_dias
           from visita_sintomas vs join sintomas s on s.codigo = vs.sintoma_codigo
          where vs.visita_id = $1 order by vs.intensidad desc, s.nombre`,
        [id],
      ),
      app.db.query<{ regla_codigo: string; conclusion: string; cf: string; explicacion: string }>(
        'select regla_codigo, conclusion, cf, explicacion from visita_inferencias where visita_id = $1 order by cf desc, regla_codigo',
        [id],
      ),
      app.db.query<{ id: number; hora_llegada: Date; especialidad: string; estado: EstadoVisita; diagnostico: string | null }>(
        `select v.id, v.hora_llegada, e.nombre as especialidad, v.estado, v.diagnostico
           from visitas v join especialidades e on e.id = v.especialidad_asignada_id
          where v.paciente_id = $1 and v.id <> $2 order by v.hora_llegada desc limit 10`,
        [f.paciente_id, id],
      ),
    ]);

    return {
      id: f.id,
      estado: f.estado,
      prioridad: f.prioridad,
      horaLlegada: f.hora_llegada.toISOString(),
      horaInicioConsulta: f.hora_inicio_consulta?.toISOString() ?? null,
      horaFinConsulta: f.hora_fin_consulta?.toISOString() ?? null,
      especialidadId: f.especialidad_id,
      especialidadCodigo: f.especialidad_codigo,
      especialidadNombre: f.especialidad_nombre,
      especialidadSugerida: f.especialidad_sugerida,
      doctorNombre: f.doctor_nombre,
      diagnostico: f.diagnostico,
      notas: f.notas,
      paciente: pacienteDto({
        id: f.paciente_id,
        cedula: f.cedula,
        nombre: f.pnombre,
        fecha_nacimiento: f.fecha_nacimiento,
        sexo: f.sexo,
        telefono: f.telefono,
      }),
      sintomas: sintomas.rows.map((s) => ({
        codigo: s.codigo,
        nombre: s.nombre,
        intensidad: s.intensidad,
        duracionDias: s.duracion_dias,
      })),
      inferencias: inferencias.rows.map((i) => ({
        regla: i.regla_codigo,
        conclusion: i.conclusion,
        cf: Number(i.cf),
        explicacion: i.explicacion,
      })),
      historial: historial.rows.map((h) => ({
        id: h.id,
        fecha: h.hora_llegada.toISOString(),
        especialidad: h.especialidad,
        estado: h.estado,
        diagnostico: h.diagnostico,
      })),
    };
  });

  /** El doctor toma una visita en espera de su especialidad. */
  app.post('/visitas/:id/iniciar', doctor, async (req) => {
    const id = parsearId(req.params);
    const yo = req.usuario!.sub;

    const d = await app.db.query<{ especialidad_id: number; consultorio_id: number | null }>(
      'select especialidad_id, consultorio_id from doctores where usuario_id = $1',
      [yo],
    );
    if (!d.rows[0]) throw new ErrorHttp(400, 'El doctor no tiene especialidad asignada');

    // UPDATE condicional: si dos doctores intentan tomar la misma visita, solo uno la obtiene.
    const r = await app.db.query(
      `update visitas
          set estado = 'en_consulta', hora_inicio_consulta = now(), doctor_id = $2, consultorio_id = $4
        where id = $1 and estado = 'espera' and especialidad_asignada_id = $3
       returning id`,
      [id, yo, d.rows[0].especialidad_id, d.rows[0].consultorio_id],
    );
    if (r.rows.length === 0) {
      throw new ErrorHttp(409, 'La visita ya no está en espera o no corresponde a su especialidad');
    }
    return { id, estado: 'en_consulta' as const };
  });

  /** El doctor cierra su consulta con diagnóstico y notas. */
  app.post('/visitas/:id/cerrar', doctor, async (req) => {
    const id = parsearId(req.params);
    const d = parsear(cerrarVisitaSchema, req.body ?? {});
    const r = await app.db.query(
      `update visitas
          set estado = 'atendida', hora_fin_consulta = now(), diagnostico = $3, notas = $4
        where id = $1 and estado = 'en_consulta' and doctor_id = $2
       returning id`,
      [id, req.usuario!.sub, d.diagnostico ?? null, d.notas ?? null],
    );
    if (r.rows.length === 0) throw new ErrorHttp(409, 'La visita no está en consulta con usted');
    return { id, estado: 'atendida' as const };
  });

  /** Recepción cancela una visita que aún espera. */
  app.post('/visitas/:id/cancelar', recepcion, async (req) => {
    const id = parsearId(req.params);
    const r = await app.db.query(
      `update visitas set estado = 'cancelada' where id = $1 and estado = 'espera' returning id`,
      [id],
    );
    if (r.rows.length === 0) throw new ErrorHttp(409, 'Solo se pueden cancelar visitas en espera');
    return { id, estado: 'cancelada' as const };
  });
}
