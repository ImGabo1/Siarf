import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import './tipos-fastify';
import { crearGuardas } from './auth/guardas';
import type { Config } from './config';
import type { Db } from './db/cliente';
import { ErrorHttp } from './errores';
import { rutasAuth } from './rutas/auth';
import { rutasCatalogos } from './rutas/catalogos';
import { rutasMetricas } from './rutas/metricas';
import { rutasPacientes } from './rutas/pacientes';
import { rutasReglas } from './rutas/reglas';
import { rutasSimulaciones } from './rutas/simulaciones';
import { rutasUsuarios } from './rutas/usuarios';
import { rutasVisitas } from './rutas/visitas';

/** Construye la aplicación Fastify (sin escuchar en un puerto; así se puede probar). */
export async function crearApp(config: Config, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : { level: config.nodeEnv === 'production' ? 'info' : 'debug' },
    // Render termina TLS delante de la app: confiar en X-Forwarded-For para req.ip.
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  app.decorate('db', db);
  app.decorate('config', config);

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ErrorHttp) {
      return reply.code(err.status).send({ error: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: err instanceof Error ? err.message : 'Solicitud inválida' });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor' });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'Ruta no encontrada' }));

  // Salud: la usa Render para el health check y sirve para "despertar" la BD de Neon.
  app.get('/salud', async (_req, reply) => {
    try {
      await db.query('select 1');
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false, error: 'Base de datos no disponible' });
    }
  });

  const requerir = crearGuardas(config.jwtSecret, db);
  await rutasAuth(app, requerir);
  await rutasUsuarios(app, requerir);
  await rutasCatalogos(app, requerir);
  await rutasPacientes(app, requerir);
  await rutasVisitas(app, requerir);
  await rutasReglas(app, requerir);
  await rutasSimulaciones(app, requerir);
  await rutasMetricas(app, requerir);

  return app;
}
