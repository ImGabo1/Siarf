import { describe, expect, it } from 'vitest';
import {
  CASOS_VALIDACION,
  ESPECIALIDADES_INICIALES,
  HECHOS_DE_EDAD,
  REGLAS_INICIALES,
  SINTOMAS_INICIALES,
  certezaPorIntensidad,
  combinarCF,
  evaluarCasos,
  hechosPorEdad,
  inferir,
  validarReglas,
  type ReglaExperta,
} from '../src';

const regla = (r: Partial<ReglaExperta> & Pick<ReglaExperta, 'codigo' | 'condiciones' | 'concluye' | 'cf'>): ReglaExperta => ({
  prioridad: 1,
  ...r,
});

describe('factores de certeza', () => {
  it('combina evidencia positiva sin pasar de 1', () => {
    expect(combinarCF(0.6, 0.6)).toBeCloseTo(0.84);
    expect(combinarCF(0.9, 0.9)).toBeLessThan(1);
    expect(combinarCF(0, 0.7)).toBeCloseTo(0.7);
  });

  it('modula la certeza por intensidad', () => {
    expect(certezaPorIntensidad(undefined)).toBe(1);
    expect(certezaPorIntensidad(1)).toBeCloseTo(0.7);
    expect(certezaPorIntensidad(5)).toBeCloseTo(1);
    expect(certezaPorIntensidad(99)).toBeCloseTo(1);
  });

  it('deriva hechos de la edad', () => {
    expect(hechosPorEdad(5)).toEqual(['paciente_pediatrico']);
    expect(hechosPorEdad(70)).toEqual(['adulto_mayor']);
    expect(hechosPorEdad(30)).toEqual([]);
    expect(hechosPorEdad(undefined)).toEqual([]);
  });
});

describe('motor de inferencia', () => {
  it('dispara una regla simple y explica por qué', () => {
    const reglas = [
      regla({ codigo: 'A', condiciones: ['tos'], concluye: { tipo: 'especialidad', valor: 'neumologia' }, cf: 0.8 }),
    ];
    const rec = inferir(reglas, { sintomas: [{ codigo: 'tos' }] }, { nombres: { tos: 'Tos', neumologia: 'Neumología' } });
    expect(rec.especialidades[0]).toMatchObject({ especialidad: 'neumologia', certeza: 0.8, reglas: ['A'] });
    expect(rec.explicacion[0]).toContain('[A] Tos → Neumología');
    expect(rec.sinCoincidencia).toBe(false);
  });

  it('no dispara si falta una condición o hay una exclusión', () => {
    const reglas = [
      regla({ codigo: 'A', condiciones: ['tos', 'fiebre'], concluye: { tipo: 'especialidad', valor: 'x' }, cf: 0.9 }),
      regla({
        codigo: 'B',
        condiciones: ['tos'],
        exclusiones: ['fiebre'],
        concluye: { tipo: 'especialidad', valor: 'y' },
        cf: 0.9,
      }),
    ];
    const soloTos = inferir(reglas, { sintomas: [{ codigo: 'tos' }] });
    expect(soloTos.especialidades.map((e) => e.especialidad)).toEqual(['y']);
    const ambos = inferir(reglas, { sintomas: [{ codigo: 'tos' }, { codigo: 'fiebre' }] });
    expect(ambos.especialidades.map((e) => e.especialidad)).toEqual(['x']);
  });

  it('encadena hechos derivados', () => {
    const reglas = [
      regla({ codigo: 'H', condiciones: ['a', 'b'], concluye: { tipo: 'hecho', valor: 'sindrome' }, cf: 0.8 }),
      regla({ codigo: 'E', condiciones: ['sindrome'], concluye: { tipo: 'especialidad', valor: 'esp' }, cf: 0.5 }),
    ];
    const rec = inferir(reglas, { sintomas: [{ codigo: 'a' }, { codigo: 'b' }] });
    expect(rec.hechosDerivados).toEqual([{ hecho: 'sindrome', certeza: 0.8 }]);
    // 0.5 * 0.8 = 0.4
    expect(rec.especialidades[0]?.certeza).toBeCloseTo(0.4);
  });

  it('el resultado no depende del orden de las reglas', () => {
    const reglas = REGLAS_INICIALES;
    const entrada = { sintomas: ['fiebre', 'tos', 'fatiga'].map((codigo) => ({ codigo })) };
    const a = inferir(reglas, entrada);
    const b = inferir([...reglas].reverse(), entrada);
    expect(b.especialidades).toEqual(a.especialidades);
  });

  it('la intensidad baja la certeza', () => {
    const reglas = [regla({ codigo: 'A', condiciones: ['tos'], concluye: { tipo: 'especialidad', valor: 'n' }, cf: 1 })];
    const leve = inferir(reglas, { sintomas: [{ codigo: 'tos', intensidad: 1 }] });
    const severo = inferir(reglas, { sintomas: [{ codigo: 'tos', intensidad: 5 }] });
    expect(leve.especialidades[0]!.certeza).toBeLessThan(severo.especialidades[0]!.certeza);
  });

  it('usa la especialidad por defecto cuando nada aplica', () => {
    const rec = inferir(REGLAS_INICIALES, { sintomas: [{ codigo: 'sintoma_inexistente' }] });
    expect(rec.sinCoincidencia).toBe(true);
    expect(rec.especialidades).toEqual([{ especialidad: 'medicina_general', certeza: 0, reglas: [] }]);
  });

  it('marca urgencia solo si la regla de urgencia supera el umbral', () => {
    const rec = inferir(REGLAS_INICIALES, {
      sintomas: [{ codigo: 'convulsiones', intensidad: 5 }],
    });
    expect(rec.urgente).toBe(true);
    const sinUrgencia = inferir(REGLAS_INICIALES, { sintomas: [{ codigo: 'tos' }] });
    expect(sinUrgencia.urgente).toBe(false);
  });

  it('termina aunque haya ciclos entre reglas', () => {
    const reglas = [
      regla({ codigo: 'X', condiciones: ['a'], concluye: { tipo: 'hecho', valor: 'b' }, cf: 0.9 }),
      regla({ codigo: 'Y', condiciones: ['b'], concluye: { tipo: 'hecho', valor: 'a' }, cf: 0.9 }),
    ];
    expect(() => inferir(reglas, { sintomas: [{ codigo: 'a' }] }, { maxRondas: 5 })).not.toThrow();
  });
});

