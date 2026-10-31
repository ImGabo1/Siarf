import { simular } from './simulador';
import type {
  CambiosEscenario,
  Escenario,
  EstadisticaReplicas,
  ResumenEscenario,
  ResultadoSim,
  SimConfig,
} from './tipos';

/** Devuelve una copia de la configuración con los cambios del escenario. */
export function aplicarCambios(config: SimConfig, cambios: CambiosEscenario): SimConfig {
  return {
    ...config,
    llegadasPorHora: cambios.llegadasPorHora ?? config.llegadasPorHora,
    puestosRecepcion: cambios.puestosRecepcion ?? config.puestosRecepcion,
    especialidades: config.especialidades.map((e) => ({
      ...e,
      consultorios: cambios.consultorios?.[e.codigo] ?? e.consultorios,
    })),
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function estadistica(valores: number[]): EstadisticaReplicas {
  const n = valores.length;
  if (n === 0) return { media: 0, desv: 0 };
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const varianza = n > 1 ? valores.reduce((a, v) => a + (v - media) ** 2, 0) / (n - 1) : 0;
  return { media: r2(media), desv: r2(Math.sqrt(varianza)) };
}

function metricasPlanas(r: ResultadoSim): Record<string, number> {
  const m: Record<string, number> = {
    llegados: r.llegados,
    atendidos: r.atendidos,
    finMin: r.finMin,
    esperaTotalPromedioMin: r.esperaTotalPromedioMin,
    tiempoEnSistemaPromedioMin: r.tiempoEnSistemaPromedioMin,
    tiempoEnSistemaP90Min: r.tiempoEnSistemaP90Min,
    espera_recepcion: r.recepcion.esperaPromedioMin,
    utilizacion_recepcion: r.recepcion.utilizacion,
  };
  for (const e of r.especialidades) {
    m[`espera_${e.id}`] = e.esperaPromedioMin;
    m[`utilizacion_${e.id}`] = e.utilizacion;
    m[`colaMax_${e.id}`] = e.colaMax;
  }
  return m;
}

/**
 * Ejecuta `replicas` simulaciones con semillas consecutivas y resume cada
 * métrica con su media y desviación. Un solo run es solo una muestra:
 * para comparar escenarios (y para el artículo) conviene promediar varias réplicas.
 */
export function replicar(config: SimConfig, replicas: number, nombre = 'Base'): ResumenEscenario {
  const acumulado = new Map<string, number[]>();
  const cuellos: Record<string, number> = {};

  for (let i = 0; i < replicas; i++) {
    const r = simular({ ...config, semilla: config.semilla + i }, { timeline: false });
    for (const [k, v] of Object.entries(metricasPlanas(r))) {
      const lista = acumulado.get(k) ?? [];
      lista.push(v);
      acumulado.set(k, lista);
    }
    const clave = r.cuelloBotella?.id ?? 'ninguno';
    cuellos[clave] = (cuellos[clave] ?? 0) + 1;
  }

  return {
    nombre,
    replicas,
    metricas: Object.fromEntries([...acumulado].map(([k, v]) => [k, estadistica(v)])),
    cuellosBotella: cuellos,
  };
}

/** Compara la configuración base contra una lista de escenarios "qué pasaría si…". */
export function compararEscenarios(base: SimConfig, escenarios: Escenario[], replicas: number): ResumenEscenario[] {
  return [
    replicar(base, replicas, 'Base'),
    ...escenarios.map((e) => replicar(aplicarCambios(base, e.cambios), replicas, e.nombre)),
  ];
}
