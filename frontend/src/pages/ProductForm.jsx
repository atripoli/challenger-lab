import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Twitter', 'Google'];
const FORMAT_OPTIONS   = ['feed', 'stories', 'carousel', 'reel', 'video', 'image', 'text'];

const EMPTY = {
  client_id: '',
  name: '',
  category: '',
  description: '',
  brief_text: '',
  target_audience: '',
  key_benefit: '',
  context: '',
  platforms: [],
  formats: [],
};

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/clients').then((d) => setClients(d.clients));
    if (!editing) return;
    api.get(`/api/products/${id}`)
      .then((d) => {
        const p = d.product;
        setForm({
          client_id:       p.client_id ?? '',
          name:            p.name ?? '',
          category:        p.category ?? '',
          description:     p.description ?? '',
          brief_text:      p.brief_text ?? '',
          target_audience: p.target_audience ?? '',
          key_benefit:     p.key_benefit ?? '',
          context:         p.context ?? '',
          platforms:       Array.isArray(p.platforms) ? p.platforms : [],
          formats:         Array.isArray(p.formats)   ? p.formats   : [],
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function toggle(k, v) {
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
    }));
  }

  const missing = useMemo(() => {
    const m = [];
    if (!form.client_id)           m.push('cliente');
    if (!form.name.trim())         m.push('nombre');
    if (!form.brief_text.trim())   m.push('brief_text');
    if (!form.target_audience.trim()) m.push('target_audience');
    return m;
  }, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (missing.length) {
      setError(`Faltan campos obligatorios: ${missing.join(', ')}`);
      return;
    }
    setSubmitting(true);
    const body = {
      ...form,
      client_id: Number(form.client_id),
      category:    form.category.trim()    || null,
      description: form.description.trim() || null,
      key_benefit: form.key_benefit.trim() || null,
      context:     form.context.trim()     || null,
    };
    try {
      if (editing) {
        await api.put(`/api/products/${id}`, body);
      } else {
        await api.post('/api/products', body);
      }
      navigate('/products');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Cargando…</div>;

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {editing ? 'Editar producto' : 'Nuevo producto'}
        </h1>
        <Link to="/products" className="text-xs text-slate-500 hover:text-slate-800">
          ← Productos
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Cliente" required>
          <select
            value={form.client_id}
            onChange={(e) => update('client_id', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— seleccionar —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Nombre" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: Tarjeta Gold"
          />
        </Field>

        <Field label="Categoría">
          <input
            type="text"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: Tarjetas de crédito"
          />
        </Field>

        <Field label="Descripción corta">
          <input
            type="text"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tarjeta premium con cashback 3%"
          />
        </Field>
      </div>

      <Field
        label="Brief text"
        required
        hint="Descripción estructurada del producto/servicio y su propuesta central."
      >
        <textarea
          rows={4}
          value={form.brief_text}
          onChange={(e) => update('brief_text', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="Target audience"
        required
        hint="Perfil detallado del público — edad, profesión, nivel de ingresos, comportamiento."
      >
        <textarea
          rows={3}
          value={form.target_audience}
          onChange={(e) => update('target_audience', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Key benefit" hint="El beneficio principal que el producto ofrece al target.">
        <input
          type="text"
          value={form.key_benefit}
          onChange={(e) => update('key_benefit', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Cashback 3% + acceso a lounge"
        />
      </Field>

      <Field label="Context" hint="Contexto de mercado, competencia y momento.">
        <textarea
          rows={3}
          value={form.context}
          onChange={(e) => update('context', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Plataformas objetivo" hint="Donde van a correr los challengers.">
        <ChipsGroup
          options={PLATFORM_OPTIONS}
          selected={form.platforms}
          onToggle={(v) => toggle('platforms', v)}
        />
      </Field>

      <Field label="Formatos" hint="Formatos creativos a producir.">
        <ChipsGroup
          options={FORMAT_OPTIONS}
          selected={form.formats}
          onToggle={(v) => toggle('formats', v)}
        />
      </Field>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || missing.length > 0}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear producto')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/products')}
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

function ChipsGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              active
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
