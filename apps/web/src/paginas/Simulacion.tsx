import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResumenEscenario, ResultadoSim, SimConfig } from '@siarf/sim';
import { api, mensajeError } from '../api';
import { Barra, Cargando, ErrorMsg, Tarjeta, fmtMin, relojSim, useCarga } from '../ui';
import { Plano } from './Plano';

interface Corrida {
  id: number;
  nombre: string;
  config: SimConfig;
  resultado: ResultadoSim;
}

export function Simulacion() {
  const params = useCarga(() => api<SimConfig>('/simulaciones/parametros'));
  const [config, setConfig] = useState<SimConfig | null>(null);
  const [corrida, setCorrida] = useState<Corrida | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.data && !config) setConfig(params.data);
  }, [params.data, config]);

  async function ejecutar() {
    if (!config) return;
    setEjecutando(true);
    setError(null);
    try {
      setCorrida(await api<Corrida>('/simulaciones', { method: 'POST', body: { config } }));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEjecutando(false);
    }
  }

  if (params.cargando && !config) return <Cargando texto="Cargando parámetros…" />;
  if (!config) return <ErrorMsg texto={params.error ?? 'No se pudieron cargar los parámetros'} />;

  return (
    <div className="columna">
      <Parametros config={config} onChange={setConfig} onEjecutar={() => void ejecutar()} ejecutando={ejecutando} />
      <ErrorMsg texto={error} />
      {corrida && (
        <>
          <Reproductor corrida={corrida} />
          <Resultados corrida={corrida} />
          <Mejoras config={corrida.config} resultado={corrida.resultado} />
        </>
      )}
    </div>
  );
}

