import '../cargar-env';
import { cargarConfig } from '../config';
import { crearDbPg } from '../db/cliente';
import { sembrarDatos } from '../db/seed';

const config = cargarConfig();
const db = crearDbPg(config.databaseUrl);
try {
  const r = await sembrarDatos(db, { adminEmail: config.adminEmail, adminPassword: config.adminPassword });
  console.log(`Reglas nuevas: ${r.reglasNuevas}. Administrador creado: ${r.adminCreado ? 'sí' : 'no (ya existía o falta ADMIN_*)'}.`);
} finally {
  await db.cerrar();
}
