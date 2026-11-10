import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { mensajeError } from './api';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{texto}</span>
    </div>
  );
}

export function ErrorMsg({ texto }: { texto: string | null }) {
  return texto ? <p className="error" role="alert">{texto}</p> : null;
}

export function Tarjeta({
  titulo,
  subtitulo,
  children,
  acciones,
  className,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tarjeta${className ? ` ${className}` : ''}`}>
      {(titulo || subtitulo || acciones) && (
        <header className="tarjeta-cab">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <span className="subtitulo">{subtitulo}</span>}
          </div>
          {acciones && <div className="acciones">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Isotipo de SIARF: una línea de pulso dentro de una forma redondeada. */
export function IconoMarca({ tam = 22 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h3.5l2.2-5.5L13 17.5l2.3-5.5H21" />
    </svg>
  );
}

export type AcentoStat = 'primario' | 'peligro' | 'ambar' | 'info' | 'ok';

/** Tarjeta de resumen con icono en gradiente, al estilo de un panel de control. */
export function Stat({
  etiqueta,
  valor,
  detalle,
  acento = 'primario',
  icono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  acento?: AcentoStat;
  icono?: ReactNode;
}) {
  return (
    <div className={`stat acento-${acento}`}>
      <div className="stat-texto">
        <span className="stat-etiqueta">{etiqueta}</span>
        <strong>{valor}</strong>
        {detalle && <span className="stat-detalle">{detalle}</span>}
      </div>
      {icono && <span className="stat-icono" aria-hidden="true">{icono}</span>}
    </div>
  );
}

export function IconoUsuarios() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconoAlerta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconoPulso() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h3.5l2.2-5.5L13 17.5l2.3-5.5H21" />
    </svg>
  );
}

export function IconoTiempo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconoOk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconoGrafica() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 8 6 12 2 12" />
    </svg>
  );
}

export function IconoDocumento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function IconoEspecialidad() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

/** Estado vacío amable, con icono y una frase de ayuda. */export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
    </div>
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

/** Minutos transcurridos entre dos instantes (por defecto, hasta ahora). */
export const minutosEntre = (desde: string, hasta: string | Date = new Date()) =>
  Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60_000));

/** Iniciales para el avatar (nombre y apellido). */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primero = partes[0];
  if (!primero) return '?';
  if (partes.length === 1) return primero.slice(0, 2).toUpperCase();
  const ultimo = partes[partes.length - 1] ?? primero;
  return (primero.charAt(0) + ultimo.charAt(0)).toUpperCase();
}

/** Minuto de simulación → reloj, suponiendo apertura a las 08:00. */
export function relojSim(min: number, inicio = 8 * 60): string {
  const total = Math.floor(inicio + min);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
