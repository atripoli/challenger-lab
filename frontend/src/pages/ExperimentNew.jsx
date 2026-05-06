import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

// Plataformas con su formato flagship/nativo. El experimento ahora trabaja
// a nivel PLATAFORMA: una idea creativa por red en su formato principal.
// Las adaptaciones a stories / reel / carousel se hacen en una fase posterior
// desde el creative ganador, no se generan upfront en el pipeline.
const PLATFORM_OPTIONS = [
  { platform: 'Facebook',  flagship: 'feed',    label: 'Facebook',  hint: 'feed 1:1' },
  { platform: 'Instagram', flagship: 'feed',    label: 'Instagram', hint: 'feed 1:1' },
  { platform: 'LinkedIn',  flagship: 'feed',    label: 'LinkedIn',  hint: 'feed 1.91:1' },
  { platform: 'TikTok',    flagship: 'video',   label: 'TikTok',    hint: 'video 9:16' },
  { platform: 'YouTube',   flagship: 'video',   label: 'YouTube',   hint: 'video 16:9' },
  { platform: 'Twitter',   flagship: 'feed',    label: 'Twitter / X', hint: 'feed 16:9' },
  { platform: 'Google',    flagship: 'display', label: 'Google',    hint: 'display' },
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
  const [angleHistory, setAngleHistory] = useState(null);

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
      // Precargar plataformas del producto, mapeando cada una a su formato flagship.
      const productPlatforms = selectedProduct.platforms || [];
      const seeded = productPlatforms
        .map((p) => PLATFORM_OPTIONS.find((o) => o.platform === p))
        .filter(Boolean)
        .map((o) => ({ platform: o.platform, format: o.flagship }));
      return { ...f, channels: seeded };
    });

    // Cargar histórico de ángulos del producto (con status) para mostrar
    // transparencia de lo que el Analyzer va a recibir como input.
    api.get(`/api/products/${selectedProduct.id}/angle-history`)
      .then((d) => setAngleHistory(d.history))
      .catch(() => setAngleHistory(null));

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
  function togglePlatform(option) {
    // Cada plataforma se traduce a su canal flagship (platform + format nativo).
    setForm((f) => {
      const exists = f.channels.some((c) => c.platform === option.platform);
      return {
        ...f,
        channels: exists
          ? f.channels.filter((c) => c.platform !== option.platform)
          : [...f.channels, { platform: option.platform, format: option.flagship }],
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

      {selectedProduct && angleHistory && angleHistory.length > 0 && (
        <AngleHistoryPanel history={angleHistory} />
      )}

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
        label="Plataformas para este experimento"
        required
        hint={`Cada plataforma genera 1 creative en su formato flagship — vas a obtener ${form.channels.length} ${form.channels.length === 1 ? 'idea creativa nativa' : 'ideas creativas nativas'} para evaluar. Las adaptaciones a stories / reel / carousel se generan después desde el creative ganador.`}
      >
        <PlatformChips
          options={PLATFORM_OPTIONS}
          selected={form.channels}
          onToggle={togglePlatform}
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

function AngleHistoryPanel({ history }) {
  const winners   = history.filter((a) => a.status === 'winner');
  const selected  = history.filter((a) => a.status === 'selected');
  const discarded = history.filter((a) => a.status === 'discarded');

  return (
    <details className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
      <summary className="cursor-pointer flex items-center justify-between gap-3 select-none">
        <div>
          <h3 className="font-medium text-slate-700">Histórico de ángulos en este producto</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            El Analyzer recibe estos {history.length} ángulos y va a evitar repetirlos. Click para ver el detalle.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 text-[11px]">
          {winners.length   > 0 && <Badge color="emerald" label={`${winners.length} ganador${winners.length > 1 ? 'es' : ''}`} />}
          {selected.length  > 0 && <Badge color="sky"     label={`${selected.length} trabajado${selected.length > 1 ? 's' : ''}`} />}
          {discarded.length > 0 && <Badge color="slate"   label={`${discarded.length} descartado${discarded.length > 1 ? 's' : ''}`} />}
        </div>
      </summary>

      <div className="mt-4 space-y-4">
        <AngleGroup title="GANADORES — validados por scoring" angles={winners} statusColor="emerald" emptyText="(ninguno aún)" />
        <AngleGroup title="SELECCIONADOS NO-GANADORES — procesados pero no eligidos" angles={selected} statusColor="sky" emptyText="(ninguno)" />
        <AngleGroup title="DESCARTADOS — el equipo los descartó en revisión" angles={discarded} statusColor="slate" emptyText="(ninguno)" />
      </div>
    </details>
  );
}

function Badge({ color, label }) {
  const cls = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky:     'bg-sky-100 text-sky-700',
    slate:   'bg-slate-200 text-slate-700',
  }[color] || 'bg-slate-100 text-slate-700';
  return <span className={`px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function AngleGroup({ title, angles, statusColor, emptyText }) {
  const cls = {
    emerald: 'border-l-emerald-400',
    sky:     'border-l-sky-400',
    slate:   'border-l-slate-400',
  }[statusColor] || 'border-l-slate-400';

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{title}</div>
      {angles.length === 0 ? (
        <div className="text-xs text-slate-400 italic">{emptyText}</div>
      ) : (
        <ul className="space-y-2">
          {angles.map((a, i) => (
            <li key={`${a.experiment_id}-${a.angle_name}-${i}`} className={`bg-white border border-slate-200 ${cls} border-l-4 rounded p-2.5 text-xs`}>
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className="font-medium text-slate-900">{a.angle_name}</span>
                <span className="text-[10px] text-slate-400">
                  exp #{a.experiment_id} · {a.experiment_name}
                </span>
              </div>
              {a.category && <span className="text-[10px] text-slate-500 mr-2">{a.category.replace(/_/g, ' ')}</span>}
              {a.insight  && <div className="text-slate-600 mt-1">{a.insight}</div>}
            </li>
          ))}
        </ul>
      )}
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

function PlatformChips({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.some((c) => c.platform === opt.platform);
        return (
          <button
            key={opt.platform}
            type="button"
            onClick={() => onToggle(opt)}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
              active
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
            }`}
          >
            <span className="font-medium">{opt.label}</span>
            <span className={`text-[10px] ${active ? 'text-white/70' : 'text-slate-400'}`}>
              · {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
