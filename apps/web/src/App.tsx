import { ETIQUETA_ROL } from '@siarf/shared';
import { AuthProvider, useAuth } from './auth';
import { Admin } from './paginas/Admin';
import { Doctor } from './paginas/Doctor';
import { Login } from './paginas/Login';
import { Recepcion } from './paginas/Recepcion';
import { BotonTema, TemaProvider } from './tema';
import { Cargando, IconoMarca, iniciales } from './ui';

function Contenido() {
  const { usuario, cargando, logout } = useAuth();

  if (cargando) {
    return (
      <main className="centrado">
        <Cargando texto="Verificando sesión…" />
      </main>
    );
  }
  if (!usuario) return <Login />;

  return (
    <>
      <div className="ambiente" aria-hidden="true">
        <span className="orbe orbe-a" />
        <span className="orbe orbe-b" />
      </div>
      <a className="saltar-contenido" href="#contenido">Saltar al contenido</a>
      <header className="barra-superior">
        <div className="barra-contenido">
          <div className="marca">
            <span className="marca-icono" aria-hidden="true">
              <IconoMarca />
            </span>
            <span className="marca-texto">
              <strong>SIARF</strong>
              <span>Atención rápida y flujo paciente-médico</span>
            </span>
          </div>
          <div className="barra-derecha">
            <span className="estado-sistema" title="Sesión activa">
              <span className="punto-vivo" aria-hidden="true" /> En línea
            </span>
            <BotonTema />
            <div className="usuario">
              <span className="avatar" aria-hidden="true">{iniciales(usuario.nombre)}</span>
              <span className="usuario-info">
                <strong>{usuario.nombre}</strong>
                <span>{ETIQUETA_ROL[usuario.rol]}</span>
              </span>
              <button className="boton-icono" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="contenido" id="contenido">
        {usuario.rol === 'admin' && <Admin />}
        {usuario.rol === 'recepcionista' && <Recepcion />}
        {usuario.rol === 'doctor' && <Doctor />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <TemaProvider>
      <AuthProvider>
        <Contenido />
      </AuthProvider>
    </TemaProvider>
  );
}
