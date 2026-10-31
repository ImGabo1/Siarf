/** Distribución de tiempos en minutos (se modela como lognormal: siempre positiva). */
export interface Dist {
  media: number;
  desv: number;
}

export interface EspecialidadSim {
  codigo: string;
  nombre: string;
  /** Proporción relativa de pacientes que van a esta especialidad (se normaliza). */
  peso: number;
  consultorios: number;
  consultaMin: Dist;
}

export interface SimConfig {
  /** Semilla del generador aleatorio: misma semilla = mismo resultado. */
  semilla: number;
  /** Minutos durante los cuales llegan pacientes (después se atiende a los que quedan). */
  duracionMin: number;
  /** Tasa media de llegadas por hora. */
  llegadasPorHora: number;
  /** Multiplicador de la tasa por hora simulada (índice 0 = primera hora). */
  perfilHorario?: number[] | undefined;
  puestosRecepcion: number;
  registroMin: Dist;
  /** Fracción de pacientes urgentes (tienen prioridad en la cola de consulta). */
  proporcionUrgentes: number;
  especialidades: EspecialidadSim[];
}

export type TipoEvento = 'llegada' | 'inicio_registro' | 'fin_registro' | 'inicio_consulta' | 'fin_consulta';

export interface EventoSim {
  /** Minutos desde el inicio de la simulación. */
  t: number;
  tipo: TipoEvento;
  pacienteId: number;
  /** "recepcion" o el código de la especialidad. */
  recurso: string;
  /** Número de puesto/consultorio (1..n) cuando aplica. */
  puesto?: number;
  urgente: boolean;
  especialidad: string;
}

export interface MetricasRecurso {
  id: string;
  nombre: string;
  servidores: number;
  atendidos: number;
  esperaPromedioMin: number;
  esperaP90Min: number;
  esperaMaxMin: number;
  servicioPromedioMin: number;
  /** 0 a 1: tiempo ocupado / (servidores × duración total). */
  utilizacion: number;
  colaPromedio: number;
  colaMax: number;
}

export interface PuntoCola {
  t: number;
  recepcion: number;
  /** Longitud de cola por especialidad. */
  especialidades: Record<string, number>;
  enSistema: number;
}

export interface CuelloBotella {
  id: string;
  nombre: string;
  esperaPromedioMin: number;
  utilizacion: number;
  /** utilización ≥ 0.85 */
  saturado: boolean;
}

export interface ResultadoSim {
  llegados: number;
  atendidos: number;
  /** Minuto en que salió el último paciente. */
  finMin: number;
  esperaTotalPromedioMin: number;
  tiempoEnSistemaPromedioMin: number;
  tiempoEnSistemaP90Min: number;
  recepcion: MetricasRecurso;
  especialidades: MetricasRecurso[];
  /** Recurso con mayor espera promedio (null si nadie esperó). */
  cuelloBotella: CuelloBotella | null;
  /** Todos los recursos ordenados por espera promedio descendente. */
  ranking: CuelloBotella[];
  serieCola: PuntoCola[];
  /** Vacío si se ejecutó con `timeline: false`. */
  timeline: EventoSim[];
}

export interface OpcionesSim {
  /** Guardar la línea de tiempo de eventos (necesaria para la animación). Por defecto true. */
  timeline?: boolean;
  /** Cada cuántos minutos se muestrea la longitud de las colas. Por defecto 5. */
  intervaloMuestreoMin?: number;
}

export type FasePaciente = 'cola_recepcion' | 'registro' | 'sala_espera' | 'consulta';

export interface PacienteEnEscena {
  id: number;
  urgente: boolean;
  especialidad: string;
  fase: FasePaciente;
  /** Puesto de recepción o consultorio (1..n) cuando está en servicio. */
  puesto?: number;
  /** Posición (0 = primero) dentro de su cola, si está esperando. */
  posCola?: number;
}

export interface CambiosEscenario {
  llegadasPorHora?: number;
  puestosRecepcion?: number;
  /** Código de especialidad → nuevo número de consultorios. */
  consultorios?: Record<string, number>;
}

export interface Escenario {
  nombre: string;
  cambios: CambiosEscenario;
}

export interface EstadisticaReplicas {
  media: number;
  desv: number;
}

export interface ResumenEscenario {
  nombre: string;
  replicas: number;
  /** Métricas agregadas: claves como "esperaTotalPromedioMin", "utilizacion_cardiologia", ... */
  metricas: Record<string, EstadisticaReplicas>;
  /** Cuántas réplicas tuvieron cada recurso como cuello de botella. */
  cuellosBotella: Record<string, number>;
}
