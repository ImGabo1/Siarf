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
import { Barra, Cargando, ErrorMsg, Tarjeta, fmtHora, useCarga, usePolling } from '../ui';

export function Recepcion() {
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
    <div className="rejilla-2">
      <div className="columna">
        <Tarjeta titulo="1. Paciente">
          {paciente ? (
            <div className="paciente-sel">
              <div>
                <strong>{paciente.nombre}</strong>
                <div className="muted">
                  {paciente.cedula} · {paciente.edad} años · {paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
                </div>
              </div>
              <button onClick={() => setPaciente(null)}>Cambiar</button>
            </div>
          ) : (
            <BuscarPaciente onElegir={(p) => { setPaciente(p); setOk(null); }} />
          )}
        </Tarjeta>

        <Tarjeta titulo={`2. Síntomas${cantidad ? ` (${cantidad})` : ''}`}>
          {sintomas.cargando && <Cargando />}
          <ErrorMsg texto={sintomas.error} />
          {sintomas.data && <SelectorSintomas sintomas={sintomas.data} seleccion={seleccion} onChange={setSeleccion} />}
        </Tarjeta>
      </div>

      <div className="columna">
        <Tarjeta titulo="3. Orientación del sistema experto">
          {!recomendacion && <p className="muted">Seleccione al menos un síntoma para obtener una sugerencia.</p>}
          {recomendacion && (
            <>
              {recomendacion.urgente && <div className="aviso-urgente">⚠ Posible urgencia: priorizar la atención</div>}
              <ul className="lista-sin-vineta">
                {recomendacion.especialidades.map((e) => (
                  <li key={e.especialidad}>
                    <label className="opcion">
                      <input
                        type="radio"
                        name="esp"
                        checked={espElegida === e.especialidadId}
                        onChange={() => setEspElegida(e.especialidadId)}
                      />
                      <span>{e.nombre}</span>
                    </label>
                    {!recomendacion.sinCoincidencia && <Barra valor={e.certeza} />}
                  </li>
                ))}
              </ul>
              <details>
                <summary>¿Por qué esta sugerencia?</summary>
                <ul>
                  {recomendacion.explicacion.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
              <p className="muted pequeno">{recomendacion.advertencia}</p>
            </>
          )}

          <label className="opcion">
            <input type="checkbox" checked={forzarUrgente} onChange={(e) => setForzarUrgente(e.target.checked)} />
            <span>Marcar como urgente (criterio del personal)</span>
          </label>

          <ErrorMsg texto={error} />
          {ok && (
            <p className="exito">
              ✓ Visita #{ok.id} registrada en {ok.especialidadNombre}
              {ok.prioridad === 'urgente' ? ' (URGENTE)' : ''}.
            </p>
          )}
          <button className="primario" onClick={() => void registrar()} disabled={!paciente || cantidad === 0 || enviando}>
            {enviando ? 'Registrando…' : 'Registrar llegada'}
          </button>
          {especialidades.data && recomendacion && espElegida === null && (
            <p className="muted pequeno">No hay una especialidad sugerida con consultorio; se usará Medicina General.</p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Pacientes en espera" acciones={<button onClick={() => void cola.recargar()}>Actualizar</button>}>
          <ErrorMsg texto={cola.error} />
          {!cola.data && !cola.error && <Cargando />}
          {cola.data && cola.data.length === 0 && <p className="muted">No hay pacientes en espera.</p>}
          {cola.data && cola.data.length > 0 && (
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
                    <td>{v.pacienteNombre}</td>
                    <td>{v.especialidadNombre}</td>
                    <td>{v.estado === 'en_consulta' ? 'En consulta' : v.prioridad === 'urgente' ? 'Urgente' : 'En espera'}</td>
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
          )}
        </Tarjeta>
      </div>
    </div>
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
      <input placeholder="Buscar por cédula o nombre…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ErrorMsg texto={error} />
      {resultados && (
        <ul className="lista-sin-vineta resultados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button className="enlace" onClick={() => onElegir(p)}>
                {p.nombre} <span className="muted">· {p.cedula} · {p.edad} años</span>
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="muted">Sin resultados.</li>}
        </ul>
      )}
      <button onClick={() => setNuevo(true)}>+ Registrar paciente nuevo</button>
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
      <label>Cédula<input value={f.cedula} onChange={set('cedula')} placeholder="V-12345678" required /></label>
      <label>Nombre completo<input value={f.nombre} onChange={set('nombre')} required /></label>
      <label>Fecha de nacimiento<input type="date" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} required /></label>
      <label>
        Sexo
        <select value={f.sexo} onChange={set('sexo')}>
          <option value="F">Femenino</option>
          <option value="M">Masculino</option>
        </select>
      </label>
      <label>Teléfono (opcional)<input value={f.telefono} onChange={set('telefono')} /></label>
      <ErrorMsg texto={error} />
      <div className="acciones">
        <button type="button" onClick={onCancelar}>Volver</button>
        <button className="primario" disabled={enviando}>Guardar paciente</button>
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

  return (
    <div>
      <input placeholder="Filtrar síntomas…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <div className="sintomas">
        {grupos.map(([cat, lista]) => (
          <fieldset key={cat}>
            <legend>{cat}</legend>
            {lista.map((s) => {
              const intensidad = seleccion[s.codigo];
              return (
                <div key={s.codigo} className="sintoma">
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
        {grupos.length === 0 && <p className="muted">Ningún síntoma coincide.</p>}
      </div>
    </div>
  );
}
