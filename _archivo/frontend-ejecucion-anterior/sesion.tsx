import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SesionDto, UsuarioDto } from '@siarf/shared';
import { api, guardarToken, leerToken, registrarAlExpirar } from './api';

interface ContextoSesion {
  usuario: UsuarioDto | null;
  /** true mientras se verifica el token guardado al abrir la página. */
  cargando: boolean;
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioDto | null>(null);
  const [cargando, setCargando] = useState(() => leerToken() !== null);

  const salir = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    registrarAlExpirar(salir);
    return () => registrarAlExpirar(null);
  }, [salir]);

  // Al abrir la página, valida el token guardado.
  useEffect(() => {
    if (!leerToken()) return;
    api
      .get<UsuarioDto>('/auth/yo')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(async (email: string, password: string) => {
    const s = await api.post<SesionDto>('/auth/login', { email, password });
    guardarToken(s.token);
    setUsuario(s.usuario);
  }, []);

  const valor = useMemo(() => ({ usuario, cargando, entrar, salir }), [usuario, cargando, entrar, salir]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return c;
}
