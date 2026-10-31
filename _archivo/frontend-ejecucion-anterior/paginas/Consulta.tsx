import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { VisitaDetalleDto } from '@siarf/shared';
import { api } from '../api';
import { formatearFechaHora, formatearHora, porcentaje, useAccion, useGet } from '../hooks';
import { useSesion } from '../sesion';

const ETIQUETA_ESTADO = {
  espera: 'En espera',
  en_consulta: 'En consulta',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
} as const;

/** Ficha de la visita: lo que el doctor necesita ver antes y durante la consulta. */
export function Consulta() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const ficha = useGet<VisitaDetalleDto>(id ? `/visitas/${id}` : null);
  const accion = useAccion();
  const [diagnostico, setDiagnostico] = useState('');
  const [notas, setNotas] = useState('');

  if (ficha.cargando && !ficha.datos) return <p>Cargando…</p>;
  if (ficha.error) return <p className="error">{ficha.error}</p>;
  const v = ficha.datos;
  if (!v) return null;

  const esDoctor = usuario?.rol === 'doctor';
  const p = v.paciente;

  const iniciar = async () => {
    const r = await accion.ejecutar(() => api.post(`/visitas/${v.id}/iniciar`));
    if (r) ficha.recargar();
  };
  const cerrar = async () => {
    const r = await accion.ejecutar(() =>
      api.post(`/visitas/${v.id}/cerrar`, {
        ...(diagnostico.trim() ? { diagnostico: diagnostico.trim() } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      }),
    );
    if (r) navegar('/cola');
  };

  return (
    <div className="pagina">
      <p>
        <Link to="/cola">← Volver a la cola</Link>
      </p>
      <div className="encabezado-pagina">
        <h1>{p.nombre}</h1>
        <div>
          <span className={`etiqueta ${v.estado}`}>{ETIQUETA_ESTADO[v.estado]}</span>
          {v.prioridad === 'urgente' && <span className="etiqueta roja">URGENTE</span>}
        </div>
      </div>

      <section className="tarjeta datos-paciente">
        <div><small>Cédula</small><strong>{p.cedula}</strong></div>
        <div><small>Edad</small><strong>{p.edad} años</strong></div>
        <div><small>Sexo</small><strong>{p.sexo === 'F' ? 'Femenino' : 'Masculino'}</strong></div>
        <div><small>Teléfono</small><strong>{p.telefono ?? '—'}</strong></div>
        <div><small>Especialidad</small><strong>{v.especialidadNombre}</strong></div>
        <div><small>Llegada</small><strong>{formatearHora(v.horaLlegada)}</strong></div>
      </section>

      <section className="tarjeta">
        <h2>Síntomas reportados</h2>
        <table className="tabla compacta">
          <thead>
            <tr><th>Síntoma</th><th>Intensidad</th><th>Duración</th></tr>
          </thead>
          <tbody>
            {v.sintomas.map((s) => (
              <tr key={s.codigo}>
                <td>{s.nombre}</td>
                <td><span className={`intensidad i${s.intensidad}`}>{s.intensidad}/5</span></td>
                <td>{s.duracionDias === null ? '—' : `${s.duracionDias} día(s)`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta">
        <h2>Orientación del sistema experto</h2>
        {v.inferencias.length === 0 ? (
          <p className="nota">Sin reglas disparadas (se asignó la especialidad por defecto).</p>
        ) : (
          <ul className="explicacion">
            {v.inferencias.map((i) => (
              <li key={i.regla}>
                {i.explicacion} <small>· CF {porcentaje(i.cf)}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="nota">Orientación automática, no es un diagnóstico. La decisión clínica es del médico.</p>
      </section>

      {v.historial.length > 0 && (
        <section className="tarjeta">
          <h2>Visitas anteriores</h2>
          <ul className="historial">
            {v.historial.map((h) => (
              <li key={h.id}>
                <Link to={`/visita/${h.id}`}>{formatearFechaHora(h.fecha)}</Link> · {h.especialidad} · {ETIQUETA_ESTADO[h.estado]}
                {h.diagnostico && <> · <em>{h.diagnostico}</em></>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {accion.error && <p className="error" role="alert">{accion.error}</p>}

      {esDoctor && v.estado === 'espera' && (
        <button className="grande" onClick={() => void iniciar()} disabled={accion.cargando}>
          Iniciar consulta
        </button>
      )}

      {esDoctor && v.estado === 'en_consulta' && (
        <section className="tarjeta">
          <h2>Cierre de la consulta</h2>
          <label>
            Diagnóstico
            <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={3} maxLength={2000} />
          </label>
          <label>
            Notas / indicaciones
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} maxLength={4000} />
          </label>
          <button className="grande" onClick={() => void cerrar()} disabled={accion.cargando}>
            {accion.cargando ? 'Guardando…' : 'Finalizar consulta'}
          </button>
        </section>
      )}

      {v.estado === 'atendida' && (
        <section className="tarjeta">
          <h2>Resultado de la consulta</h2>
          <p><strong>Atendió:</strong> {v.doctorNombre ?? '—'} · {formatearHora(v.horaInicioConsulta)} a {formatearHora(v.horaFinConsulta)}</p>
          <p><strong>Diagnóstico:</strong> {v.diagnostico ?? '—'}</p>
          <p><strong>Notas:</strong> {v.notas ?? '—'}</p>
        </section>
      )}
    </div>
  );
}
