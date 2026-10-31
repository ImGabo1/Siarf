import { hechosPorEdad, inferir } from './motor';
import type { CasoValidacion } from './casos-validacion';
import type { OpcionesMotor, ReglaExperta } from './tipos';

export interface ResultadoCaso {
  id: string;
  esperada: string;
  obtenida: string[];
  top1: boolean;
  top2: boolean;
  urgenteOk: boolean;
}

export interface ResumenEvaluacion {
  total: number;
  exactitudTop1: number;
  exactitudTop2: number;
  exactitudUrgencia: number;
  casos: ResultadoCaso[];
}

/** Evalúa un conjunto de casos y calcula exactitud top-1, top-2 y de urgencia. */
export function evaluarCasos(
  reglas: ReglaExperta[],
  casos: CasoValidacion[],
  opciones: OpcionesMotor = {},
): ResumenEvaluacion {
  const resultados: ResultadoCaso[] = casos.map((caso) => {
    const rec = inferir(
      reglas,
      { sintomas: caso.sintomas.map((codigo) => ({ codigo })), hechosExtra: hechosPorEdad(caso.edad) },
      opciones,
    );
    const obtenida = rec.especialidades.map((e) => e.especialidad);
    return {
      id: caso.id,
      esperada: caso.esperada,
      obtenida,
      top1: obtenida[0] === caso.esperada,
      top2: obtenida.slice(0, 2).includes(caso.esperada),
      urgenteOk: rec.urgente === Boolean(caso.urgente),
    };
  });
  const n = resultados.length || 1;
  const frac = (f: (r: ResultadoCaso) => boolean) => resultados.filter(f).length / n;
  return {
    total: resultados.length,
    exactitudTop1: frac((r) => r.top1),
    exactitudTop2: frac((r) => r.top2),
    exactitudUrgencia: frac((r) => r.urgenteOk),
    casos: resultados,
  };
}
