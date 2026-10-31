# API

Base: la URL de Render (local: `http://localhost:3000`). JSON en ambos sentidos.
Autenticación: cabecera `Authorization: Bearer <token>` (se obtiene en `/auth/login`).
Errores: `{ "error": "mensaje", "detalles": ... }` con el código HTTP correspondiente
(400 datos inválidos · 401 sin sesión · 403 sin permiso · 404 · 409 conflicto · 429 demasiados intentos).

Los esquemas de entrada están en `packages/shared/src/esquemas.ts` y los tipos de respuesta en `tipos.ts`.

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /salud` | público | Estado del servidor y la base (también «despierta» a Render/Neon) |
| `POST /auth/login` | público | `{email, password}` → `{token, usuario}`. Limita intentos por IP |
| `GET /auth/yo` | todos | Usuario de la sesión |
| `GET /usuarios` | admin | Lista del personal |
| `POST /usuarios` | admin | Crea usuario (un doctor requiere `especialidadId`) |
| `PATCH /usuarios/:id` | admin | Cambia nombre, rol, activo, contraseña, especialidad/consultorio |
| `GET /especialidades` · `/consultorios` · `/sintomas` | todos | Catálogos |
| `GET /pacientes?q=` | admin, recepción, doctor | Busca por cédula o nombre (mín. 2 caracteres) |
| `GET /pacientes/:id` | admin, recepción, doctor | Ficha |
| `POST /pacientes` | admin, recepción | Registra paciente (cédula normalizada: `V-123` → `V123`) |
| `POST /inferencia` | admin, recepción | Vista previa del sistema experto (no guarda) |
| `POST /visitas` | admin, recepción | Registra la llegada: guarda síntomas y explicación, asigna especialidad y prioridad |
| `GET /visitas/cola` | admin, recepción, doctor | Cola de espera. El doctor ve la de su especialidad; los demás filtran con `?especialidadId=` |
| `GET /visitas/:id` | admin, recepción, doctor | Historia: paciente, síntomas, razonamiento y consultas previas |
| `POST /visitas/:id/iniciar` | doctor | Toma la visita (si dos doctores intentan, solo uno gana → 409) |
| `POST /visitas/:id/cerrar` | doctor | `{diagnostico?, notas?}` cierra la consulta |
| `POST /visitas/:id/cancelar` | admin, recepción | Cancela una visita en espera |
| `GET /reglas` | admin | Base de conocimiento |
| `POST /reglas` | admin | Crea regla (se valida junto con las existentes antes de guardar) |
| `PATCH /reglas/:id` | admin | Cambia `cf`, `prioridad`, `urgencia`, `activa`, `descripcion` |
| `GET /reglas/validar` | admin | Revisa la base (duplicados, ciclos, hechos desconocidos…) |
| `GET /reglas/evaluar-casos` | admin | Exactitud contra los casos de validación |
| `GET /simulaciones/parametros` | admin | Configuración inicial (consultorios reales de la BD) |
| `POST /simulaciones` | admin | Ejecuta y guarda una simulación → resultados + línea de tiempo |
| `POST /simulaciones/comparar` | admin | `{base, escenarios[], replicas}` → resumen por escenario (no guarda) |
| `GET /simulaciones` · `/simulaciones/:id` | admin | Historial / una simulación guardada |
| `GET /metricas?dias=7` | admin | Métricas del flujo **real** (esperas, consultas, llegadas por hora) |

## Reglas de negocio importantes

- Un paciente solo puede tener **una visita activa** (en espera o en consulta); la BD lo garantiza con un índice único.
- La cola se ordena: en consulta primero, luego urgentes, luego por hora de llegada.
- Un usuario desactivado pierde el acceso **de inmediato** (el token se contrasta con la BD en cada petición).
- Un admin no puede desactivarse ni quitarse el rol a sí mismo.
