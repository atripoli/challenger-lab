import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Challenger Lab</h1>
          <p className="text-sm text-slate-500 mt-1">Iniciá sesión para continuar.</p>
        </div>

        <label className="block">
          <span className="text-sm text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="text-xs text-slate-500 text-center pt-1">
          ¿Olvidaste tu contraseña? Pedile a un administrador del equipo que la
          resetee desde <span className="font-medium text-slate-600">Equipo</span>.
        </p>
      </form>
    </div>
  );
}
