import type { ZodTypeAny, z } from 'zod';

/** Error con código HTTP; el manejador global lo convierte en respuesta JSON. */
export class ErrorHttp extends Error {
  constructor(
    public readonly status: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorHttp';
  }
}

/** Valida `datos` con un esquema Zod; si falla responde 400 con el detalle. */
export function parsear<S extends ZodTypeAny>(esquema: S, datos: unknown): z.output<S> {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorHttp(400, 'Datos inválidos', r.error.flatten());
  return r.data as z.output<S>;
}

/** Extrae `:id` de los parámetros de la ruta. */
export function parsearId(params: unknown): number {
  const id = Number((params as { id?: unknown } | undefined)?.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorHttp(400, 'Identificador inválido');
  return id;
}
