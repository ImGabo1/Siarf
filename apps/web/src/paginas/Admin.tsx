import { useState, type FormEvent } from 'react';
import type {
  ConsultorioDto,
  EspecialidadDto,
  MetricasRealesDto,
  ProblemaReglaDto,
  ReglaDto,
  Rol,
  UsuarioDto,
} from '@siarf/shared';
import { ETIQUETA_ROL, ROLES } from '@siarf/shared';
import { api, mensajeError } from '../api';
import { Barra, Cargando, ErrorMsg, IconoAlerta, IconoDocumento, IconoOk, IconoTiempo, IconoUsuarios, Stat, Tarjeta, fmtMin, iniciales, useCarga } from '../ui';
import { Recepcion } from './Recepcion';
import { Simulacion } from './Simulacion';

const PESTANAS = [
  { id: 'simulacion', nombre: 'Simulación' },
  { id: 'metricas', nombre: 'Métricas reales' },
  { id: 'reglas', nombre: 'Base de conocimiento' },
  { id: 'usuarios', nombre: 'Usuarios' },
  { id: 'recepcion', nombre: 'Recepción' },
] as const;
type Pestana = (typeof PESTANAS)[number]['id'];

export function Admin() {
  const [pestana, setPestana] = useState<Pestana>('simulacion');
  return (
    <div className="columna admin-contenido">
      <header className="pagina-cab admin-cab">
        <div>
          <p className="sobre-titulo">Panel de administración</p>
          <h1>Administración</h1>
          <p className="muted">Supervise el flujo, ajuste la simulación y gestione al personal.</p>
        </div>
        <span className="badge consulta sin-punto">Acceso administrador</span>
      </header>
      <nav className="pestanas" aria-label="Secciones de administración">
        {PESTANAS.map((p) => (
          <button key={p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)}>
            <IconoPestana id={p.id} />
            {p.nombre}
          </button>
        ))}
      </nav>
      {pestana === 'simulacion' && <Simulacion />}
      {pestana === 'metricas' && <MetricasReales />}
      {pestana === 'reglas' && <Reglas />}
      {pestana === 'usuarios' && <Usuarios />}
      {pestana === 'recepcion' && <Recepcion embebido />}
    </div>
  );
}

