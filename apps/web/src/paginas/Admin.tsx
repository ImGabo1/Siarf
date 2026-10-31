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
import { Barra, Cargando, ErrorMsg, Tarjeta, fmtMin, useCarga } from '../ui';
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
    <div className="columna">
      <nav className="pestanas" aria-label="Secciones de administración">
        {PESTANAS.map((p) => (
          <button key={p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)}>
            {p.nombre}
          </button>
        ))}
      </nav>
      {pestana === 'simulacion' && <Simulacion />}
      {pestana === 'metricas' && <MetricasReales />}
      {pestana === 'reglas' && <Reglas />}
      {pestana === 'usuarios' && <Usuarios />}
      {pestana === 'recepcion' && <Recepcion />}
    </div>
  );
}

// ── Métricas del flujo real ──────────────────────────────────────────────────
function MetricasReales() {
  const [dias, setDias] = useState(7);
  const m = useCarga(() => api<MetricasRealesDto>(`/metricas?dias=${dias}`), dias);
  const maxHora = Math.max(1, ...(m.data?.porHora.map((h) => h.total) ?? [1]));
  const maxEspera = Math.max(1, ...(m.data?.porEspecialidad.map((e) => e.esperaPromedioMin ?? 0) ?? [1]));

  return (
    <Tarjeta
      titulo="Flujo real registrado en el sistema"
      acciones={
        <label className="en-linea">
          Últimos
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}
          </select>
        </label>
      }
    >
      {m.cargando && !m.data && <Cargando />}
      <ErrorMsg texto={m.error} />
      {m.data && (
        <>
          <div className="kpis">
            <div className="kpi"><span className="muted">Visitas</span><strong>{m.data.total}</strong></div>
            <div className="kpi"><span className="muted">Atendidas</span><strong>{m.data.atendidas}</strong></div>
            <div className="kpi"><span className="muted">Espera promedio</span><strong>{fmtMin(m.data.esperaPromedioMin)}</strong></div>
            <div className="kpi"><span className="muted">Consulta promedio</span><strong>{fmtMin(m.data.consultaPromedioMin)}</strong></div>
          </div>
          <p className="muted pequeno">
            Use estos promedios para calibrar la simulación (duración de consulta y proporción de pacientes por especialidad).
          </p>
          <h3>Por especialidad</h3>
          <ul className="lista-sin-vineta">
            {m.data.porEspecialidad.filter((e) => e.total > 0).map((e) => (
              <li key={e.codigo} className="fila-barra">
                <span>{e.nombre} <span className="muted">({e.total})</span></span>
                <Barra valor={(e.esperaPromedioMin ?? 0) / maxEspera} etiqueta={`espera ${fmtMin(e.esperaPromedioMin)} · consulta ${fmtMin(e.consultaPromedioMin)}`} />
              </li>
            ))}
          </ul>
          <h3>Llegadas por hora del día</h3>
          <ul className="lista-sin-vineta">
            {m.data.porHora.map((h) => (
              <li key={h.hora} className="fila-barra">
                <span>{String(h.hora).padStart(2, '0')}:00</span>
                <Barra valor={h.total / maxHora} etiqueta={String(h.total)} />
              </li>
            ))}
            {m.data.porHora.length === 0 && <li className="muted">Aún no hay visitas en el período.</li>}
          </ul>
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
      titulo={`Reglas del sistema experto${reglas.data ? ` (${reglas.data.length})` : ''}`}
      acciones={
        <>
          <button onClick={() => void validar()}>Validar base</button>
          <button onClick={() => void evaluar()}>Evaluar con casos de prueba</button>
        </>
      }
    >
      <p className="muted pequeno">
        Reglas de ejemplo para desarrollo: deben ser revisadas por un profesional de la salud antes de usarse como resultado en el artículo.
        Un cambio de CF o de «activa» se aplica de inmediato a las nuevas evaluaciones.
      </p>
      <ErrorMsg texto={error ?? reglas.error} />

      {problemas && (
        problemas.length === 0
          ? <p className="exito">✓ La base de conocimiento no tiene errores ni avisos.</p>
          : <ul>{problemas.map((p, i) => <li key={i} className={p.nivel === 'error' ? 'error' : ''}>{p.nivel.toUpperCase()}{p.regla ? ` [${p.regla}]` : ''}: {p.mensaje}</li>)}</ul>
      )}

      {evalu && (
        <div className="cuadro-eval">
          <strong>{evalu.total} casos</strong> · exactitud top-1 {pct(evalu.exactitudTop1)} · top-2 {pct(evalu.exactitudTop2)} · urgencia {pct(evalu.exactitudUrgencia)}
          {evalu.casos.filter((c) => !c.top1 || !c.urgenteOk).map((c) => (
            <div key={c.id} className="error">
              {c.id}: esperada {c.esperada}, obtenida {c.obtenida.join(', ') || '—'}{c.urgenteOk ? '' : ' (urgencia distinta)'}
            </div>
          ))}
        </div>
      )}

      {reglas.cargando && !reglas.data && <Cargando />}
      {reglas.data && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Código</th><th>SI (condiciones)</th><th>ENTONCES</th><th>CF</th><th>Prior.</th><th>Urg.</th><th>Activa</th></tr>
            </thead>
            <tbody>
              {reglas.data.map((r) => (
                <tr key={r.id} className={r.activa ? '' : 'inactiva'}>
                  <td>{r.codigo}</td>
                  <td>
                    {r.condiciones.join(' + ')}
                    {r.exclusiones.length > 0 && <span className="muted"> · excepto {r.exclusiones.join(', ')}</span>}
                  </td>
                  <td>{r.concluyeTipo === 'hecho' ? `hecho: ${r.concluyeValor}` : r.concluyeValor}</td>
                  <td>
                    <input className="corto" type="number" min={0.05} max={1} step={0.05} defaultValue={r.cf}
                      onBlur={(e) => void cambiarCf(r, e.target.value)} aria-label={`CF de ${r.codigo}`} />
                  </td>
                  <td>{r.prioridad}</td>
                  <td>{r.urgencia ? '⚠' : ''}</td>
                  <td><input type="checkbox" checked={r.activa} onChange={() => void alternar(r)} aria-label={`Activar ${r.codigo}`} /></td>
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

  const nombreEsp = (id: number | null) => especialidades.data?.find((e) => e.id === id)?.nombre ?? '—';
  const consultoriosDe = consultorios.data?.filter((c) => c.especialidadId === Number(f.especialidadId)) ?? [];

  return (
    <div className="rejilla-2">
      <Tarjeta titulo="Personal registrado">
        <ErrorMsg texto={usuarios.error} />
        {usuarios.cargando && !usuarios.data && <Cargando />}
        {usuarios.data && (
          <table>
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Especialidad</th><th>Activo</th></tr></thead>
            <tbody>
              {usuarios.data.map((u) => (
                <tr key={u.id} className={u.activo ? '' : 'inactiva'}>
                  <td>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td>{ETIQUETA_ROL[u.rol]}</td>
                  <td>{u.rol === 'doctor' ? nombreEsp(u.especialidadId) : '—'}</td>
                  <td><input type="checkbox" checked={u.activo} onChange={() => void alternarActivo(u)} aria-label={`Activar ${u.nombre}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>

      <Tarjeta titulo="Registrar nuevo usuario">
        <form className="formulario" onSubmit={crear}>
          <label>Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required minLength={2} /></label>
          <label>Correo<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
          <label>Contraseña inicial (mín. 8)<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
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
          <button className="primario" disabled={creando}>{creando ? 'Guardando…' : 'Crear usuario'}</button>
        </form>
      </Tarjeta>
    </div>
  );
}
