import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EspecialidadDto, VisitaColaDto } from '@siarf/shared';
import { api } from '../api';
import { formatearHora, useAccion, useGet } from '../hooks';
import { useSesion } from '../sesion';

/** Cola de pacientes. El doctor ve la de su especialidad; recepción/admin ven todas. */
export function Cola() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const esDoctor = usuario?.rol === 'doctor';
  const puedeCancelar = usuario?.rol === 'admin' || usuario?.rol === 'recepcionista';

  const [filtro, setFiltro] = useState<number | ''>('');
  const especialidades = useGet<EspecialidadDto[]>(esDoctor ? null : '/especialidades');
  const ruta = !esDoctor && filtro !== '' ? `/visitas/cola?especialidadId=${filtro}` : '/visitas/cola';
  const cola = useGet<VisitaColaDto[]>(ruta, 10_000); // se refresca solo cada 10 s
  const accion = useAccion();

  const atender = async (id: number) => {
    const r = await accion.ejecutar(() => api.post(`/visitas/${id}/iniciar`));
    if (r) navegar(`/visita/${id}`);
  };
  const cancelar = async (id: number) => {
    if (!window.confirm('¿Cancelar esta visita?')) return;
    const r = await accion.ejecutar(() => api.post(`/visitas/${id}/cancelar`));
    if (r) cola.recargar();
  };

  const lista = cola.datos ?? [];
  const enConsulta = lista.filter((v) => v.estado === 'en_consulta');
  const enEspera = lista.filter((v) => v.estado === 'espera');
  // El primero de la cola de cada especialidad es el siguiente a atender.
  const siguientes = new Set<number>();
  const vistas = new Set<number>();
  for (const v of enEspera) {
    if (!vistas.has(v.especialidadId)) {
      vistas.add(v.especialidadId);
      siguientes.add(v.id);
    }
  }

  return (
    <div className="pagina">
      <div className="encabezado-pagina">
        <h1>Cola de pacientes</h1>
        {!esDoctor && (
          <label className="en-linea">
            Especialidad
            <select value={filtro} onChange={(e) => setFiltro(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Todas</option>
              {(especialidades.datos ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {cola.error && <p className="error">{cola.error}</p>}
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      {cola.cargando && !cola.datos && <p>Cargando…</p>}

      {enConsulta.length > 0 && (
        <section className="tarjeta">
          <h2>En consulta ({enConsulta.length})</h2>
          <TablaCola filas={enConsulta} mostrarEsp={!esDoctor} />
        </section>
      )}

      <section className="tarjeta">
        <h2>En espera ({enEspera.length})</h2>
        {enEspera.length === 0 ? (
          <p className="nota">No hay pacientes esperando.</p>
        ) : (
          <TablaCola
            filas={enEspera}
            mostrarEsp={!esDoctor}
            acciones={(v) => (
              <>
                {esDoctor && (
                  <button disabled={accion.cargando || !siguientes.has(v.id)} onClick={() => void atender(v.id)} title={siguientes.has(v.id) ? '' : 'Debe atender primero al siguiente en la cola'}>
                    Atender
                  </button>
                )}
                {puedeCancelar && (
                  <button className="secundario" disabled={accion.cargando} onClick={() => void cancelar(v.id)}>
                    Cancelar
                  </button>
                )}
              </>
            )}
          />
        )}
      </section>
    </div>
  );
}

function TablaCola({
  filas,
  mostrarEsp,
  acciones,
}: {
  filas: VisitaColaDto[];
  mostrarEsp: boolean;
  acciones?: (v: VisitaColaDto) => React.ReactNode;
}) {
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Edad</th>
            {mostrarEsp && <th>Especialidad</th>}
            <th>Llegada</th>
            <th>Espera</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map((v) => (
            <tr key={v.id} className={v.prioridad === 'urgente' ? 'urgente' : ''}>
              <td>
                <Link to={`/visita/${v.id}`}>{v.pacienteNombre}</Link>
                {v.prioridad === 'urgente' && <span className="etiqueta roja">URGENTE</span>}
                <small className="bloque">{v.cedula}</small>
              </td>
              <td>{v.edad}</td>
              {mostrarEsp && <td>{v.especialidadNombre}</td>}
              <td>{formatearHora(v.horaLlegada)}</td>
              <td>{v.minutosEspera} min</td>
              <td className="acciones">{acciones?.(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
