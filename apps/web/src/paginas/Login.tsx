import { useEffect, useState, type FormEvent } from 'react';
import { despertarServidor, mensajeError } from '../api';
import { useAuth } from '../auth';
import { ErrorMsg } from '../ui';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <form className="tarjeta login-form" onSubmit={enviar}>
        <h1>SIARF</h1>
        <p className="muted">Sistema Inteligente de Atención Rápida y Simulación de Flujo Paciente-Médico</p>
        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <ErrorMsg texto={error} />
        <button className="primario" disabled={enviando}>
          {enviando ? 'Conectando…' : 'Ingresar'}
        </button>
        {enviando && <p className="muted">Si el servidor estaba inactivo puede tardar hasta un minuto en responder.</p>}
      </form>
    </main>
  );
}
