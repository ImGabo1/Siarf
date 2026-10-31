import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { actualizarUsuarioSchema, crearUsuarioSchema, type UsuarioDto } from '@siarf/shared';
import type { Requerir } from '../auth/guardas';
import { ErrorHttp, parsear, parsearId } from '../errores';
import { SQL_USUARIO, aDto } from './auth';

type Fila = Parameters<typeof aDto>[0];

/** Código de error de PostgreSQL para violación de unicidad. */
const UNIQUE_VIOLATION = '23505';
const esUnico = (e: unknown) => (e as { code?: string })?.code === UNIQUE_VIOLATION;

export async function rutasUsuarios(app: FastifyInstance, requerir: Requerir) {
  const soloAdmin = { preHandler: requerir('admin') };

  app.get('/usuarios', soloAdmin, async (): Promise<UsuarioDto[]> => {
    const { rows } = await app.db.query<Fila>(`${SQL_USUARIO} order by u.id`);
    return rows.map(aDto);
  });

  app.post('/usuarios', soloAdmin, async (req, reply) => {
    const datos = parsear(crearUsuarioSchema, req.body);
    const hash = await bcrypt.hash(datos.password, 10);

    try {
      const id = await app.db.tx(async (q) => {
        const r = await q.query<{ id: number }>(
          'insert into usuarios (nombre, email, password_hash, rol) values ($1, $2, $3, $4) returning id',
          [datos.nombre, datos.email, hash, datos.rol],
        );
        const nuevo = r.rows[0]!.id;
        if (datos.rol === 'doctor') {
          await q.query('insert into doctores (usuario_id, especialidad_id, consultorio_id) values ($1, $2, $3)', [
            nuevo,
            datos.especialidadId,
            datos.consultorioId ?? null,
          ]);
        }
        return nuevo;
      });
      const { rows } = await app.db.query<Fila>(`${SQL_USUARIO} where u.id = $1`, [id]);
      reply.code(201);
      return aDto(rows[0]!);
    } catch (e) {
      if (esUnico(e)) throw new ErrorHttp(409, 'Ya existe un usuario con ese correo');
      // violación de llave foránea (especialidad/consultorio inexistentes)
      if ((e as { code?: string })?.code === '23503') throw new ErrorHttp(400, 'Especialidad o consultorio inexistente');
      throw e;
    }
  });

  app.patch('/usuarios/:id', soloAdmin, async (req) => {
    const id = parsearId(req.params);
    const datos = parsear(actualizarUsuarioSchema, req.body);

    if (id === req.usuario!.sub && (datos.activo === false || (datos.rol && datos.rol !== 'admin'))) {
      throw new ErrorHttp(400, 'No puede desactivarse ni quitarse el rol de administrador a sí mismo');
    }

    await app.db.tx(async (q) => {
      const actual = await q.query<{ rol: string }>('select rol from usuarios where id = $1 for update', [id]);
      if (!actual.rows[0]) throw new ErrorHttp(404, 'Usuario no encontrado');

      const sets: string[] = [];
      const params: unknown[] = [];
      const agregar = (col: string, valor: unknown) => {
        params.push(valor);
        sets.push(`${col} = $${params.length}`);
      };
      if (datos.nombre !== undefined) agregar('nombre', datos.nombre);
      if (datos.rol !== undefined) agregar('rol', datos.rol);
      if (datos.activo !== undefined) agregar('activo', datos.activo);
      if (datos.password !== undefined) agregar('password_hash', await bcrypt.hash(datos.password, 10));
      if (sets.length > 0) {
        params.push(id);
        await q.query(`update usuarios set ${sets.join(', ')} where id = $${params.length}`, params);
      }

      const rolFinal = datos.rol ?? actual.rows[0].rol;
      if (rolFinal === 'doctor' && (datos.especialidadId !== undefined || datos.consultorioId !== undefined)) {
        const previo = await q.query<{ especialidad_id: number }>('select especialidad_id from doctores where usuario_id = $1', [id]);
        const esp = datos.especialidadId ?? previo.rows[0]?.especialidad_id;
        if (esp === undefined) throw new ErrorHttp(400, 'Un doctor requiere especialidadId');
        await q.query(
          `insert into doctores (usuario_id, especialidad_id, consultorio_id) values ($1, $2, $3)
           on conflict (usuario_id) do update
             set especialidad_id = excluded.especialidad_id,
                 consultorio_id = case when $4 then excluded.consultorio_id else doctores.consultorio_id end`,
          [id, esp, datos.consultorioId ?? null, datos.consultorioId !== undefined],
        );
      }
    });

    const { rows } = await app.db.query<Fila>(`${SQL_USUARIO} where u.id = $1`, [id]);
    return aDto(rows[0]!);
  });
}
