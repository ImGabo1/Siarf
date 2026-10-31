import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mensajeError } from './api';

export interface EstadoCarga<T> {
  datos: T | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
}

/**
 * Carga un recurso GET y lo recarga cada `cadaMs` (opcional). Ignora respuestas
 * de peticiones viejas si la ruta cambia mientras llegan.
 */
export function useGet<T>(ruta: string | null, cadaMs?: number): EstadoCarga<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(ruta !== null);
  const [version, setVersion] = useState(0);
  const ultima = useRef(0);

  useEffect(() => {
    if (ruta === null) {
      setDatos(null);
      setCargando(false);
      return;
    }
    let vivo = true;
    const id = ++ultima.current;
    const cargar = (silencioso: boolean) => {
      if (!silencioso) setCargando(true);
      api
        .get<T>(ruta)
        .then((d) => {
          if (vivo && id === ultima.current) {
            setDatos(d);
            setError(null);
          }
        })
        .catch((e) => {
          if (vivo && id === ultima.current) setError(mensajeError(e));
        })
        .finally(() => {
          if (vivo && id === ultima.current) setCargando(false);
        });
    };
    cargar(false);
    const t = cadaMs ? setInterval(() => cargar(true), cadaMs) : undefined;
    return () => {
      vivo = false;
      if (t) clearInterval(t);
    };
  }, [ruta, cadaMs, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { datos, error, cargando, recargar };
}

/** Ejecuta una acción asíncrona y expone su estado (cargando / error). */
export function useAccion() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setCargando(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(mensajeError(e));
      return undefined;
    } finally {
      setCargando(false);
    }
  }, []);

  return { cargando, error, ejecutar, limpiarError: () => setError(null) };
}

export function formatearHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export function formatearFechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

export const porcentaje = (n: number) => `${Math.round(n * 100)}%`;
