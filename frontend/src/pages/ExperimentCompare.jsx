import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { STATUS_META } from '../lib/status.js';

const CATEGORY_COLOR = {
  FUNCTIONAL_BENEFIT:   'bg-sky-100 text-sky-700',
  ECONOMIC_OPPORTUNITY: 'bg-emerald-100 text-emerald-700',
  SOCIAL_STATUS:        'bg-violet-100 text-violet-700',
  EMOTIONAL_IDENTITY:   'bg-rose-100 text-rose-700',
  CULTURAL_TIMING:      'bg-amber-100 text-amber-700',
};

export default function ExperimentCompare() {
  const [params, setParams] = useSearchParams();
  const aId = params.get('a');
  const bId = params.get('b');

  const [allExperiments, setAllExperiments] = useState([]);
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/experiments')
      .then((d) => setAllExperiments(d.experiments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!aId || !bId) { setA(null); setB(null); return; }
    Promise.all([
      api.get(`/api/experiments/${aId}`),
      api.get(`/api/experiments/${bId}`),
    ])
      .then(([ra, rb]) => { setA(ra.experiment); setB(rb.experiment); })
      .catch((err) => setError(err.message));
  }, [aId, bId]);

  function pick(side, id) {
    const next = new URLSearchParams(params);
    if (id) next.set(side, id); else next.delete(side);
    setParams(next, { replace: true });
  }

  if (loading) return <div className="text-slate-500 text-sm">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/experiments" className="text-xs text-slate-500 hover:text-slate-800">← Experimentos</Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Compare side-by-side</h1>
        <p className="text-sm text-slate-500">
          Elegí dos experimentos y mirá las diferencias en winner, scoring, categorías ganadoras y plataformas predichas.
          Útil para validar si una iteración de prompt mejoró frente a la anterior.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExperimentPicker label="Experimento A" experiments={allExperiments} value={aId} onChange={(v) => pick('a', v)} disabledId={bId} />
        <ExperimentPicker label="Experimento B" experiments={allExperiments} value={bId} onChange={(v) => pick('b', v)} disabledId={aId} />
      </div>

      {(!a || !b) && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          Elegí los dos experimentos arriba para ver la comparación.
        </div>
      )}

      {a && b && <CompareView a={a} b={b} />}
    </div>
  );
}

// ---------------- picker ----------------

function ExperimentPicker({ label, experiments, value, onChange, disabledId }) {
  const sorted = useMemo(
    () => [...experiments].sort((x, y) => new Date(y.updated_at) - new Date(x.updated_at)),
    [experiments],
  );
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">— seleccionar —</option>
        {sorted.map((e) => (
          <option
            key={e.id}
            value={e.id}
            disabled={String(e.id) === String(disabledId)}
          >
            #{e.id} · {e.name} · {e.client_name} · {(STATUS_META[e.status]?.label) || e.status}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------- compare ----------------

function CompareView({ a, b }) {
  const sameProduct = a.product_id === b.product_id;
  return (
    <div className="space-y-4">
      {!sameProduct && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md p-3">
          ⚠ Estos experimentos corresponden a productos distintos ({a.product_name} vs {b.product_name}). La comparación pierde poder porque el orchestrator usa el brief/target/context del producto. Para resultados accionables, comparate dos corridas del mismo producto.
        </div>
      )}

      {/* Header con datos crudos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExperimentHeader exp={a} side="A" />
        <ExperimentHeader exp={b} side="B" />
      </div>

      {/* Diff key metrics */}
      <DiffMetrics a={a} b={b} />

      {/* Champion images */}
      {(a.champion_image_url || b.champion_image_url) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChampionPanel exp={a} />
          <ChampionPanel exp={b} />
        </div>
      )}

      {/* Winner challenger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WinnerPanel exp={a} side="A" />
        <WinnerPanel exp={b} side="B" />
      </div>

      {/* Categorías y selección */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoriesPanel exp={a} />
        <CategoriesPanel exp={b} />
      </div>

      {/* Scoring table comparativo */}
      <ScoringComparison a={a} b={b} />

      {/* Platform prediction */}
      <PlatformComparison a={a} b={b} />
    </div>
  );
}

function ExperimentHeader({ exp, side }) {
  const meta = STATUS_META[exp.status] || STATUS_META.draft;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{side}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${meta.className}`}>{meta.label}</span>
      </div>
      <div className="mt-2">
        <Link to={`/experiments/${exp.id}`} className="font-semibold text-slate-900 hover:underline">
          {exp.name}
        </Link>
        <div className="text-xs text-slate-500">{exp.client_name} · {exp.product_name}</div>
        <div className="text-[11px] text-slate-400 mt-1">
          {exp.completed_at
            ? `Completado ${new Date(exp.completed_at).toLocaleString('es-AR')}`
            : exp.created_at
              ? `Creado ${new Date(exp.created_at).toLocaleString('es-AR')}`
              : ''}
        </div>
      </div>
    </div>
  );
}

function DiffMetrics({ a, b }) {
  const upA = a.uplift_vs_champion != null ? Number(a.uplift_vs_champion) : null;
  const upB = b.uplift_vs_champion != null ? Number(b.uplift_vs_champion) : null;
  const winnerSide = upA != null && upB != null
    ? upA > upB ? 'A' : upB > upA ? 'B' : 'tie'
    : null;
  const diff = upA != null && upB != null ? upB - upA : null;

  const champA = a.champion_score?.total ?? null;
  const champB = b.champion_score?.total ?? null;

  const winA = a.winner_payload?.total_score ?? null;
  const winB = b.winner_payload?.total_score ?? null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-medium text-slate-700 mb-3">Diferencias clave</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <DiffMetric
          label="Uplift vs Champion"
          a={fmtUplift(upA)}
          b={fmtUplift(upB)}
          diff={diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}` : null}
          highlight={winnerSide}
        />
        <DiffMetric
          label="Score del Winner"
          a={winA != null ? Number(winA).toFixed(2) : '—'}
          b={winB != null ? Number(winB).toFixed(2) : '—'}
        />
        <DiffMetric
          label="Score del Champion"
          a={champA != null ? Number(champA).toFixed(2) : '—'}
          b={champB != null ? Number(champB).toFixed(2) : '—'}
        />
      </div>
      {winnerSide === 'A' && (
        <div className="mt-3 text-xs text-emerald-700 text-center">
          → A gana esta comparación: mayor uplift sobre Champion.
        </div>
      )}
      {winnerSide === 'B' && (
        <div className="mt-3 text-xs text-emerald-700 text-center">
          → B gana esta comparación: mayor uplift sobre Champion.
        </div>
      )}
      {winnerSide === 'tie' && (
        <div className="mt-3 text-xs text-slate-500 text-center">→ Empate en uplift.</div>
      )}
    </div>
  );
}

function DiffMetric({ label, a, b, diff, highlight }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-2 text-lg font-bold">
        <span className={highlight === 'A' ? 'text-emerald-600' : 'text-slate-700'}>{a}</span>
        <span className="text-slate-400">vs</span>
        <span className={highlight === 'B' ? 'text-emerald-600' : 'text-slate-700'}>{b}</span>
      </div>
      {diff && <div className="text-xs text-slate-500 mt-0.5">Δ {diff}</div>}
    </div>
  );
}

