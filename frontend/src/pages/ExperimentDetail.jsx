import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { STATUS_META, RUNNING_STATUSES, STEP_ORDER, STEP_LABELS } from '../lib/status.js';

const POLL_INTERVAL_MS = 3500;

const CATEGORY_COLOR = {
  FUNCTIONAL_BENEFIT:  'bg-sky-100 text-sky-700',
  ECONOMIC_OPPORTUNITY:'bg-emerald-100 text-emerald-700',
  SOCIAL_STATUS:       'bg-violet-100 text-violet-700',
  EMOTIONAL_IDENTITY:  'bg-rose-100 text-rose-700',
  CULTURAL_TIMING:     'bg-amber-100 text-amber-700',
};

export default function ExperimentDetail() {
  const { id } = useParams();
  const [exp, setExp] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const pollRef = useRef(null);

  async function load() {
    try {
      const { experiment } = await api.get(`/api/experiments/${id}`);
      setExp(experiment);
      return experiment;
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!exp) return;
    const isRunning = RUNNING_STATUSES.has(exp.status);
    if (!isRunning) { stopPolling(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp?.status]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function run() {
    setError(null);
    setRunning(true);
    try {
      await api.post(`/api/experiments/${id}/run`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (!exp) return <div className="text-slate-500 text-sm">Cargando…</div>;

  const meta = STATUS_META[exp.status] || STATUS_META.draft;
  const isRunning = RUNNING_STATUSES.has(exp.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/experiments" className="text-xs text-slate-500 hover:text-slate-800">← Experimentos</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{exp.name}</h1>
          <div className="text-sm text-slate-500">{exp.client_name} · {exp.product_name}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs ${meta.className}`}>{meta.label}</span>
          {!isRunning && exp.status !== 'completed' && (
            <button
              onClick={run}
              disabled={running || !exp.champion_image_url}
              className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {exp.status === 'failed' ? 'Reintentar' : 'Ejecutar skills'}
            </button>
          )}
          {exp.status === 'completed' && (
            <button
              onClick={run}
              disabled={running}
              className="rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm"
            >
              Re-generar
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}

      {exp.error_message && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
          <div className="font-medium">Último error</div>
          <div className="mt-1 font-mono text-xs whitespace-pre-wrap">{exp.error_message}</div>
        </div>
      )}

      <StepTimeline status={exp.status} />

      {exp.status === 'completed' && exp.winner_payload && (
        <WinnerBanner winner={exp.winner_payload} uplift={exp.uplift_vs_champion} champion={exp.champion_score} />
      )}

      <section className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">Champion</h2>
          {exp.champion_image_url ? (
            <img src={exp.champion_image_url} alt="champion" className="rounded border border-slate-200 w-full" />
          ) : (
            <div className="text-xs text-slate-500">Sin imagen</div>
          )}
          {exp.champion_score && <ChampionScoreCard score={exp.champion_score} />}
        </div>

        <div className="space-y-6">
          <Section title="Brief" body={exp.brief_snapshot} />

          {exp.angles            && <AnglesBlock      angles={exp.angles} />}
          {exp.optimized_angles  && <OptimizedBlock   items={exp.optimized_angles} />}
          {exp.executions        && <ExecutionsBlock  executions={exp.executions} winnerId={exp.winner_id} />}
          {exp.scores            && <ScoresBlock      scores={exp.scores} winnerId={exp.winner_id} champion={exp.champion_score} />}
        </div>
      </section>
    </div>
  );
}

// ---------------- sub-components ----------------

function Section({ title, body }) {
  if (!body) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      <div className="bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-700 whitespace-pre-wrap">{body}</div>
    </div>
  );
}

function StepTimeline({ status }) {
  const currentIdx = STEP_ORDER.indexOf(status);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-3 text-xs">
        {Object.entries(STEP_LABELS).map(([key, label], i) => {
          const idx = STEP_ORDER.indexOf(key);
          const active = idx === currentIdx;
          const done = currentIdx > idx || status === 'completed';
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`px-2.5 py-1 rounded-full border ${
                active ? 'bg-brand-500 text-white border-brand-500' :
                done  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
              }`}>{label}</div>
              {i < 3 && <div className="w-6 h-px bg-slate-200" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WinnerBanner({ winner, uplift, champion }) {
  const sign = uplift == null ? '' : (Number(uplift) >= 0 ? '+' : '');
  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-5 flex items-center justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-emerald-700 font-medium">Ganador</div>
        <div className="text-lg font-semibold text-emerald-900 mt-1">
          Ángulo #{winner.angle_number} · score {winner.total_score}
        </div>
        {winner.recommendation && (
          <div className="text-sm text-emerald-900/80 mt-1">{winner.recommendation}</div>
        )}
      </div>
      {uplift != null && (
        <div className="text-right">
          <div className="text-xs text-emerald-700">vs Champion {champion?.total ?? ''}</div>
          <div className={`text-2xl font-bold ${Number(uplift) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {sign}{Number(uplift).toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

function ChampionScoreCard({ score }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 text-xs">
      <div className="text-slate-500 uppercase tracking-wide mb-1">Champion score</div>
      <div className="flex justify-between"><span>Novelty</span><span className="font-mono">{score.novelty?.score ?? '—'}</span></div>
      <div className="flex justify-between"><span>Appeal</span><span className="font-mono">{score.appeal?.score ?? '—'}</span></div>
      <div className="flex justify-between"><span>Conversion</span><span className="font-mono">{score.conversion?.score ?? '—'}</span></div>
      <div className="flex justify-between border-t border-slate-200 mt-1 pt-1 font-semibold">
        <span>Total</span><span className="font-mono">{score.total ?? '—'}</span>
      </div>
    </div>
  );
}

function CategoryBadge({ category }) {
  if (!category) return null;
  const cls = CATEGORY_COLOR[category] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {category.replace(/_/g, ' ')}
    </span>
  );
}

function AnglesBlock({ angles }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">1 · Ángulos estratégicos</h3>
      <div className="space-y-2">
        {angles.map((a) => {
          const num = a.angle_number ?? a.id;
          const name = a.angle_name || a.name || a.nombre || `Ángulo ${num}`;
          return (
            <div key={num} className="bg-white border border-slate-200 rounded-md p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">#{num}</span>
                  <div className="font-medium text-slate-900">{name}</div>
                </div>
                <CategoryBadge category={a.category} />
              </div>
              {a.insight && <div className="text-sm text-slate-600 mt-2"><b>Insight:</b> {a.insight}</div>}
              {a.benefit && <div className="text-sm text-slate-600 mt-1"><b>Beneficio:</b> {a.benefit}</div>}
              {a.evidence && <div className="text-sm text-slate-500 mt-1 italic"><b>Evidencia:</b> {a.evidence}</div>}
              {a.target_emotion && <div className="text-xs text-slate-500 mt-1"><b>Emoción:</b> {a.target_emotion}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptimizedBlock({ items }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">2 · Nudges conductuales</h3>
      <div className="space-y-2">
        {items.map((a) => {
          const num = a.angle_number ?? a.id;
          const nudges = a.nudges_applied || a.nudges || [];
          return (
            <div key={num} className="bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-700">
              <div className="flex items-baseline justify-between">
                <div className="font-medium text-slate-900">Ángulo #{num}</div>
              </div>
              {nudges.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {nudges.map((n, k) => (
                    <li key={k} className="border-l-2 border-brand-200 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500">{n.nudge_id || '—'}</span>
                        <span className="font-medium">{n.nudge_name || n.tipo || n.nudge}</span>
                        {n.category && <CategoryBadge category={n.category} />}
                      </div>
                      {n.application && <div className="text-slate-600 mt-0.5">{n.application}</div>}
                      {n.expected_impact && <div className="text-slate-500 text-xs italic mt-0.5">Impacto: {n.expected_impact}</div>}
                    </li>
                  ))}
                </ul>
              )}
              {a.optimized_messaging && (
                <div className="mt-3 bg-slate-50 rounded p-2 text-slate-700">
                  <b className="text-xs uppercase text-slate-500">Mensaje optimizado:</b>
                  <div className="mt-1">{a.optimized_messaging}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutionsBlock({ executions, winnerId }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">3 · Ejecuciones creativas</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {executions.map((ex, i) => {
          const num = ex.angle_number ?? ex.id;
          const id = `angle_${num}`;
          const isWinner = winnerId === id;
          const visual = ex.visual_concept || {};
          const cta = ex.cta || {};
          return (
            <div key={num ?? i} className={`rounded-md p-4 border ${isWinner ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'}`}>
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">#{num}</span>
                  {ex.template_used && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{ex.template_used}</span>
                  )}
                </div>
                {isWinner && <span className="text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5">Ganador</span>}
              </div>
              {ex.big_idea && <div className="mt-2 text-sm italic text-slate-700">{ex.big_idea}</div>}
              {ex.headline && <div className="mt-2 text-base font-semibold text-slate-900">{ex.headline}</div>}
              {ex.subheadline && <div className="text-sm text-slate-600">{ex.subheadline}</div>}
              {ex.body_copy && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{ex.body_copy}</div>}

              {(visual.main_visual || visual.background || visual.person || visual.colors) && (
                <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2 space-y-0.5">
                  {visual.main_visual && <div><b>Visual:</b> {visual.main_visual}</div>}
                  {visual.background  && <div><b>Fondo:</b> {visual.background}</div>}
                  {visual.person      && <div><b>Persona:</b> {visual.person}</div>}
                  {visual.colors      && <div><b>Paleta:</b> {visual.colors}</div>}
                </div>
              )}

              {(cta.text || cta.type) && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="bg-brand-500 text-white px-2 py-1 rounded">{cta.text || cta.type}</span>
                  {cta.friction && <span className="text-slate-500">fricción: {cta.friction}</span>}
                </div>
              )}

              {ex.hashtags && (
                <div className="text-xs text-brand-600 mt-2">
                  {(Array.isArray(ex.hashtags) ? ex.hashtags : []).map((h) => `${String(h).startsWith('#') ? '' : '#'}${String(h).replace(/^#/, '')}`).join(' ')}
                </div>
              )}

              {ex.tone && <div className="text-[11px] text-slate-400 mt-1">Tono: {ex.tone}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoresBlock({ scores, winnerId, champion }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">4 · Scoring</h3>
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Ángulo</th>
              <th className="px-3 py-2 text-right">Novelty</th>
              <th className="px-3 py-2 text-right">Appeal</th>
              <th className="px-3 py-2 text-right">Conversion</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left">Predicción por plataforma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {champion && (
              <tr className="bg-slate-50/60 text-slate-600">
                <td className="px-3 py-2 font-mono text-xs">Champion</td>
                <td className="px-3 py-2 text-right">{champion.novelty?.score ?? '—'}</td>
                <td className="px-3 py-2 text-right">{champion.appeal?.score ?? '—'}</td>
                <td className="px-3 py-2 text-right">{champion.conversion?.score ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold">{champion.total ?? '—'}</td>
                <td className="px-3 py-2">—</td>
              </tr>
            )}
            {scores.map((s, i) => {
              const num = s.angle_number ?? s.id;
              const id = `angle_${num}`;
              const isWinner = winnerId === id;
              const platforms = s.platform_prediction || {};
              return (
                <tr key={num ?? i} className={isWinner ? 'bg-emerald-50' : ''}>
                  <td className="px-3 py-2 font-mono text-xs">#{num}</td>
                  <td className="px-3 py-2 text-right">{val(s.novelty) ?? s.novedad ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{val(s.appeal)  ?? s.atractivo ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{val(s.conversion) ?? s.leads ?? s.potencial_leads ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{s.total ?? s.score_total ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {Object.entries(platforms).map(([p, v]) => (
                      <span key={p} className="mr-2">{p}: <b>{v}</b></span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Extrae `.score` si es un objeto, o devuelve el valor directo.
function val(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v.score ?? null;
  return v;
}
