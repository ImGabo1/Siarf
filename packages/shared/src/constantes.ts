export const ROLES = ['admin', 'recepcionista', 'doctor'] as const;
export type Rol = (typeof ROLES)[number];

export const PRIORIDADES = ['normal', 'urgente'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS_VISITA = ['espera', 'en_consulta', 'atendida', 'cancelada'] as const;
export type EstadoVisita = (typeof ESTADOS_VISITA)[number];

export const SEXOS = ['F', 'M'] as const;
export type Sexo = (typeof SEXOS)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  doctor: 'Doctor',
};
