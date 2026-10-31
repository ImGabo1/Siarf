import { crearRng, elegirPonderado, exponencial, lognormal } from './aleatorio';
import { MinHeap } from './heap';
import type {
  CuelloBotella,
  Dist,
  EventoSim,
  MetricasRecurso,
  OpcionesSim,
  PuntoCola,
  ResultadoSim,
  SimConfig,
  TipoEvento,
} from './tipos';

const MAX_LLEGADAS_ESPERADAS = 50_000;
const UMBRAL_SATURACION = 0.85;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function validarConfig(c: SimConfig): void {
  const err = (m: string): never => {
    throw new Error(`Configuración de simulación inválida: ${m}`);
  };
  const dist = (d: Dist, nombre: string) => {
    if (!(d.media > 0)) err(`${nombre}.media debe ser > 0`);
    if (!(d.desv >= 0)) err(`${nombre}.desv debe ser >= 0`);
  };
  if (!(c.duracionMin > 0)) err('duracionMin debe ser > 0');
  if (!(c.llegadasPorHora >= 0)) err('llegadasPorHora debe ser >= 0');
  if (!Number.isInteger(c.puestosRecepcion) || c.puestosRecepcion < 1) err('puestosRecepcion debe ser un entero >= 1');
  if (c.proporcionUrgentes < 0 || c.proporcionUrgentes > 1) err('proporcionUrgentes debe estar entre 0 y 1');
  if (c.especialidades.length === 0) err('se requiere al menos una especialidad');
  dist(c.registroMin, 'registroMin');
  for (const e of c.especialidades) {
    if (!Number.isInteger(e.consultorios) || e.consultorios < 1) err(`${e.codigo}: consultorios debe ser un entero >= 1`);
    if (!(e.peso > 0)) err(`${e.codigo}: peso debe ser > 0`);
    dist(e.consultaMin, `${e.codigo}.consultaMin`);
  }
  if (c.perfilHorario?.some((x) => !(x >= 0))) err('perfilHorario no puede tener valores negativos');
  const esperadas = (c.llegadasPorHora * c.duracionMin) / 60 * Math.max(1, ...(c.perfilHorario ?? [1]));
  if (esperadas > MAX_LLEGADAS_ESPERADAS) err(`se esperan demasiadas llegadas (${Math.round(esperadas)})`);
}

interface Paciente {
  id: number;
  urgente: boolean;
  espIdx: number;
  tLlegada: number;
  tEntradaCola: number;
  esperaRecepcion: number;
  esperaEspecialidad: number;
  tSalida: number;
}

interface Recurso {
  id: string;
  nombre: string;
  dist: Dist;
  libre: boolean[];
  colaUrgente: number[];
  colaNormal: number[];
  esperas: number[];
  servicios: number[];
  areaCola: number;
  ultimoT: number;
  colaMax: number;
  atendidos: number;
}

type TipoFin = 'fin_registro' | 'fin_consulta' | 'llegada';
interface EventoFuturo {
  t: number;
  seq: number;
  tipo: TipoFin;
  pacienteId: number;
  recurso: number; // índice en `recursos` (0 = recepción)
  puesto: number;
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.max(0, Math.ceil(p * orden.length) - 1));
  return orden[i] ?? 0;
}

const promedio = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/**
 * Simulación de eventos discretos del flujo del paciente:
 *
 *   llegada → cola de recepción → registro → cola de especialidad → consulta → salida
 *
 * - Las llegadas siguen un proceso de Poisson (con perfil horario opcional,
 *   por el método de adelgazamiento / thinning).
 * - Recepción y cada especialidad son recursos con N servidores y una cola.
 *   La cola de especialidad atiende primero a los urgentes y luego por orden de llegada.
 * - Los tiempos de registro y consulta son lognormales (media y desviación configurables).
 * - Tras `duracionMin` ya no llegan pacientes, pero se atiende a los que quedan.
 */
