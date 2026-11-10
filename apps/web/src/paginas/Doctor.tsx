import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { EstadoVisita, VisitaColaDto, VisitaDetalleDto } from '@siarf/shared';
import { useAuth } from '../auth';
import { api, mensajeError } from '../api';
import {
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
  minutosEntre,
  useCarga,
  usePolling,
} from '../ui';

type FiltroCola = 'todos' | 'urgentes';

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaHoy(): string {
  const texto = new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function Doctor() {
  const { usuario } = useAuth();
  const cola = usePolling(() => api<VisitaColaDto[]>('/visitas/cola'), 10_000);
  const [sel, setSel] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<FiltroCola>('todos');
  const [q, setQ] = useState('');

  const lista = useMemo(() => cola.data ?? [], [cola.data]);

  // Al abrir la pantalla se elige el primer paciente para ahorrar clics.
  useEffect(() => {
    if (sel !== null || lista.length === 0) return;
    const primero = lista.find((v) => v.estado === 'espera') ?? lista[0];
    if (primero) setSel(primero.id);
  }, [lista, sel]);

  const stats = useMemo(() => {
    const enEspera = lista.filter((v) => v.estado === 'espera');
    return {
      enEspera: enEspera.length,
      urgentes: enEspera.filter((v) => v.prioridad === 'urgente').length,
      enConsulta: lista.filter((v) => v.estado === 'en_consulta').length,
      esperaMax: enEspera.reduce((max, v) => Math.max(max, v.minutosEspera), 0),
    };
  }, [lista]);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return lista.filter((v) => {
      if (filtro === 'urgentes' && v.prioridad !== 'urgente') return false;
      if (!texto) return true;
      return v.pacienteNombre.toLowerCase().includes(texto) || v.cedula.toLowerCase().includes(texto);
    });
  }, [lista, filtro, q]);

  const atenderSiguiente = () => {
    const siguiente = lista.find((v) => v.estado === 'espera');
    if (siguiente) setSel(siguiente.id);
  };

  return (
    <div>
      <header className="pagina-cab">
        <div>
          <p className="sobre-titulo">Mi jornada</p>
          <h1>{saludo()}, {usuario?.nombre.split(' ')[0]}</h1>
          <p className="muted">{fechaHoy()}</p>
        </div>
        <div className="acciones">
          <span className="badge consulta sin-punto">
            <span className="punto-vivo" aria-hidden="true" /> Actualización automática
          </span>
          <button className="primario" onClick={atenderSiguiente} disabled={stats.enEspera === 0}>
            Atender siguiente
          </button>
        </div>
      </header>

      <section className="resumen-dia" aria-label="Resumen de la jornada">
        <Stat
          etiqueta="En espera"
          valor={stats.enEspera}
          detalle="Pacientes listos para consulta"
          acento="primario"
          icono={<IconoUsuarios />}
        />
        <Stat
          etiqueta="Urgentes"
          valor={stats.urgentes}
          detalle={stats.urgentes > 0 ? 'Requieren prioridad' : 'Sin urgencias pendientes'}
          acento={stats.urgentes > 0 ? 'peligro' : 'ok'}
          icono={<IconoAlerta />}
        />
        <Stat
          etiqueta="En consulta"
          valor={stats.enConsulta}
          detalle="Atenciones en curso"
          acento="info"
          icono={<IconoPulso />}
        />
        <Stat
          etiqueta="Espera más larga"
          valor={<>{stats.esperaMax} <small>min</small></>}
          detalle="Tiempo máximo acumulado"
          acento={stats.esperaMax >= 45 ? 'peligro' : stats.esperaMax >= 20 ? 'ambar' : 'ok'}
          icono={<IconoTiempo />}
        />
      </section>

      <div className="rejilla-2 doctor">
        <section className="tarjeta panel-cola" aria-label="Cola de pacientes">
          <header className="tarjeta-cab">
            <div>
              <h2>
                Mi cola <span className="badge consulta sin-punto">{lista.length}</span>
              </h2>
              <span className="subtitulo">Ordenada por prioridad y hora de llegada</span>
            </div>
            <button
              className="boton-icono"
              onClick={() => void cola.recargar()}
              title="Actualizar cola"
              aria-label="Actualizar cola"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
              </svg>
            </button>
          </header>

          <div className="buscador cola-buscador">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o cédula…"
              aria-label="Buscar paciente en la cola"
            />
          </div>

          <div className="cola-herramientas">
            <div className="cola-filtros" role="group" aria-label="Filtrar cola">
              <button className={filtro === 'todos' ? 'activa' : ''} onClick={() => setFiltro('todos')}>
                Todos <span className="conteo">{lista.length}</span>
              </button>
              <button className={filtro === 'urgentes' ? 'activa' : ''} onClick={() => setFiltro('urgentes')}>
                Urgentes <span className="conteo">{stats.urgentes}</span>
              </button>
            </div>
            <span className="muted pequeno">{visibles.length} en pantalla</span>
          </div>

          <ErrorMsg texto={cola.error} />
          {!cola.data && !cola.error && <Cargando texto="Cargando cola…" />}
          {cola.data && visibles.length === 0 && (
            <Vacio titulo={lista.length === 0 ? 'Sin pacientes en espera' : 'Ningún paciente coincide'}>
              {lista.length === 0
                ? 'Cuando recepción registre una llegada, aparecerá aquí automáticamente.'
                : 'Pruebe con otro nombre, cédula o quite el filtro de urgentes.'}
            </Vacio>
          )}

          {visibles.length > 0 && (
            <ul className="lista-sin-vineta cola" aria-live="polite">
              {visibles.map((v) => {
                const activo = sel === v.id;
                const esperaClase = v.minutosEspera >= 45 ? ' critica' : v.minutosEspera >= 20 ? ' larga' : '';
                return (
                  <li key={v.id}>
                    <button
                      className={`item-cola${activo ? ' activo' : ''}${v.prioridad === 'urgente' ? ' urgente' : ''}`}
                      onClick={() => setSel(v.id)}
                      aria-current={activo ? 'true' : undefined}
                    >
                      <span className={`avatar${v.prioridad === 'urgente' ? ' urgente' : ''}`} aria-hidden="true">
                        {iniciales(v.pacienteNombre)}
                      </span>
                      <span className="cola-info">
                        <span className="cola-nombre">{v.pacienteNombre}</span>
                        <span className="cola-meta">
                          {v.edad} años · {v.especialidadNombre}
                        </span>
                        <span className={`cola-espera${esperaClase}`}>
                          {v.estado === 'en_consulta' ? 'En consulta' : `${v.minutosEspera} min en espera`}
                        </span>
                      </span>
                      {v.estado === 'en_consulta' && <span className="badge consulta">En consulta</span>}
                      {v.prioridad === 'urgente' && v.estado !== 'en_consulta' && <span className="badge urgente">Urgente</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {sel === null ? (
          <Tarjeta>
            <Vacio titulo="Seleccione un paciente">
              Elija una persona de la cola para revisar su historia, síntomas y orientación del sistema experto.
            </Vacio>
          </Tarjeta>
        ) : (
          <Detalle key={sel} id={sel} onCambio={() => void cola.recargar()} />
        )}
      </div>
    </div>
  );
}

function Detalle({ id, onCambio }: { id: number; onCambio: () => void }) {
  const { data: v, error, cargando, recargar } = useCarga(() => api<VisitaDetalleDto>(`/visitas/${id}`), id);
  const [diagnostico, setDiagnostico] = useState('');
  const [notas, setNotas] = useState('');
  const [accion, setAccion] = useState<'iniciar' | 'cerrar' | null>(null);
  const [errAccion, setErrAccion] = useState<string | null>(null);

  async function ejecutar(ruta: 'iniciar' | 'cerrar') {
    setAccion(ruta);
    setErrAccion(null);
    try {
      await api(`/visitas/${id}/${ruta}`, {
        method: 'POST',
        ...(ruta === 'cerrar' ? { body: { diagnostico: diagnostico || undefined, notas: notas || undefined } } : {}),
      });
      if (ruta === 'cerrar') {
        setDiagnostico('');
        setNotas('');
      }
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

  function atajoCerrar(e: KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && accion === null) {
      e.preventDefault();
      void ejecutar('cerrar');
    }
  }

  if (cargando && !v) {
    return (
      <Tarjeta>
        <Cargando texto="Cargando historia clínica…" />
      </Tarjeta>
    );
  }
  if (!v) {
    return (
      <Tarjeta>
        <ErrorMsg texto={error ?? 'No se pudo cargar la visita'} />
      </Tarjeta>
    );
  }

  const minutosEspera = v.horaInicioConsulta
    ? minutosEntre(v.horaLlegada, v.horaInicioConsulta)
    : minutosEntre(v.horaLlegada);

  return (
    <div className="columna">
      <Tarjeta>
        <div className="paciente-cab">
          <div className="paciente-identidad">
            <span className={`avatar grande${v.prioridad === 'urgente' ? ' urgente' : ''}`} aria-hidden="true">
              {iniciales(v.paciente.nombre)}
            </span>
            <div>
              <h2>
                {v.paciente.nombre}
                {v.prioridad === 'urgente' && <span className="etiqueta-urgente">URGENTE</span>}
              </h2>
              <p className="muted">
                {v.paciente.cedula} · {v.paciente.edad} años · {v.paciente.sexo === 'F' ? 'Femenino' : 'Masculino'}
                {v.paciente.telefono && (
                  <> · <a href={`tel:${v.paciente.telefono}`}>{v.paciente.telefono}</a></>
                )}
              </p>
              <div className="acciones" style={{ marginTop: 6 }}>
                <BadgeEstado estado={v.estado} />
              </div>
            </div>
          </div>
          <div className="datos-rapidos">
            <div>
              <span>Llegada</span>
              <strong>{fmtHora(v.horaLlegada)}</strong>
            </div>
            <div>
              <span>Espera</span>
              <strong>{minutosEspera} min</strong>
            </div>
            <div>
              <span>Especialidad</span>
              <strong>{v.especialidadNombre}</strong>
            </div>
            {v.horaInicioConsulta && (
              <div>
                <span>Inicio</span>
                <strong>{fmtHora(v.horaInicioConsulta)}</strong>
              </div>
            )}
          </div>
        </div>
      </Tarjeta>

      {v.prioridad === 'urgente' && v.estado !== 'atendida' && (
        <div className="aviso-urgente" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          Paciente marcado como urgente: priorice su atención.
        </div>
      )}

      <div className="rejilla-detalle">
        <Tarjeta titulo="Síntomas referidos" subtitulo={`${v.sintomas.length} registrados en recepción`}>
          {v.sintomas.length === 0 ? (
            <p className="muted">Sin síntomas registrados.</p>
          ) : (
            <ul className="chips">
              {v.sintomas.map((s) => (
                <li key={s.codigo} className={s.intensidad >= 4 ? 'fuerte' : ''}>
                  {s.nombre}
                  <span className="puntos" aria-label={`Intensidad ${s.intensidad} de 5`} title={`Intensidad ${s.intensidad}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i key={n} className={n <= s.intensidad ? 'on' : ''} />
                    ))}
                  </span>
                  {s.duracionDias !== null && <span className="muted pequeno">· {s.duracionDias} d</span>}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Orientación del sistema experto" subtitulo="Reglas que respaldan la especialidad">
          {v.inferencias.length === 0 ? (
            <p className="muted">Sin inferencias registradas para esta visita.</p>
          ) : (
            <ul className="lista-sin-vineta razonamiento">
              {v.inferencias.map((i) => (
                <li key={i.regla}>
                  <div className="cabeza">
                    <strong>{i.conclusion}</strong>
                    <span className="regla">{i.regla}</span>
                  </div>
                  <p className="pequeno">{i.explicacion}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="muted pequeno">Apoyo a la decisión: no sustituye el juicio clínico.</p>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Consulta"
        subtitulo={v.estado === 'en_consulta' ? 'Registre el diagnóstico y las indicaciones al cerrar' : undefined}
      >
        <ErrorMsg texto={errAccion} />

        {v.estado === 'espera' && (
          <>
            <p className="muted">Al iniciar, el paciente pasará a su consultorio y la cola se actualizará.</p>
            <button
              className="primario accion-grande"
              onClick={() => void ejecutar('iniciar')}
              disabled={accion !== null}
            >
              {accion === 'iniciar' ? 'Iniciando…' : 'Iniciar consulta'}
            </button>
          </>
        )}

        {v.estado === 'en_consulta' && (
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              void ejecutar('cerrar');
            }}
            onKeyDown={atajoCerrar}
          >
            <div className="estado-consulta">
              <span className="punto-vivo" aria-hidden="true" />
              Consulta en curso{v.horaInicioConsulta ? ` desde las ${fmtHora(v.horaInicioConsulta)}` : ''}
            </div>
            <label>
              Diagnóstico
              <textarea
                rows={3}
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                maxLength={2000}
                placeholder="Impresión diagnóstica…"
              />
            </label>
            <label>
              Notas e indicaciones
              <textarea
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={4000}
                placeholder="Tratamiento, órdenes médicas, recomendaciones…"
              />
            </label>
            <div className="acciones" style={{ justifyContent: 'space-between' }}>
              <span className="atajos"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> para guardar</span>
              <button className="primario" disabled={accion !== null}>
                {accion === 'cerrar' ? 'Guardando…' : 'Cerrar y guardar consulta'}
              </button>
            </div>
          </form>
        )}

        {v.estado === 'atendida' && (
          <>
            <p className="exito">
              Consulta cerrada{v.doctorNombre ? ` por ${v.doctorNombre}` : ''}
              {v.horaFinConsulta ? ` a las ${fmtHora(v.horaFinConsulta)}` : ''}.
            </p>
            <div className="resumen-consulta">
              <div>
                <span>Diagnóstico</span>
                <p>{v.diagnostico ?? 'Sin diagnóstico registrado.'}</p>
              </div>
              <div>
                <span>Notas e indicaciones</span>
                <p>{v.notas ?? 'Sin notas registradas.'}</p>
              </div>
            </div>
          </>
        )}

        {v.estado === 'cancelada' && <p className="muted">Esta visita fue cancelada.</p>}
      </Tarjeta>

      {v.historial.length > 0 && (
        <Tarjeta titulo="Historial clínico" subtitulo={`${v.historial.length} atenciones anteriores`}>
          <ul className="historial">
            {v.historial.map((h) => (
              <li key={h.id}>
                <span className="fecha">{new Date(h.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <div className="cabeza">
                  <strong>{h.especialidad}</strong>
                  <BadgeEstado estado={h.estado} />
                </div>
                <p className="pequeno">{h.diagnostico ?? <span className="muted">Sin diagnóstico registrado.</span>}</p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

function BadgeEstado({ estado }: { estado: EstadoVisita }) {
  if (estado === 'espera') return <span className="badge espera">En espera</span>;
  if (estado === 'en_consulta') return <span className="badge consulta">En consulta</span>;
  if (estado === 'atendida') return <span className="badge ok">Atendida</span>;
  return <span className="badge sin-punto">Cancelada</span>;
}
