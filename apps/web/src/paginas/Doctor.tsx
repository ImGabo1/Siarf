import { useState } from 'react';
import type { VisitaColaDto, VisitaDetalleDto } from '@siarf/shared';
import { api, mensajeError } from '../api';
import { Cargando, ErrorMsg, Tarjeta, fmtHora, useCarga, usePolling } from '../ui';

export function Doctor() {
  const cola = usePolling(() => api<VisitaColaDto[]>('/visitas/cola'), 10_000);
  const [sel, setSel] = useState<number | null>(null);

  return (
    <div className="rejilla-2 doctor">
      <Tarjeta titulo="Mi cola" acciones={<button onClick={() => void cola.recargar()}>Actualizar</button>}>
        <ErrorMsg texto={cola.error} />
        {!cola.data && !cola.error && <Cargando />}
        {cola.data && cola.data.length === 0 && <p className="muted">No hay pacientes en espera.</p>}
        <ul className="lista-sin-vineta cola">
          {cola.data?.map((v) => (
            <li key={v.id}>
              <button
                className={`item-cola${sel === v.id ? ' activo' : ''}${v.prioridad === 'urgente' ? ' urgente' : ''}`}
                onClick={() => setSel(v.id)}
              >
                <strong>{v.pacienteNombre}</strong>
                <span>
                  {v.edad} años · {fmtHora(v.horaLlegada)} · {v.minutosEspera} min
                </span>
                {v.estado === 'en_consulta' && <em>En consulta</em>}
                {v.prioridad === 'urgente' && v.estado !== 'en_consulta' && <em>URGENTE</em>}
              </button>
            </li>
          ))}
        </ul>
      </Tarjeta>

      {sel === null ? (
        <Tarjeta>
          <p className="muted">Seleccione un paciente de la cola para ver su historia y síntomas.</p>
        </Tarjeta>
      ) : (
        <Detalle id={sel} onCambio={() => void cola.recargar()} />
      )}
    </div>
  );
}

function Detalle({ id, onCambio }: { id: number; onCambio: () => void }) {
  const { data: v, error, cargando, recargar } = useCarga(() => api<VisitaDetalleDto>(`/visitas/${id}`), id);
  const [diagnostico, setDiagnostico] = useState('');
  const [notas, setNotas] = useState('');
  const [accion, setAccion] = useState<string | null>(null);
  const [errAccion, setErrAccion] = useState<string | null>(null);

  async function ejecutar(ruta: 'iniciar' | 'cerrar') {
    setAccion(ruta);
    setErrAccion(null);
    try {
      await api(`/visitas/${id}/${ruta}`, {
        method: 'POST',
        ...(ruta === 'cerrar' ? { body: { diagnostico: diagnostico || undefined, notas: notas || undefined } } : {}),
      });
      await recargar();
      onCambio();
    } catch (e) {
      setErrAccion(mensajeError(e));
      void recargar();
      onCambio();
    } finally {
      setAccion(null);
    }
  }

  if (cargando && !v) return <Tarjeta><Cargando /></Tarjeta>;
  if (!v) return <Tarjeta><ErrorMsg texto={error ?? 'No se pudo cargar la visita'} /></Tarjeta>;

  return (
    <div className="columna">
      <Tarjeta titulo={v.paciente.nombre}>
        <p>
          {v.paciente.cedula} · {v.paciente.edad} años · {v.paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
          {v.paciente.telefono ? ` · ${v.paciente.telefono}` : ''}
        </p>
        <p>
          Especialidad: <strong>{v.especialidadNombre}</strong> · Llegada {fmtHora(v.horaLlegada)}
          {v.prioridad === 'urgente' && <span className="etiqueta-urgente">URGENTE</span>}
        </p>

        <h3>Síntomas referidos</h3>
        <ul className="chips">
          {v.sintomas.map((s) => (
            <li key={s.codigo} className={s.intensidad >= 4 ? 'fuerte' : ''}>
              {s.nombre} · {s.intensidad}/5
            </li>
          ))}
        </ul>

        {v.inferencias.length > 0 && (
          <details>
            <summary>Razonamiento del sistema experto</summary>
            <ul>
              {v.inferencias.map((i) => (
                <li key={i.regla}>{i.explicacion}</li>
              ))}
            </ul>
          </details>
        )}
      </Tarjeta>

      <Tarjeta titulo="Consulta">
        <ErrorMsg texto={errAccion} />
        {v.estado === 'espera' && (
          <button className="primario" onClick={() => void ejecutar('iniciar')} disabled={accion !== null}>
            Iniciar consulta
          </button>
        )}
        {v.estado === 'en_consulta' && (
          <div className="formulario">
            <label>
              Diagnóstico
              <textarea rows={2} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} maxLength={2000} />
            </label>
            <label>
              Notas / indicaciones
              <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={4000} />
            </label>
            <button className="primario" onClick={() => void ejecutar('cerrar')} disabled={accion !== null}>
              Cerrar consulta
            </button>
          </div>
        )}
        {v.estado === 'atendida' && (
          <>
            <p className="exito">Consulta cerrada{v.doctorNombre ? ` por ${v.doctorNombre}` : ''}.</p>
            {v.diagnostico && <p><strong>Diagnóstico:</strong> {v.diagnostico}</p>}
            {v.notas && <p><strong>Notas:</strong> {v.notas}</p>}
          </>
        )}
        {v.estado === 'cancelada' && <p className="muted">Visita cancelada.</p>}
      </Tarjeta>

      {v.historial.length > 0 && (
        <Tarjeta titulo="Historial del paciente">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Especialidad</th><th>Estado</th><th>Diagnóstico</th></tr>
            </thead>
            <tbody>
              {v.historial.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.fecha).toLocaleDateString('es-VE')}</td>
                  <td>{h.especialidad}</td>
                  <td>{h.estado}</td>
                  <td>{h.diagnostico ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}