describe('base de conocimiento inicial', () => {
  const ctx = {
    sintomas: SINTOMAS_INICIALES.map((s) => s.codigo),
    especialidades: ESPECIALIDADES_INICIALES.map((e) => e.codigo),
    hechosExtra: HECHOS_DE_EDAD,
  };

  it('no tiene errores ni avisos de validación', () => {
    expect(validarReglas(REGLAS_INICIALES, ctx)).toEqual([]);
  });

  it('detecta duplicados, CF inválido, especialidad desconocida y ciclos', () => {
    const malas: ReglaExperta[] = [
      regla({ codigo: 'Z1', condiciones: ['fiebre'], concluye: { tipo: 'especialidad', valor: 'inventada' }, cf: 0.5 }),
      regla({ codigo: 'Z1', condiciones: ['fiebre'], concluye: { tipo: 'especialidad', valor: 'pediatria' }, cf: 1.5 }),
      regla({ codigo: 'Z2', condiciones: ['h2'], concluye: { tipo: 'hecho', valor: 'h1' }, cf: 0.5 }),
      regla({ codigo: 'Z3', condiciones: ['h1'], concluye: { tipo: 'hecho', valor: 'h2' }, cf: 0.5 }),
    ];
    const mensajes = validarReglas(malas, ctx).map((p) => p.mensaje).join('\n');
    expect(mensajes).toContain('duplicado');
    expect(mensajes).toContain('CF fuera de rango');
    expect(mensajes).toContain('Especialidad desconocida');
    expect(mensajes).toContain('ciclo');
  });

  it('acierta los casos de validación de ejemplo', () => {
    const resumen = evaluarCasos(REGLAS_INICIALES, CASOS_VALIDACION);
    const fallos = resumen.casos.filter((c) => !c.top1 || !c.urgenteOk);
    expect(fallos).toEqual([]);
    expect(resumen.exactitudTop1).toBe(1);
    expect(resumen.exactitudUrgencia).toBe(1);
  });
});