function IconoPestana({ id }: { id: Pestana }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (id === 'simulacion') {
    return (
      <svg {...props}>
        <path d="M3 3v18h18" />
        <path d="m7 14 3-4 3 3 5-7" />
      </svg>
    );
  }
  if (id === 'metricas') {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 15v3M12 10v8M17 13v5" />
      </svg>
    );
  }
  if (id === 'reglas') {
    return (
      <svg {...props}>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </svg>
    );
  }
  if (id === 'usuarios') {
    return (
      <svg {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 11h8M8 16h5" />
    </svg>
  );
}

// ── Segmentado de período ──────────────────────────────────────────────────────
function PeriodoSegmentado({ valor, onCambio }: { valor: number; onCambio: (v: number) => void }) {
  return (
    <div className="segmentado" role="radiogroup" aria-label="Período de métricas">
      {[1, 7, 30, 90].map((d) => (
        <button
          key={d}
          role="radio"
          aria-checked={valor === d}
          className={valor === d ? 'seg-activa' : 'seg'}
          onClick={() => onCambio(d)}
        >
          {d} día{d > 1 ? 's' : ''}
        </button>
      ))}
    </div>
  );
}

// ── Métricas del flujo real ──────────────────────────────────────────────────
function MetricasReales() {
  const [dias, setDias] = useState(7);
  const m = useCarga(() => api<MetricasRealesDto>(`/metricas?dias=${dias}`), dias);
  const maxHora = Math.max(1, ...(m.data?.porHora.map((h) => h.total) ?? [1]));
  const maxEspera = Math.max(1, ...(m.data?.porEspecialidad.map((e) => e.esperaPromedioMin ?? 0) ?? [1]));
  const total = m.data?.total ?? 0;
  const atendidas = m.data?.atendidas ?? 0;

  return (
    <Tarjeta
      titulo="Flujo real registrado en el sistema"
      subtitulo="Datos de visitas del consultorio, útiles para calibrar la simulación"
      acciones={<PeriodoSegmentado valor={dias} onCambio={setDias} />}
    >
      {m.cargando && !m.data && <Cargando />}
      <ErrorMsg texto={m.error} />
      {m.data && (
        <>
          <div className="stats-metricas">
            <Stat etiqueta="Visitas" valor={total} acento="primario" icono={<IconoUsuarios />} />
            <Stat
              etiqueta="Atendidas"
              valor={atendidas}
              detalle={total > 0 ? `${Math.round((atendidas / total) * 100)}% del total` : 'Sin visitas'}
              acento="ok"
              icono={<IconoOk />}
            />
            <Stat
              etiqueta="Espera promedio"
              valor={fmtMin(m.data.esperaPromedioMin)}
              acento="ambar"
              icono={<IconoTiempo />}
            />
            <Stat
              etiqueta="Consulta promedio"
              valor={fmtMin(m.data.consultaPromedioMin)}
              acento="info"
              icono={<IconoTiempo />}
            />
          </div>

          <p className="muted pequeno">
            Use estos promedios para calibrar la simulación (duración de consulta y proporción de pacientes por especialidad).
          </p>

          <div className="rejilla-detalle">
            <Tarjeta className="tarjeta-metrica">
              <header className="tarjeta-cab">
                <div>
                  <h2>Por especialidad</h2>
                  <span className="subtitulo">Volumen de visitas y espera promedio</span>
                </div>
              </header>
              <ul className="lista-sin-vineta">
                {m.data.porEspecialidad.filter((e) => e.total > 0).map((e) => (
                  <li key={e.codigo} className="fila-barra fila-metrica">
                    <div>
                      <span>{e.nombre}</span>
                      <span className="muted pequeno">({e.total} visita{e.total !== 1 ? 's' : ''})</span>
                    </div>
                    <Barra
                      valor={(e.esperaPromedioMin ?? 0) / maxEspera}
                      etiqueta={`espera ${fmtMin(e.esperaPromedioMin)} · consulta ${fmtMin(e.consultaPromedioMin)}`}
                    />
                  </li>
                ))}
                {m.data.porEspecialidad.every((e) => e.total === 0) && (
                  <li className="muted">Aún no hay visitas registradas por especialidad.</li>
                )}
              </ul>
            </Tarjeta>

            <Tarjeta className="tarjeta-metrica">
              <header className="tarjeta-cab">
                <div>
                  <h2>Llegadas por hora del día</h2>
                  <span className="subtitulo">Distribución de visitas a lo largo de las 24 h</span>
                </div>
              </header>
              <ul className="lista-sin-vineta">
                {m.data.porHora.map((h) => (
                  <li key={h.hora} className="fila-barra fila-metrica">
                    <div>
                      <span>{String(h.hora).padStart(2, '0')}:00</span>
                      <span className="muted pequeno">{h.total} visita{h.total !== 1 ? 's' : ''}</span>
                    </div>
                    <Barra valor={h.total / maxHora} etiqueta={String(h.total)} />
                  </li>
                ))}
                {m.data.porHora.length === 0 && <li className="muted">Aún no hay visitas en el período.</li>}
              </ul>
            </Tarjeta>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

// ── Base de conocimiento ─────────────────────────────────────────────────────
interface ResumenEval {
  total: number;
  exactitudTop1: number;
  exactitudTop2: number;
  exactitudUrgencia: number;
  casos: { id: string; esperada: string; obtenida: string[]; top1: boolean; urgenteOk: boolean }[];
}

function Reglas() {
  const reglas = useCarga(() => api<ReglaDto[]>('/reglas'));
  const [problemas, setProblemas] = useState<ProblemaReglaDto[] | null>(null);
  const [evalu, setEvalu] = useState<ResumenEval | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = reglas.data?.length ?? 0;
  const activas = reglas.data?.filter((r) => r.activa).length ?? 0;
  const urgentes = reglas.data?.filter((r) => r.urgencia).length ?? 0;
  const problemasCount = problemas?.length ?? 0;

  async function alternar(r: ReglaDto) {
    try {
      await api(`/reglas/${r.id}`, { method: 'PATCH', body: { activa: !r.activa } });
      await reglas.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  async function cambiarCf(r: ReglaDto, valor: string) {
    const cf = Number(valor);
    if (!(cf > 0 && cf <= 1) || cf === r.cf) return;
    try {
      await api(`/reglas/${r.id}`, { method: 'PATCH', body: { cf } });
      await reglas.recargar();
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  async function validar() {
    try {
      setProblemas(await api<ProblemaReglaDto[]>('/reglas/validar'));
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  async function evaluar() {
    try {
      setEvalu(await api<ResumenEval>('/reglas/evaluar-casos'));
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <Tarjeta
      titulo="Base de conocimiento"
      subtitulo="Reglas del sistema experto que guían el diagnóstico y la prioridad de los pacientes"
      acciones={
        <>
          <button onClick={() => void validar()}>Validar base</button>
          <button className="primario" onClick={() => void evaluar()}>
            Evaluar con casos de prueba
          </button>
        </>
      }
    >
      <div className="stats-reglas">
        <Stat etiqueta="Reglas" valor={total} acento="primario" icono={<IconoDocumento />} />
        <Stat
          etiqueta="Activas"
          valor={activas}
          detalle={total > 0 ? `${Math.round((activas / total) * 100)}% activas` : 'Sin reglas'}
          acento="ok"
          icono={<IconoOk />}
        />
        <Stat etiqueta="Urgentes" valor={urgentes} acento="peligro" icono={<IconoAlerta />} />
        <Stat
          etiqueta="Problemas"
          valor={problemasCount}
          detalle={problemasCount === 0 ? 'Base limpia' : 'Revisar avisos'}
          acento={problemasCount === 0 ? 'ok' : 'ambar'}
          icono={<IconoAlerta />}
        />
      </div>

      <p className="muted pequeno">
        Reglas de ejemplo para desarrollo: deben ser revisadas por un profesional de la salud antes de usarse como resultado en el artículo.
        Un cambio de CF o de «activa» se aplica de inmediato a las nuevas evaluaciones.
      </p>
      <ErrorMsg texto={error ?? reglas.error} />

      {problemas && (
        <div className="resultado-validacion">
          {problemas.length === 0 ? (
            <div className="aviso-ok">
              <span className="icono-aviso"><IconoOk /></span>
              <span>La base de conocimiento no tiene errores ni avisos.</span>
            </div>
          ) : (
            <ul className="lista-problemas">
              {problemas.map((p, i) => (
                <li key={i} className={`problema-item ${p.nivel === 'error' ? 'problema-error' : 'problema-aviso'}`}>
                  <span className="chip-nivel">{p.nivel.toUpperCase()}</span>
                  {p.regla && <span className="chip-regla">[{p.regla}]</span>}
                  {p.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {evalu && (
        <div className="resultado-evaluacion">
          <div className="stats-evaluacion">
            <Stat etiqueta="Casos evaluados" valor={evalu.total} acento="primario" icono={<IconoDocumento />} />
            <Stat
              etiqueta="Exactitud top-1"
              valor={pct(evalu.exactitudTop1)}
              acento="ok"
              icono={<IconoOk />}
            />
            <Stat
              etiqueta="Exactitud top-2"
              valor={pct(evalu.exactitudTop2)}
              acento="info"
              icono={<IconoDocumento />}
            />
            <Stat
              etiqueta="Urgencia detectada"
              valor={pct(evalu.exactitudUrgencia)}
              acento="ambar"
              icono={<IconoAlerta />}
            />
          </div>
          {evalu.casos.filter((c) => !c.top1 || !c.urgenteOk).length > 0 && (
            <ul className="lista-casos">
              {evalu.casos.filter((c) => !c.top1 || !c.urgenteOk).map((c) => (
                <li key={c.id} className="caso-item">
                  <span className="caso-id">{c.id}</span>
                  <span className="caso-espera">esperada <strong>{c.esperada}</strong>, obtenida {c.obtenida.join(', ') || '—'}</span>
                  {!c.urgenteOk && <span className="caso-urgencia">(urgencia distinta)</span>}
                </li>
              ))}
            </ul>
          )}
          {evalu.casos.every((c) => c.top1 && c.urgenteOk) && (
            <div className="aviso-ok">
              <span className="icono-aviso"><IconoOk /></span>
              <span>Todos los casos de prueba coinciden con lo esperado.</span>
            </div>
          )}
        </div>
      )}

      {reglas.cargando && !reglas.data && <Cargando />}
      {reglas.data && (
        <div className="tabla-scroll tarjeta-tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>SI (condiciones)</th>
                <th>ENTONCES</th>
                <th>CF</th>
                <th>Prior.</th>
                <th>Urg.</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reglas.data.map((r) => (
                <tr key={r.id} className={r.activa ? '' : 'inactiva'}>
                  <td>{r.codigo}</td>
                  <td>
                    {r.condiciones.join(' + ')}
                    {r.exclusiones.length > 0 && <span className="muted pequeña"> · excepto {r.exclusiones.join(', ')}</span>}
                  </td>
                  <td>{r.concluyeTipo === 'hecho' ? `hecho: ${r.concluyeValor}` : r.concluyeValor}</td>
                  <td>
                    <input
                      className="corto"
                      type="number"
                      min={0.05}
                      max={1}
                      step={0.05}
                      defaultValue={r.cf}
                      onBlur={(e) => void cambiarCf(r, e.target.value)}
                      aria-label={`CF de ${r.codigo}`}
                    />
                  </td>
                  <td>{r.prioridad}</td>
                  <td>{r.urgencia ? <span className="chip chip-urgente">Urgente</span> : <span className="chip chip-normal">Normal</span>}</td>
                  <td>
                    <span className="chip estado-chip {r.activa ? 'chip-activa' : 'chip-inactiva'}">
                      {r.activa ? 'Activa' : 'Inactiva'}
                    </span>{' '}
                    <input
                      type="checkbox"
                      checked={r.activa}
                      onChange={() => void alternar(r)}
                      aria-label={`Activar ${r.codigo}`}
                      className="toggle-estado"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

// ── Usuarios del personal ────────────────────────────────────────────────────
function Usuarios() {
  const usuarios = useCarga(() => api<UsuarioDto[]>('/usuarios'));
  const especialidades = useCarga(() => api<EspecialidadDto[]>('/especialidades'));
  const consultorios = useCarga(() => api<ConsultorioDto[]>('/consultorios'));
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ nombre: '', email: '', password: '', rol: 'recepcionista' as Rol, especialidadId: '', consultorioId: '' });
  const [creando, setCreando] = useState(false);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    try {
      await api('/usuarios', {
        method: 'POST',
        body: {
          nombre: f.nombre,
          email: f.email,
          password: f.password,
          rol: f.rol,
          ...(f.rol === 'doctor' && f.especialidadId ? { especialidadId: Number(f.especialidadId) } : {}),
          ...(f.rol === 'doctor' && f.consultorioId ? { consultorioId: Number(f.consultorioId) } : {}),
        },
      });
      setF({ ...f, nombre: '', email: '', password: '' });
      await usuarios.recargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCreando(false);
    }
  }

  async function alternarActivo(u: UsuarioDto) {
    try {
      await api(`/usuarios/${u.id}`, { method: 'PATCH', body: { activo: !u.activo } });
      await usuarios.recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  const total = usuarios.data?.length ?? 0;
  const activos = usuarios.data?.filter((u) => u.activo).length ?? 0;
  const doctores = usuarios.data?.filter((u) => u.rol === 'doctor').length ?? 0;
  const recepcionistas = usuarios.data?.filter((u) => u.rol === 'recepcionista').length ?? 0;

  const nombreEsp = (id: number | null) => especialidades.data?.find((e) => e.id === id)?.nombre ?? '—';
  const consultoriosDe = consultorios.data?.filter((c) => c.especialidadId === Number(f.especialidadId)) ?? [];

  const rolChip = (rol: Rol) => (
    <span className={`chip rol-chip rol-${rol}`}>{ETIQUETA_ROL[rol]}</span>
  );

  return (
    <div className="columna admin-usuarios">
      <Tarjeta className="tarjeta-resumen">
        <header className="tarjeta-cab">
          <div>
            <h2>Personal del consultorio</h2>
            <span className="subtitulo">Resumen del equipo y sus cuentas de acceso</span>
          </div>
        </header>
        <div className="stats-personal">
          <Stat etiqueta="Personal" valor={total} acento="primario" icono={<IconoUsuarios />} />
          <Stat etiqueta="Activos" valor={activos} detalle={total > 0 ? `${Math.round((activos / total) * 100)}% con acceso` : 'Sin personal'} acento="ok" icono={<IconoOk />} />
          <Stat etiqueta="Doctores" valor={doctores} acento="info" icono={<IconoTiempo />} />
          <Stat etiqueta="Recepción" valor={recepcionistas} acento="ambar" icono={<IconoUsuarios />} />
        </div>
      </Tarjeta>

      <div className="rejilla-2">
        <Tarjeta className="tarjeta-tabla">
          <header className="tarjeta-cab">
            <div>
              <h2>Cuentas registradas</h2>
              <span className="subtitulo">Active o desactive cuentas sin borrar su historial</span>
            </div>
          </header>
          <ErrorMsg texto={usuarios.error} />
          {usuarios.cargando && !usuarios.data && <Cargando />}
          {usuarios.data && (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Especialidad</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {usuarios.data.map((u) => (
                    <tr key={u.id} className={u.activo ? '' : 'inactiva'}>
                      <td>
                        <div className="fila-usuario">
                          <span className="avatar-usuario mini">{iniciales(u.nombre)}</span>
                          <span>{u.nombre}</span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{rolChip(u.rol)}</td>
                      <td>{u.rol === 'doctor' ? nombreEsp(u.especialidadId) : '—'}</td>
                      <td>
                        <span className={`chip estado-chip ${u.activo ? 'chip-activa' : 'chip-inactiva'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>{' '}
                        <input
                          type="checkbox"
                          checked={u.activo}
                          onChange={() => void alternarActivo(u)}
                          aria-label={`Activar ${u.nombre}`}
                          className="toggle-estado"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="tarjeta-formulario">
          <header className="tarjeta-cab">
            <div>
              <h2>Registrar nuevo usuario</h2>
              <span className="subtitulo">El doctor necesita una especialidad para recibir pacientes</span>
            </div>
          </header>
          <form className="formulario" onSubmit={crear}>
            <label>Nombre
              <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required minLength={2} />
            </label>
            <label>Correo
              <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </label>
            <label>Contraseña inicial (mín. 8)
              <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            </label>
            <label>
              Rol
              <select value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as Rol })}>
                {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
              </select>
            </label>
            {f.rol === 'doctor' && (
              <>
                <label>
                  Especialidad
                  <select value={f.especialidadId} onChange={(e) => setF({ ...f, especialidadId: e.target.value, consultorioId: '' })} required>
                    <option value="">Seleccione…</option>
                    {especialidades.data?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </label>
                <label>
                  Consultorio (opcional)
                  <select value={f.consultorioId} onChange={(e) => setF({ ...f, consultorioId: e.target.value })} disabled={!f.especialidadId}>
                    <option value="">Sin asignar</option>
                    {consultoriosDe.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
              </>
            )}
            <ErrorMsg texto={error} />
            <button className="primario ancho" disabled={creando}>
              {creando ? 'Guardando…' : 'Crear usuario'}
            </button>
          </form>
        </Tarjeta>
      </div>
    </div>
  );
}
