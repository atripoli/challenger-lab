import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const CATEGORY_COLOR = {
  FUNCTIONAL_BENEFIT:   'bg-sky-500',
  ECONOMIC_OPPORTUNITY: 'bg-emerald-500',
  SOCIAL_STATUS:        'bg-violet-500',
  EMOTIONAL_IDENTITY:   'bg-rose-500',
  CULTURAL_TIMING:      'bg-amber-500',
};

const PLATFORM_COLOR = {
  facebook:  'bg-blue-500',
  instagram: 'bg-pink-500',
  linkedin:  'bg-sky-500',
  tiktok:    'bg-fuchsia-500',
  youtube:   'bg-red-500',
  twitter:   'bg-slate-500',
  google:    'bg-emerald-500',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/stats/dashboard')
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Cargando…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>;
  if (!stats) return null;

  const { totals, uplift, winning_categories, platform_predictions, recent_completed, pipeline_duration, calibration, results_aggregate, api_cost } = stats;
  const isEmpty = totals.experiments === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {isEmpty && (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center">
          <p className="text-slate-600 text-sm">
            Todavía no hay experimentos cargados. <Link to="/experiments/new" className="text-brand-600 hover:underline">Creá el primero</Link> para empezar a ver patrones.
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total experimentos"    value={totals.experiments} />
            <Kpi label="Completados"           value={totals.completed} sub={percent(totals.completed, totals.experiments)} />
            <Kpi label="Uplift promedio"       value={fmtUplift(uplift.avg)} sub={uplift.n ? `n=${uplift.n}` : 'sin data'} highlight={uplift.avg > 0} />
            <Kpi label="Tiempo promedio pipeline" value={fmtDuration(pipeline_duration.avg_seconds)} sub={pipeline_duration.n ? `${pipeline_duration.n} corridas` : '—'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="En revisión"     value={totals.awaiting_review} accent="bg-amber-100 text-amber-800" link="/experiments?status=awaiting_review" />
            <MiniStat label="Corriendo"       value={totals.analyzing + totals.optimizing + totals.executing + totals.scoring} accent="bg-blue-100 text-blue-700" />
            <MiniStat label="Fallidos"        value={totals.failed} accent="bg-red-100 text-red-700" />
            <MiniStat label="Borradores"      value={totals.draft} accent="bg-slate-100 text-slate-700" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategoryDistribution items={winning_categories} totalWins={winning_categories.reduce((s, r) => s + r.wins, 0)} />
            <PlatformPredictionRanking items={platform_predictions} />
          </div>

          <UpliftDistribution uplift={uplift} />

          {api_cost && api_cost.n_experiments_with_usage > 0 && (
            <ApiCostPanel apiCost={api_cost} />
          )}

          {calibration && calibration.n > 0 && (
            <CalibrationPanel calibration={calibration} resultsAgg={results_aggregate} />
          )}

          <RecentCompleted items={recent_completed} />
        </>
      )}
    </div>
  );
}

