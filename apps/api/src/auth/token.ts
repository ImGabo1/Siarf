import { SignJWT, jwtVerify } from 'jose';
import type { Rol } from '@siarf/shared';

export interface TokenUsuario {
  /** Id del usuario. */
  sub: number;
  rol: Rol;
  nombre: string;
}

const clave = (secreto: string) => new TextEncoder().encode(secreto);

export async function firmarToken(usuario: TokenUsuario, secreto: string, expira: string): Promise<string> {
  return new SignJWT({ rol: usuario.rol, nombre: usuario.nombre })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuario.sub))
    .setIssuedAt()
    .setExpirationTime(expira)
    .sign(clave(secreto));
}

export async function verificarToken(token: string, secreto: string): Promise<TokenUsuario> {
  const { payload } = await jwtVerify(token, clave(secreto), { algorithms: ['HS256'] });
  const sub = Number(payload.sub);
  if (!Number.isInteger(sub)) throw new Error('Token sin sujeto válido');
  return { sub, rol: payload['rol'] as Rol, nombre: String(payload['nombre'] ?? '') };
}
