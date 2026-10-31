import { ETIQUETA_ROL } from '@siarf/shared';
import { AuthProvider, useAuth } from './auth';
import { Admin } from './paginas/Admin';
import { Doctor } from './paginas/Doctor';
import { Login } from './paginas/Login';
import { Recepcion } from './paginas/Recepcion';
import { Cargando } from './ui';

function Contenido() {
  const { usuario, cargando, logout } = useAuth();

  if (cargando) return <main className="centrado"><Cargando texto="Verificando sesión…" /></main>;
  if (!usuario) return <Login />;

  return (
    <>
      <header className="barra-superior">
        <div>
          <strong>SIARF</strong>
          <span className="muted"> · Atención rápida y flujo paciente-médico</span>
        </div>
        <div className="usuario">
          <span>{usuario.nombre} <span className="muted">({ETIQUETA_ROL[usuario.rol]})</span></span>
          <button onClick={logout}>Salir</button>
        </div>
      </header>
      <main className="contenido">
        {usuario.rol === 'admin' && <Admin />}
        {usuario.rol === 'recepcionista' && <Recepcion />}
        {usuario.rol === 'doctor' && <Doctor />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  );
}
