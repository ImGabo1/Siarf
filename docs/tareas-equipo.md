# Primeros pasos y reparto del equipo

## Paso 0 (cualquiera, 15 min): verificar que todo compila

El código se generó sin poder instalar dependencias, así que el primer paso es comprobarlo:

```bash
npm install
npm run typecheck     # debe pasar en los 5 paquetes; corrija lo que salga
npm test              # 30 pruebas (sistema experto y simulación)
npm run build
```

Después, subir a GitHub **incluyendo `package-lock.json`** (lo genera `npm install`) y cambiar `npm install` por
`npm ci` en `.github/workflows/ci.yml`.

Errores probables a corregir: tipos del backend (Fastify/pg) y del frontend (React) que no se pudieron comprobar;
rutas del bundler al desplegar en Render; configuración de Vercel con monorepo.

## Reparto

### Backend + despliegue (tú)
- [ ] Levantar la API contra PostgreSQL local y recorrer el flujo completo con la interfaz.
- [ ] Escribir pruebas de integración de la API (por ejemplo con `@electric-sql/pglite` o un contenedor).
- [ ] Desplegar en Render (`render.yaml`) y conectar con Neon; configurar `CORS_ORIGIN`.
- [ ] Configurar CI (`.github/workflows/ci.yml`).
- [ ] Opcional: formulario/endpoint para **editar** condiciones de reglas (hoy solo se crean por API).

### Frontend
- [ ] Probar `npm run dev:web`; corregir tipos y detalles visuales.
- [ ] Mejorar el diseño del plano (`apps/web/src/paginas/Plano.tsx`): iconos, rutas animadas, mejor distribución.
- [ ] Formulario para crear reglas (la API ya existe: `POST /reglas`).
- [ ] Desplegar en Vercel (*Root Directory* `apps/web`, variable `VITE_API_URL`).
- [ ] Accesibilidad y vista móvil.

### Base de datos
- [ ] Revisar `db/migrations/001_init.sql` y proponer índices/ajustes.
- [ ] **Con apoyo de un médico**, revisar y ampliar la base de conocimiento
      (`packages/expert/src/conocimiento-inicial.ts`): síntomas, reglas, CF, prioridades, urgencias.
- [ ] Escribir los **casos de validación** independientes (`casos-validacion.ts`) con el médico.
- [ ] Datos de prueba ficticios (pacientes y visitas) para demostrar las métricas reales.
- [ ] Estrategia de respaldos (Neon permite ramas y restauración puntual).

### Documentación y artículo
- [ ] Documento de requisitos (funcionales y no funcionales) y diagramas UML (casos de uso, secuencia, clases).
- [ ] Manual de usuario por rol (con capturas).
- [ ] Redactar el artículo usando [`sistema-experto-y-simulacion.md`](sistema-experto-y-simulacion.md) como base.
- [ ] Definir con el equipo el diseño de experimentos: escenarios, réplicas, métricas a reportar.
- [ ] Conseguir y citar la **fuente clínica** de las reglas (guías, entrevista al médico).

## Orden sugerido

1. Paso 0 y subir a GitHub (todos).
2. Desplegar el «esqueleto» completo cuanto antes (aunque sea feo): detecta temprano los problemas de CORS, Neon y Render.
3. Base de conocimiento validada por el médico.
4. Calibrar la simulación y correr los experimentos del artículo.
5. Pulir interfaz, manual y artículo.

## Ideas si sobra tiempo

- Perfil horario de llegadas calibrado con los datos reales (`/metricas` → `porHora`).
- Exportar resultados de la simulación a CSV para el artículo.
- Cambio de contraseña por el propio usuario; registro de auditoría de accesos.
- Pantalla pública de turnos (sala de espera).
