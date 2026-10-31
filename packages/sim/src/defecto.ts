import type { EspecialidadSim, SimConfig } from './tipos';

/**
 * Parámetros de partida. SON SUPUESTOS, no datos reales: deben calibrarse
 * con tiempos medidos en el hospital (o justificarse en el artículo).
 */
export const ESPECIALIDADES_SIM_DEFECTO: EspecialidadSim[] = [
  { codigo: 'medicina_general', nombre: 'Medicina General', peso: 0.25, consultorios: 3, consultaMin: { media: 12, desv: 5 } },
  { codigo: 'pediatria', nombre: 'Pediatría', peso: 0.12, consultorios: 2, consultaMin: { media: 15, desv: 5 } },
  { codigo: 'cardiologia', nombre: 'Cardiología', peso: 0.08, consultorios: 1, consultaMin: { media: 20, desv: 6 } },
  { codigo: 'neumologia', nombre: 'Neumología', peso: 0.08, consultorios: 1, consultaMin: { media: 18, desv: 6 } },
  { codigo: 'gastroenterologia', nombre: 'Gastroenterología', peso: 0.09, consultorios: 1, consultaMin: { media: 18, desv: 6 } },
  { codigo: 'neurologia', nombre: 'Neurología', peso: 0.05, consultorios: 1, consultaMin: { media: 25, desv: 8 } },
  { codigo: 'traumatologia', nombre: 'Traumatología', peso: 0.12, consultorios: 1, consultaMin: { media: 15, desv: 5 } },
  { codigo: 'dermatologia', nombre: 'Dermatología', peso: 0.05, consultorios: 1, consultaMin: { media: 12, desv: 4 } },
  { codigo: 'urologia', nombre: 'Urología', peso: 0.04, consultorios: 1, consultaMin: { media: 15, desv: 5 } },
  { codigo: 'otorrinolaringologia', nombre: 'Otorrinolaringología', peso: 0.04, consultorios: 1, consultaMin: { media: 14, desv: 5 } },
  { codigo: 'oftalmologia', nombre: 'Oftalmología', peso: 0.03, consultorios: 1, consultaMin: { media: 15, desv: 5 } },
  { codigo: 'emergencia', nombre: 'Emergencia', peso: 0.05, consultorios: 2, consultaMin: { media: 25, desv: 10 } },
];

/** Jornada de 8 horas con picos a media mañana y a primera hora de la tarde. */
export function configPorDefecto(): SimConfig {
  return {
    semilla: 42,
    duracionMin: 480,
    llegadasPorHora: 30,
    perfilHorario: [0.6, 1.0, 1.3, 1.2, 0.8, 0.9, 1.1, 0.7],
    puestosRecepcion: 2,
    registroMin: { media: 3, desv: 1 },
    proporcionUrgentes: 0.05,
    especialidades: ESPECIALIDADES_SIM_DEFECTO.map((e) => ({ ...e, consultaMin: { ...e.consultaMin } })),
  };
}
