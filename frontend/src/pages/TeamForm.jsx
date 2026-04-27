import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

const ROLES = [
  { value: 'admin',   label: 'Admin · gestiona equipo, prompts y todo lo demás' },
  { value: 'analyst', label: 'Analyst · crea y ejecuta experimentos, edita clientes/productos' },
  { value: 'viewer',  label: 'Viewer · solo lectura' },
];

const EMPTY = {
  email: '', full_name: '', role: 'analyst', password: '', is_active: true,
};

export default function TeamForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    api.get(`/api/users/${id}`)
      .then((d) => {
        const u = d.user;
        setForm({
          email:     u.email,
          full_name: u.full_name,
          role:      u.role,
          password:  '',
          is_active: u.is_active,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.full_name) {
      setError('Email y nombre son obligatorios'); return;
    }
    if (!editing && (!form.password || form.password.length < 8)) {
      setError('Password mínimo 8 caracteres'); return;
    }
    setSubmitting(true);
    const body = {
      email:     form.email.trim(),
      full_name: form.full_name.trim(),
      role:      form.role,
      is_active: form.is_active,
    };
    if (form.password) body.password = form.password;
    try {
      if (editing) await api.put(`/api/users/${id}`, body);
      else         await api.post('/api/users', body);
      navigate('/team');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Cargando…</div>;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {editing ? 'Editar miembro' : 'Sumar miembro al equipo'}
        </h1>
        <Link to="/team" className="text-xs text-slate-500 hover:text-slate-800">← Equipo</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre completo" required>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Juan Pérez"
          />
        </Field>

        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="juan@empresa.com"
          />
        </Field>
      </div>

      <Field label="Rol" required>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <label key={r.value} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={form.role === r.value}
                onChange={() => update('role', r.value)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-700">{r.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field
        label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
        required={!editing}
        hint={editing ? 'Dejá en blanco para no cambiarla.' : 'Mínimo 8 caracteres. Compartila con el miembro por canal seguro.'}
      >
        <input
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
          placeholder={editing ? '••••••••' : 'mínimo 8 caracteres'}
          autoComplete="new-password"
        />
      </Field>

      {editing && (
        <Field label="Estado">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />
            <span className="text-sm text-slate-700">Usuario activo (puede iniciar sesión)</span>
          </label>
        </Field>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear miembro')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
