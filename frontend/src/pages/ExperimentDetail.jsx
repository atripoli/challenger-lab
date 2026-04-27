import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { STATUS_META, RUNNING_STATUSES, STEP_ORDER, STEP_LABELS } from '../lib/status.js';

const POLL_INTERVAL_MS = 3500;

const CATEGORY_COLOR = {
  FUNCTIONAL_BENEFIT:   'bg-sky-100 text-sky-700',
  ECONOMIC_OPPORTUNITY: 'bg-emerald-100 text-emerald-700',
  SOCIAL_STATUS:        'bg-violet-100 text-violet-700',
  EMOTIONAL_IDENTITY:   'bg-rose-100 text-rose-700',
  CULTURAL_TIMING:      'bg-amber-100 text-amber-700',
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
  const isAwaitingReview = exp.status === 'awaiting_review';

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
          {!isRunning && exp.status !== 'completed' && !isAwaitingReview && (
            <button
              onClick={run}
              disabled={running || !exp.champion_image_url}
              className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {exp.status === 'failed' ? 'Reintentar' : 'Generar 5 ángulos'}
            </button>
          )}
          {exp.status === 'completed' && (
            <button
              onClick={run}
              disabled={running}
              className="rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm"
            >
              Re-generar ángulos
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

      {isAwaitingReview && exp.angles && (
        <ReviewPanel
          experimentId={exp.id}
          angles={exp.angles}
          onUpdated={load}
          onError={setError}
        />
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
          {!isAwaitingReview && exp.angles && <AnglesBlock angles={exp.angles} selected={exp.selected_angle_numbers} />}
          {exp.optimized_angles  && <OptimizedBlock   items={exp.optimized_angles} />}
          {exp.executions        && <ExecutionsBlock  executions={exp.executions} winnerId={exp.winner_id} />}
          {exp.scores            && <ScoresBlock      scores={exp.scores} winnerId={exp.winner_id} champion={exp.champion_score} />}
        </div>
      </section>

      {exp.status === 'completed' && (
        <ResultsBlock experiment={exp} />
      )}
    </div>
  );
}

// ---------------- review mode ----------------

function ReviewPanel({ experimentId, angles, onUpdated, onError }) {
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null); // angle being edited
  const [continuing, setContinuing] = useState(false);

  const sortedAngles = useMemo(
    () => [...angles].sort((a, b) => (a.angle_number || 0) - (b.angle_number || 0)),
    [angles],
  );

  function toggle(num) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  async function saveEdit(updatedAngle) {
    onError(null);
    const patched = sortedAngles.map((a) =>
      a.angle_number === updatedAngle.angle_number ? { ...a, ...updatedAngle } : a,
    );
    try {
      await api.patch(`/api/experiments/${experimentId}/angles`, { angles: patched });
      setEditing(null);
      onUpdated();
    } catch (err) {
      onError(err.message);
    }
  }

  async function continueWithSelected() {
    if (selected.size === 0) return;
    onError(null);
    setContinuing(true);
    try {
      await api.post(`/api/experiments/${experimentId}/continue`, {
        selected_angle_numbers: Array.from(selected).sort((a, b) => a - b),
      });
      onUpdated();
    } catch (err) {
      onError(err.message);
    } finally {
      setContinuing(false);
    }
  }

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-amber-900">Revisá los 5 ángulos antes de continuar</h3>
            <p className="text-sm text-amber-800 mt-0.5">
              Editá los que quieras refinar y seleccioná {' '}
              <b>1 a 5</b> para continuar el pipeline (Optimizer → Ogilvy → Scorer).
              Sólo se procesarán los seleccionados — los demás se descartan.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-amber-700">Seleccionados</div>
            <div className="text-2xl font-bold text-amber-900">{selected.size}</div>
          </div>
        </div>

        <div className="space-y-2">
          {sortedAngles.map((a) => (
            <CompactAngleCard
              key={a.angle_number}
              angle={a}
              selected={selected.has(a.angle_number)}
              onToggle={() => toggle(a.angle_number)}
              onEdit={() => setEditing(a)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
          <button
            onClick={continueWithSelected}
            disabled={selected.size === 0 || continuing}
            className="rounded-md bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {continuing
              ? 'Continuando…'
              : selected.size === 0
                ? 'Seleccioná al menos 1 ángulo'
                : `Continuar con ${selected.size} ángulo${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {editing && (
        <AngleEditModal
          angle={editing}
          onSave={saveEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}

function CompactAngleCard({ angle, selected, onToggle, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const cls = CATEGORY_COLOR[angle.category] || 'bg-slate-100 text-slate-600';
  return (
    <div className={`bg-white border rounded-md p-3 transition ${selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 accent-amber-600"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">#{angle.angle_number}</span>
            <span className="font-medium text-slate-900 truncate">{angle.angle_name || '(sin nombre)'}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
              {(angle.category || '').replace(/_/g, ' ')}
            </span>
          </div>
          {angle.insight && !expanded && (
            <div className="text-xs text-slate-500 mt-1 line-clamp-1">{angle.insight}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            {expanded ? 'Ocultar' : 'Ver'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-brand-600 hover:underline"
          >
            Editar
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pl-7 space-y-1 text-sm">
          {angle.insight && <div className="text-slate-700"><b className="text-slate-500">Insight:</b> {angle.insight}</div>}
          {angle.benefit && <div className="text-slate-700"><b className="text-slate-500">Beneficio:</b> {angle.benefit}</div>}
          {angle.evidence && <div className="text-slate-600 italic"><b className="text-slate-500 not-italic">Evidencia:</b> {angle.evidence}</div>}
          {angle.target_emotion && <div className="text-xs text-slate-500"><b>Emoción:</b> {angle.target_emotion}</div>}
        </div>
      )}
    </div>
  );
}

function AngleEditModal({ angle, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    angle_name:     angle.angle_name || '',
    category:       angle.category || '',
    insight:        angle.insight || '',
    benefit:        angle.benefit || '',
    evidence:       angle.evidence || '',
    target_emotion: angle.target_emotion || '',
  });

  function update(k, v) { setDraft((d) => ({ ...d, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    onSave({ angle_number: angle.angle_number, ...draft });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Editar ángulo #{angle.angle_number}
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ModalField label="Nombre del ángulo" value={draft.angle_name} onChange={(v) => update('angle_name', v)} />
          <ModalField label="Categoría" value={draft.category} onChange={(v) => update('category', v)} as="select" options={Object.keys(CATEGORY_COLOR)} />
          <ModalField label="Insight" value={draft.insight} onChange={(v) => update('insight', v)} as="textarea" rows={3} />
          <ModalField label="Beneficio" value={draft.benefit} onChange={(v) => update('benefit', v)} as="textarea" rows={2} />
          <ModalField label="Evidencia" value={draft.evidence} onChange={(v) => update('evidence', v)} as="textarea" rows={2} />
          <ModalField label="Emoción objetivo" value={draft.target_emotion} onChange={(v) => update('target_emotion', v)} />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalField({ label, value, onChange, as = 'input', rows, options }) {
  const cls = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {as === 'textarea' ? (
        <textarea rows={rows || 3} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : as === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">— sin categoría —</option>
          {(options || []).map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}

// ---------------- read-only blocks ----------------

function StepTimeline({ status }) {
  const currentIdx = STEP_ORDER.indexOf(status);
  const entries = Object.entries(STEP_LABELS);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {entries.map(([key, label], i) => {
          const idx = STEP_ORDER.indexOf(key);
          const active = idx === currentIdx;
          const done = currentIdx > idx || status === 'completed';
          const isReview = key === 'awaiting_review';
          const cls = active
            ? (isReview ? 'bg-amber-500 text-white border-amber-500' : 'bg-brand-500 text-white border-brand-500')
            : done
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-50 text-slate-500 border-slate-200';
          return (
            <div key={key} className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded-full border ${cls}`}>{label}</div>
              {i < entries.length - 1 && <div className="w-4 h-px bg-slate-200" />}
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

function AnglesBlock({ angles, selected }) {
  const selSet = new Set(Array.isArray(selected) ? selected : []);
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">1 · Ángulos estratégicos</h3>
      <div className="space-y-2">
        {angles.map((a) => {
          const num = a.angle_number ?? a.id;
          const name = a.angle_name || a.name || a.nombre || `Ángulo ${num}`;
          const isPicked = selSet.has(Number(num));
          return (
            <div key={num} className={`bg-white border rounded-md p-4 ${isPicked ? 'border-emerald-300' : 'border-slate-200 opacity-70'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">#{num}</span>
                  <div className="font-medium text-slate-900">{name}</div>
                  {isPicked && <span className="text-[10px] bg-emerald-600 text-white rounded px-1.5 py-0.5">SELECCIONADO</span>}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {executions.map((ex, i) => (
          <ExecutionCard key={ex.angle_number ?? i} ex={ex} winnerId={winnerId} />
        ))}
      </div>
    </div>
  );
}

function ExecutionCard({ ex, winnerId }) {
  const num = ex.angle_number ?? ex.id;
  const id = `angle_${num}`;
  const isWinner = winnerId === id;

  // v6: array `creatives` por (platform, format).
  // Fallback v5/v4/v3: armar un creative single con los campos sueltos.
  const creatives = Array.isArray(ex.creatives) && ex.creatives.length > 0
    ? ex.creatives
    : [{
        platform:        'Anuncio',
        format:          null,
        aspect_ratio:    null,
        post_copy:       ex.post_copy || ex.body_copy || null,
        visual:          ex.visual || ex.visual_concept || {},
        overlay_text:    ex.overlay_text || null,
        cta_button:      ex.cta_button || ex.cta?.button_text || ex.cta?.text || null,
        headline:        ex.headline || null,
        description:     ex.description || null,
        system_cta_type: ex.system_cta_type || ex.cta?.action || ex.cta?.type || null,
      }];

  return (
    <div className={`rounded-lg p-4 border ${isWinner ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'} space-y-3`}>
      {/* Header del ángulo */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">#{num}</span>
          {ex.template_used && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{ex.template_used}</span>
          )}
          {ex.tone && <span className="text-[10px] text-slate-500 italic">{ex.tone}</span>}
          <span className="text-[10px] text-slate-400">· {creatives.length} creativo{creatives.length > 1 ? 's' : ''}</span>
        </div>
        {isWinner && <span className="text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5">Ganador</span>}
      </div>

      {ex.big_idea && (
        <div className="text-xs italic text-slate-600 border-l-2 border-slate-300 pl-2">
          {ex.big_idea}
        </div>
      )}

      {/* Una mockup card por creative */}
      <div className="space-y-3">
        {creatives.map((c, i) => (
          <CreativeMockup key={`${c.platform}-${c.format}-${i}`} creative={c} />
        ))}
      </div>

      {/* Hashtags + tone */}
      {ex.hashtags && (
        <div className="text-xs text-brand-600">
          {(Array.isArray(ex.hashtags) ? ex.hashtags : []).map((h) => '#' + String(h).replace(/^#/, '')).join(' ')}
        </div>
      )}
    </div>
  );
}

const CHANNEL_RULES = {
  'facebook|feed':       { post: [40, 80, 125] },
  'instagram|feed':      { post: [100, 150, 200] },
  'linkedin|feed':       { post: [200, 400, 600] },
  'facebook|stories':    { post: null },
  'instagram|stories':   { post: null },
  'instagram|carousel':  { post: [80, 150, 220] },
  'instagram|reel':      { post: [40, 100, 150] },
  'tiktok|video':        { post: [40, 100, 150] },
  'tiktok|feed':         { post: [40, 100, 150] },
  'twitter|feed':        { post: [120, 260, 280] },
  'youtube|video':       { post: [60, 200, 300] },
};

function CreativeMockup({ creative }) {
  const c = creative;
  const platformKey = String(c.platform || '').toLowerCase();
  const formatKey = String(c.format || '').toLowerCase();
  const isVertical = c.aspect_ratio === '9:16' || formatKey === 'stories' || formatKey === 'reel';
  const visual = c.visual || {};
  const overlay = c.overlay_text || null;

  const postRule = CHANNEL_RULES[`${platformKey}|${formatKey}`]?.post;
  const len = c.post_copy ? c.post_copy.length : 0;
  let postStatus = null;
  if (postRule && c.post_copy) {
    const [lo, hi, max] = postRule;
    postStatus = len > max
      ? { color: 'text-red-600', label: 'fuera de rango' }
      : len < lo
        ? { color: 'text-amber-600', label: 'corto' }
        : len > hi
          ? { color: 'text-amber-600', label: 'largo' }
          : { color: 'text-emerald-600', label: 'óptimo' };
  }

  const pillCls = PLATFORM_PILL[platformKey] || 'bg-slate-100 text-slate-700';

  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">

      {/* Tab del creativo */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pillCls}`}>
            {c.platform}
          </span>
          {c.format && (
            <span className="text-[10px] text-slate-500">{c.format}</span>
          )}
          {c.aspect_ratio && (
            <span className="text-[10px] text-slate-400 font-mono">{c.aspect_ratio}</span>
          )}
        </div>
        {c.post_copy && (
          <div className="text-[10px] font-mono text-slate-500">
            post: {len}c
            {postStatus && <span className={`ml-1 ${postStatus.color}`}>· {postStatus.label}</span>}
          </div>
        )}
      </div>

      {/* 1. POST COPY */}
      {c.post_copy && (
        <div className="px-3 pt-3 pb-2 text-sm text-slate-800 whitespace-pre-wrap">
          {c.post_copy}
        </div>
      )}

      {/* 2-4. IMAGEN (con overlay y cta button) */}
      <div className={`bg-gradient-to-br from-slate-100 to-slate-200 border-y border-slate-200 flex flex-col items-center justify-center relative ${isVertical ? 'aspect-[9/16] min-h-[280px]' : 'min-h-[150px] p-4'}`}>
        {overlay?.primary && (
          <div className="text-center mb-2 px-4">
            <div className={`font-bold text-slate-900 leading-tight ${isVertical ? 'text-lg' : 'text-base'}`}>
              {overlay.primary}
            </div>
            {overlay.secondary && (
              <div className="text-xs text-slate-600 mt-1">{overlay.secondary}</div>
            )}
          </div>
        )}
        {c.cta_button && (
          <div className="mt-2 inline-block px-4 py-2 rounded bg-brand-600 text-white text-xs font-semibold">
            {c.cta_button}
          </div>
        )}
        <div className="absolute top-1.5 right-1.5 text-[9px] text-slate-400 uppercase tracking-wide">
          Imagen
        </div>
      </div>

      {/* 5. HEADLINE + DESCRIPTION (sólo si el formato lo soporta) */}
      {(c.headline || c.description || c.system_cta_type) && (
        <div className="px-3 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex-1 min-w-0">
            {c.headline && (
              <div className="font-semibold text-slate-900 text-sm leading-tight truncate">
                {c.headline}
              </div>
            )}
            {c.description && (
              <div className="text-xs text-slate-600 truncate">{c.description}</div>
            )}
          </div>
          {c.system_cta_type && (
            <button type="button" className="text-xs px-3 py-1.5 rounded bg-slate-700 text-white whitespace-nowrap pointer-events-none">
              {c.system_cta_type}
            </button>
          )}
        </div>
      )}

      {/* Brief visual (collapsible) */}
      {(visual.main_subject || visual.main_visual || visual.scene || visual.background || visual.color_palette || visual.colors) && (
        <details className="text-xs px-3 py-2 border-t border-slate-100">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800 select-none">
            Brief visual
          </summary>
          <div className="mt-2 space-y-1 text-slate-600 bg-slate-50 rounded p-2">
            <Line label="Sujeto"   value={visual.main_subject || visual.main_visual} />
            <Line label="Escena"   value={visual.scene || visual.background} />
            <Line label="Paleta"   value={visual.color_palette || visual.colors} />
            <Line label="Estilo"   value={visual.style} />
            <Line label="Gráficos" value={visual.graphic_elements} />
            <Line label="Mood"     value={visual.mood} />
            <Line label="Persona"  value={visual.person} />
          </div>
        </details>
      )}
    </div>
  );
}

function Line({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-16 flex-shrink-0">{label}</span>
      <span className="flex-1">{value}</span>
    </div>
  );
}

function PostCopySection({ text, variants }) {
  if (variants && variants.length > 0) {
    return <CopyVariants variants={variants} />;
  }
  return <div className="whitespace-pre-wrap">{text}</div>;
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

function val(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v.score ?? null;
  return v;
}

// ---------------- Resultados de campaña post-launch ----------------

function ResultsBlock({ experiment }) {
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { results } = await api.get(`/api/experiments/${experiment.id}/results`);
      setResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [experiment.id]);

  async function handleSave(formData) {
    setError(null);
    const body = normalizeForSubmit(formData);
    try {
      if (editing && editing.id) {
        await api.put(`/api/experiments/${experiment.id}/results/${editing.id}`, body);
      } else {
        await api.post(`/api/experiments/${experiment.id}/results`, body);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(r) {
    if (!confirm(`¿Eliminar este resultado (${r.challenger_id} en ${r.platform})?`)) return;
    try {
      await api.del(`/api/experiments/${experiment.id}/results/${r.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-700">Resultados de campaña (post-launch)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cargá las métricas reales una vez que el challenger se haya corrido en producción. Cerramos el loop entre lo que el Scorer predijo y lo que pasó.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_RESULT, challenger_id: experiment.winner_id || '' })}
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-md whitespace-nowrap"
        >
          Cargar resultados
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}

      {loading ? (
        <div className="text-xs text-slate-500">Cargando…</div>
      ) : !results || results.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500">
          Aún no cargaste métricas reales. El sistema va a comparar predicted_score vs actual cuando lo hagas.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Challenger</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-right">Impres.</th>
                <th className="px-3 py-2 text-right">Clicks</th>
                <th className="px-3 py-2 text-right">CTR</th>
                <th className="px-3 py-2 text-right">CVR</th>
                <th className="px-3 py-2 text-right">CPA</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right">Predicción</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => {
                const delta = (r.actual_performance_score != null && r.predicted_score != null)
                  ? Number(r.actual_performance_score) - Number(r.predicted_score)
                  : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{r.challenger_id}</td>
                    <td className="px-3 py-2 text-slate-600">{r.platform}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtIntR(r.impressions)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtIntR(r.clicks)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtPctR(r.ctr)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtPctR(r.conversion_rate)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtMoneyR(r.cpa, r.currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtMoneyR(r.budget_spent, r.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">{r.predicted_score ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.actual_performance_score != null ? (
                        <span className={delta == null ? 'text-slate-700' : delta >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {Number(r.actual_performance_score).toFixed(1)}
                          {delta != null && (
                            <span className="text-[10px] ml-1">
                              ({delta >= 0 ? '+' : ''}{delta.toFixed(1)})
                            </span>
                          )}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right space-x-3">
                      <button onClick={() => setEditing(r)} className="text-xs text-brand-600 hover:underline">Editar</button>
                      <button onClick={() => handleDelete(r)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ResultEntryModal
          initial={editing}
          isNew={!editing.id}
          experiment={experiment}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  );
}

const EMPTY_RESULT = {
  challenger_id:            '',
  platform:                 '',
  impressions:              '',
  clicks:                   '',
  ctr:                      '',
  conversions:              '',
  conversion_rate:          '',
  cpc:                      '',
  cpa:                      '',
  budget_spent:             '',
  currency:                 'USD',
  campaign_duration_days:   '',
  actual_performance_score: '',
  notes:                    '',
};

function ResultEntryModal({ initial, isNew, experiment, onSave, onCancel }) {
  const [form, setForm] = useState({ ...initial });

  // Opciones del dropdown: cada execution del experimento → angle_N
  const challengerOptions = useMemo(() => {
    const exs = Array.isArray(experiment.executions) ? experiment.executions : [];
    return exs.map((ex) => {
      const num = ex.angle_number ?? ex.id;
      const angle = (Array.isArray(experiment.angles) ? experiment.angles : [])
        .find((a) => a.angle_number === num);
      const name = angle?.angle_name || ex.big_idea || `Ángulo ${num}`;
      return { id: `angle_${num}`, label: `Ángulo #${num} · ${name}` };
    });
  }, [experiment]);

  const platformOptions = useMemo(() => {
    const channels = Array.isArray(experiment.channels) ? experiment.channels : [];
    const set = new Set(channels.map((c) => c.platform));
    return Array.from(set);
  }, [experiment]);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Auto-cómputo: si cambian impressions o clicks, calcular CTR.
  function autoCompute(next) {
    const ni = Number(next.impressions);
    const nc = Number(next.clicks);
    if (Number.isFinite(ni) && Number.isFinite(nc) && ni > 0) {
      next.ctr = (nc / ni).toFixed(4);
    }
    const ncv = Number(next.conversions);
    if (Number.isFinite(nc) && Number.isFinite(ncv) && nc > 0) {
      next.conversion_rate = (ncv / nc).toFixed(4);
    }
    if (Number.isFinite(ncv) && ncv > 0 && Number.isFinite(Number(next.budget_spent))) {
      next.cpa = (Number(next.budget_spent) / ncv).toFixed(2);
    }
    if (Number.isFinite(nc) && nc > 0 && Number.isFinite(Number(next.budget_spent))) {
      next.cpc = (Number(next.budget_spent) / nc).toFixed(2);
    }
    return next;
  }

  function updateAuto(k, v) {
    setForm((f) => autoCompute({ ...f, [k]: v }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.challenger_id || !form.platform) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-lg w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'Cargar resultado de campaña' : 'Editar resultado'}
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalField label="Challenger lanzado" required>
              <select required value={form.challenger_id} onChange={(e) => update('challenger_id', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— elegir —</option>
                {challengerOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </ModalField>

            <ModalField label="Plataforma" required>
              <select required value={form.platform} onChange={(e) => update('platform', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— elegir —</option>
                {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </ModalField>
          </div>

          <fieldset className="border border-slate-200 rounded-md p-4 space-y-3">
            <legend className="text-xs uppercase tracking-wide text-slate-500 px-2">Performance</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumFieldR label="Impresiones"     value={form.impressions}     onChange={(v) => updateAuto('impressions', v)}     step="1" />
              <NumFieldR label="Clicks"          value={form.clicks}          onChange={(v) => updateAuto('clicks', v)}          step="1" />
              <NumFieldR label="Conversiones"    value={form.conversions}     onChange={(v) => updateAuto('conversions', v)}     step="1" />
              <NumFieldR label="Budget gastado"  value={form.budget_spent}    onChange={(v) => updateAuto('budget_spent', v)}    step="0.01" />
              <NumFieldR label="CTR (auto)"      value={form.ctr}             onChange={(v) => update('ctr', v)}                 step="0.0001" max="1" />
              <NumFieldR label="CVR (auto)"      value={form.conversion_rate} onChange={(v) => update('conversion_rate', v)}     step="0.0001" max="1" />
              <NumFieldR label="CPC (auto)"      value={form.cpc}             onChange={(v) => update('cpc', v)}                 step="0.01" />
              <NumFieldR label="CPA (auto)"      value={form.cpa}             onChange={(v) => update('cpa', v)}                 step="0.01" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-600">
                Moneda
                <input type="text" value={form.currency || 'USD'} maxLength={3}
                       onChange={(e) => update('currency', e.target.value.toUpperCase())}
                       className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm w-16 uppercase font-mono" />
              </label>
              <label className="text-xs text-slate-600">
                Días en aire
                <input type="number" value={form.campaign_duration_days ?? ''} step="1" min="0"
                       onChange={(e) => update('campaign_duration_days', e.target.value)}
                       className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm w-20 font-mono" />
              </label>
            </div>
          </fieldset>

          <ModalField
            label="Tu evaluación de performance (0-10, opcional)"
            hint="Score subjetivo del campaign manager. Lo comparamos con el predicted_score que calculó el Scorer para medir calibración."
          >
            <input type="number" value={form.actual_performance_score ?? ''} step="0.5" min="0" max="10"
                   onChange={(e) => update('actual_performance_score', e.target.value)}
                   className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
          </ModalField>

          <ModalField label="Notas">
            <textarea rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Aprendizajes, problemas operativos, observaciones del público real, etc." />
          </ModalField>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancelar</button>
          <button type="submit" className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function ModalField({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      {children}
    </label>
  );
}

function NumFieldR({ label, value, onChange, step, max }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input type="number" value={value ?? ''} step={step} min={0} max={max}
             onChange={(e) => onChange(e.target.value)}
             className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono" />
    </label>
  );
}

function fmtIntR(n)      { return n != null ? Number(n).toLocaleString('es-AR') : '—'; }
function fmtPctR(n)      { return n != null ? `${(Number(n) * 100).toFixed(2)}%` : '—'; }
function fmtMoneyR(n, c) { return n != null ? `${c || 'USD'} ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }

function normalizeForSubmit(f) {
  const out = { ...f };
  ['impressions', 'clicks', 'ctr', 'conversions', 'conversion_rate', 'cpc', 'cpa',
   'budget_spent', 'campaign_duration_days', 'actual_performance_score']
    .forEach((k) => {
      if (out[k] === '' || out[k] == null) out[k] = null;
      else out[k] = Number(out[k]);
    });
  if (!out.notes) out.notes = null;
  return out;
}

// Reglas de longitud por canal — para flaggear variantes que se pasan.
const COPY_LENGTH_RULES = {
  'facebook|feed':    { ideal: [40, 80],   max: 125 },
  'instagram|feed':   { ideal: [100, 150], max: 125 }, // cutoff "Ver más"
  'linkedin|feed':    { ideal: [200, 400], max: 600 },
  'facebook|stories': { ideal: [10, 50],   max: 80 },
  'instagram|stories':{ ideal: [10, 50],   max: 80 },
  'instagram|carousel':{ ideal: [80, 150], max: 200 },
  'tiktok|video':     { ideal: [40, 100],  max: 150 },
  'youtube|video':    { ideal: [60, 200],  max: 300 },
  'twitter|feed':     { ideal: [120, 260], max: 280 },
};

const PLATFORM_PILL = {
  facebook:  'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  linkedin:  'bg-sky-100 text-sky-700',
  tiktok:    'bg-fuchsia-100 text-fuchsia-700',
  youtube:   'bg-red-100 text-red-700',
  twitter:   'bg-slate-200 text-slate-700',
  google:    'bg-emerald-100 text-emerald-700',
};

function CopyVariants({ variants }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">Body copy por canal</div>
      {variants.map((v, i) => {
        const platformKey = String(v.platform || '').toLowerCase();
        const formatKey = String(v.format || '').toLowerCase();
        const ruleKey = `${platformKey}|${formatKey}`;
        const rule = COPY_LENGTH_RULES[ruleKey];
        const len = v.char_count ?? (v.body || '').length;
        const status = rule
          ? len > rule.max
            ? { color: 'text-red-600', label: 'fuera de rango' }
            : len < rule.ideal[0]
              ? { color: 'text-amber-600', label: 'corto' }
              : len > rule.ideal[1]
                ? { color: 'text-amber-600', label: 'largo' }
                : { color: 'text-emerald-600', label: 'óptimo' }
          : null;
        const pillCls = PLATFORM_PILL[platformKey] || 'bg-slate-100 text-slate-700';
        return (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded p-2.5 text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pillCls}`}>
                  {v.platform}
                </span>
                {v.format && (
                  <span className="text-[10px] text-slate-500">{v.format}</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {len} chars
                {status && (
                  <span className={`ml-1.5 ${status.color}`}>· {status.label}</span>
                )}
              </div>
            </div>
            <div className="text-slate-700 whitespace-pre-wrap">{v.body}</div>
          </div>
        );
      })}
    </div>
  );
}
