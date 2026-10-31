import type { Dist } from './tipos';

/** Generador pseudoaleatorio mulberry32: rápido, con semilla y reproducible. */
export function crearRng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exponencial con tasa `lambda` (eventos por unidad de tiempo). */
export function exponencial(rng: () => number, lambda: number): number {
  return -Math.log(1 - rng()) / lambda;
}

/** Normal estándar por Box-Muller. */
export function normalEstandar(rng: () => number): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Lognormal a partir de la media y la desviación estándar deseadas
 * (no de los parámetros mu/sigma). Siempre positiva.
 */
export function lognormal(rng: () => number, { media, desv }: Dist): number {
  if (desv <= 0) return media;
  const sigma2 = Math.log(1 + (desv / media) ** 2);
  const mu = Math.log(media) - sigma2 / 2;
  return Math.exp(mu + Math.sqrt(sigma2) * normalEstandar(rng));
}

/** Elige un índice según pesos relativos. */
export function elegirPonderado(rng: () => number, pesos: number[]): number {
  const total = pesos.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < pesos.length; i++) {
    x -= pesos[i] ?? 0;
    if (x <= 0) return i;
  }
  return pesos.length - 1;
}
