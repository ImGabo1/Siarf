import type {
  Disparo,
  EntradaConsulta,
  EspecialidadSugerida,
  Hecho,
  OpcionesMotor,
  ReglaExperta,
  Recomendacion,
} from './tipos';

export const ADVERTENCIA =
  'Sugerencia automática de orientación. No constituye un diagnóstico; la decisión final corresponde al personal de salud.';

const EPSILON = 1e-9;

/** Hechos que se derivan de la edad del paciente. */
export function hechosPorEdad(edad: number | undefined): Hecho[] {
  if (edad === undefined || Number.isNaN(edad)) return [];
  if (edad < 14) return ['paciente_pediatrico'];
  if (edad >= 65) return ['adulto_mayor'];
  return [];
}

/**
 * Combina dos factores de certeza positivos que apoyan la misma conclusión
 * (regla de MYCIN): cf = a + b * (1 - a).
 */
export function combinarCF(a: number, b: number): number {
  return a + b * (1 - a);
}

/**
 * Certeza de un síntoma según su intensidad (1 a 5).
 * Sin intensidad = 1. Intensidad 1 = 0.70, intensidad 5 = 1.00.
 */
export function certezaPorIntensidad(intensidad: number | undefined): number {
  if (intensidad === undefined) return 1;
  const i = Math.min(5, Math.max(1, intensidad));
  return 0.7 + 0.075 * (i - 1);
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;

function mapasIguales(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w === undefined || Math.abs(v - w) > EPSILON) return false;
  }
  return true;
}

/**
 * Motor de inferencia por encadenamiento hacia adelante (forward chaining)
 * con factores de certeza.
 *
 * Funcionamiento:
 *  1. La memoria de trabajo inicia con los síntomas del paciente (certeza
 *     según intensidad) y los hechos extra (certeza 1).
 *  2. En cada ronda se evalúan TODAS las reglas contra la memoria actual.
 *     Una regla se dispara si cumple todas sus condiciones y ninguna
 *     exclusión. Su certeza = cf_regla × mínimo(certeza de condiciones).
 *  3. Las conclusiones iguales se combinan con `combinarCF`.
 *     Los hechos derivados se agregan a la memoria para la siguiente ronda.
 *  4. Se repite hasta que la memoria deje de cambiar (punto fijo) o se
 *     alcance `maxRondas`.
 *
 * Como cada ronda se recalcula desde los hechos base, el resultado no
 * depende del orden de las reglas.
 */
