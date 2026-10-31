import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { mensajeError } from './api';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="muted">{texto}</p>;
}

export function ErrorMsg({ texto }: { texto: string | null }) {
  return texto ? <p className="error" role="alert">{texto}</p> : null;
}

export function Tarjeta({ titulo, children, acciones }: { titulo?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="tarjeta">
      {(titulo || acciones) && (
        <header className="tarjeta-cab">
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div className="acciones">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Barra horizontal de 0 a 1 (certeza, utilización…). */
export function Barra({ valor, etiqueta, alerta = false }: { valor: number; etiqueta?: string; alerta?: boolean }) {
  const pct = Math.round(Math.min(1, Math.max(0, valor)) * 100);
  return (
    <div className="barra" title={etiqueta ?? `${pct}%`}>
      <div className={`barra-relleno${alerta ? ' alerta' : ''}`} style={{ width: `${pct}%` }} />
      <span>{etiqueta ?? `${pct}%`}</span>
    </div>
  );
}

/** Consulta periódica (para colas y paneles que deben mantenerse al día). */
export function usePolling<T>(fn: () => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(fn);
  ref.current = fn;

  const recargar = useCallback(async () => {
    try {
      setData(await ref.current());
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    void recargar();
    const id = setInterval(() => void recargar(), ms);
    return () => clearInterval(id);
  }, [ms, recargar]);

  return { data, error, recargar };
}

/** Carga única (se repite al cambiar `clave`). */
export function useCarga<T>(fn: () => Promise<T>, clave: unknown = null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const ref = useRef(fn);
  ref.current = fn;

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setData(await ref.current());
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar, clave]);

  return { data, error, cargando, recargar };
}

export const fmtMin = (m: number | null | undefined) => (m === null || m === undefined ? '—' : `${m.toFixed(1)} min`);

export const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

/** Minuto de simulación → reloj, suponiendo apertura a las 08:00. */
export function relojSim(min: number, inicio = 8 * 60): string {
  const total = Math.floor(inicio + min);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
