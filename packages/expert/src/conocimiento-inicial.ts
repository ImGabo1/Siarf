import type { ReglaExperta, TipoConclusion } from './tipos';

/**
 * ⚠ BASE DE CONOCIMIENTO DE EJEMPLO.
 * Las reglas y factores de certeza (CF) de este archivo son un punto de partida
 * para desarrollar y probar el sistema. NO están validados clínicamente.
 * Antes de usarlos en el artículo o en una demostración formal, deben ser
 * revisados y ajustados por un profesional de la salud (el "experto").
 *
 * Este archivo alimenta el seed de la base de datos (apps/api). Una vez
 * sembrada, las reglas se editan en la base de datos / panel de administración.
 */

export interface EspecialidadInicial {
  codigo: string;
  nombre: string;
  /** Cantidad de consultorios que se crean en el seed. */
  consultorios: number;
}

export interface SintomaInicial {
  codigo: string;
  nombre: string;
  categoria: string;
}

export const ESPECIALIDADES_INICIALES: EspecialidadInicial[] = [
  { codigo: 'medicina_general', nombre: 'Medicina General', consultorios: 3 },
  { codigo: 'pediatria', nombre: 'Pediatría', consultorios: 2 },
  { codigo: 'emergencia', nombre: 'Emergencia', consultorios: 2 },
  { codigo: 'cardiologia', nombre: 'Cardiología', consultorios: 1 },
  { codigo: 'neumologia', nombre: 'Neumología', consultorios: 1 },
  { codigo: 'gastroenterologia', nombre: 'Gastroenterología', consultorios: 1 },
  { codigo: 'neurologia', nombre: 'Neurología', consultorios: 1 },
  { codigo: 'traumatologia', nombre: 'Traumatología', consultorios: 1 },
  { codigo: 'dermatologia', nombre: 'Dermatología', consultorios: 1 },
  { codigo: 'urologia', nombre: 'Urología', consultorios: 1 },
  { codigo: 'otorrinolaringologia', nombre: 'Otorrinolaringología', consultorios: 1 },
  { codigo: 'oftalmologia', nombre: 'Oftalmología', consultorios: 1 },
];

const s = (codigo: string, nombre: string, categoria: string): SintomaInicial => ({ codigo, nombre, categoria });

export const SINTOMAS_INICIALES: SintomaInicial[] = [
  s('fiebre', 'Fiebre', 'General'),
  s('fatiga', 'Fatiga / cansancio', 'General'),
  s('malestar_general', 'Malestar general', 'General'),
  s('perdida_peso', 'Pérdida de peso sin causa', 'General'),

  s('tos', 'Tos', 'Respiratorio'),
  s('tos_con_flema', 'Tos con flema', 'Respiratorio'),
  s('dificultad_respiratoria', 'Dificultad para respirar', 'Respiratorio'),
  s('sibilancias', 'Silbidos en el pecho', 'Respiratorio'),

  s('dolor_toracico', 'Dolor en el pecho', 'Cardiovascular'),
  s('palpitaciones', 'Palpitaciones', 'Cardiovascular'),
  s('hinchazon_piernas', 'Hinchazón de piernas', 'Cardiovascular'),
  s('mareo', 'Mareo', 'Cardiovascular'),
  s('desmayo', 'Desmayo', 'Cardiovascular'),

  s('dolor_abdominal', 'Dolor abdominal', 'Digestivo'),
  s('nauseas', 'Náuseas', 'Digestivo'),
  s('vomitos', 'Vómitos', 'Digestivo'),
  s('diarrea', 'Diarrea', 'Digestivo'),
  s('acidez', 'Acidez / ardor de estómago', 'Digestivo'),
  s('estrenimiento', 'Estreñimiento', 'Digestivo'),
  s('sangre_en_heces', 'Sangre en las heces', 'Digestivo'),

  s('dolor_cabeza', 'Dolor de cabeza', 'Neurológico'),
  s('convulsiones', 'Convulsiones', 'Neurológico'),
  s('hormigueo', 'Hormigueo / adormecimiento', 'Neurológico'),
  s('perdida_fuerza', 'Pérdida de fuerza', 'Neurológico'),
  s('dificultad_habla', 'Dificultad para hablar', 'Neurológico'),
  s('confusion', 'Confusión', 'Neurológico'),

  s('dolor_articular', 'Dolor articular', 'Músculo-esquelético'),
  s('inflamacion_articular', 'Inflamación de articulación', 'Músculo-esquelético'),
  s('dolor_espalda', 'Dolor de espalda', 'Músculo-esquelético'),
  s('trauma_golpe', 'Golpe o caída reciente', 'Músculo-esquelético'),
  s('fractura_sospechada', 'Sospecha de fractura', 'Músculo-esquelético'),

  s('erupcion_cutanea', 'Erupción en la piel', 'Piel'),
  s('picazon', 'Picazón', 'Piel'),
  s('lesion_piel', 'Lesión o mancha en la piel', 'Piel'),

  s('dolor_al_orinar', 'Dolor al orinar', 'Urinario'),
  s('orina_frecuente', 'Orinar con mucha frecuencia', 'Urinario'),
  s('sangre_en_orina', 'Sangre en la orina', 'Urinario'),

  s('dolor_oido', 'Dolor de oído', 'Oído, nariz y garganta'),
  s('perdida_audicion', 'Pérdida de audición', 'Oído, nariz y garganta'),
  s('dolor_garganta', 'Dolor de garganta', 'Oído, nariz y garganta'),
  s('congestion_nasal', 'Congestión nasal', 'Oído, nariz y garganta'),

  s('ojo_rojo', 'Ojo rojo', 'Ojos'),
  s('dolor_ocular', 'Dolor en el ojo', 'Ojos'),
  s('vision_borrosa', 'Visión borrosa', 'Ojos'),
];

