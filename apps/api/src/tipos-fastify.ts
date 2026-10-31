import type { Config } from './config';
import type { Db } from './db/cliente';
import type { TokenUsuario } from './auth/token';

// Amplía los tipos de Fastify con lo que agregamos a la instancia y a la petición.
declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
  }
  interface FastifyRequest {
    usuario?: TokenUsuario;
  }
}