export function simular(config: SimConfig, opciones: OpcionesSim = {}): ResultadoSim {
  validarConfig(config);
  const guardarTimeline = opciones.timeline ?? true;
  const intervalo = opciones.intervaloMuestreoMin ?? 5;
  const rng = crearRng(config.semilla);

  const crearRecurso = (id: string, nombre: string, servidores: number, dist: Dist): Recurso => ({
    id,
    nombre,
    dist,
    libre: Array.from({ length: servidores }, () => true),
    colaUrgente: [],
    colaNormal: [],
    esperas: [],
    servicios: [],
    areaCola: 0,
    ultimoT: 0,
    colaMax: 0,
    atendidos: 0,
  });

  // recursos[0] = recepción; recursos[i + 1] = especialidad i
  const recursos: Recurso[] = [
    crearRecurso('recepcion', 'Recepción', config.puestosRecepcion, config.registroMin),
    ...config.especialidades.map((e) => crearRecurso(e.codigo, e.nombre, e.consultorios, e.consultaMin)),
  ];
  const pesos = config.especialidades.map((e) => e.peso);

  // Los ids empiezan en 1; la posición 0 del arreglo queda vacía.
  const pacientes: (Paciente | undefined)[] = [];
  const timeline: EventoSim[] = [];
  const futuros = new MinHeap<EventoFuturo>((a, b) => a.t < b.t || (a.t === b.t && a.seq < b.seq));
  let seq = 0;
  let llegados = 0;
  let salidos = 0;
  let ultimaT = 0;

  const largoCola = (r: Recurso) => r.colaUrgente.length + r.colaNormal.length;
  const tocar = (r: Recurso, t: number) => {
    r.areaCola += largoCola(r) * (t - r.ultimoT);
    r.ultimoT = t;
  };
  const registrar = (t: number, tipo: TipoEvento, p: Paciente, recurso: string, puesto?: number) => {
    if (!guardarTimeline) return;
    const espCodigo = config.especialidades[p.espIdx]?.codigo ?? '';
    timeline.push({
      t: r2(t),
      tipo,
      pacienteId: p.id,
      recurso,
      ...(puesto !== undefined ? { puesto } : {}),
      urgente: p.urgente,
      especialidad: espCodigo,
    });
  };

  const encolar = (idx: number, p: Paciente, t: number) => {
    const r = recursos[idx]!;
    tocar(r, t);
    p.tEntradaCola = t;
    // Solo la cola de consulta (idx > 0) da prioridad a urgentes.
    if (idx > 0 && p.urgente) r.colaUrgente.push(p.id);
    else r.colaNormal.push(p.id);
    r.colaMax = Math.max(r.colaMax, largoCola(r));
  };

  const intentarIniciar = (idx: number, t: number) => {
    const r = recursos[idx]!;
    for (;;) {
      const puestoLibre = r.libre.findIndex((l) => l);
      if (puestoLibre < 0 || largoCola(r) === 0) return;
      tocar(r, t);
      const pid = r.colaUrgente.length > 0 ? r.colaUrgente.shift()! : r.colaNormal.shift()!;
      const p = pacientes[pid]!;
      const espera = t - p.tEntradaCola;
      if (idx === 0) p.esperaRecepcion = espera;
      else p.esperaEspecialidad = espera;
      r.esperas.push(espera);
      const duracion = lognormal(rng, r.dist);
      r.servicios.push(duracion);
      r.libre[puestoLibre] = false;
      registrar(t, idx === 0 ? 'inicio_registro' : 'inicio_consulta', p, r.id, puestoLibre + 1);
      futuros.push({
        t: t + duracion,
        seq: seq++,
        tipo: idx === 0 ? 'fin_registro' : 'fin_consulta',
        pacienteId: pid,
        recurso: idx,
        puesto: puestoLibre,
      });
    }
  };

  // Llegadas: Poisson no homogéneo por adelgazamiento.
  const perfil = config.perfilHorario && config.perfilHorario.length > 0 ? config.perfilHorario : undefined;
  const maxFactor = perfil ? Math.max(...perfil, 1e-9) : 1;
  const lambdaMax = (config.llegadasPorHora / 60) * maxFactor;
  const factor = (t: number) => (perfil ? (perfil[Math.min(Math.floor(t / 60), perfil.length - 1)] ?? 1) : 1);
  const proximaLlegada = (desde: number): number | null => {
    if (lambdaMax <= 0) return null;
    let x = desde;
    for (;;) {
      x += exponencial(rng, lambdaMax);
      if (x >= config.duracionMin) return null;
      if (rng() <= factor(x) / maxFactor) return x;
    }
  };
  const programarLlegada = (desde: number) => {
    const t = proximaLlegada(desde);
    if (t !== null) futuros.push({ t, seq: seq++, tipo: 'llegada', pacienteId: -1, recurso: 0, puesto: 0 });
  };

  // Muestreo de colas
  const serieCola: PuntoCola[] = [];
  let proxMuestra = 0;
  const snapshot = (t: number): PuntoCola => ({
    t: r2(t),
    recepcion: largoCola(recursos[0]!),
    especialidades: Object.fromEntries(
      config.especialidades.map((e, i) => [e.codigo, largoCola(recursos[i + 1]!)]),
    ),
    enSistema: llegados - salidos,
  });
  const muestrear = (hasta: number) => {
    while (proxMuestra <= hasta) {
      serieCola.push(snapshot(proxMuestra));
      proxMuestra += intervalo;
    }
  };

  programarLlegada(0);

  for (let ev = futuros.pop(); ev; ev = futuros.pop()) {
    muestrear(ev.t);
    ultimaT = ev.t;

    if (ev.tipo === 'llegada') {
      const p: Paciente = {
        id: ++llegados,
        urgente: rng() < config.proporcionUrgentes,
        espIdx: elegirPonderado(rng, pesos),
        tLlegada: ev.t,
        tEntradaCola: ev.t,
        esperaRecepcion: 0,
        esperaEspecialidad: 0,
        tSalida: -1,
      };
      pacientes[p.id] = p; // índice = id (la posición 0 queda vacía)
      registrar(ev.t, 'llegada', p, 'recepcion');
      encolar(0, p, ev.t);
      intentarIniciar(0, ev.t);
      programarLlegada(ev.t);
    } else if (ev.tipo === 'fin_registro') {
      const p = pacientes[ev.pacienteId]!;
      const rec = recursos[0]!;
      rec.libre[ev.puesto] = true;
      rec.atendidos++;
      registrar(ev.t, 'fin_registro', p, 'recepcion', ev.puesto + 1);
      encolar(p.espIdx + 1, p, ev.t);
      intentarIniciar(p.espIdx + 1, ev.t);
      intentarIniciar(0, ev.t);
    } else {
      const p = pacientes[ev.pacienteId]!;
      const rec = recursos[ev.recurso]!;
      rec.libre[ev.puesto] = true;
      rec.atendidos++;
      p.tSalida = ev.t;
      salidos++;
      registrar(ev.t, 'fin_consulta', p, rec.id, ev.puesto + 1);
      intentarIniciar(ev.recurso, ev.t);
    }
  }
  muestrear(ultimaT);
  if (serieCola.length === 0 || serieCola[serieCola.length - 1]!.t < r2(ultimaT)) serieCola.push(snapshot(ultimaT));

  // ── Métricas ────────────────────────────────────────────────────────────
  const tFin = ultimaT;
  const metricasDe = (r: Recurso): MetricasRecurso => {
    tocar(r, tFin);
    const ocupado = r.servicios.reduce((a, b) => a + b, 0);
    return {
      id: r.id,
      nombre: r.nombre,
      servidores: r.libre.length,
      atendidos: r.atendidos,
      esperaPromedioMin: r2(promedio(r.esperas)),
      esperaP90Min: r2(percentil(r.esperas, 0.9)),
      esperaMaxMin: r2(r.esperas.length ? Math.max(...r.esperas) : 0),
      servicioPromedioMin: r2(promedio(r.servicios)),
      utilizacion: r3(tFin > 0 ? ocupado / (r.libre.length * tFin) : 0),
      colaPromedio: r2(tFin > 0 ? r.areaCola / tFin : 0),
      colaMax: r.colaMax,
    };
  };

  const todas = recursos.map(metricasDe);
  const [recepcion, ...especialidades] = todas as [MetricasRecurso, ...MetricasRecurso[]];

  const ranking: CuelloBotella[] = todas
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      esperaPromedioMin: m.esperaPromedioMin,
      utilizacion: m.utilizacion,
      saturado: m.utilizacion >= UMBRAL_SATURACION,
    }))
    .sort((a, b) => b.esperaPromedioMin - a.esperaPromedioMin || b.utilizacion - a.utilizacion);
  const primero = ranking[0];
  const cuelloBotella = primero && primero.esperaPromedioMin > 0 ? primero : null;

  const atendidosLista = pacientes.filter((p): p is Paciente => p !== undefined && p.tSalida >= 0);
  const enSistema = atendidosLista.map((p) => p.tSalida - p.tLlegada);

  return {
    llegados,
    atendidos: atendidosLista.length,
    finMin: r2(tFin),
    esperaTotalPromedioMin: r2(promedio(atendidosLista.map((p) => p.esperaRecepcion + p.esperaEspecialidad))),
    tiempoEnSistemaPromedioMin: r2(promedio(enSistema)),
    tiempoEnSistemaP90Min: r2(percentil(enSistema, 0.9)),
    recepcion,
    especialidades,
    cuelloBotella,
    ranking,
    serieCola,
    timeline,
  };
}
