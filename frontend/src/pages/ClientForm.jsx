import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

const EMPTY = { name: '', industry: '', notes: '' };

export default function ClientForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    api.get(`/api/clients/${id}`)
      .then((d) => {
        const c = d.client;
        setForm({
          name:     c.name ?? '',
          industry: c.industry ?? '',
          notes:    c.notes ?? '',
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Nombre es obligatorio'); return; }
    setSubmitting(true);
    const body = {
      name:     form.name.trim(),
      industry: form.industry.trim() || null,
      notes:    form.notes.trim() || null,
    };
    try {
      if (editing) await api.put(`/api/clients/${id}`, body);
      else         await api.post('/api/clients', body);
      navigate('/clients');
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
          {editing ? 'Editar cliente' : 'Nuevo cliente'}
        </h1>
        <Link to="/clients" className="text-xs text-slate-500 hover:text-slate-800">
          ← Clientes
        </Link>
      </div>

      <Field label="Nombre" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ej: Banco Hipotecario"
        />
      </Field>

      <Field label="Industria">
        <input
          type="text"
          value={form.industry}
          onChange={(e) => update('industry', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Banca, Educación, Retail, SaaS, …"
        />
      </Field>

      <Field label="Notas" hint="Contexto interno opcional sobre el cliente.">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !form.name.trim()}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear cliente')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/clients')}
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
