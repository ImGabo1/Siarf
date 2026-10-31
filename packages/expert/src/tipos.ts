/**
 * Tipos del sistema experto.
 *
 * Un "hecho" es un código de síntoma (p. ej. "fiebre"), un hecho derivado por
 * otra regla (p. ej. "sindrome_gripal") o un hecho del paciente
 * (p. ej. "paciente_pediatrico").
 */
export type Hecho = string;

export type TipoConclusion = 'especialidad' | 'hecho';

export interface ReglaExperta {
  /** Código único legible, p. ej. "C03". */
  codigo: string;
  descripcion?: string;
  /** Todas deben estar presentes (AND). */
  condiciones: Hecho[];
  /** Si alguna está presente, la regla NO se dispara. */
  exclusiones?: Hecho[];
  concluye: { tipo: TipoConclusion; valor: string };
  /** Factor de certeza de la regla, entre 0 y 1. */
  cf: number;
  /** Mayor prioridad = aparece primero en la explicación. */
  prioridad: number;
  /** Si se dispara con certeza suficiente, el caso se marca como urgente. */
  urgencia?: boolean;
}

export interface SintomaPaciente {
  codigo: string;
  /** 1 (leve) a 5 (severo). Modula la certeza del hecho. */
  intensidad?: number;
  /** Informativo para el médico; el motor actual no lo usa. */
  duracionDias?: number;
}

export interface EntradaConsulta {
  sintomas: SintomaPaciente[];
  /** Hechos adicionales con certeza 1 (p. ej. los derivados de la edad). */
  hechosExtra?: Hecho[];
}

export interface Disparo {
  regla: string;
  descripcion?: string;
  condiciones: Hecho[];
  concluye: ReglaExperta['concluye'];
  /** CF de la regla ya multiplicado por la certeza de sus condiciones. */
  cf: number;
  prioridad: number;
  urgencia: boolean;
  /** Frase legible que explica por qué se disparó. */
  explicacion: string;
}

export interface EspecialidadSugerida {
  /** Código de especialidad (p. ej. "cardiologia"). */
  especialidad: string;
  /** Certeza combinada entre 0 y 1. */
  certeza: number;
  /** Códigos de las reglas que contribuyeron. */
  reglas: string[];
}

export interface Recomendacion {
  /** Ordenadas de mayor a menor certeza. */
  especialidades: EspecialidadSugerida[];
  urgente: boolean;
  hechosDerivados: { hecho: Hecho; certeza: number }[];
  /** Reglas disparadas, ordenadas por prioridad. */
  disparos: Disparo[];
  /** Líneas de texto para mostrar al usuario (módulo de explicación). */
  explicacion: string[];
  /** true si ninguna regla alcanzó el umbral y se usó la especialidad por defecto. */
  sinCoincidencia: boolean;
  advertencia: string;
}

export interface OpcionesMotor {
  /** Certeza mínima para sugerir una especialidad. Por defecto 0.2. */
  umbralMinimo?: number;
  /** Certeza mínima de una regla de urgencia para marcar el caso urgente. Por defecto 0.5. */
  umbralUrgencia?: number;
  /** Máximo de rondas de inferencia (protege contra ciclos). Por defecto 10. */
  maxRondas?: number;
  /** Códigos → nombres legibles, solo para las explicaciones. */
  nombres?: Record<string, string>;
  /** Especialidad a sugerir cuando ninguna regla aplica. */
  especialidadPorDefecto?: string;
}

export interface ProblemaBase {
  nivel: 'error' | 'aviso';
  regla?: string;
  mensaje: string;
}
