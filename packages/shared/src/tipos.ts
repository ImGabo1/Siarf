import type { EstadoVisita, Prioridad, Rol, Sexo } from './constantes';

/**
 * Tipos de las respuestas de la API (contrato backend ↔ frontend).
 * Las fechas viajan como cadenas ISO 8601.
 */

export interface UsuarioDto {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  /** Solo doctores. */
  especialidadId: number | null;
  consultorioId: number | null;
}

export interface SesionDto {
  token: string;
  usuario: UsuarioDto;
}

export interface EspecialidadDto {
  id: number;
  codigo: string;
  nombre: string;
}

export interface ConsultorioDto {
  id: number;
  nombre: string;
  especialidadId: number;
  especialidadCodigo: string;
}

export interface SintomaDto {
  codigo: string;
  nombre: string;
  categoria: string;
}

export interface PacienteDto {
  id: number;
  cedula: string;
  nombre: string;
  fechaNacimiento: string;
  sexo: Sexo;
  telefono: string | null;
  edad: number;
}

export interface EspecialidadSugeridaDto {
  /** Código de la especialidad. */
  especialidad: string;
  nombre: string;
  especialidadId: number | null;
  /** 0 a 1. */
  certeza: number;
  reglas: string[];
}

export interface RecomendacionDto {
  especialidades: EspecialidadSugeridaDto[];
  urgente: boolean;
  hechosDerivados: { hecho: string; certeza: number }[];
  /** Explicación legible de las reglas disparadas. */
  explicacion: string[];
  sinCoincidencia: boolean;
  advertencia: string;
}

export interface VisitaColaDto {
  id: number;
  pacienteNombre: string;
  cedula: string;
  edad: number;
  especialidadId: number;
  especialidadCodigo: string;
  especialidadNombre: string;
  prioridad: Prioridad;
  estado: EstadoVisita;
  horaLlegada: string;
  minutosEspera: number;
}

export interface VisitaDetalleDto {
  id: number;
  estado: EstadoVisita;
  prioridad: Prioridad;
  horaLlegada: string;
  horaInicioConsulta: string | null;
  horaFinConsulta: string | null;
  especialidadId: number;
  especialidadCodigo: string;
  especialidadNombre: string;
  /** Código de la primera especialidad sugerida por el sistema experto. */
  especialidadSugerida: string | null;
  doctorNombre: string | null;
  diagnostico: string | null;
  notas: string | null;
  paciente: PacienteDto;
  sintomas: { codigo: string; nombre: string; intensidad: number; duracionDias: number | null }[];
  inferencias: { regla: string; conclusion: string; cf: number; explicacion: string }[];
  historial: {
    id: number;
    fecha: string;
    especialidad: string;
    estado: EstadoVisita;
    diagnostico: string | null;
  }[];
}

export interface VisitaCreadaDto {
  id: number;
  prioridad: Prioridad;
  especialidadId: number;
  especialidadNombre: string;
  recomendacion: RecomendacionDto;
}

export interface ReglaDto {
  id: number;
  codigo: string;
  descripcion: string | null;
  concluyeTipo: 'especialidad' | 'hecho';
  concluyeValor: string;
  cf: number;
  prioridad: number;
  urgencia: boolean;
  activa: boolean;
  condiciones: string[];
  exclusiones: string[];
}

export interface ProblemaReglaDto {
  nivel: 'error' | 'aviso';
  regla?: string;
  mensaje: string;
}

export interface SimulacionResumenDto {
  id: number;
  nombre: string;
  creadoEn: string;
  llegados: number;
  atendidos: number;
  cuelloBotella: string | null;
}

export interface MetricasRealesDto {
  desde: string;
  total: number;
  atendidas: number;
  esperaPromedioMin: number | null;
  consultaPromedioMin: number | null;
  porEspecialidad: {
    codigo: string;
    nombre: string;
    total: number;
    esperaPromedioMin: number | null;
    consultaPromedioMin: number | null;
  }[];
  porHora: { hora: number; total: number }[];
}

export interface ErrorApiDto {
  error: string;
  detalles?: unknown;
}