function ChampionPanel({ exp }) {
  const score = exp.champion_score;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
      <div className="text-xs text-slate-500 uppercase tracking-wide">Champion</div>
      {exp.champion_image_url
        ? <img src={exp.champion_image_url} alt="champion" className="rounded border border-slate-200 max-h-40 object-contain w-full" />
        : <div className="text-xs text-slate-400">Sin imagen</div>}
      {score && (
        <div className="grid grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-100">
          <Stat3 label="Novelty"    v={score.novelty?.score} />
          <Stat3 label="Appeal"     v={score.appeal?.score} />
          <Stat3 label="Conversion" v={score.conversion?.score} />
          <Stat3 label="Total"      v={score.total} bold />
        </div>
      )}
    </div>
  );
}

function Stat3({ label, v, bold }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`font-mono ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{v ?? '—'}</div>
    </div>
  );
}

function WinnerPanel({ exp, side }) {
  const winnerNum = exp.winner_payload?.angle_number;
  const angles = Array.isArray(exp.angles) ? exp.angles : [];
  const winnerAngle = angles.find((a) => a.angle_number === winnerNum);
  const executions = Array.isArray(exp.executions) ? exp.executions : [];
  const winnerExec = executions.find((e) => e.angle_number === winnerNum);
  const firstCreative = winnerExec?.creatives?.[0] || winnerExec;

  if (!winnerAngle) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide">{side} · Winner</div>
        <div className="text-xs text-slate-400 mt-2">Sin ganador asignado.</div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-emerald-700 uppercase tracking-wide font-medium">{side} · Winner #{winnerNum}</div>
        {winnerAngle.category && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLOR[winnerAngle.category] || 'bg-slate-100 text-slate-600'}`}>
            {winnerAngle.category.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="font-medium text-slate-900">{winnerAngle.angle_name || '(sin nombre)'}</div>
      {winnerAngle.insight && <div className="text-xs text-slate-700"><b>Insight:</b> {winnerAngle.insight}</div>}
      {firstCreative?.headline && (
        <div className="text-sm font-semibold text-slate-900 pt-1 border-t border-emerald-200/60">
          {firstCreative.headline}
        </div>
      )}
      {firstCreative?.post_copy && (
        <div className="text-xs text-slate-700 line-clamp-3">{firstCreative.post_copy}</div>
      )}
      {firstCreative?.body_copy && !firstCreative?.post_copy && (
        <div className="text-xs text-slate-700 line-clamp-3">{firstCreative.body_copy}</div>
      )}
      {exp.winner_payload?.recommendation && (
        <div className="text-[11px] text-emerald-800 italic mt-1">
          {exp.winner_payload.recommendation}
        </div>
      )}
    </div>
  );
}

