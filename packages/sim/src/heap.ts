/** Cola de prioridad (min-heap) para la lista de eventos futuros. */
export class MinHeap<T> {
  private datos: T[] = [];

  constructor(private readonly menor: (a: T, b: T) => boolean) {}

  get tamano(): number {
    return this.datos.length;
  }

  push(x: T): void {
    const d = this.datos;
    d.push(x);
    let i = d.length - 1;
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (!this.menor(d[i]!, d[padre]!)) break;
      [d[i], d[padre]] = [d[padre]!, d[i]!];
      i = padre;
    }
  }

  pop(): T | undefined {
    const d = this.datos;
    if (d.length === 0) return undefined;
    const tope = d[0]!;
    const ultimo = d.pop()!;
    if (d.length > 0) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const izq = 2 * i + 1;
        const der = izq + 1;
        let m = i;
        if (izq < d.length && this.menor(d[izq]!, d[m]!)) m = izq;
        if (der < d.length && this.menor(d[der]!, d[m]!)) m = der;
        if (m === i) break;
        [d[i], d[m]] = [d[m]!, d[i]!];
        i = m;
      }
    }
    return tope;
  }
}
