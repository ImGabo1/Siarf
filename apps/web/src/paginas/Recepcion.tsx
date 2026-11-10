import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  EspecialidadDto,
  PacienteDto,
  RecomendacionDto,
  SintomaDto,
  VisitaColaDto,
  VisitaCreadaDto,
} from '@siarf/shared';
import { api, mensajeError } from '../api';
import {
  Barra,
  Cargando,
  ErrorMsg,
  IconoAlerta,
  IconoPulso,
  IconoTiempo,
  IconoUsuarios,
  Stat,
  Tarjeta,
  Vacio,
  fmtHora,
  iniciales,
  useCarga,
  usePolling,
} from '../ui';

export function Recepcion({ embebido = false }: { embebido?: boolean }) {
  const sintomas = useCarga(() => api<SintomaDto[]>('/sintomas'));
  const especialidades = useCarga(() => api<EspecialidadDto[]>('/especialidades'));
  const cola = usePolling(() => api<VisitaColaDto[]>('/visitas/cola'), 15_000);

  const [paciente, setPaciente] = useState<PacienteDto | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});
  const [recomendacion, setRecomendacion] = useState<RecomendacionDto | null>(null);
  const [espElegida, setEspElegida] = useState<number | null>(null);
  const [forzarUrgente, setForzarUrgente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<VisitaCreadaDto | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cantidad = Object.keys(seleccion).length;

  const enEspera = useMemo(() => (cola.data ?? []).filter((v) => v.estado === 'espera'), [cola.data]);
  const enConsulta = useMemo(() => (cola.data ?? []).filter((v) => v.estado === 'en_consulta'), [cola.data]);
  const urgentes = enEspera.filter((v) => v.prioridad === 'urgente').length;
  const esperaProm = enEspera.length
    ? Math.round(enEspera.reduce((total, v) => total + v.minutosEspera, 0) / enEspera.length)
    : 0;

  // Evalúa con el sistema experto cada vez que cambian los síntomas o el paciente (con retraso para no saturar).
  const contador = useRef(0);
  useEffect(() => {
    if (cantidad === 0) {
      setRecomendacion(null);
      return;
    }
    const mio = ++contador.current;
    const id = setTimeout(() => {
      api<RecomendacionDto>('/inferencia', {
        method: 'POST',
        body: {
          sintomas: Object.entries(seleccion).map(([codigo, intensidad]) => ({ codigo, intensidad })),
          ...(paciente ? { pacienteId: paciente.id } : {}),
        },
      })
        .then((r) => {
          if (mio !== contador.current) return; // llegó una respuesta más nueva
          setRecomendacion(r);
          setEspElegida(r.especialidades[0]?.especialidadId ?? null);
          setError(null);
        })
        .catch((e) => mio === contador.current && setError(mensajeError(e)));
    }, 400);
    return () => clearTimeout(id);
  }, [seleccion, paciente, cantidad]);

  async function registrar() {
    if (!paciente || cantidad === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api<VisitaCreadaDto>('/visitas', {
        method: 'POST',
        body: {
          pacienteId: paciente.id,
          sintomas: Object.entries(seleccion).map(([codigo, intensidad]) => ({ codigo, intensidad })),
          ...(espElegida ? { especialidadAsignadaId: espElegida } : {}),
          ...(forzarUrgente ? { forzarUrgente: true } : {}),
        },
      });
      setOk(r);
      setPaciente(null);
      setSeleccion({});
      setRecomendacion(null);
      setForzarUrgente(false);
      void cola.recargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id: number) {
    if (!window.confirm('¿Cancelar esta visita?')) return;
    try {
      await api(`/visitas/${id}/cancelar`, { method: 'POST' });
      void cola.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <div className="columna">
      {!embebido && (
        <header className="pagina-cab">
          <div>
            <p className="sobre-titulo">Flujo de llegada</p>
            <h1>Recepción</h1>
            <p className="muted">Registre al paciente, marque los síntomas y confirme la especialidad.</p>
          </div>
          <span className="badge consulta sin-punto">
            <span className="punto-vivo" aria-hidden="true" /> Actualización automática
          </span>
        </header>
      )}

      <section className="resumen-dia" aria-label="Resumen de la sala de espera">
        <Stat
          etiqueta="En espera"
          valor={enEspera.length}
          detalle="Pacientes aguardando"
          acento="primario"
          icono={<IconoUsuarios />}
        />
        <Stat
          etiqueta="Urgentes"
          valor={urgentes}
          detalle={urgentes > 0 ? 'Prioridad clínica' : 'Sin urgencias pendientes'}
          acento={urgentes > 0 ? 'peligro' : 'ok'}
          icono={<IconoAlerta />}
        />
        <Stat
          etiqueta="En consulta"
          valor={enConsulta.length}
          detalle="Siendo atendidos"
          acento="info"
          icono={<IconoPulso />}
        />
        <Stat
          etiqueta="Espera promedio"
          valor={<>{esperaProm} <small>min</small></>}
          detalle="Sala de espera actual"
          acento={esperaProm >= 30 ? 'ambar' : 'ok'}
          icono={<IconoTiempo />}
        />
      </section>

      <FlujoPasos paciente={!!paciente} cantidad={cantidad} />

      <div className="rejilla-2">
        <div className="columna">
          <Tarjeta titulo={<><span className="paso-num">1</span>Paciente</>}>
            {paciente ? (
              <div className="paciente-sel">
                <span className="avatar" aria-hidden="true">{iniciales(paciente.nombre)}</span>
                <div className="paciente-sel-info">
                  <strong>{paciente.nombre}</strong>
                  <div className="muted">
                    {paciente.cedula} · {paciente.edad} años · {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
                  </div>
                </div>
                <button className="chico" onClick={() => setPaciente(null)}>Cambiar</button>
              </div>
            ) : (
              <BuscarPaciente onElegir={(p) => { setPaciente(p); setOk(null); }} />
            )}
          </Tarjeta>

          <Tarjeta
            titulo={<><span className="paso-num">2</span>Síntomas</>}
            acciones={cantidad > 0 ? <span className="badge consulta sin-punto">{cantidad} seleccionado{cantidad === 1 ? '' : 's'}</span> : undefined}
          >
            {sintomas.cargando && <Cargando />}
            <ErrorMsg texto={sintomas.error} />
            {sintomas.data && <SelectorSintomas sintomas={sintomas.data} seleccion={seleccion} onChange={setSeleccion} />}
          </Tarjeta>
        </div>

        <div className="columna">
          <Tarjeta titulo={<><span className="paso-num">3</span>Orientación del sistema experto</>}>
            {!recomendacion && (
              <Vacio titulo="Aún no hay sugerencia">
                Seleccione al menos un síntoma para que el sistema experto oriente la especialidad.
              </Vacio>
            )}
            {recomendacion && (
              <div className="recomendacion" aria-live="polite">
                {recomendacion.urgente && (
                  <div className="aviso-urgente" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
                      <path d="M12 9v4M12 17h.01" />
                    </svg>
                    <span><strong>Posible urgencia.</strong> Priorice la atención de este paciente.</span>
                  </div>
                )}

                <p className="resumen-seleccion">
                  Evaluando <strong>{cantidad}</strong> síntoma{cantidad === 1 ? '' : 's'}
                  {paciente ? <> de <strong>{paciente.nombre}</strong></> : null}.
                </p>

                <div className="opciones-esp">
                  {recomendacion.especialidades.map((e, i) => {
                    const activa = espElegida === e.especialidadId;
                    return (
                      <label key={e.especialidad} className={`opcion-esp${activa ? ' activa' : ''}`}>
                        <span className="opcion-esp-fila">
                          <input
                            type="radio"
                            name="esp"
                            checked={activa}
                            onChange={() => setEspElegida(e.especialidadId)}
                          />
                          <span className="opcion-esp-nombre">{e.nombre}</span>
                          {i === 0 && !recomendacion.sinCoincidencia && <span className="badge recomendada">Recomendada</span>}
                          {!recomendacion.sinCoincidencia && <span className="opcion-esp-pct">{Math.round(e.certeza * 100)}%</span>}
                        </span>
                        {!recomendacion.sinCoincidencia && <Barra valor={e.certeza} />}
                      </label>
                    );
                  })}
                </div>

                <details>
                  <summary>¿Por qué esta sugerencia?</summary>
                  <ul>
                    {recomendacion.explicacion.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </details>
                <p className="muted pequeno">{recomendacion.advertencia}</p>
              </div>
            )}

            <label className="opcion urgente-check">
              <input type="checkbox" checked={forzarUrgente} onChange={(e) => setForzarUrgente(e.target.checked)} />
              <span>Marcar como urgente (criterio del personal)</span>
            </label>

            <ErrorMsg texto={error} />
            {ok && (
              <p className="exito aviso-exito">
                ✓ Visita #{ok.id} registrada en {ok.especialidadNombre}
                {ok.prioridad === 'urgente' ? ' (URGENTE)' : ''}.
              </p>
            )}
            <button className="primario accion-grande" onClick={() => void registrar()} disabled={!paciente || cantidad === 0 || enviando}>
              {enviando ? 'Registrando…' : 'Registrar llegada'}
            </button>
            {especialidades.data && recomendacion && espElegida === null && (
              <p className="muted pequeno">No hay una especialidad sugerida con consultorio; se usará Medicina General.</p>
            )}
          </Tarjeta>

          <Tarjeta
            titulo="Pacientes en espera"
            subtitulo="Se actualiza automáticamente cada 15 segundos"
            acciones={<button className="chico" onClick={() => void cola.recargar()}>Actualizar</button>}
          >
            <ErrorMsg texto={cola.error} />
            {!cola.data && !cola.error && <Cargando />}
            {cola.data && cola.data.length === 0 && (
              <Vacio titulo="Sala de espera vacía">
                Cuando registre una llegada, el paciente aparecerá aquí.
              </Vacio>
            )}
            {cola.data && cola.data.length > 0 && (
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Llegada</th>
                      <th>Paciente</th>
                      <th>Especialidad</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cola.data.map((v) => (
                      <tr key={v.id} className={v.prioridad === 'urgente' ? 'fila-urgente' : ''}>
                        <td>
                          {fmtHora(v.horaLlegada)} <span className="muted">({v.minutosEspera} min)</span>
                        </td>
                        <td>
                          <span className="fila-paciente">
                            <span className={`avatar mini${v.prioridad === 'urgente' ? ' urgente' : ''}`} aria-hidden="true">
                              {iniciales(v.pacienteNombre)}
                            </span>
                            {v.pacienteNombre}
                          </span>
                        </td>
                        <td>{v.especialidadNombre}</td>
                        <td>
                          {v.estado === 'en_consulta' ? (
                            <span className="badge consulta">En consulta</span>
                          ) : v.prioridad === 'urgente' ? (
                            <span className="badge urgente">Urgente</span>
                          ) : (
                            <span className="badge espera">En espera</span>
                          )}
                        </td>
                        <td>
                          {v.estado === 'espera' && (
                            <button className="chico" onClick={() => void cancelar(v.id)}>
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

function FlujoPasos({ paciente, cantidad }: { paciente: boolean; cantidad: number }) {
  const pasos = [
    {
      n: 1,
      titulo: 'Paciente',
      detalle: paciente ? 'Identificado' : 'Buscar o registrar',
      hecho: paciente,
      activo: !paciente,
    },
    {
      n: 2,
      titulo: 'Síntomas',
      detalle: cantidad > 0 ? `${cantidad} seleccionado${cantidad === 1 ? '' : 's'}` : 'Marque los referidos',
      hecho: cantidad > 0,
      activo: paciente && cantidad === 0,
    },
    {
      n: 3,
      titulo: 'Orientación',
      detalle: cantidad > 0 ? 'Revisar y registrar' : 'Pendiente',
      hecho: false,
      activo: cantidad > 0,
    },
  ];

  return (
    <ol className="flujo-pasos" aria-label="Pasos para registrar la llegada">
      {pasos.map((p) => (
        <li key={p.n} className={`${p.hecho ? 'hecho ' : ''}${p.activo ? 'activo' : ''}`}>
          <span className="flujo-num" aria-hidden="true">{p.hecho ? '✓' : p.n}</span>
          <span className="flujo-texto">
            <strong>{p.titulo}</strong>
            <span>{p.detalle}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function BuscarPaciente({ onElegir }: { onElegir: (p: PacienteDto) => void }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<PacienteDto[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados(null);
      return;
    }
    const id = setTimeout(() => {
      api<PacienteDto[]>(`/pacientes?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setResultados(r); setError(null); })
        .catch((e) => setError(mensajeError(e)));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  if (nuevo) return <NuevoPaciente cedulaInicial={q} onCreado={onElegir} onCancelar={() => setNuevo(false)} />;

  return (
    <div>
      <div className="buscador">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          placeholder="Buscar por cédula o nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          aria-label="Buscar paciente por cédula o nombre"
        />
      </div>
      <ErrorMsg texto={error} />
      {resultados && (
        <ul className="lista-sin-vineta lista-resultados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button className="resultado-paciente" onClick={() => onElegir(p)}>
                <span className="avatar mini" aria-hidden="true">{iniciales(p.nombre)}</span>
                <span>
                  <strong>{p.nombre}</strong>
                  <span className="muted">Cédula {p.cedula} · {p.edad} años · {p.sexo === 'F' ? 'Femenino' : 'Masculino'}</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="muted resultado-vacio">Sin coincidencias. Puede registrar un paciente nuevo.</li>}
        </ul>
      )}
      <button className="secundario ancho" onClick={() => setNuevo(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Registrar paciente nuevo
      </button>
    </div>
  );
}

function NuevoPaciente({
  cedulaInicial,
  onCreado,
  onCancelar,
}: {
  cedulaInicial: string;
  onCreado: (p: PacienteDto) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState({
    cedula: /\d/.test(cedulaInicial) ? cedulaInicial : '',
    nombre: '',
    fechaNacimiento: '',
    sexo: 'F',
    telefono: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const p = await api<PacienteDto>('/pacientes', {
        method: 'POST',
        body: { ...f, ...(f.telefono ? {} : { telefono: undefined }) },
      });
      onCreado(p);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <div className="form-doble">
        <label>Cédula<input value={f.cedula} onChange={set('cedula')} placeholder="V-12345678" required /></label>
        <label>Nombre completo<input value={f.nombre} onChange={set('nombre')} required /></label>
      </div>
      <div className="form-doble">
        <label>Fecha de nacimiento<input type="date" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} required /></label>
        <label>
          Sexo
          <select value={f.sexo} onChange={set('sexo')}>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </label>
      </div>
      <label>Teléfono (opcional)<input value={f.telefono} onChange={set('telefono')} placeholder="0414-0000000" /></label>
      <ErrorMsg texto={error} />
      <div className="acciones fin">
        <button type="button" onClick={onCancelar}>Volver</button>
        <button className="primario" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar paciente'}</button>
      </div>
    </form>
  );
}

function SelectorSintomas({
  sintomas,
  seleccion,
  onChange,
}: {
  sintomas: SintomaDto[];
  seleccion: Record<string, number>;
  onChange: (s: Record<string, number>) => void;
}) {
  const [filtro, setFiltro] = useState('');
  const cantidad = Object.keys(seleccion).length;
  const grupos = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    const m = new Map<string, SintomaDto[]>();
    for (const s of sintomas) {
      if (f && !s.nombre.toLowerCase().includes(f)) continue;
      m.set(s.categoria, [...(m.get(s.categoria) ?? []), s]);
    }
    return [...m.entries()];
  }, [sintomas, filtro]);

  const alternar = (codigo: string) => {
    const { [codigo]: quitado, ...resto } = seleccion;
    onChange(quitado === undefined ? { ...seleccion, [codigo]: 3 } : resto);
  };

  const porCodigo = useMemo(() => new Map(sintomas.map((s) => [s.codigo, s])), [sintomas]);

  return (
    <div>
      <div className="buscador">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          placeholder="Filtrar síntomas…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Filtrar síntomas"
        />
      </div>

      {cantidad > 0 && (
        <div className="seleccion-sintomas">
          <ul className="chips">
            {Object.entries(seleccion).map(([codigo, intensidad]) => {
              const s = porCodigo.get(codigo);
              return (
                <li key={codigo} className={intensidad >= 4 ? 'fuerte' : ''}>
                  {s?.nombre ?? codigo}
                  <span className="puntos" aria-label={`Intensidad ${intensidad} de 5`} title={`Intensidad ${intensidad}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= intensidad ? 'on' : ''} />)}
                  </span>
                  <button type="button" className="chip-x" onClick={() => alternar(codigo)} aria-label={`Quitar ${s?.nombre ?? codigo}`}>×</button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="chico" onClick={() => onChange({})}>Limpiar</button>
        </div>
      )}

      <div className="sintomas">
        {grupos.map(([cat, lista]) => (
          <fieldset key={cat}>
            <legend>{cat} <span className="conteo">{lista.length}</span></legend>
            {lista.map((s) => {
              const intensidad = seleccion[s.codigo];
              return (
                <div key={s.codigo} className={`sintoma${intensidad !== undefined ? ' activo' : ''}`}>
                  <label className="opcion">
                    <input type="checkbox" checked={intensidad !== undefined} onChange={() => alternar(s.codigo)} />
                    <span>{s.nombre}</span>
                  </label>
                  {intensidad !== undefined && (
                    <select
                      value={intensidad}
                      onChange={(e) => onChange({ ...seleccion, [s.codigo]: Number(e.target.value) })}
                      aria-label={`Intensidad de ${s.nombre}`}
                    >
                      <option value={1}>1 · leve</option>
                      <option value={2}>2</option>
                      <option value={3}>3 · moderado</option>
                      <option value={4}>4</option>
                      <option value={5}>5 · severo</option>
                    </select>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
        {grupos.length === 0 && <p className="muted">Ningún síntoma coincide con el filtro.</p>}
      </div>
    </div>
  );
}
