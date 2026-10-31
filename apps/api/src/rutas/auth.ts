import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { loginSchema, type SesionDto, type UsuarioDto } from '@siarf/shared';
import { firmarToken } from '../auth/token';
import { ErrorHttp, parsear } from '../errores';
import type { Requerir } from '../auth/guardas';

interface FilaUsuario {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: UsuarioDto['rol'];
  activo: boolean;
  especialidad_id: number | null;
  consultorio_id: number | null;
}

export const SQL_USUARIO = `
  select u.id, u.nombre, u.email, u.password_hash, u.rol, u.activo,
         d.especialidad_id, d.consultorio_id
    from usuarios u left join doctores d on d.usuario_id = u.id`;

export function aDto(f: FilaUsuario): UsuarioDto {
  return {
    id: f.id,
    nombre: f.nombre,
    email: f.email,
    rol: f.rol,
    activo: f.activo,
    especialidadId: f.especialidad_id,
    consultorioId: f.consultorio_id,
  };
}

// Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
const HASH_FALSO = bcrypt.hashSync('contraseña-de-relleno', 10);

export async function rutasAuth(app: FastifyInstance, requerir: Requerir) {
  // Limitación básica de intentos por IP (en memoria; suficiente para un solo servicio).
  const intentos = new Map<string, { n: number; hasta: number }>();
  const MAX_INTENTOS = 8;
  const VENTANA_MS = 5 * 60_000;

  app.post('/auth/login', async (req) => {
    const ahora = Date.now();
    const registro = intentos.get(req.ip);
    if (registro && registro.hasta > ahora && registro.n >= MAX_INTENTOS) {
      throw new ErrorHttp(429, 'Demasiados intentos. Espere unos minutos.');
    }

    const { email, password } = parsear(loginSchema, req.body);
    const { rows } = await app.db.query<FilaUsuario>(`${SQL_USUARIO} where u.email = $1`, [email]);
    const u = rows[0];
    const ok = await bcrypt.compare(password, u?.password_hash ?? HASH_FALSO);

    if (!u || !ok || !u.activo) {
      const actual = registro && registro.hasta > ahora ? registro : { n: 0, hasta: ahora + VENTANA_MS };
      intentos.set(req.ip, { n: actual.n + 1, hasta: actual.hasta });
      throw new ErrorHttp(401, 'Correo o contraseña incorrectos');
    }
    intentos.delete(req.ip);

    const token = await firmarToken({ sub: u.id, rol: u.rol, nombre: u.nombre }, app.config.jwtSecret, app.config.jwtExpira);
    const sesion: SesionDto = { token, usuario: aDto(u) };
    return sesion;
  });

  app.get('/auth/yo', { preHandler: requerir() }, async (req) => {
    const { rows } = await app.db.query<FilaUsuario>(`${SQL_USUARIO} where u.id = $1`, [req.usuario!.sub]);
    if (!rows[0]) throw new ErrorHttp(404, 'Usuario no encontrado');
    return aDto(rows[0]);
  });
}
