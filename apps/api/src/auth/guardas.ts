import type { FastifyRequest } from 'fastify';
import type { Rol } from '@siarf/shared';
import type { Db } from '../db/cliente';
import { ErrorHttp } from '../errores';
import { verificarToken } from './token';

export type Requerir = (...roles: Rol[]) => (req: FastifyRequest) => Promise<void>;

/**
 * Crea la guarda de autenticación/autorización para usar como `preHandler`:
 *
 *   app.get('/ruta', { preHandler: requerir('admin') }, handler)   // solo admin
 *   app.get('/ruta', { preHandler: requerir() }, handler)          // cualquier usuario autenticado
 *
 * Además de validar el token, consulta la base de datos para que un usuario
 * desactivado o con otro rol pierda el acceso de inmediato (sin esperar a que
 * venza su token).
 */
export function crearGuardas(secreto: string, db: Db): Requerir {
  return (...roles) =>
    async (req) => {
      const cabecera = req.headers.authorization;
      if (!cabecera?.startsWith('Bearer ')) throw new ErrorHttp(401, 'Falta el token de autenticación');

      let sub: number;
      try {
        ({ sub } = await verificarToken(cabecera.slice(7), secreto));
      } catch {
        throw new ErrorHttp(401, 'Token inválido o vencido');
      }

      const { rows } = await db.query<{ rol: Rol; nombre: string; activo: boolean }>(
        'select rol, nombre, activo from usuarios where id = $1',
        [sub],
      );
      const u = rows[0];
      if (!u || !u.activo) throw new ErrorHttp(401, 'Usuario inactivo o inexistente');
      if (roles.length > 0 && !roles.includes(u.rol)) throw new ErrorHttp(403, 'No tiene permiso para esta acción');

      req.usuario = { sub, rol: u.rol, nombre: u.nombre };
    };
}
