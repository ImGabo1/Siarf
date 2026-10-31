import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SesionDto, UsuarioDto } from '@siarf/shared';
import { api, guardarToken, leerToken, onSesionExpirada } from './api';

interface AuthCtx {
  usuario: UsuarioDto | null;
  /** true mientras se valida el token guardado al abrir la página. */
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioDto | null>(null);
  const [cargando, setCargando] = useState(() => leerToken() !== null);

  const logout = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    onSesionExpirada(logout);
    if (!leerToken()) return;
    api<UsuarioDto>('/auth/yo')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const s = await api<SesionDto>('/auth/login', { method: 'POST', body: { email, password } });
    guardarToken(s.token);
    setUsuario(s.usuario);
  }, []);

  const valor = useMemo(() => ({ usuario, cargando, login, logout }), [usuario, cargando, login, logout]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return c;
}
