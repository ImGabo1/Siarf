import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'siarf_tema';

function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  } catch {
    /* sin almacenamiento: se usa la preferencia del sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

interface TemaCtx {
  tema: Tema;
  alternar: () => void;
}

const Ctx = createContext<TemaCtx | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      /* la preferencia dura hasta recargar */
    }
  }, [tema]);

  const alternar = useCallback(() => {
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'));
  }, []);

  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTema(): TemaCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTema debe usarse dentro de TemaProvider');
  return ctx;
}

/** Botón circular para alternar entre tema claro y oscuro. */
export function BotonTema({ className }: { className?: string }) {
  const { tema, alternar } = useTema();
  const oscuro = tema === 'oscuro';
  return (
    <button
      type="button"
      className={`boton-tema${className ? ` ${className}` : ''}`}
      onClick={alternar}
      title={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {oscuro ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
