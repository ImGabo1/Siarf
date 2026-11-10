import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carga el archivo .env en desarrollo (Node >=20.12). En producción (Render) las
// variables vienen del panel y el archivo no existe, así que no se hace nada.
const ruta = resolve(process.cwd(), '.env');
if (existsSync(ruta) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(ruta);
}