interface Extra {
  prioridad?: number;
  urgencia?: boolean;
  exclusiones?: string[];
  descripcion?: string;
}

const r = (
  codigo: string,
  condiciones: string[],
  tipo: TipoConclusion,
  valor: string,
  cf: number,
  extra: Extra = {},
): ReglaExperta => ({
  codigo,
  condiciones,
  exclusiones: extra.exclusiones ?? [],
  concluye: { tipo, valor },
  cf,
  prioridad: extra.prioridad ?? 1,
  urgencia: extra.urgencia ?? false,
  ...(extra.descripcion ? { descripcion: extra.descripcion } : {}),
});

const esp = (codigo: string, condiciones: string[], especialidad: string, cf: number, extra?: Extra) =>
  r(codigo, condiciones, 'especialidad', especialidad, cf, extra);
const hecho = (codigo: string, condiciones: string[], valor: string, cf: number, extra?: Extra) =>
  r(codigo, condiciones, 'hecho', valor, cf, extra);

/** Hechos que el sistema inyecta según la edad (ver `hechosPorEdad`). */
export const HECHOS_DE_EDAD = ['paciente_pediatrico', 'adulto_mayor'];

export const REGLAS_INICIALES: ReglaExperta[] = [
  // ── Urgencias (prioridad alta) ──────────────────────────────────────────
  esp('U01', ['dolor_toracico', 'dificultad_respiratoria'], 'emergencia', 0.95, { prioridad: 10, urgencia: true, descripcion: 'Posible evento cardiopulmonar agudo' }),
  esp('U02', ['dolor_toracico', 'desmayo'], 'emergencia', 0.95, { prioridad: 10, urgencia: true }),
  esp('U03', ['convulsiones'], 'emergencia', 0.9, { prioridad: 10, urgencia: true }),
  esp('U04', ['confusion', 'fiebre'], 'emergencia', 0.85, { prioridad: 10, urgencia: true }),
  esp('U05', ['sangre_en_heces', 'mareo'], 'emergencia', 0.8, { prioridad: 9, urgencia: true, descripcion: 'Posible sangrado digestivo con repercusión' }),
  esp('U06', ['perdida_fuerza', 'dificultad_habla'], 'emergencia', 0.95, { prioridad: 10, urgencia: true, descripcion: 'Posibles signos de accidente cerebrovascular' }),

  // ── Cardiología ─────────────────────────────────────────────────────────
  esp('C01', ['dolor_toracico'], 'cardiologia', 0.6, { prioridad: 5 }),
  esp('C02', ['palpitaciones'], 'cardiologia', 0.6, { prioridad: 5 }),
  esp('C03', ['dolor_toracico', 'palpitaciones'], 'cardiologia', 0.85, { prioridad: 6 }),
  esp('C04', ['hinchazon_piernas', 'dificultad_respiratoria'], 'cardiologia', 0.7, { prioridad: 5 }),
  esp('C05', ['mareo', 'palpitaciones'], 'cardiologia', 0.6, { prioridad: 5 }),

  // ── Neumología ──────────────────────────────────────────────────────────
  hecho('H01', ['fiebre', 'tos', 'fatiga'], 'sindrome_gripal', 0.8, { prioridad: 3, descripcion: 'Cuadro tipo gripal' }),
  esp('N01', ['tos'], 'neumologia', 0.4, { prioridad: 3 }),
  esp('N02', ['tos', 'dificultad_respiratoria'], 'neumologia', 0.75, { prioridad: 4 }),
  esp('N03', ['sibilancias'], 'neumologia', 0.7, { prioridad: 4 }),
  esp('N04', ['tos_con_flema', 'fiebre'], 'neumologia', 0.7, { prioridad: 4 }),
  esp('N05', ['dificultad_respiratoria'], 'neumologia', 0.5, { prioridad: 3 }),
  esp('N06', ['sindrome_gripal', 'dificultad_respiratoria'], 'neumologia', 0.7, { prioridad: 4 }),

  // ── Gastroenterología ───────────────────────────────────────────────────
  hecho('H02', ['nauseas', 'vomitos', 'diarrea'], 'cuadro_gastrointestinal_agudo', 0.85, { prioridad: 3 }),
  esp('G01', ['dolor_abdominal'], 'gastroenterologia', 0.5, { prioridad: 3 }),
  esp('G02', ['acidez'], 'gastroenterologia', 0.7, { prioridad: 3 }),
  esp('G03', ['diarrea', 'dolor_abdominal'], 'gastroenterologia', 0.75, { prioridad: 4 }),
  esp('G04', ['sangre_en_heces'], 'gastroenterologia', 0.8, { prioridad: 5 }),
  esp('G05', ['cuadro_gastrointestinal_agudo'], 'gastroenterologia', 0.75, { prioridad: 4 }),
  esp('G06', ['estrenimiento'], 'gastroenterologia', 0.5, { prioridad: 2 }),

  // ── Neurología ──────────────────────────────────────────────────────────
  esp('NE01', ['dolor_cabeza'], 'neurologia', 0.5, { prioridad: 3 }),
  esp('NE02', ['dolor_cabeza', 'vision_borrosa'], 'neurologia', 0.75, { prioridad: 4 }),
  esp('NE03', ['hormigueo', 'perdida_fuerza'], 'neurologia', 0.8, { prioridad: 5 }),
  esp('NE04', ['mareo', 'hormigueo'], 'neurologia', 0.6, { prioridad: 4 }),

  // ── Traumatología ───────────────────────────────────────────────────────
  esp('T01', ['trauma_golpe', 'dolor_articular'], 'traumatologia', 0.8, { prioridad: 5 }),
  esp('T02', ['fractura_sospechada'], 'traumatologia', 0.9, { prioridad: 6 }),
  esp('T03', ['dolor_espalda'], 'traumatologia', 0.6, { prioridad: 3 }),
  esp('T04', ['dolor_articular', 'inflamacion_articular'], 'traumatologia', 0.75, { prioridad: 4 }),
  esp('T05', ['dolor_articular'], 'traumatologia', 0.5, { prioridad: 3 }),

  // ── Dermatología ────────────────────────────────────────────────────────
  esp('D01', ['erupcion_cutanea'], 'dermatologia', 0.7, { prioridad: 3 }),
  esp('D02', ['picazon'], 'dermatologia', 0.6, { prioridad: 3 }),
  esp('D03', ['lesion_piel'], 'dermatologia', 0.8, { prioridad: 4 }),

  // ── Urología ────────────────────────────────────────────────────────────
  esp('UR01', ['dolor_al_orinar'], 'urologia', 0.75, { prioridad: 4 }),
  esp('UR02', ['sangre_en_orina'], 'urologia', 0.85, { prioridad: 5 }),
  esp('UR03', ['orina_frecuente'], 'urologia', 0.5, { prioridad: 3 }),

  // ── Otorrinolaringología ────────────────────────────────────────────────
  esp('O01', ['dolor_oido'], 'otorrinolaringologia', 0.8, { prioridad: 4 }),
  esp('O02', ['perdida_audicion'], 'otorrinolaringologia', 0.8, { prioridad: 4 }),
  esp('O03', ['dolor_garganta', 'congestion_nasal'], 'otorrinolaringologia', 0.6, { prioridad: 3 }),
  esp('O04', ['dolor_garganta'], 'otorrinolaringologia', 0.5, { prioridad: 2 }),

  // ── Oftalmología ────────────────────────────────────────────────────────
  esp('OF01', ['ojo_rojo'], 'oftalmologia', 0.8, { prioridad: 4 }),
  esp('OF02', ['dolor_ocular'], 'oftalmologia', 0.75, { prioridad: 4 }),
  esp('OF03', ['vision_borrosa'], 'oftalmologia', 0.4, { prioridad: 2 }),

  // ── Pediatría (según edad) ──────────────────────────────────────────────
  esp('P00', ['paciente_pediatrico'], 'pediatria', 0.5, { prioridad: 3 }),
  esp('P01', ['paciente_pediatrico', 'fiebre'], 'pediatria', 0.85, { prioridad: 4 }),
  esp('P02', ['paciente_pediatrico', 'tos'], 'pediatria', 0.8, { prioridad: 4 }),
  esp('P03', ['paciente_pediatrico', 'diarrea'], 'pediatria', 0.8, { prioridad: 4 }),
  esp('P04', ['paciente_pediatrico', 'erupcion_cutanea'], 'pediatria', 0.8, { prioridad: 4 }),
  esp('P05', ['paciente_pediatrico', 'vomitos'], 'pediatria', 0.8, { prioridad: 4 }),
  esp('P06', ['paciente_pediatrico', 'dolor_oido'], 'pediatria', 0.8, { prioridad: 4 }),

  // ── Medicina general ────────────────────────────────────────────────────
  esp('M01', ['fiebre'], 'medicina_general', 0.5, { prioridad: 2 }),
  esp('M02', ['fatiga'], 'medicina_general', 0.5, { prioridad: 2 }),
  esp('M03', ['malestar_general'], 'medicina_general', 0.6, { prioridad: 2 }),
  esp('M04', ['perdida_peso'], 'medicina_general', 0.6, { prioridad: 2 }),
  esp('M05', ['sindrome_gripal'], 'medicina_general', 0.6, { prioridad: 3, exclusiones: ['dificultad_respiratoria'] }),
];
