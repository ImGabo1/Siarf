import { useMemo } from 'react';
import { reconstruirEstado, type EventoSim, type PacienteEnEscena, type SimConfig } from '@siarf/sim';

interface Props {
  config: SimConfig;
  timeline: EventoSim[];
  /** Minuto simulado que se dibuja. */
  t: number;
}

const ANCHO = 1000;
const ALTO = 620;
const R = 7; // radio del paciente
const MAX_COLA_RECEPCION = 96;
const MAX_COLA_SALA = 40;

/**
 * Plano esquemático del hospital: recepción a la izquierda y una tarjeta por
 * especialidad a la derecha. Los pacientes (círculos) se mueven según el
 * estado reconstruido a partir de la línea de tiempo de la simulación.
 *   rojo = urgente · azul = normal
 */
export function Plano({ config, timeline, t }: Props) {
  const escena = useMemo(() => reconstruirEstado(timeline, t), [timeline, t]);

  const enRecepcion = escena.filter((p) => p.fase === 'cola_recepcion').sort((a, b) => (a.posCola ?? 0) - (b.posCola ?? 0));
  const enRegistro = escena.filter((p) => p.fase === 'registro');

  const n = config.especialidades.length;
  const columnas = n <= 4 ? n || 1 : n <= 9 ? 3 : 4;
  const filas = Math.ceil(n / columnas);
  const x0 = 295;
  const hueco = 8;
  const w = (ANCHO - x0 - 10 - (columnas - 1) * hueco) / columnas;
  const h = (ALTO - 20 - (filas - 1) * hueco) / filas;

  const paciente = (p: PacienteEnEscena, cx: number, cy: number) => (
    <circle key={p.id} cx={cx} cy={cy} r={R} className={p.urgente ? 'pac urgente' : 'pac'}>
      <title>{`Paciente ${p.id}${p.urgente ? ' (urgente)' : ''}`}</title>
    </circle>
  );

  // ── Recepción ──
  const puestos = config.puestosRecepcion;
  const filasPuestos = Math.ceil(puestos / 4);
  const yCola = 62 + filasPuestos * 46 + 28;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="plano" role="img" aria-label="Plano del hospital con pacientes en movimiento">
      <rect x={10} y={10} width={270} height={ALTO - 20} rx={10} className="zona" />
      <text x={24} y={34} className="titulo-zona">Recepción</text>
      {Array.from({ length: puestos }, (_, i) => {
        const x = 24 + (i % 4) * 62;
        const y = 48 + Math.floor(i / 4) * 46;
        const ocupado = enRegistro.find((p) => p.puesto === i + 1);
        return (
          <g key={i}>
            <rect x={x} y={y} width={54} height={34} rx={6} className={ocupado ? 'puesto ocupado' : 'puesto'} />
            {ocupado ? paciente(ocupado, x + 27, y + 17) : <text x={x + 27} y={y + 21} className="num">{i + 1}</text>}
          </g>
        );
      })}
      <text x={24} y={yCola - 10} className="subtitulo">
        Cola de recepción ({enRecepcion.length})
      </text>
      {enRecepcion.slice(0, MAX_COLA_RECEPCION).map((p) =>
        paciente(p, 30 + ((p.posCola ?? 0) % 12) * 20, yCola + 6 + Math.floor((p.posCola ?? 0) / 12) * 20),
      )}
      {enRecepcion.length > MAX_COLA_RECEPCION && (
        <text x={24} y={ALTO - 24} className="subtitulo">+{enRecepcion.length - MAX_COLA_RECEPCION} más</text>
      )}

      {/* ── Especialidades ── */}
      {config.especialidades.map((e, i) => {
        const x = x0 + (i % columnas) * (w + hueco);
        const y = 10 + Math.floor(i / columnas) * (h + hueco);
        const espera = escena
          .filter((p) => p.fase === 'sala_espera' && p.especialidad === e.codigo)
          .sort((a, b) => (a.posCola ?? 0) - (b.posCola ?? 0));
        const enConsulta = escena.filter((p) => p.fase === 'consulta' && p.especialidad === e.codigo);
        const calor = espera.length >= 6 ? 'rojo' : espera.length >= 3 ? 'ambar' : '';
        const porFila = Math.max(1, Math.floor((w - 20) / 34));
        const filasSlots = Math.ceil(e.consultorios / porFila);
        const yEspera = y + 40 + filasSlots * 34 + 22;
        const porFilaEspera = Math.max(1, Math.floor((w - 16) / 18));

        return (
          <g key={e.codigo}>
            <rect x={x} y={y} width={w} height={h} rx={10} className={`zona ${calor}`} />
            <text x={x + 10} y={y + 20} className="titulo-zona">{e.nombre.length > 22 ? `${e.nombre.slice(0, 21)}…` : e.nombre}</text>
            {Array.from({ length: e.consultorios }, (_, k) => {
              const sx = x + 10 + (k % porFila) * 34;
              const sy = y + 32 + Math.floor(k / porFila) * 34;
              const ocupado = enConsulta.find((p) => p.puesto === k + 1);
              return (
                <g key={k}>
                  <rect x={sx} y={sy} width={28} height={28} rx={5} className={ocupado ? 'puesto ocupado' : 'puesto'} />
                  {ocupado ? paciente(ocupado, sx + 14, sy + 14) : <text x={sx + 14} y={sy + 18} className="num">{k + 1}</text>}
                </g>
              );
            })}
            <text x={x + 10} y={yEspera - 8} className="subtitulo">En espera ({espera.length})</text>
            {espera.slice(0, MAX_COLA_SALA).map((p) =>
              paciente(
                p,
                x + 16 + ((p.posCola ?? 0) % porFilaEspera) * 18,
                yEspera + 8 + Math.floor((p.posCola ?? 0) / porFilaEspera) * 18,
              ),
            )}
            {espera.length > MAX_COLA_SALA && (
              <text x={x + w - 10} y={y + h - 8} textAnchor="end" className="subtitulo">+{espera.length - MAX_COLA_SALA}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
