const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CLAVE_TOKEN = 'siarf_token';

// localStorage puede fallar (modo privado, datos bloqueados): siempre dentro de try/catch.
export const guardarToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, t);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* sin almacenamiento: la sesión dura hasta recargar */
  }
};
export const leerToken = (): string | null => {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}

let alExpirarSesion: (() => void) | null = null;
export const onSesionExpirada = (fn: () => void) => {
  alExpirarSesion = fn;
};

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(ruta: string, { method = 'GET', body }: Opciones = {}): Promise<T> {
  const token = leerToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.');
  }

  const texto = await res.text();
  const datos: unknown = texto ? safeJson(texto) : null;

  if (!res.ok) {
    const e = (datos ?? {}) as { error?: string; detalles?: unknown };
    if (res.status === 401 && ruta !== '/auth/login') alExpirarSesion?.();
    throw new ApiError(res.status, e.error ?? `Error ${res.status}`, e.detalles);
  }
  return datos as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** Despierta el servidor (Render gratis se duerme) y la base (Neon gratis se suspende). */
export const despertarServidor = () => fetch(`${BASE}/salud`).catch(() => undefined);

export const mensajeError = (e: unknown): string => (e instanceof Error ? e.message : 'Error inesperado');