function CategoriesPanel({ exp }) {
  const angles = Array.isArray(exp.angles) ? exp.angles : [];
  const selected = new Set(Array.isArray(exp.selected_angle_numbers) ? exp.selected_angle_numbers : []);
  const winnerNum = exp.winner_payload?.angle_number;

  if (!angles.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Ángulos generados</div>
        <div className="text-xs text-slate-400">Sin ángulos.</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Ángulos generados</div>
      <ul className="space-y-1.5 text-sm">
        {angles.map((a) => {
          const num = a.angle_number;
          const isWinner = num === winnerNum;
          const wasPicked = selected.size === 0 || selected.has(num);
          return (
            <li key={num} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-6 text-slate-400">#{num}</span>
              <span className={isWinner ? 'font-semibold text-emerald-700' : wasPicked ? 'text-slate-700' : 'text-slate-400 line-through'}>
                {a.angle_name || '(sin nombre)'}
              </span>
              {a.category && (
                <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${CATEGORY_COLOR[a.category] || 'bg-slate-100 text-slate-600'}`}>
                  {a.category.replace(/_/g, ' ')}
                </span>
              )}
              {isWinner && <span className="text-[9px] bg-emerald-600 text-white rounded-full px-1.5 py-0.5">WIN</span>}
              {!wasPicked && <span className="text-[9px] text-slate-400">descartado</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoringComparison({ a, b }) {
  const scoresA = Array.isArray(a.scores) ? a.scores : [];
  const scoresB = Array.isArray(b.scores) ? b.scores : [];
  if (!scoresA.length && !scoresB.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-700">Scoring lado a lado</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-200">
        <ScoringTable scores={scoresA} winnerId={a.winner_id} side="A" />
        <ScoringTable scores={scoresB} winnerId={b.winner_id} side="B" />
      </div>
    </div>
  );
}

function ScoringTable({ scores, winnerId, side }) {
  return (
    <div>
      <div className="px-4 py-2 bg-slate-50 text-xs font-medium text-slate-600">{side}</div>
      <table className="w-full text-xs">
        <thead className="bg-white text-slate-500">
          <tr>
            <th className="px-3 py-1.5 text-left">#</th>
            <th className="px-3 py-1.5 text-right">Nov</th>
            <th className="px-3 py-1.5 text-right">App</th>
            <th className="px-3 py-1.5 text-right">Conv</th>
            <th className="px-3 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {scores.map((s, i) => {
            const num = s.angle_number ?? s.id;
            const id = `angle_${num}`;
            const isWinner = winnerId === id;
            return (
              <tr key={num ?? i} className={isWinner ? 'bg-emerald-50' : ''}>
                <td className="px-3 py-1.5 font-mono">#{num}</td>
                <td className="px-3 py-1.5 text-right">{val(s.novelty)}</td>
                <td className="px-3 py-1.5 text-right">{val(s.appeal)}</td>
                <td className="px-3 py-1.5 text-right">{val(s.conversion)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{s.total ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlatformComparison({ a, b }) {
  const aggA = aggregatePlatform(a.scores);
  const aggB = aggregatePlatform(b.scores);
  const allPlatforms = Array.from(new Set([...Object.keys(aggA), ...Object.keys(aggB)])).sort();

  if (allPlatforms.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-medium text-slate-700 mb-3">Predicción por plataforma (avg de challengers)</h3>
      <div className="space-y-2 text-sm">
        {allPlatforms.map((p) => {
          const va = aggA[p];
          const vb = aggB[p];
          const winsA = va != null && (vb == null || va > vb);
          const winsB = vb != null && (va == null || vb > va);
          return (
            <div key={p} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
              <span className="text-slate-700 capitalize">{p}</span>
              <span className={`font-mono ${winsA ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                A: {va != null ? va.toFixed(2) : '—'}
              </span>
              <span className="text-slate-300">·</span>
              <span className={`font-mono ${winsB ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                B: {vb != null ? vb.toFixed(2) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function aggregatePlatform(scores) {
  if (!Array.isArray(scores)) return {};
  const sums = {};
  const counts = {};
  for (const s of scores) {
    const pp = s.platform_prediction || {};
    for (const [platform, value] of Object.entries(pp)) {
      const v = Number(value);
      if (Number.isFinite(v)) {
        sums[platform] = (sums[platform] || 0) + v;
        counts[platform] = (counts[platform] || 0) + 1;
      }
    }
  }
  const out = {};
  for (const k of Object.keys(sums)) out[k] = sums[k] / counts[k];
  return out;
}

// ---------------- helpers ----------------

function val(v) {
  if (v == null) return '—';
  if (typeof v === 'object') return v.score ?? '—';
  return v;
}

function fmtUplift(n) {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}`;
}
