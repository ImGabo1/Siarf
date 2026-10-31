/**
 * Casos clínicos FICTICIOS con la especialidad esperada.
 *
 * Sirven como prueba de regresión (cada cambio en las reglas debe seguir
 * pasando) y como plantilla del conjunto de validación del artículo:
 * el médico revisor debe confirmar o corregir la columna `esperada`, y la
 * métrica de exactitud (top-1 / top-2) se calcula con `evaluarCasos`.
 */
export interface CasoValidacion {
  id: string;
  descripcion: string;
  sintomas: string[];
  edad?: number;
  /** Especialidad que se espera en primer lugar. */
  esperada: string;
  urgente?: boolean;
}

export const CASOS_VALIDACION: CasoValidacion[] = [
  { id: 'K01', descripcion: 'Dolor de pecho con falta de aire', sintomas: ['dolor_toracico', 'dificultad_respiratoria'], edad: 55, esperada: 'emergencia', urgente: true },
  { id: 'K02', descripcion: 'Dolor de pecho y palpitaciones', sintomas: ['dolor_toracico', 'palpitaciones'], edad: 48, esperada: 'cardiologia' },
  { id: 'K03', descripcion: 'Cuadro gripal', sintomas: ['tos', 'fiebre', 'fatiga'], edad: 30, esperada: 'medicina_general' },
  { id: 'K04', descripcion: 'Tos y falta de aire con fiebre', sintomas: ['tos', 'dificultad_respiratoria', 'fiebre'], edad: 40, esperada: 'neumologia' },
  { id: 'K05', descripcion: 'Dolor abdominal con diarrea', sintomas: ['dolor_abdominal', 'diarrea'], edad: 28, esperada: 'gastroenterologia' },
  { id: 'K06', descripcion: 'Dolor de cabeza y visión borrosa', sintomas: ['dolor_cabeza', 'vision_borrosa'], edad: 35, esperada: 'neurologia' },
  { id: 'K07', descripcion: 'Caída con dolor e inflamación articular', sintomas: ['trauma_golpe', 'dolor_articular', 'inflamacion_articular'], edad: 62, esperada: 'traumatologia' },
  { id: 'K08', descripcion: 'Sospecha de fractura', sintomas: ['fractura_sospechada'], edad: 20, esperada: 'traumatologia' },
  { id: 'K09', descripcion: 'Erupción con picazón', sintomas: ['erupcion_cutanea', 'picazon'], edad: 33, esperada: 'dermatologia' },
  { id: 'K10', descripcion: 'Dolor al orinar y micción frecuente', sintomas: ['dolor_al_orinar', 'orina_frecuente'], edad: 41, esperada: 'urologia' },
  { id: 'K11', descripcion: 'Dolor de oído con pérdida de audición', sintomas: ['dolor_oido', 'perdida_audicion'], edad: 29, esperada: 'otorrinolaringologia' },
  { id: 'K12', descripcion: 'Ojo rojo y dolor ocular', sintomas: ['ojo_rojo', 'dolor_ocular'], edad: 37, esperada: 'oftalmologia' },
  { id: 'K13', descripcion: 'Niño con fiebre', sintomas: ['fiebre'], edad: 5, esperada: 'pediatria' },
  { id: 'K14', descripcion: 'Niño con erupción', sintomas: ['erupcion_cutanea'], edad: 8, esperada: 'pediatria' },
  { id: 'K15', descripcion: 'Convulsiones', sintomas: ['convulsiones'], edad: 25, esperada: 'emergencia', urgente: true },
  { id: 'K16', descripcion: 'Pérdida de fuerza y dificultad para hablar', sintomas: ['perdida_fuerza', 'dificultad_habla'], edad: 70, esperada: 'emergencia', urgente: true },
  { id: 'K17', descripcion: 'Malestar general', sintomas: ['malestar_general'], edad: 45, esperada: 'medicina_general' },
  { id: 'K18', descripcion: 'Náuseas, vómitos y diarrea', sintomas: ['nauseas', 'vomitos', 'diarrea'], edad: 31, esperada: 'gastroenterologia' },
  { id: 'K19', descripcion: 'Sangre en heces con mareo', sintomas: ['sangre_en_heces', 'mareo'], edad: 58, esperada: 'emergencia', urgente: true },
  { id: 'K20', descripcion: 'Piernas hinchadas y falta de aire', sintomas: ['hinchazon_piernas', 'dificultad_respiratoria'], edad: 70, esperada: 'cardiologia' },
  { id: 'K21', descripcion: 'Mareo con hormigueo', sintomas: ['mareo', 'hormigueo'], edad: 52, esperada: 'neurologia' },
  { id: 'K22', descripcion: 'Silbidos en el pecho y tos', sintomas: ['sibilancias', 'tos'], edad: 30, esperada: 'neumologia' },
];
