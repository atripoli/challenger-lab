import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ExperimentNew() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_id: '', name: '', brief_snapshot: '', historical_json: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products));
  }, []);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function onFile(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.product_id) return setError('Elegí un producto');
    if (!form.name.trim()) return setError('Ingresá un nombre');
    if (!file) return setError('Subí la imagen del Champion');

    let historical = null;
    if (form.historical_json.trim()) {
      try { historical = JSON.parse(form.historical_json); }
      catch { return setError('El histórico no es JSON válido'); }
    }

    setSubmitting(true);
    try {
      const uploaded = await api.upload('/api/uploads/champion', file);
      const { experiment } = await api.post('/api/experiments', {
        product_id: Number(form.product_id),
        name: form.name.trim(),
        brief_snapshot: form.brief_snapshot.trim() || null,
        champion_image_url: uploaded.url,
        champion_public_id: uploaded.public_id,
        historical_data: historical,
      });
      navigate(`/experiments/${experiment.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900">Nuevo experimento</h1>

      <Field label="Producto" required>
        <select
          value={form.product_id}
          onChange={(e) => update('product_id', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— seleccionar —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.client_name} · {p.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Nombre del experimento" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ej: Campaña Q2 — retargeting cartera activa"
        />
      </Field>

      <Field label="Imagen Champion" required>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="text-sm" />
        {preview && (
          <img src={preview} alt="preview" className="mt-3 max-h-56 rounded border border-slate-200" />
        )}
      </Field>

      <Field label="Brief del producto" hint="Texto libre que se usará como contexto.">
        <textarea
          rows={5}
          value={form.brief_snapshot}
          onChange={(e) => update('brief_snapshot', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Histórico (JSON opcional)" hint="Array de campañas previas con métricas. Se parsea como JSON.">
        <textarea
          rows={5}
          value={form.historical_json}
          onChange={(e) => update('historical_json', e.target.value)}
          className="w-full font-mono text-xs rounded-md border border-slate-300 px-3 py-2"
          placeholder='[{"campaign":"Q1-A","ctr":0.023,"cvr":0.011}]'
        />
      </Field>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? 'Creando…' : 'Crear experimento'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/experiments')}
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
