import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResumenEscenario, ResultadoSim, SimConfig } from '@siarf/sim';
import { api, mensajeError } from '../api';
import {
  Barra,
  Cargando,
  ErrorMsg,
  IconoOk,
  IconoTiempo,
  IconoUsuarios,
  IconoDocumento,
  IconoAlerta,
  IconoGrafica,
  Stat,
  Tarjeta,
  Vacio,
  fmtMin,
  relojSim,
  useCarga,
} from '../ui';
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
    <div className="columna sim-contenido">
      <header className="pagina-cab admin-cab">
        <div>
          <p className="sobre-titulo">Simulación de flujo</p>
          <h1>Simulador de consultorio</h1>
          <p className="muted">
            Prueba distintos escenarios de llegada y capacidad para ver cómo se comportan los tiempos de espera y detectar cuellos de botella.
          </p>
        </div>
      </header>

      <Parametros
        config={config}
        onChange={setConfig}
        onEjecutar={() => void ejecutar()}
        onRestablecer={() => params.data && setConfig(params.data)}
        ejecutando={ejecutando}
      />
      <ErrorMsg texto={error} />

      {!corrida && (
        <Tarjeta className="tarjeta-vacio-inicial">
          <div className="vacio-inicial">
            <div className="pasos-vacio">
              <div className="paso-vacio">
                <span className="num-paso">1</span>
                <div>
                  <strong>Ajuste los parámetros</strong>
                  <p>Llegadas por hora, puestos de recepción, consultorios y proporción de urgentes.</p>
                </div>
              </div>
              <div className="paso-vacio">
                <span className="num-paso">2</span>
                <div>
                  <strong>Ejecute la simulación</strong>
                  <p>Vea el plano animado del hospital y la evolución de la cola a lo largo de la jornada.</p>
                </div>
              </div>
              <div className="paso-vacio">
                <span className="num-paso">3</span>
                <div>
                  <strong>Analice los resultados</strong>
                  <p>Identifique cuellos de botella y compare escenarios para optimizar el flujo.</p>
                </div>
              </div>
            </div>
            <p className="muted pequeno">
              Los valores iniciales son supuestos. Calíbrelos con datos reales de la pestaña «Métricas reales».
            </p>
          </div>
        </Tarjeta>
      )}

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
  onRestablecer,
  ejecutando,
}: {
  config: SimConfig;
  onChange: (c: SimConfig) => void;
  onEjecutar: () => void;
  onRestablecer: () => void;
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
      subtitulo="Ajuste el escenario y calibre con datos reales antes de ejecutar"
      acciones={
        <>
          <button onClick={onRestablecer} disabled={ejecutando}>Restablecer</button>
          <button className="primario ancho-ejecutar" onClick={onEjecutar} disabled={ejecutando}>
            {ejecutando ? 'Simulando…' : 'Ejecutar simulación'}
          </button>
        </>
      }
    >
      <div className="sim-param-grupos">
        <section className="sim-param-grupo">
          <h3>Flujo de llegada</h3>
          <div className="rejilla-params">
            <label>
              Llegadas por hora
              <input type="number" min={0} max={300} value={config.llegadasPorHora}
                onChange={(e) => onChange({ ...config, llegadasPorHora: num(e.target.value, 0, 300) })} />
              <span className="pista">pacientes / hora</span>
            </label>
            <label>
              % urgentes
              <input type="number" min={0} max={100} value={Math.round(config.proporcionUrgentes * 100)}
                onChange={(e) => onChange({ ...config, proporcionUrgentes: num(e.target.value, 0, 100) / 100 })} />
              <span className="pista">de las llegadas</span>
            </label>
            <label>
              Jornada (min)
              <input type="number" min={30} max={1440} step={30} value={config.duracionMin}
                onChange={(e) => onChange({ ...config, duracionMin: num(e.target.value, 30, 1440, true) })} />
              <span className="pista">duración del día</span>
            </label>
            <label>
              Semilla
              <input type="number" value={config.semilla}
                onChange={(e) => onChange({ ...config, semilla: num(e.target.value, 0, 2_000_000_000, true) })} />
              <span className="pista">aleatoriedad</span>
            </label>
          </div>
        </section>

        <section className="sim-param-grupo">
          <h3>Capacidad de atención</h3>
          <div className="rejilla-params">
            <label>
              Puestos de recepción
              <input type="number" min={1} max={20} value={config.puestosRecepcion}
                onChange={(e) => onChange({ ...config, puestosRecepcion: num(e.target.value, 1, 20, true) })} />
              <span className="pista">ventanillas</span>
            </label>
            <label>
              Registro (min, media)
              <input type="number" min={0.5} max={60} step={0.5} value={config.registroMin.media}
                onChange={(e) => onChange({ ...config, registroMin: { ...config.registroMin, media: num(e.target.value, 0.5, 60) } })} />
              <span className="pista">tiempo en recepción</span>
            </label>
          </div>
        </section>
      </div>

      <details className="detalle-especialidades">
        <summary>Consultorios y duración de consulta por especialidad</summary>
        <div className="tabla-scroll">
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
        </div>
        <p className="muted pequeno">
          El peso es la proporción relativa de pacientes que llegan a cada especialidad. Los valores iniciales son supuestos:
          calíbelos con datos reales (pestaña «Métricas reales»).
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
    <Tarjeta className="tarjeta-reproductor">
      <header className="tarjeta-cab simulacion-cab">
        <div>
          <h2>Plano del hospital</h2>
          <span className="subtitulo">Evolución de la jornada en tiempo simulado</span>
        </div>
        <div className="estado-en-vivo">
          <span className="punto-vivo" aria-hidden="true"></span>
          <span>{jugando ? 'En ejecución' : 'Listo'}</span>
        </div>
      </header>

      <div className="controles-reproductor">
        <button className="primario btn-reproducir" onClick={alternar}>
          {jugando ? '⏸ Pausar' : t >= resultado.finMin ? '↺ Repetir' : '▶ Reproducir'}
        </button>
        <label className="en-linea vel-select">
          <span>Velocidad</span>
          <select value={vel} onChange={(e) => setVel(Number(e.target.value))}>
            {VELOCIDADES.map((v) => <option key={v} value={v}>{v} min/s</option>)}
          </select>
        </label>
        <div className="reloj-grande">
          <span className="reloj">{relojSim(t)}</span>
          <span className="membro">minutos simulados</span>
        </div>
        <div className="estado-sistema">
          <span className="etiqueta">En el sistema</span>
          <strong>{punto?.enSistema ?? 0}</strong>
          <span className="etiqueta">Cola recepción</span>
          <strong>{punto?.recepcion ?? 0}</strong>
        </div>
      </div>

      <input
        type="range" min={0} max={resultado.finMin} step={0.5} value={t}
        onChange={(e) => { setJugando(false); setT(Number(e.target.value)); }}
        aria-label="Línea de tiempo de la simulación" className="deslizador"
      />

      <div className="plano-wrap">
        <Plano config={config} timeline={resultado.timeline} t={t} />
      </div>

      <div className="leyenda-repro">
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
    <section className="tarjeta-serie">
      <header className="tarjeta-cab ser-cab">
        <div>
          <h2>Pacientes en el sistema</h2>
          <span className="subtitulo">Evolución de la ocupación a lo largo del día</span>
        </div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="serie" role="img" aria-label="Pacientes en el sistema a lo largo del día">
        <text x={4} y={14} className="subtitulo-svg">Pacientes en el sistema (máx. {maxY})</text>
        <line x1={30} y1={H - 18} x2={W - 10} y2={H - 18} className="eje" />
        <polyline points={puntos} className="linea" />
        <line x1={x(t)} y1={10} x2={x(t)} y2={H - 18} className="marca" />
      </svg>
    </section>
  );
}

