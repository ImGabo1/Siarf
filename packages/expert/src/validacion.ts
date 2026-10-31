import type { ProblemaBase, ReglaExperta } from './tipos';

export interface ContextoValidacion {
  /** Códigos de síntomas conocidos. */
  sintomas?: string[];
  /** Códigos de especialidades conocidas. */
  especialidades?: string[];
  /** Hechos extra que el sistema puede inyectar (p. ej. los de edad). */
  hechosExtra?: string[];
}

/**
 * Revisa la base de conocimiento y devuelve problemas.
 * Sirve como control de calidad al editar reglas (admin, seeds y pruebas).
 */
export function validarReglas(reglas: ReglaExperta[], ctx: ContextoValidacion = {}): ProblemaBase[] {
  const problemas: ProblemaBase[] = [];
  const vistos = new Set<string>();
  const derivados = new Set(reglas.filter((r) => r.concluye.tipo === 'hecho').map((r) => r.concluye.valor));
  const conocidos = new Set([...(ctx.sintomas ?? []), ...(ctx.hechosExtra ?? []), ...derivados]);

  for (const r of reglas) {
    if (vistos.has(r.codigo)) problemas.push({ nivel: 'error', regla: r.codigo, mensaje: 'Código de regla duplicado.' });
    vistos.add(r.codigo);

    if (!(r.cf > 0 && r.cf <= 1))
      problemas.push({ nivel: 'error', regla: r.codigo, mensaje: `CF fuera de rango (0,1]: ${r.cf}.` });
    if (r.condiciones.length === 0)
      problemas.push({ nivel: 'error', regla: r.codigo, mensaje: 'La regla no tiene condiciones.' });

    if (r.concluye.tipo === 'especialidad' && ctx.especialidades && !ctx.especialidades.includes(r.concluye.valor))
      problemas.push({
        nivel: 'error',
        regla: r.codigo,
        mensaje: `Especialidad desconocida: «${r.concluye.valor}».`,
      });

    if (ctx.sintomas) {
      for (const c of [...r.condiciones, ...(r.exclusiones ?? [])]) {
        if (!conocidos.has(c))
          problemas.push({
            nivel: 'aviso',
            regla: r.codigo,
            mensaje: `La condición «${c}» no es un síntoma, un hecho de edad ni un hecho derivado por otra regla.`,
          });
      }
    }

    if (r.concluye.tipo === 'hecho' && r.condiciones.includes(r.concluye.valor))
      problemas.push({ nivel: 'error', regla: r.codigo, mensaje: 'La regla se usa a sí misma como condición.' });
  }

  // Ciclos entre hechos derivados (A → B → A).
  const grafo = new Map<string, Set<string>>();
  for (const r of reglas) {
    if (r.concluye.tipo !== 'hecho') continue;
    const set = grafo.get(r.concluye.valor) ?? new Set<string>();
    for (const c of r.condiciones) if (derivados.has(c)) set.add(c);
    grafo.set(r.concluye.valor, set);
  }
  const estado = new Map<string, 1 | 2>();
  const enCiclo = new Set<string>();
  const visitar = (nodo: string, pila: string[]) => {
    estado.set(nodo, 1);
    for (const vecino of grafo.get(nodo) ?? []) {
      if (estado.get(vecino) === 1) {
        for (const x of pila.slice(pila.indexOf(vecino))) enCiclo.add(x);
        enCiclo.add(vecino);
      } else if (!estado.has(vecino)) visitar(vecino, [...pila, vecino]);
    }
    estado.set(nodo, 2);
  };
  for (const nodo of grafo.keys()) if (!estado.has(nodo)) visitar(nodo, [nodo]);
  for (const h of enCiclo)
    problemas.push({ nivel: 'error', mensaje: `El hecho derivado «${h}» participa en un ciclo de reglas.` });

  return problemas;
}
