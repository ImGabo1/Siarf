# SIARF · Sistema Inteligente de Atención Rápida y Simulación de Flujo Paciente-Médico

Sistema para hospitales/ambulatorios con dos módulos que comparten base de datos:

1. **Módulo clínico.** La recepcionista registra al paciente y sus síntomas; un **sistema experto**
   (reglas + factores de certeza, sin IA ni LLM) sugiere la especialidad y marca urgencias. El doctor ve su cola
   con la historia, los síntomas y la explicación del razonamiento.
2. **Módulo de simulación (panel de administrador).** Simulación de eventos discretos del recorrido
   *llegada → recepción → sala de espera → consultorio*, con **plano animado**, tiempos de espera,
   utilización, **cuello de botella** y comparación de escenarios («¿qué pasa si agrego un consultorio?»).

Todo en **TypeScript** · React · Fastify · PostgreSQL · Vercel (web) + Render (API) + Neon (BD).

## Estado de verificación (léase antes de empezar)

| Parte | Estado |
|---|---|
| `packages/expert` (sistema experto) | ✅ 14 pruebas pasan, tipos correctos |
| `packages/sim` (simulación) | ✅ 16 pruebas pasan, tipos correctos |
| `packages/shared` (esquemas Zod) | ✅ tipos correctos, esquemas probados |
| `apps/api` (backend) | ⚠️ **Escrito pero no compilado ni ejecutado.** Se revisó sintaxis; falta correrlo contra PostgreSQL |
| `apps/web` (frontend) | ⚠️ **Escrito pero no compilado ni ejecutado.** Falta `npm run build` y probarlo en el navegador |
| Despliegue (`render.yaml`, `vercel.json`, CI) | ⚠️ Sin probar |

El entorno donde se generó no tenía acceso al registro de npm, por eso **no hay `package-lock.json`**
y las partes marcadas con ⚠️ pueden tener errores de tipos o de integración. Es de esperar corregir
detalles al primer `npm install && npm run typecheck`. Los primeros pasos sugeridos están en
[`docs/tareas-equipo.md`](docs/tareas-equipo.md).

## Estructura

```
apps/
  api/            Backend Fastify (Render)       → rutas, auth JWT por rol, migraciones, seed
  web/            Frontend React + Vite (Vercel) → login, recepción, doctor, panel admin
packages/
  shared/         Esquemas Zod y tipos del contrato API (lo usan front y back)
  expert/         Sistema experto: motor de inferencia, reglas iniciales, casos de validación
  sim/            Motor de simulación de eventos discretos + escenarios
db/migrations/    SQL del esquema (001_init.sql)
docs/             Documentación de apoyo
_archivo/         Archivos de una ejecución anterior (se pueden borrar)
```

`expert` y `sim` son TypeScript puro (sin dependencias): se prueban sin servidor ni base de datos.

## Puesta en marcha local

Requisitos: Node 20+ (se recomienda 22) y una base PostgreSQL (Docker o una rama de Neon).

```bash
npm install                        # instala todo el monorepo
docker compose up -d               # PostgreSQL local (o use una cadena de Neon)

cp apps/api/.env.example apps/api/.env      # edite JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD
cp apps/web/.env.example apps/web/.env

npm run dev:api                    # http://localhost:3000  (migra y siembra al arrancar)
npm run dev:web                    # http://localhost:5173
```

Ingrese con `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Desde **Administración → Usuarios** cree
recepcionistas y doctores (un doctor necesita especialidad).

Comandos útiles: `npm test` · `npm run typecheck` · `npm run build` · `npm run migrate` · `npm run seed`.

## Despliegue (Neon + Render + Vercel)

1. **Neon:** cree un proyecto y copie la cadena de conexión (use la del *pooler*, con `?sslmode=require`).
2. **Render:** *New → Blueprint* sobre el repositorio (usa `render.yaml`), o un *Web Service* con
   build `npm install --include=dev && npm run build -w @siarf/api` y start `npm run start -w @siarf/api`.
   Variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (URL de Vercel), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   Al arrancar aplica migraciones y siembra datos (idempotente).
3. **Vercel:** importe el repositorio, *Root Directory* = `apps/web`, y variable `VITE_API_URL` = URL de Render.
   Como `apps/web` depende de paquetes del monorepo, active *Include source files outside of the Root Directory*
   (Settings → General) para que Vercel instale con el `package.json` de la raíz.
4. Vuelva a Render y ajuste `CORS_ORIGIN` con la URL final de Vercel.

Planes gratuitos: Render **duerme** el servicio tras ~15 min sin tráfico y Neon **suspende** la base; el primer
acceso tarda. La pantalla de login ya «despierta» el servidor al abrirse; para una demo, ábranla unos minutos antes.

## Cómo funciona

- **Sistema experto** → [`docs/sistema-experto-y-simulacion.md`](docs/sistema-experto-y-simulacion.md)
- **API** → [`docs/api.md`](docs/api.md)
- **Base de datos** → [`docs/base-de-datos.md`](docs/base-de-datos.md)

## ⚠ Advertencias importantes

- Las **reglas y factores de certeza** de `packages/expert/src/conocimiento-inicial.ts` son un **ejemplo para
  desarrollo**, sin validación clínica. Deben ser revisadas por un profesional de la salud antes de usarse en el
  artículo o en una demostración formal.
- Los **parámetros de la simulación** (`packages/sim/src/defecto.ts`) son **supuestos**, no datos reales.
  Calíbrelos con tiempos medidos o justifíquelos en el artículo.
- El sistema da una **orientación**, no un diagnóstico; la interfaz lo indica.
- Use **datos ficticios** de pacientes en desarrollo y demostraciones.
- Los «cambiar CF / activar regla» del panel se aplican de inmediato; la API también permite crear reglas
  (`POST /reglas`) pero la interfaz aún no tiene el formulario.