// ── Resultados y cuello de botella ───────────────────────────────────────────
function Resultados({ corrida }: { corrida: Corrida }) {
  const r = corrida.resultado;
  const maxEspera = Math.max(1, ...r.ranking.map((x) => x.esperaPromedioMin));
  const detalle = [r.recepcion, ...r.especialidades];
  const tieneCuello = Boolean(r.cuelloBotella);
  const usoPromedio = detalle.reduce((acc, m) => acc + m.utilizacion, 0) / detalle.length;

  return (
    <Tarjeta className="tarjeta-resultados">
      <header className="tarjeta-cab res-cab">
        <div>
          <h2>Resultados de la simulación</h2>
          <span className="subtitulo">Indicadores clave de la jornada simulada</span>
        </div>
      </header>

      <div className="stats-resultados">
        <Stat etiqueta="Pacientes atendidos" valor={`${r.atendidos} / ${r.llegados}`} acento="ok" icono={<IconoOk />} />
        <Stat etiqueta="Espera promedio total" valor={fmtMin(r.esperaTotalPromedioMin)} acento="ambar" icono={<IconoTiempo />} />
        <Stat
          etiqueta="Tiempo en el sistema"
          valor={fmtMin(r.tiempoEnSistemaPromedioMin)}
          detalle={`p90: ${fmtMin(r.tiempoEnSistemaP90Min)}`}
          acento="info"
          icono={<IconoTiempo />}
        />
        <Stat etiqueta="Fin de la jornada" valor={relojSim(r.finMin)} acento="primario" icono={<IconoUsuarios />} />
      </div>

      <div className="indicadores-resumen">
        <div className="indicador">
          <strong className="valor">{Math.round(usoPromedio * 100)}%</strong>
          <span className="etiqueta">Utilización promedio</span>
        </div>
        <div className="indicador">
          <strong className="valor">{r.atendidos}</strong>
          <span className="etiqueta">Pacientes atendidos</span>
        </div>
        <div className="indicador">
          <strong className="valor">{r.llegados - r.atendidos}</strong>
          <span className="etiqueta">No atendidos</span>
        </div>
        <div className="indicador">
          <strong className="valor">{detalle.length}</strong>
          <span className="etiqueta">Recursos evaluados</span>
        </div>
      </div>

      {tieneCuello && r.cuelloBotella ? (
        <div className="cuello-botella-alerta">
          <span className="icono-alerta"><IconoAlerta /></span>
          <div>
            <strong>Cuello de botella: {r.cuelloBotella.nombre}</strong>
            <span>
              espera promedio {fmtMin(r.cuelloBotella.esperaPromedioMin)} ·
              utilización {Math.round(r.cuelloBotella.utilizacion * 100)}%{r.cuelloBotella.saturado ? ' · saturado' : ''}
            </span>
          </div>
        </div>
      ) : (
        <div className="aviso-ok">
          <span className="icono-aviso"><IconoOk /></span>
          <span>No se detectaron esperas significativas en esta jornada.</span>
        </div>
      )}

      <h3>Espera promedio por recurso</h3>
      <ul className="lista-sin-vineta lista-recursos">
        {r.ranking.map((x) => (
          <li key={x.id} className="fila-barra fila-recurso">
            <span>{x.nombre}</span>
            <Barra valor={x.esperaPromedioMin / maxEspera} etiqueta={fmtMin(x.esperaPromedioMin)} alerta={x.saturado} />
          </li>
        ))}
      </ul>

      <details className="detalle-tabla">
        <summary>Tabla detallada por recurso</summary>
        <div className="tabla-scroll">
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
        </div>
      </details>
    </Tarjeta>
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
    <Tarjeta className="tarjeta-mejoras">
      <header className="tarjeta-cab mej-cab">
        <div>
          <h2>¿Cómo optimizar el flujo?</h2>
          <span className="subtitulo">Pruebe agregar recursos en los puntos con más espera</span>
        </div>
        <button className="primario btn-comparar" onClick={() => void comparar()} disabled={cargando}>
          {cargando ? 'Calculando…' : 'Comparar escenarios'}
        </button>
      </header>

      <p className="muted pequeno">
        Cada escenario se simula 10 veces con semillas distintas y se muestra el promedio ± desviación estándar.
      </p>
      <ErrorMsg texto={error} />
      {filas && filas.length === 0 && (
        <div className="aviso-ok">
          <span className="icono-aviso"><IconoOk /></span>
          <span>No hay esperas que optimizar con estos parámetros.</span>
        </div>
      )}
      {filas && filas.length > 0 && <TablaEscenarios filas={filas} />}
    </Tarjeta>
  );
}

function TablaEscenarios({ filas }: { filas: ResumenEscenario[] }) {
  const base = filas[0]?.metricas['esperaTotalPromedioMin']?.media ?? 0;
  return (
    <section className="tarjeta-escenarios">
      <div className="tabla-scroll">
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
                <tr key={f.nombre} className={i === 0 ? 'fila-base' : dif < 0 ? 'fila-mejora' : 'fila-empeora'}>
                  <td>{f.nombre}</td>
                  <td>{e ? `${e.media.toFixed(1)} ± ${e.desv.toFixed(1)}` : '—'}</td>
                  <td className={i === 0 ? 'celda-base' : dif < 0 ? 'celda-mejora' : 'celda-empeora'}>
                    {i === 0 ? '—' : `${dif > 0 ? '+' : ''}${dif.toFixed(0)}%`}
                  </td>
                  <td>{s ? `${s.media.toFixed(1)} ± ${s.desv.toFixed(1)}` : '—'}</td>
                  <td>{cuello ? `${cuello[0]} (${cuello[1]}/${f.replicas})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
