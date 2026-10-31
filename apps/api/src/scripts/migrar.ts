import { cargarConfig } from '../config';
import { crearDbPg } from '../db/cliente';
import { ejecutarMigraciones } from '../db/migrar';

const db = crearDbPg(cargarConfig().databaseUrl);
try {
  const nuevas = await ejecutarMigraciones(db);
  console.log(nuevas.length ? `Aplicadas: ${nuevas.join(', ')}` : 'Base de datos al día.');
} finally {
  await db.cerrar();
}
