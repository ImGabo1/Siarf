import { useEffect, useState, type FormEvent } from 'react';
import { despertarServidor, mensajeError } from '../api';
import { useAuth } from '../auth';
import { BotonTema } from '../tema';
import { ErrorMsg, IconoMarca } from '../ui';

const BENEFICIOS = [
  'Orientación clínica explicable',
  'Una sola cola paciente-médico',
  'Simulación de flujo y capacidad',
];

const COLA_DEMO = [
  { iniciales: 'CD', nombre: 'Carmen Delgado', detalle: 'Cardiología · 12 min', estado: 'Urgente', clase: 'urgente' },
  { iniciales: 'JM', nombre: 'José A. Méndez', detalle: 'Medicina General · 8 min', estado: 'En espera', clase: 'espera' },
  { iniciales: 'LG', nombre: 'Luisa F. Gómez', detalle: 'Medicina General · 5 min', estado: 'En espera', clase: 'espera' },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Despierta el servidor y la base apenas se abre la página.
  useEffect(() => {
    void despertarServidor();
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <div className="login-ambiente" aria-hidden="true">
        <span className="orbe orbe-1" />
        <span className="orbe orbe-2" />
        <span className="login-grid" />
      </div>

      <div className="login-barra">
        <div className="login-barra-marca">
          <span className="marca-icono" aria-hidden="true"><IconoMarca tam={20} /></span>
          <div>
            <strong>SIARF</strong>
            <span>Sistema experto de atención clínica</span>
          </div>
        </div>
        <BotonTema />
      </div>

      <div className="login-layout">
        <aside className="login-panel">
          <div className="login-panel-marca">
            <span className="marca-icono" aria-hidden="true"><IconoMarca tam={28} /></span>
            <div>
              <strong>SIARF</strong>
              <span>Sistema Inteligente de Atención Rápida</span>
            </div>
          </div>

          <div className="login-panel-texto">
            <span className="login-pill">
              <span className="punto-vivo" aria-hidden="true" /> Sistema experto clínico
            </span>
            <h1>La sala de espera,<br /><em>por fin bajo control.</em></h1>
            <p>
              Recepción, orientación diagnóstica y simulación de flujo en una sola
              historia. Menos papeleo, decisiones más claras.
            </p>
          </div>

          <ul className="login-beneficios">
            {BENEFICIOS.map((b) => (
              <li key={b}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                {b}
              </li>
            ))}
          </ul>

          <div className="login-preview" aria-hidden="true">
            <header>
              <span className="login-preview-titulo">
                <span className="punto-vivo" /> Cola en vivo
              </span>
              <span className="login-preview-hora">08:42</span>
            </header>
            <ul>
              {COLA_DEMO.map((p) => (
                <li key={p.nombre} className={p.clase === 'urgente' ? 'urgente' : ''}>
                  <span className="avatar">{p.iniciales}</span>
                  <span className="login-preview-info">
                    <strong>{p.nombre}</strong>
                    <span>{p.detalle}</span>
                  </span>
                  <span className={`badge ${p.clase}`}>{p.estado}</span>
                </li>
              ))}
            </ul>
            <footer>
              <div><strong>3</strong><span>en espera</span></div>
              <div><strong>8 min</strong><span>promedio</span></div>
              <div><strong>92%</strong><span>certeza</span></div>
            </footer>
          </div>

          <p className="login-panel-pie">
            La orientación del sistema experto no sustituye el juicio del médico.
          </p>
        </aside>

        <section className="login-acceso">
          <form className="login-form" onSubmit={enviar} aria-busy={enviando}>
            <div className="login-marca">
              <p className="sobre-titulo">Acceso del personal</p>
              <h2>Bienvenido de nuevo</h2>
              <p className="entradilla">Ingrese para abrir su jornada clínica en SIARF.</p>
            </div>

            <label>
              Correo electrónico
              <span className="campo-icono">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="nombre@hospital.com"
                  autoFocus
                  required
                />
              </span>
            </label>

            <label>
              Contraseña
              <span className="campo-password">
                <input
                  type={verClave ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="ojo"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verClave ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <path d="m1 1 22 22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </span>
            </label>

            <ErrorMsg texto={error} />
            <button className="primario" disabled={enviando}>
              {enviando ? 'Conectando…' : 'Iniciar sesión'}
            </button>
            {enviando && (
              <p className="muted pequeno" role="status">
                Si el servidor estaba inactivo puede tardar hasta un minuto en responder.
              </p>
            )}

            <p className="login-seguro">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Acceso protegido por rol. Use datos ficticios en demostraciones.
            </p>
          </form>
        </section>
      </div>

      <p className="login-pie">SIARF · Proyecto académico · Recepción, sistema experto y simulación</p>
    </main>
  );
}
