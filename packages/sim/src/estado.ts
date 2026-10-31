import type { EventoSim, PacienteEnEscena } from './tipos';

/**
 * Reconstruye quién está dónde en el minuto `t` a partir de la línea de tiempo.
 * La usa el frontend para animar el plano del hospital.
 *
 * `posCola` indica el lugar de cada paciente en su cola (0 = el siguiente):
 * la recepción es FIFO; la sala de espera de cada especialidad atiende
 * primero a los urgentes y luego por orden de entrada.
 */
export function reconstruirEstado(timeline: EventoSim[], t: number): PacienteEnEscena[] {
  const activos = new Map<number, { p: PacienteEnEscena; tCola: number }>();

  for (const ev of timeline) {
    if (ev.t > t) break;
    const a = activos.get(ev.pacienteId);
    switch (ev.tipo) {
      case 'llegada':
        activos.set(ev.pacienteId, {
          p: { id: ev.pacienteId, urgente: ev.urgente, especialidad: ev.especialidad, fase: 'cola_recepcion' },
          tCola: ev.t,
        });
        break;
      case 'inicio_registro':
        if (a) {
          a.p.fase = 'registro';
          if (ev.puesto !== undefined) a.p.puesto = ev.puesto;
        }
        break;
      case 'fin_registro':
        if (a) {
          a.p.fase = 'sala_espera';
          delete a.p.puesto;
          a.tCola = ev.t;
        }
        break;
      case 'inicio_consulta':
        if (a) {
          a.p.fase = 'consulta';
          if (ev.puesto !== undefined) a.p.puesto = ev.puesto;
        }
        break;
      case 'fin_consulta':
        activos.delete(ev.pacienteId);
        break;
    }
  }

  const lista = [...activos.values()];
  const asignar = (grupo: typeof lista) =>
    grupo.forEach((a, i) => {
      a.p.posCola = i;
    });

  asignar(
    lista
      .filter((a) => a.p.fase === 'cola_recepcion')
      .sort((x, y) => x.tCola - y.tCola || x.p.id - y.p.id),
  );

  const salas = new Map<string, typeof lista>();
  for (const a of lista) {
    if (a.p.fase !== 'sala_espera') continue;
    const g = salas.get(a.p.especialidad) ?? [];
    g.push(a);
    salas.set(a.p.especialidad, g);
  }
  for (const g of salas.values()) {
    g.sort((x, y) => Number(y.p.urgente) - Number(x.p.urgente) || x.tCola - y.tCola || x.p.id - y.p.id);
    asignar(g);
  }

  return lista.map((a) => a.p);
}
