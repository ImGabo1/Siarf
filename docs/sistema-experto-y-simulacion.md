# Sistema experto y simulación (base para el artículo)

## 1. Sistema experto

Implementado en `packages/expert`. Sigue la arquitectura clásica de un sistema experto:

| Componente | Dónde está |
|---|---|
| **Base de conocimiento** (hechos y reglas) | Tablas `sintomas`, `reglas`, `regla_condiciones`; semilla en `conocimiento-inicial.ts` |
| **Memoria de trabajo** | Los síntomas del paciente (con intensidad) + hechos de edad + hechos derivados |
| **Motor de inferencia** | `motor.ts` → `inferir()` |
| **Módulo de explicación** | Cada disparo genera una frase legible; se guarda en `visita_inferencias` |
| **Adquisición de conocimiento** | Panel admin → Base de conocimiento (CF, activar/desactivar) y `POST /reglas` |
| **Validación de la base** | `validacion.ts` → `validarReglas()` (duplicados, CF inválido, ciclos, hechos desconocidos) |

### Regla

```
SI   fiebre Y tos Y fatiga
ENTONCES hecho derivado «sindrome_gripal»   CF 0.80

SI   dolor_toracico Y dificultad_respiratoria
ENTONCES especialidad «emergencia»   CF 0.95   (marca urgencia)
```

Una regla tiene condiciones (todas deben cumplirse), exclusiones opcionales («excepto si…»), una conclusión
(especialidad o hecho derivado), un **factor de certeza (CF)**, una prioridad y una marca de urgencia.

### Inferencia (encadenamiento hacia adelante)

1. La memoria de trabajo inicia con los síntomas. La certeza de cada síntoma depende de su **intensidad** (1–5):
   `0.70 + 0.075 · (intensidad − 1)`, es decir, de 0.70 (leve) a 1.00 (severo).
2. Se evalúan todas las reglas. Una regla se dispara si cumple todas sus condiciones y ninguna exclusión.
   Su certeza es `CF_regla × mínimo(certeza de las condiciones)`.
3. Las conclusiones sobre la misma especialidad se **combinan** con la fórmula de MYCIN:
   `CF = a + b · (1 − a)`. Así, evidencia que coincide refuerza la certeza sin pasar de 1.
4. Los hechos derivados se añaden a la memoria y se repite hasta que nada cambie (punto fijo, máx. 10 rondas).
5. Se sugieren las especialidades con certeza ≥ 0.20, ordenadas. Si ninguna alcanza, se sugiere Medicina General.
   El caso es **urgente** si se dispara una regla de urgencia con certeza ≥ 0.50.

Propiedad probada: el resultado **no depende del orden** de las reglas. Cada ronda se recalcula desde los hechos base.

### Evaluación para el artículo

`packages/expert/src/casos-validacion.ts` contiene casos clínicos **ficticios** con la especialidad esperada.
`evaluarCasos()` calcula la **exactitud top-1, top-2 y de urgencia**; también disponible en el panel
(Base de conocimiento → *Evaluar con casos de prueba*) y en `GET /reglas/evaluar-casos`.

> Para que sea un resultado defendible: **un médico debe revisar** la lista de síntomas, las reglas, los CF y los
> casos de prueba (la columna `esperada`). Ahora mismo los casos pasan al 100 % porque las reglas se escribieron
> junto con ellos: eso verifica que el motor funciona, **no** que la medicina sea correcta. Para medir de verdad, usen
> casos escritos por el médico de forma independiente.

## 2. Simulación

Implementada en `packages/sim`. **Simulación de eventos discretos** con lista de eventos futuros (min-heap).

```
llegada ─▶ cola de recepción ─▶ registro ─▶ sala de espera de la especialidad ─▶ consulta ─▶ salida
```

| Elemento | Modelo |
|---|---|
| Llegadas | Proceso de Poisson; con perfil horario por *thinning* (hora pico / valle) |
| Recepción | N puestos, cola FIFO, tiempo de registro lognormal |
| Especialidades | M consultorios por especialidad, una cola cada una; **los urgentes pasan primero** |
| Duración de consulta | Lognormal (media y desviación por especialidad) |
| Destino del paciente | Aleatorio según el *peso* de cada especialidad |
| Fin | Tras la jornada ya no llegan pacientes, pero se atiende a los que quedan |
| Reproducibilidad | Generador con **semilla**: misma semilla = mismo resultado |

**Métricas:** pacientes atendidos; espera promedio, p90 y máxima por recurso; tiempo promedio de servicio;
**utilización** (tiempo ocupado / capacidad); largo medio y máximo de cola; tiempo total en el sistema;
serie temporal de ocupación.

**Cuello de botella:** el recurso con mayor espera promedio; se marca *saturado* si su utilización es ≥ 85 %.

**Escenarios:** `compararEscenarios()` simula la configuración base y variantes (+1 consultorio, +1 puesto de
recepción, otra tasa de llegadas…) con **varias réplicas** (semillas consecutivas) y reporta media ± desviación.
Una sola corrida es una muestra; para conclusiones, usen ≥ 10 réplicas.

**Animación:** la API devuelve la *línea de tiempo* de eventos; `reconstruirEstado(timeline, t)` indica dónde
está cada paciente en el minuto *t*, y el plano SVG lo dibuja.

### Supuestos a justificar o calibrar

Los valores de `defecto.ts` (30 pacientes/hora, consultas de 12–25 min, 2 puestos de recepción, 5 % urgentes…)
son **supuestos**. Opciones: (a) medir tiempos en un centro de salud; (b) calibrar con las **Métricas reales**
que el propio sistema registra; (c) citarlos de literatura. Elijan una y descríbanla en la metodología.
También se supone que los pacientes llegan solos, no hay abandono de cola y los doctores atienden sin descansos.

### Validación del modelo (ideas para la sección de resultados)

- Verificación: pruebas automáticas (`packages/sim/test`) — conservación de pacientes, orden de eventos,
  utilización en [0,1], reproducibilidad, prioridad de urgentes.
- Contraste con teoría de colas: con un solo servidor y llegadas/servicios exponenciales, la espera debe
  acercarse a la fórmula M/M/1 (`Wq = ρ / (μ − λ)`).
- Comparación entre simulación y flujo real (cuando haya datos).
