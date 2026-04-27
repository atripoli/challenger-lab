import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

// Canales predefinidos. Cada uno es una combinación específica (platform, format)
// que el modelo va a respetar 1:1 — sin agregar variantes ni cross-products.
const CHANNEL_OPTIONS = [
  { platform: 'Facebook',  format: 'feed',     label: 'Facebook · feed' },
  { platform: 'Facebook',  format: 'stories',  label: 'Facebook · stories' },
  { platform: 'Facebook',  format: 'reel',     label: 'Facebook · reel' },
  { platform: 'Instagram', format: 'feed',     label: 'Instagram · feed' },
  { platform: 'Instagram', format: 'stories',  label: 'Instagram · stories' },
  { platform: 'Instagram', format: 'reel',     label: 'Instagram · reel' },
  { platform: 'Instagram', format: 'carousel', label: 'Instagram · carousel' },
  { platform: 'LinkedIn',  format: 'feed',     label: 'LinkedIn · feed' },
  { platform: 'LinkedIn',  format: 'carousel', label: 'LinkedIn · carousel' },
  { platform: 'TikTok',    format: 'video',    label: 'TikTok · video' },
  { platform: 'YouTube',   format: 'video',    label: 'YouTube · video' },
  { platform: 'YouTube',   format: 'shorts',   label: 'YouTube · shorts' },
  { platform: 'Twitter',   format: 'feed',     label: 'Twitter · feed' },
  { platform: 'Google',    format: 'search',   label: 'Google · search' },
  { platform: 'Google',    format: 'display',  label: 'Google · display' },
];

const channelKey = (c) => `${c.platform}|${c.format}`;

export default function ExperimentNew() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ product_id: '', name: '', channels: [], parent_experiment_id: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [historyCount, setHistoryCount] = useState(null);
  const [productExperiments, setProductExperiments] = useState([]);

  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products));
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.product_id)) || null,
    [products, form.product_id],
  );

  // Cuando cambia el producto seleccionado, traemos cuántas campañas de
  // histórico tiene cargadas + precargamos canales con el cross-product de
  // platforms × formats del producto (default sugerido). El usuario puede
  // ajustar antes de submit.
  useEffect(() => {
    if (!selectedProduct) { setHistoryCount(null); return; }
    api.get(`/api/products/${selectedProduct.id}/history`)
      .then((d) => setHistoryCount(d.history.length))
      .catch(() => setHistoryCount(null));

    setForm((f) => {
      if (f.channels.length > 0) return f; // no pisar selección manual
      const pp = selectedProduct.platforms || [];
      const ff = selectedProduct.formats   || [];
      const seeded = [];
      for (const p of pp) for (const fmt of ff) {
        // matchear contra opciones predefinidas
        const opt = CHANNEL_OPTIONS.find((o) => o.platform === p && o.format === fmt);
        if (opt) seeded.push({ platform: opt.platform, format: opt.format });
      }
      return { ...f, channels: seeded };
    });

    // Cargar experimentos previos del mismo producto que tengan ángulos generados,
    // para mostrarlos como posibles parents en el picker de iteración.
    api.get(`/api/experiments?product_id=${selectedProduct.id}`)
      .then((d) => {
        const candidates = (d.experiments || []).filter(
          (e) => e.status === 'completed' || e.status === 'awaiting_review' ||
                 ['optimizing', 'executing', 'scoring'].includes(e.status),
        );
        setProductExperiments(candidates);
      })
      .catch(() => setProductExperiments([]));
  }, [selectedProduct?.id]);

  const parentExperiment = useMemo(
    () => productExperiments.find((e) => String(e.id) === String(form.parent_experiment_id)) || null,
    [productExperiments, form.parent_experiment_id],
  );

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleChannel(option) {
    setForm((f) => {
      const key = channelKey(option);
      const exists = f.channels.some((c) => channelKey(c) === key);
      return {
        ...f,
        channels: exists
          ? f.channels.filter((c) => channelKey(c) !== key)
          : [...f.channels, { platform: option.platform, format: option.format }],
      };
    });
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
    if (form.channels.length === 0) return setError('Elegí al menos un canal');

    setSubmitting(true);
    try {
      const uploaded = await api.upload('/api/uploads/champion', file);
      const body = {
        product_id: Number(form.product_id),
        name: form.name.trim(),
        champion_image_url: uploaded.url,
        champion_public_id: uploaded.public_id,
        channels: form.channels,
      };
      if (form.parent_experiment_id) {
        body.parent_experiment_id = Number(form.parent_experiment_id);
      }
      const { experiment } = await api.post('/api/experiments', body);
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

      {selectedProduct && productExperiments.length > 0 && (
        <Field
          label="¿Iterar sobre un experimento existente? (opcional)"
          hint="En Champion & Challenger los ángulos estratégicos son estables — lo que cambia entre iteraciones es la ejecución creativa. Si seleccionás un experimento padre, el Analyzer NO se ejecuta y los ángulos se heredan tal cual; sólo cambian el Champion (la imagen que subís ahora) y los nuevos creativos generados sobre los mismos ángulos."
        >
          <select
            value={form.parent_experiment_id}
            onChange={(e) => update('parent_experiment_id', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— exploración nueva (Analyzer corre y genera 5 ángulos frescos) —</option>
            {productExperiments.map((e) => (
              <option key={e.id} value={e.id}>
                #{e.id} · {e.name} {e.winner_id ? `· winner ${e.winner_id}` : ''}
              </option>
            ))}
          </select>
          {parentExperiment && (
            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md p-2.5">
              Iterando sobre <b>#{parentExperiment.id} · {parentExperiment.name}</b>. Los ángulos de ese experimento se van a copiar y vas a ir directo a la pantalla de revisión para seleccionar cuáles testear con los nuevos creativos.
            </div>
          )}
        </Field>
      )}

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
        label="Canales para este experimento"
        required
        hint={`Marcá cada canal específico (plataforma + formato) donde vas a correr. El Ogilvy genera EXACTAMENTE un creativo por canal seleccionado — ${form.channels.length} ${form.channels.length === 1 ? 'creativo será generado' : 'creativos serán generados'}.`}
      >
        <ChannelChips
          options={CHANNEL_OPTIONS}
          selected={form.channels}
          onToggle={toggleChannel}
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

function ChannelChips({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const key = channelKey(opt);
        const active = selected.some((c) => channelKey(c) === key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(opt)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              active
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
