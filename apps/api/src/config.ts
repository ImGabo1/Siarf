import { z } from 'zod';

const booleano = (porDefecto: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(porDefecto)
    .transform((v) => v === 'true');

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRA: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AUTO_MIGRATE: booleano('true'),
  AUTO_SEED: booleano('true'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD debe tener al menos 8 caracteres').optional(),
  TZ_NEGOCIO: z.string().default('America/Caracas'),
});

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpira: string;
  /** `true` permite cualquier origen (CORS_ORIGIN="*"). */
  corsOrigins: string[] | true;
  autoMigrate: boolean;
  autoSeed: boolean;
  adminEmail: string | undefined;
  adminPassword: string | undefined;
  tzNegocio: string;
}

/** Lee y valida las variables de entorno. Lanza un error legible si algo falta. */
export function cargarConfig(env: Record<string, string | undefined> = process.env): Config {
  // Una variable vacía (p. ej. en Render) se trata como no definida.
  const limpio = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const r = esquema.safeParse(limpio);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  const e = r.data;
  const origenes = e.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    jwtExpira: e.JWT_EXPIRA,
    corsOrigins: origenes.includes('*') ? true : origenes,
    autoMigrate: e.AUTO_MIGRATE,
    autoSeed: e.AUTO_SEED,
    adminEmail: e.ADMIN_EMAIL,
    adminPassword: e.ADMIN_PASSWORD,
    tzNegocio: e.TZ_NEGOCIO,
  };
}