export function inferir(
  reglas: ReglaExperta[],
  entrada: EntradaConsulta,
  opciones: OpcionesMotor = {},
): Recomendacion {
  const umbralMinimo = opciones.umbralMinimo ?? 0.2;
  const umbralUrgencia = opciones.umbralUrgencia ?? 0.5;
  const maxRondas = opciones.maxRondas ?? 10;
  const nombres = opciones.nombres ?? {};
  const nombre = (codigo: string) => nombres[codigo] ?? codigo;

  // Memoria de trabajo inicial
  const base = new Map<string, number>();
  for (const s of entrada.sintomas) {
    const cert = certezaPorIntensidad(s.intensidad);
    base.set(s.codigo, Math.max(base.get(s.codigo) ?? 0, cert));
  }
  for (const h of entrada.hechosExtra ?? []) base.set(h, 1);

  let hechos = new Map(base);
  let disparos: Disparo[] = [];
  let certezaEspecialidades = new Map<string, { cert: number; reglas: string[] }>();

  for (let ronda = 0; ronda < maxRondas; ronda++) {
    const derivados = new Map<string, number>();
    const especialidades = new Map<string, { cert: number; reglas: string[] }>();
    const disparosRonda: Disparo[] = [];

    for (const regla of reglas) {
      if (!regla.condiciones.every((c) => hechos.has(c))) continue;
      if (regla.exclusiones?.some((e) => hechos.has(e))) continue;

      const certCondiciones = Math.min(...regla.condiciones.map((c) => hechos.get(c) ?? 0));
      const cf = regla.cf * certCondiciones;

      if (regla.concluye.tipo === 'hecho') {
        const previo = derivados.get(regla.concluye.valor) ?? 0;
        derivados.set(regla.concluye.valor, combinarCF(previo, cf));
      } else {
        const previo = especialidades.get(regla.concluye.valor) ?? { cert: 0, reglas: [] };
        especialidades.set(regla.concluye.valor, {
          cert: combinarCF(previo.cert, cf),
          reglas: [...previo.reglas, regla.codigo],
        });
      }

      const destino =
        regla.concluye.tipo === 'hecho'
          ? `hecho derivado «${nombre(regla.concluye.valor)}»`
          : nombre(regla.concluye.valor);
      const explicacion =
        `[${regla.codigo}] ${regla.condiciones.map(nombre).join(' + ')} → ${destino} ` +
        `(certeza ${Math.round(cf * 100)}%)${regla.urgencia ? ' ⚠ urgencia' : ''}`;

      disparosRonda.push({
        regla: regla.codigo,
        ...(regla.descripcion ? { descripcion: regla.descripcion } : {}),
        condiciones: regla.condiciones,
        concluye: regla.concluye,
        cf: redondear(cf),
        prioridad: regla.prioridad,
        urgencia: Boolean(regla.urgencia),
        explicacion,
      });
    }

    const siguiente = new Map(base);
    for (const [h, c] of derivados) siguiente.set(h, combinarCF(base.get(h) ?? 0, c));

    const estable = mapasIguales(hechos, siguiente);
    hechos = siguiente;
    disparos = disparosRonda;
    certezaEspecialidades = especialidades;
    if (estable) break;
  }

  // Resolución de conflictos: prioridad, certeza, especificidad y código.
  const especificidad = new Map(reglas.map((r) => [r.codigo, r.condiciones.length]));
  disparos.sort(
    (a, b) =>
      b.prioridad - a.prioridad ||
      b.cf - a.cf ||
      (especificidad.get(b.regla) ?? 0) - (especificidad.get(a.regla) ?? 0) ||
      a.regla.localeCompare(b.regla),
  );

  let especialidades: EspecialidadSugerida[] = [...certezaEspecialidades.entries()]
    .map(([especialidad, v]) => ({
      especialidad,
      certeza: redondear(v.cert),
      reglas: [...v.reglas].sort(),
    }))
    .filter((e) => e.certeza >= umbralMinimo)
    .sort((a, b) => b.certeza - a.certeza || a.especialidad.localeCompare(b.especialidad));

  const urgente = disparos.some((d) => d.urgencia && d.cf >= umbralUrgencia);
  const sinCoincidencia = especialidades.length === 0;
  if (sinCoincidencia) {
    especialidades = [
      { especialidad: opciones.especialidadPorDefecto ?? 'medicina_general', certeza: 0, reglas: [] },
    ];
  }

  const hechosDerivados = [...hechos.entries()]
    .filter(([h]) => !entrada.sintomas.some((s) => s.codigo === h) && !(entrada.hechosExtra ?? []).includes(h))
    .map(([hecho, certeza]) => ({ hecho, certeza: redondear(certeza) }));

  const explicacion = disparos.map((d) => d.explicacion);
  if (sinCoincidencia) {
    explicacion.push(
      'Ninguna regla alcanzó la certeza mínima; se sugiere evaluación en ' +
        `${nombre(especialidades[0]?.especialidad ?? 'medicina_general')}.`,
    );
  } else {
    for (const e of especialidades) {
      explicacion.push(
        `Certeza combinada de ${nombre(e.especialidad)}: ${Math.round(e.certeza * 100)}% (reglas ${e.reglas.join(', ')}).`,
      );
    }
  }

  return {
    especialidades,
    urgente,
    hechosDerivados,
    disparos,
    explicacion,
    sinCoincidencia,
    advertencia: ADVERTENCIA,
  };
}