// ── Parámetros ───────────────────────────────────────────────────────────────
function Parametros({
  config,
  onChange,
  onEjecutar,
  ejecutando,
}: {
  config: SimConfig;
  onChange: (c: SimConfig) => void;
  onEjecutar: () => void;
  ejecutando: boolean;
}) {
  const num = (v: string, min: number, max: number, entero = false) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, entero ? Math.round(x) : x));
  };
  const setEsp = (codigo: string, parche: Partial<SimConfig['especialidades'][number]>) =>
    onChange({ ...config, especialidades: config.especialidades.map((e) => (e.codigo === codigo ? { ...e, ...parche } : e)) });

  return (
    <Tarjeta
      titulo="Parámetros de la simulación"
      acciones={
        <button className="primario" onClick={onEjecutar} disabled={ejecutando}>
          {ejecutando ? 'Simulando…' : 'Ejecutar simulación'}
        </button>
      }
    >
      <div className="rejilla-params">
        <label>
          Llegadas por hora
          <input type="number" min={0} max={300} value={config.llegadasPorHora}
            onChange={(e) => onChange({ ...config, llegadasPorHora: num(e.target.value, 0, 300) })} />
        </label>
        <label>
          Puestos de recepción
          <input type="number" min={1} max={20} value={config.puestosRecepcion}
            onChange={(e) => onChange({ ...config, puestosRecepcion: num(e.target.value, 1, 20, true) })} />
        </label>
        <label>
          Registro (min, media)
          <input type="number" min={0.5} max={60} step={0.5} value={config.registroMin.media}
            onChange={(e) => onChange({ ...config, registroMin: { ...config.registroMin, media: num(e.target.value, 0.5, 60) } })} />
        </label>
        <label>
          Jornada (min)
          <input type="number" min={30} max={1440} step={30} value={config.duracionMin}
            onChange={(e) => onChange({ ...config, duracionMin: num(e.target.value, 30, 1440, true) })} />
        </label>
        <label>
          % urgentes
          <input type="number" min={0} max={100} value={Math.round(config.proporcionUrgentes * 100)}
            onChange={(e) => onChange({ ...config, proporcionUrgentes: num(e.target.value, 0, 100) / 100 })} />
        </label>
        <label>
          Semilla
          <input type="number" value={config.semilla}
            onChange={(e) => onChange({ ...config, semilla: num(e.target.value, 0, 2_000_000_000, true) })} />
        </label>
      </div>

      <details>
        <summary>Consultorios y duración de consulta por especialidad</summary>
        <table>
          <thead>
            <tr><th>Especialidad</th><th>Consultorios</th><th>Consulta (min)</th><th>Peso</th></tr>
          </thead>
          <tbody>
            {config.especialidades.map((e) => (
              <tr key={e.codigo}>
                <td>{e.nombre}</td>
                <td><input type="number" min={1} max={30} value={e.consultorios}
                  onChange={(ev) => setEsp(e.codigo, { consultorios: num(ev.target.value, 1, 30, true) })} /></td>
                <td><input type="number" min={1} max={120} value={e.consultaMin.media}
                  onChange={(ev) => setEsp(e.codigo, { consultaMin: { ...e.consultaMin, media: num(ev.target.value, 1, 120) } })} /></td>
                <td><input type="number" min={0.01} max={100} step={0.01} value={e.peso}
                  onChange={(ev) => setEsp(e.codigo, { peso: num(ev.target.value, 0.01, 100) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted pequeno">
          El peso es la proporción relativa de pacientes que llegan a cada especialidad. Los valores iniciales son supuestos:
          calíbrelos con datos reales (pestaña «Métricas reales»).
        </p>
      </details>
    </Tarjeta>
  );
}

// ── Reproductor animado ──────────────────────────────────────────────────────
const VELOCIDADES = [5, 15, 30, 60, 120];

function Reproductor({ corrida }: { corrida: Corrida }) {
  const { resultado, config } = corrida;
  const [t, setT] = useState(0);
  const [jugando, setJugando] = useState(false);
  const [vel, setVel] = useState(30); // minutos simulados por segundo real
  const tRef = useRef(0);
  tRef.current = t;

  // Reinicia al llegar una simulación nueva.
  useEffect(() => {
    setT(0);
    setJugando(false);
  }, [corrida.id]);

  useEffect(() => {
    if (!jugando) return;
    let previo = performance.now();
    let raf = 0;
    const paso = (ahora: number) => {
      const dt = (ahora - previo) / 1000;
      previo = ahora;
      const siguiente = Math.min(resultado.finMin, tRef.current + dt * vel);
      setT(siguiente);
      if (siguiente >= resultado.finMin) setJugando(false);
      else raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [jugando, vel, resultado.finMin]);

  const punto = useMemo(() => {
    let mejor = resultado.serieCola[0];
    for (const p of resultado.serieCola) {
      if (p.t > t) break;
      mejor = p;
    }
    return mejor;
  }, [resultado.serieCola, t]);

  const alternar = () => {
    if (!jugando && t >= resultado.finMin) setT(0);
    setJugando((j) => !j);
  };

  return (
    <Tarjeta titulo="Plano del hospital">
      <div className="controles">
        <button className="primario" onClick={alternar}>{jugando ? '⏸ Pausar' : t >= resultado.finMin ? '↺ Repetir' : '▶ Reproducir'}</button>
        <label className="en-linea">
          Velocidad
          <select value={vel} onChange={(e) => setVel(Number(e.target.value))}>
            {VELOCIDADES.map((v) => <option key={v} value={v}>{v} min/s</option>)}
          </select>
        </label>
        <strong className="reloj">{relojSim(t)}</strong>
        <span className="muted">En el sistema: {punto?.enSistema ?? 0} · Cola recepción: {punto?.recepcion ?? 0}</span>
      </div>
      <input
        type="range" min={0} max={resultado.finMin} step={0.5} value={t}
        onChange={(e) => { setJugando(false); setT(Number(e.target.value)); }}
        aria-label="Línea de tiempo de la simulación" className="deslizador"
      />
      <Plano config={config} timeline={resultado.timeline} t={t} />
      <div className="leyenda">
        <span><i className="pac" /> Normal</span>
        <span><i className="pac urgente" /> Urgente</span>
        <span><i className="cuadro" /> Libre</span>
        <span><i className="cuadro ocupado" /> Ocupado</span>
        <span className="muted">Tarjeta ámbar/roja: sala de espera con 3+/6+ pacientes</span>
      </div>
      <SerieCola resultado={resultado} t={t} />
    </Tarjeta>
  );
}

function SerieCola({ resultado, t }: { resultado: ResultadoSim; t: number }) {
  const serie = resultado.serieCola;
  const W = 1000;
  const H = 110;
  const maxY = Math.max(5, ...serie.map((p) => p.enSistema));
  const x = (m: number) => (m / Math.max(1, resultado.finMin)) * (W - 40) + 30;
  const y = (v: number) => H - 18 - (v / maxY) * (H - 30);
  const puntos = serie.map((p) => `${x(p.t).toFixed(1)},${y(p.enSistema).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="serie" role="img" aria-label="Pacientes en el sistema a lo largo del día">
      <text x={4} y={14} className="subtitulo">Pacientes en el sistema (máx. {maxY})</text>
      <line x1={30} y1={H - 18} x2={W - 10} y2={H - 18} className="eje" />
      <polyline points={puntos} className="linea" />
      <line x1={x(t)} y1={10} x2={x(t)} y2={H - 18} className="marca" />
    </svg>
  );
}

// ── Resultados y cuello de botella ───────────────────────────────────────────
function Resultados({ corrida }: { corrida: Corrida }) {
  const r = corrida.resultado;
  const maxEspera = Math.max(1, ...r.ranking.map((x) => x.esperaPromedioMin));
  const detalle = [r.recepcion, ...r.especialidades];
  return (
    <Tarjeta titulo="Resultados">
      <div className="kpis">
        <Kpi etiqueta="Pacientes atendidos" valor={`${r.atendidos} / ${r.llegados}`} />
        <Kpi etiqueta="Espera promedio total" valor={fmtMin(r.esperaTotalPromedioMin)} />
        <Kpi etiqueta="Tiempo en el sistema" valor={fmtMin(r.tiempoEnSistemaPromedioMin)} detalle={`p90: ${fmtMin(r.tiempoEnSistemaP90Min)}`} />
        <Kpi etiqueta="Fin de la jornada" valor={relojSim(r.finMin)} />
      </div>

      {r.cuelloBotella ? (
        <div className="cuello">
          <strong>Cuello de botella: {r.cuelloBotella.nombre}</strong>
          <span>
            espera promedio {fmtMin(r.cuelloBotella.esperaPromedioMin)} · utilización {Math.round(r.cuelloBotella.utilizacion * 100)}%
            {r.cuelloBotella.saturado ? ' (saturado)' : ''}
          </span>
        </div>
      ) : (
        <p className="exito">No se detectaron esperas significativas.</p>
      )}

      <h3>Espera promedio por recurso</h3>
      <ul className="lista-sin-vineta">
        {r.ranking.map((x) => (
          <li key={x.id} className="fila-barra">
            <span>{x.nombre}</span>
            <Barra valor={x.esperaPromedioMin / maxEspera} etiqueta={fmtMin(x.esperaPromedioMin)} alerta={x.saturado} />
          </li>
        ))}
      </ul>

      <details>
        <summary>Tabla detallada</summary>
        <table>
          <thead>
            <tr><th>Recurso</th><th>Serv.</th><th>Atendidos</th><th>Espera prom.</th><th>Espera p90</th><th>Espera máx.</th><th>Servicio prom.</th><th>Utilización</th><th>Cola máx.</th></tr>
          </thead>
          <tbody>
            {detalle.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td><td>{m.servidores}</td><td>{m.atendidos}</td>
                <td>{fmtMin(m.esperaPromedioMin)}</td><td>{fmtMin(m.esperaP90Min)}</td><td>{fmtMin(m.esperaMaxMin)}</td>
                <td>{fmtMin(m.servicioPromedioMin)}</td>
                <td>{Math.round(m.utilizacion * 100)}%</td><td>{m.colaMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Tarjeta>
  );
}

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="kpi">
      <span className="muted">{etiqueta}</span>
      <strong>{valor}</strong>
      {detalle && <span className="muted pequeno">{detalle}</span>}
    </div>
  );
}

// ── Sugerencia de mejoras (comparación de escenarios) ────────────────────────
function Mejoras({ config, resultado }: { config: SimConfig; resultado: ResultadoSim }) {
  const [filas, setFilas] = useState<ResumenEscenario[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los resultados anteriores dejan de valer al cambiar de simulación.
  useEffect(() => setFilas(null), [resultado]);

  const comparar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Escenarios: +1 puesto de recepción y +1 consultorio en cada uno de los 3 recursos con más espera.
      const escenarios: { nombre: string; cambios: { puestosRecepcion?: number; consultorios?: Record<string, number> } }[] = [];
      const top = resultado.ranking.filter((r) => r.esperaPromedioMin > 0).slice(0, 3);
      for (const r of top) {
        if (r.id === 'recepcion') {
          escenarios.push({ nombre: '+1 puesto de recepción', cambios: { puestosRecepcion: config.puestosRecepcion + 1 } });
        } else {
          const esp = config.especialidades.find((e) => e.codigo === r.id);
          if (esp) escenarios.push({ nombre: `+1 consultorio de ${esp.nombre}`, cambios: { consultorios: { [esp.codigo]: esp.consultorios + 1 } } });
        }
      }
      if (escenarios.length === 0) {
        setFilas([]);
        return;
      }
      setFilas(await api<ResumenEscenario[]>('/simulaciones/comparar', { method: 'POST', body: { base: config, escenarios, replicas: 10 } }));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [config, resultado]);

  return (
    <Tarjeta
      titulo="¿Cómo optimizar el flujo?"
      acciones={<button onClick={() => void comparar()} disabled={cargando}>{cargando ? 'Calculando…' : 'Comparar escenarios'}</button>}
    >
      <p className="muted">
        Prueba agregar un recurso a los puntos con más espera. Cada escenario se simula 10 veces con semillas distintas y se muestra el promedio ± desviación.
      </p>
      <ErrorMsg texto={error} />
      {filas && filas.length === 0 && <p className="exito">No hay esperas que optimizar con estos parámetros.</p>}
      {filas && filas.length > 0 && <TablaEscenarios filas={filas} />}
    </Tarjeta>
  );
}

function TablaEscenarios({ filas }: { filas: ResumenEscenario[] }) {
  const base = filas[0]?.metricas['esperaTotalPromedioMin']?.media ?? 0;
  return (
    <table>
      <thead>
        <tr><th>Escenario</th><th>Espera total (min)</th><th>Cambio</th><th>Tiempo en el sistema (min)</th><th>Cuello más frecuente</th></tr>
      </thead>
      <tbody>
        {filas.map((f, i) => {
          const e = f.metricas['esperaTotalPromedioMin'];
          const s = f.metricas['tiempoEnSistemaPromedioMin'];
          const dif = e && base > 0 ? ((e.media - base) / base) * 100 : 0;
          const cuello = Object.entries(f.cuellosBotella).sort((a, b) => b[1] - a[1])[0];
          return (
            <tr key={f.nombre}>
              <td>{f.nombre}</td>
              <td>{e ? `${e.media.toFixed(1)} ± ${e.desv.toFixed(1)}` : '—'}</td>
              <td className={i === 0 ? '' : dif < 0 ? 'mejora' : 'empeora'}>{i === 0 ? '—' : `${dif > 0 ? '+' : ''}${dif.toFixed(0)}%`}</td>
              <td>{s ? `${s.media.toFixed(1)} ± ${s.desv.toFixed(1)}` : '—'}</td>
              <td>{cuello ? `${cuello[0]} (${cuello[1]}/${f.replicas})` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