function ApiCostPanel({ apiCost }) {
  const totalInput = apiCost.total_input_tokens + apiCost.total_cache_read + apiCost.total_cache_creation;
  const cachePct = totalInput > 0
    ? (apiCost.total_cache_read / totalInput) * 100
    : 0;
  // Sin cache, los tokens cache_read se hubieran cobrado al precio normal de input.
  // Estimamos savings como cache_read × (1 - 0.10) × price del modelo más usado.
  // Aproximación rough: usamos un blended rate de $2/1M input.
  const estimatedSavings = (apiCost.total_cache_read / 1_000_000) * 2 * 0.9;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700">Costo API Anthropic</h3>
        <span className="text-[11px] text-slate-500">
          {apiCost.n_skill_calls} llamadas en {apiCost.n_experiments_with_usage} experimento{apiCost.n_experiments_with_usage !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
        <Stat
          label="Costo total"
          value={`USD ${apiCost.total_cost_usd.toFixed(2)}`}
        />
        <Stat
          label="Costo promedio por experimento"
          value={`USD ${apiCost.avg_cost_per_experiment.toFixed(3)}`}
        />
        <Stat
          label="Tokens cacheados (lectura)"
          value={fmtTokens(apiCost.total_cache_read)}
          positive={cachePct > 20}
        />
        <Stat
          label="% cache hit"
          value={`${cachePct.toFixed(1)}%`}
          positive={cachePct > 20}
        />
      </div>

      {apiCost.by_model.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Por modelo</div>
          <div className="space-y-1.5 text-sm">
            {apiCost.by_model.map((m) => {
              const totalCost = apiCost.total_cost_usd || 1;
              const pct = (m.cost_usd / totalCost) * 100;
              return (
                <div key={m.model}>
                  <div className="flex items-baseline justify-between text-xs mb-0.5">
                    <span className="text-slate-700 font-mono">{m.model}</span>
                    <span className="text-slate-500">
                      {m.n_calls} llamadas · {fmtTokens(m.input_tokens + m.output_tokens)} tok ·{' '}
                      <span className="font-semibold text-slate-700">USD {Number(m.cost_usd).toFixed(3)}</span>
                    </span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cachePct > 5 && (
        <div className="mt-3 text-xs text-emerald-700 text-center">
          ✓ Prompt caching activo — ahorraste ~USD {estimatedSavings.toFixed(3)} estimados sobre {fmtTokens(apiCost.total_cache_read)} tokens leídos del cache.
        </div>
      )}
    </div>
  );
}

function fmtTokens(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function CalibrationPanel({ calibration, resultsAgg }) {
  const delta = calibration.avg_delta;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700">Calibración del Scorer (predicted vs actual)</h3>
        <span className="text-[11px] text-slate-500">{calibration.n} resultado{calibration.n !== 1 ? 's' : ''} cargado{calibration.n !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <Stat label="Predicted promedio" value={calibration.avg_predicted?.toFixed(2) ?? '—'} />
        <Stat label="Actual promedio"    value={calibration.avg_actual?.toFixed(2)    ?? '—'} />
        <Stat
          label="Δ (actual − predicted)"
          value={delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
          positive={delta != null && delta > 0.5}
          negative={delta != null && delta < -0.5}
        />
        {resultsAgg?.total_budget != null && (
          <Stat
            label="Budget total trackeado"
            value={`${resultsAgg.currency || 'USD'} ${Number(resultsAgg.total_budget).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`}
          />
        )}
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">
        {delta != null && Math.abs(delta) < 0.5 && '✓ El Scorer está bien calibrado — sus predicciones se acercan a la performance real.'}
        {delta != null && delta > 0.5 && 'El Scorer está siendo conservador: la realidad supera lo predicho.'}
        {delta != null && delta < -0.5 && '⚠ El Scorer está sobreestimando: las predicciones son más optimistas que la realidad. Habría que revisar el prompt del Performance Scorer.'}
      </p>
    </div>
  );
}

// ---------------- componentes ----------------

function Kpi({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, accent, link }) {
  const inner = (
    <div className={`rounded-md px-3 py-2 flex items-center justify-between ${accent}`}>
      <span className="text-xs">{label}</span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function CategoryDistribution({ items, totalWins }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-medium text-slate-700">Categorías ganadoras</h3>
      <p className="text-xs text-slate-500 mb-3">Cuál de las 5 categorías estratégicas gana más experimentos.</p>
      {totalWins === 0 ? (
        <div className="text-xs text-slate-400">Sin experimentos completados todavía.</div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.category}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-slate-700">{(c.category || '—').replace(/_/g, ' ')}</span>
                <span className="text-slate-500 font-mono">
                  {c.wins} <span className="text-slate-400">({Math.round(c.share * 100)}%)</span>
                </span>
              </div>
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${CATEGORY_COLOR[c.category] || 'bg-slate-400'}`}
                  style={{ width: `${Math.max(2, c.share * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformPredictionRanking({ items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-medium text-slate-700">Plataformas mejor predichas</h3>
      <p className="text-xs text-slate-500 mb-3">Score promedio (0-10) que el Performance Scorer asigna a cada plataforma para los challengers.</p>
      {items.length === 0 ? (
        <div className="text-xs text-slate-400">Sin datos de platform_prediction todavía.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.platform}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-slate-700 capitalize">{p.platform}</span>
                <span className="text-slate-500 font-mono">
                  {p.avg_score.toFixed(2)}<span className="text-slate-400"> / 10</span>
                </span>
              </div>
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${PLATFORM_COLOR[p.platform.toLowerCase()] || 'bg-slate-400'}`}
                  style={{ width: `${Math.max(2, (p.avg_score / 10) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UpliftDistribution({ uplift }) {
  if (uplift.n === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-medium text-slate-700 mb-3">Distribución de uplift vs Champion</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <Stat label="Promedio" value={fmtUplift(uplift.avg)} />
        <Stat label="Mediana"  value={fmtUplift(uplift.median)} />
        <Stat label="Máximo"   value={fmtUplift(uplift.max)} positive />
        <Stat label="Mínimo"   value={fmtUplift(uplift.min)} negative={uplift.min < 0} />
      </div>
      <p className="text-xs text-slate-500 mt-3 text-center">
        {uplift.n} experimento{uplift.n !== 1 ? 's' : ''} completado{uplift.n !== 1 ? 's' : ''}.
        {uplift.avg < 0 && <span className="text-red-600 ml-1">⚠ El promedio es negativo: en general los challengers están perdiendo contra el Champion.</span>}
      </p>
    </div>
  );
}

function Stat({ label, value, positive, negative }) {
  const cls = negative ? 'text-red-600' : positive ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="bg-slate-50 rounded p-3">
      <div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function RecentCompleted({ items }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-700">Últimos 5 completados</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs">
          <tr>
            <th className="px-4 py-2 text-left">Nombre</th>
            <th className="px-4 py-2 text-left">Cliente / Producto</th>
            <th className="px-4 py-2 text-left">Ganador</th>
            <th className="px-4 py-2 text-right">Uplift</th>
            <th className="px-4 py-2 text-right">Completado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((e) => (
            <tr key={e.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link to={`/experiments/${e.id}`} className="text-brand-600 hover:underline">
                  {e.name}
                </Link>
                {e.recommendation && (
                  <div className="text-[11px] text-slate-500 line-clamp-1 max-w-md mt-0.5">
                    {e.recommendation}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 text-xs">{e.client_name} · {e.product_name}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.winner_id || '—'}</td>
              <td className={`px-4 py-3 text-right font-semibold ${e.uplift_vs_champion >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmtUplift(e.uplift_vs_champion)}
              </td>
              <td className="px-4 py-3 text-right text-slate-500 text-xs">
                {e.completed_at ? new Date(e.completed_at).toLocaleDateString('es-AR') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- helpers ----------------

function percent(n, total) {
  if (!total) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}
function fmtUplift(n) {
  if (n == null || isNaN(n)) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
}
function fmtDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
