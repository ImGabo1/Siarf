import { describe, expect, it } from 'vitest';
import {
  aplicarCambios,
  compararEscenarios,
  configPorDefecto,
  crearRng,
  lognormal,
  reconstruirEstado,
  replicar,
  simular,
  type SimConfig,
} from '../src';

const base = (): SimConfig => configPorDefecto();

describe('generador aleatorio', () => {
  it('es reproducible con la misma semilla', () => {
    const a = crearRng(7);
    const b = crearRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('la lognormal respeta la media pedida', () => {
    const rng = crearRng(1);
    const n = 20000;
    let suma = 0;
    for (let i = 0; i < n; i++) suma += lognormal(rng, { media: 15, desv: 5 });
    expect(suma / n).toBeCloseTo(15, 0);
  });
});

describe('simulación', () => {
  it('es determinista para una semilla y cambia con otra', () => {
    const a = simular(base());
    const b = simular(base());
    const c = simular({ ...base(), semilla: 99 });
    expect(a).toEqual(b);
    expect(c.llegados).not.toBe(a.llegados);
  });

  it('atiende a todos los que llegan (se drena la cola)', () => {
    const r = simular(base());
    expect(r.llegados).toBeGreaterThan(50);
    expect(r.atendidos).toBe(r.llegados);
    expect(r.recepcion.atendidos).toBe(r.llegados);
    const totalConsultas = r.especialidades.reduce((s, e) => s + e.atendidos, 0);
    expect(totalConsultas).toBe(r.llegados);
  });

  it('cada paciente recorre los eventos en orden y los tiempos son coherentes', () => {
    const r = simular({ ...base(), duracionMin: 120 });
    const orden = ['llegada', 'inicio_registro', 'fin_registro', 'inicio_consulta', 'fin_consulta'];
    const porPaciente = new Map<number, string[]>();
    let tPrevio = 0;
    for (const ev of r.timeline) {
      expect(ev.t).toBeGreaterThanOrEqual(tPrevio);
      tPrevio = ev.t;
      porPaciente.set(ev.pacienteId, [...(porPaciente.get(ev.pacienteId) ?? []), ev.tipo]);
    }
    expect(porPaciente.size).toBe(r.llegados);
    for (const tipos of porPaciente.values()) expect(tipos).toEqual(orden);
  });

  it('las utilizaciones están entre 0 y 1', () => {
    const r = simular(base());
    for (const m of [r.recepcion, ...r.especialidades]) {
      expect(m.utilizacion).toBeGreaterThanOrEqual(0);
      expect(m.utilizacion).toBeLessThanOrEqual(1);
    }
  });

  it('sin llegadas no hay eventos ni cuello de botella', () => {
    const r = simular({ ...base(), llegadasPorHora: 0 });
    expect(r.llegados).toBe(0);
    expect(r.timeline).toEqual([]);
    expect(r.cuelloBotella).toBeNull();
  });

  it('con carga muy alta se identifica un cuello de botella saturado', () => {
    const r = simular({ ...base(), llegadasPorHora: 90 });
    expect(r.cuelloBotella).not.toBeNull();
    expect(r.cuelloBotella!.esperaPromedioMin).toBeGreaterThan(10);
  });

  it('los urgentes esperan menos que los normales en la sala de consulta', () => {
    const cfg: SimConfig = {
      ...base(),
      llegadasPorHora: 60,
      proporcionUrgentes: 0.3,
      especialidades: [
        { codigo: 'x', nombre: 'X', peso: 1, consultorios: 1, consultaMin: { media: 12, desv: 3 } },
      ],
    };
    const r = simular(cfg);
    const espera = (urgente: boolean) => {
      const inicio = new Map<number, number>();
      const fin = new Map<number, number>();
      for (const ev of r.timeline) {
        if (ev.urgente !== urgente) continue;
        if (ev.tipo === 'fin_registro') fin.set(ev.pacienteId, ev.t);
        if (ev.tipo === 'inicio_consulta') inicio.set(ev.pacienteId, ev.t);
      }
      const v = [...fin].map(([id, t]) => (inicio.get(id) ?? t) - t);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(espera(true)).toBeLessThan(espera(false));
  });

  it('valida configuraciones inválidas', () => {
    expect(() => simular({ ...base(), puestosRecepcion: 0 })).toThrow();
    expect(() => simular({ ...base(), especialidades: [] })).toThrow();
    expect(() => simular({ ...base(), llegadasPorHora: 1e9 })).toThrow();
  });

  it('puede omitir la línea de tiempo', () => {
    const r = simular(base(), { timeline: false });
    expect(r.timeline).toEqual([]);
    expect(r.atendidos).toBeGreaterThan(0);
  });
});

describe('reconstrucción de estado (animación)', () => {
  it('muestra pacientes en cola y en servicio en un instante dado', () => {
    const r = simular({ ...base(), llegadasPorHora: 90 });
    const enEscena = reconstruirEstado(r.timeline, 120);
    expect(enEscena.length).toBeGreaterThan(0);
    for (const p of enEscena) {
      if (p.fase === 'cola_recepcion' || p.fase === 'sala_espera') expect(p.posCola).toBeDefined();
      if (p.fase === 'registro' || p.fase === 'consulta') expect(p.puesto).toBeDefined();
    }
    // el número en escena coincide con la serie de muestreo
    const punto = r.serieCola.find((s) => s.t === 120);
    expect(punto).toBeDefined();
    expect(enEscena.length).toBe(punto!.enSistema);
  });

  it('al final de la simulación no queda nadie', () => {
    const r = simular(base());
    expect(reconstruirEstado(r.timeline, r.finMin + 1)).toEqual([]);
  });
});

describe('escenarios', () => {
  it('aplica cambios sin mutar la configuración original', () => {
    const cfg = base();
    const nuevo = aplicarCambios(cfg, { puestosRecepcion: 4, consultorios: { traumatologia: 3 } });
    expect(nuevo.puestosRecepcion).toBe(4);
    expect(nuevo.especialidades.find((e) => e.codigo === 'traumatologia')!.consultorios).toBe(3);
    expect(cfg.puestosRecepcion).toBe(2);
    expect(cfg.especialidades.find((e) => e.codigo === 'traumatologia')!.consultorios).toBe(1);
  });

  it('agregar un consultorio al cuello de botella reduce su espera', () => {
    const cfg: SimConfig = { ...base(), llegadasPorHora: 60 };
    const [antes, despues] = compararEscenarios(
      cfg,
      [{ nombre: '+2 consultorios de traumatología', cambios: { consultorios: { traumatologia: 3 } } }],
      10,
    ) as [ReturnType<typeof replicar>, ReturnType<typeof replicar>];
    expect(despues.metricas['espera_traumatologia']!.media).toBeLessThan(antes.metricas['espera_traumatologia']!.media);
  });

  it('el resumen incluye media y desviación por métrica', () => {
    const resumen = replicar(base(), 5);
    expect(resumen.replicas).toBe(5);
    expect(resumen.metricas['esperaTotalPromedioMin']!.desv).toBeGreaterThanOrEqual(0);
    expect(Object.values(resumen.cuellosBotella).reduce((a, b) => a + b, 0)).toBe(5);
  });
});
