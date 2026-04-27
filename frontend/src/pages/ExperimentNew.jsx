import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Twitter', 'Google'];
const FORMAT_OPTIONS   = ['feed', 'stories', 'carousel', 'reel', 'video', 'image', 'text'];

export default function ExperimentNew() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_id: '', name: '', platforms: [], formats: [] });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [historyCount, setHistoryCount] = useState(null);

  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.product_id)) || null,
    [products, form.product_id],
  );

  // Cuando cambia el producto seleccionado, traemos cuántas campañas de
  // histórico tiene cargadas + precargamos platforms/formats con los del producto.
  useEffect(() => {
    if (!selectedProduct) { setHistoryCount(null); return; }
    api.get(`/api/products/${selectedProduct.id}/history`)
      .then((d) => setHistoryCount(d.history.length))
      .catch(() => setHistoryCount(null));

    // Precargar platforms/formats desde el producto si el form todavía está vacío.
    setForm((f) => ({
      ...f,
      platforms: f.platforms.length > 0 ? f.platforms : (selectedProduct.platforms || []),
      formats:   f.formats.length   > 0 ? f.formats   : (selectedProduct.formats   || []),
    }));
  }, [selectedProduct?.id]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function toggle(k, v) {
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
    }));
  }

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
    if (form.platforms.length === 0) return setError('Elegí al menos una plataforma');
    if (form.formats.length === 0) return setError('Elegí al menos un formato');

    setSubmitting(true);
    try {
      const uploaded = await api.upload('/api/uploads/champion', file);
      const { experiment } = await api.post('/api/experiments', {
        product_id: Number(form.product_id),
        name: form.name.trim(),
        champion_image_url: uploaded.url,
        champion_public_id: uploaded.public_id,
        platforms: form.platforms,
        formats:   form.formats,
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

      <Field
        label="Producto"
        required
        hint="El brief, audiencia, key benefit, contexto, plataformas y formatos se leen del producto. Si falta info, editalo o creá uno nuevo antes de continuar."
      >
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

      {selectedProduct && <ProductBriefPanel product={selectedProduct} historyCount={historyCount} />}

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

      <Field
        label="Plataformas para este experimento"
        required
        hint={selectedProduct
          ? "Precargado con las plataformas típicas del producto. Ajustá si en este experimento querés probar canales distintos."
          : "Elegí primero un producto."}
      >
        <ChipsGroup
          options={PLATFORM_OPTIONS}
          selected={form.platforms}
          onToggle={(v) => toggle('platforms', v)}
        />
      </Field>

      <Field
        label="Formatos para este experimento"
        required
        hint="El Ogilvy va a generar un creativo por cada combo (plataforma × formato) que tenga sentido."
      >
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

function ProductBriefPanel({ product, historyCount }) {
  const missing = [];
  if (!product.brief_text)      missing.push('brief_text');
  if (!product.target_audience) missing.push('target_audience');

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-700">Contexto del producto que va a usar el orchestrator</h3>
        <div className="flex gap-3 text-xs">
          <Link to={`/products/${product.id}/history`} className="text-slate-600 hover:underline">
            Histórico →
          </Link>
          <Link to={`/products/${product.id}/edit`} className="text-brand-600 hover:underline">
            Editar producto →
          </Link>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2 text-xs">
          ⚠️ Faltan campos obligatorios en el producto: <b>{missing.join(', ')}</b>. Completalos antes de ejecutar para evitar respuestas pobres.
        </div>
      )}

      <Row label="Brief"     value={product.brief_text} />
      <Row label="Target"    value={product.target_audience} />
      <Row label="Key benefit" value={product.key_benefit} />
      <Row label="Contexto"  value={product.context} />
      <Row label="Plataformas" value={Array.isArray(product.platforms) && product.platforms.length ? product.platforms.join(' · ') : null} />
      <Row label="Formatos"  value={Array.isArray(product.formats) && product.formats.length ? product.formats.join(' · ') : null} />
      <Row
        label="Histórico"
        value={historyCount == null
          ? '…'
          : historyCount === 0
            ? 'sin campañas previas cargadas (el Analyzer no tendrá benchmarks)'
            : `${historyCount} campaña${historyCount > 1 ? 's' : ''} previa${historyCount > 1 ? 's' : ''} cargada${historyCount > 1 ? 's' : ''}`}
      />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700 whitespace-pre-wrap">
        {value || <i className="text-slate-400">(vacío)</i>}
      </span>
    </div>
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
