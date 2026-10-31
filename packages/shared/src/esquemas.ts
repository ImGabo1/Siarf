import { z } from 'zod';
import { ROLES, SEXOS } from './constantes';

/**
 * Esquemas de validación compartidos: el backend los usa para validar las
 * peticiones y el frontend puede reutilizarlos en sus formularios.
 */

const idPositivo = z.number().int().positive();

// ── Autenticación y usuarios ──────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    password: z.string().min(8).max(100),
    rol: z.enum(ROLES),
    especialidadId: idPositivo.optional(),
    consultorioId: idPositivo.optional(),
  })
  .refine((d) => d.rol !== 'doctor' || d.especialidadId !== undefined, {
    message: 'Un doctor requiere especialidadId',
    path: ['especialidadId'],
  });

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
  especialidadId: idPositivo.optional(),
  consultorioId: idPositivo.nullable().optional(),
});

// ── Pacientes ─────────────────────────────────────────────────────────────
export const crearPacienteSchema = z.object({
  /** Se guarda normalizada: mayúsculas y sin guiones (V-12345678 → V12345678). */
  cedula: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[VEJGP]?-?\d{5,10}$/, 'Cédula inválida (ejemplo: V-12345678)')
    .transform((v) => v.replace(/[^A-Z0-9]/g, '')),
  nombre: z.string().trim().min(2).max(160),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD'),
  sexo: z.enum(SEXOS),
  telefono: z.string().trim().max(30).optional(),
});

// ── Evaluación de síntomas y visitas ──────────────────────────────────────
export const sintomaEntradaSchema = z.object({
  codigo: z.string().trim().min(1).max(60),
  /** 1 (leve) a 5 (severo). Si no se indica, 3. */
  intensidad: z.number().int().min(1).max(5).default(3),
  duracionDias: z.number().int().min(0).max(3650).optional(),
});

export const inferenciaSchema = z.object({
  sintomas: z.array(sintomaEntradaSchema).min(1).max(30),
  /** Si se envía `pacienteId`, la edad se toma de la ficha del paciente. */
  edad: z.number().int().min(0).max(120).optional(),
  pacienteId: idPositivo.optional(),
});

export const crearVisitaSchema = z.object({
  pacienteId: idPositivo,
  sintomas: z.array(sintomaEntradaSchema).min(1).max(30),
  /** Si se omite, se usa la primera especialidad sugerida por el sistema experto. */
  especialidadAsignadaId: idPositivo.optional(),
  forzarUrgente: z.boolean().optional(),
});

export const cerrarVisitaSchema = z.object({
  diagnostico: z.string().trim().max(2000).optional(),
  notas: z.string().trim().max(4000).optional(),
});

// ── Base de conocimiento (reglas) ─────────────────────────────────────────
export const crearReglaSchema = z.object({
  codigo: z.string().trim().min(1).max(20),
  descripcion: z.string().trim().max(300).optional(),
  concluyeTipo: z.enum(['especialidad', 'hecho']),
  concluyeValor: z.string().trim().min(1).max(60),
  cf: z.number().gt(0).max(1),
  prioridad: z.number().int().min(0).max(100).default(1),
  urgencia: z.boolean().default(false),
  activa: z.boolean().default(true),
  condiciones: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  exclusiones: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});

export const actualizarReglaSchema = z.object({
  descripcion: z.string().trim().max(300).optional(),
  cf: z.number().gt(0).max(1).optional(),
  prioridad: z.number().int().min(0).max(100).optional(),
  urgencia: z.boolean().optional(),
  activa: z.boolean().optional(),
});

// ── Simulación ────────────────────────────────────────────────────────────
const distSchema = z.object({
  media: z.number().positive().max(600),
  desv: z.number().min(0).max(600),
});

export const simConfigSchema = z.object({
  semilla: z.number().int().default(42),
  duracionMin: z.number().min(30).max(1440).default(480),
  llegadasPorHora: z.number().min(0).max(300),
  perfilHorario: z.array(z.number().min(0).max(10)).min(1).max(24).optional(),
  puestosRecepcion: z.number().int().min(1).max(20),
  registroMin: distSchema,
  proporcionUrgentes: z.number().min(0).max(1).default(0.05),
  especialidades: z
    .array(
      z.object({
        codigo: z.string().min(1).max(60),
        nombre: z.string().min(1).max(80),
        peso: z.number().positive().max(1000),
        consultorios: z.number().int().min(1).max(30),
        consultaMin: distSchema,
      }),
    )
    .min(1)
    .max(30),
});

export const crearSimulacionSchema = z.object({
  nombre: z.string().trim().max(120).optional(),
  config: simConfigSchema,
});

export const compararSimulacionSchema = z.object({
  base: simConfigSchema,
  escenarios: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(120),
        cambios: z.object({
          llegadasPorHora: z.number().min(0).max(300).optional(),
          puestosRecepcion: z.number().int().min(1).max(20).optional(),
          consultorios: z.record(z.string(), z.number().int().min(1).max(30)).optional(),
        }),
      }),
    )
    .max(6),
  replicas: z.number().int().min(1).max(30).default(10),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
export type CrearPacienteInput = z.infer<typeof crearPacienteSchema>;
export type SintomaEntrada = z.infer<typeof sintomaEntradaSchema>;
export type InferenciaInput = z.infer<typeof inferenciaSchema>;
export type CrearVisitaInput = z.infer<typeof crearVisitaSchema>;
export type CerrarVisitaInput = z.infer<typeof cerrarVisitaSchema>;
export type CrearReglaInput = z.infer<typeof crearReglaSchema>;
export type ActualizarReglaInput = z.infer<typeof actualizarReglaSchema>;
export type SimConfigInput = z.infer<typeof simConfigSchema>;
export type CrearSimulacionInput = z.infer<typeof crearSimulacionSchema>;
export type CompararSimulacionInput = z.infer<typeof compararSimulacionSchema>;
