import { crearApp } from './app';
import { cargarConfig } from './config';
import { crearDbPg } from './db/cliente';
import { ejecutarMigraciones } from './db/migrar';
import { sembrarDatos } from './db/seed';

async function main() {
  const config = cargarConfig();
  const db = crearDbPg(config.databaseUrl);

  if (config.autoMigrate) {
    const nuevas = await ejecutarMigraciones(db);
    if (nuevas.length > 0) console.log(`Migraciones aplicadas: ${nuevas.join(', ')}`);
  }
  if (config.autoSeed) {
    const r = await sembrarDatos(db, { adminEmail: config.adminEmail, adminPassword: config.adminPassword });
    if (r.reglasNuevas > 0) console.log(`Reglas nuevas sembradas: ${r.reglasNuevas}`);
    if (r.adminCreado) console.log(`Administrador inicial creado: ${config.adminEmail}`);
  }

  const app = await crearApp(config, db);
  await app.listen({ port: config.port, host: '0.0.0.0' });

  const cerrar = async (senal: string) => {
    app.log.info(`${senal} recibido, cerrando…`);
    await app.close();
    await db.cerrar();
    process.exit(0);
  };
  process.on('SIGTERM', () => void cerrar('SIGTERM'));
  process.on('SIGINT', () => void cerrar('SIGINT'));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
