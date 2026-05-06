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
  const [briefs, setBriefs] = useState([]);
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

  async function loadBriefs() {
    try {
      const { briefs } = await api.get(`/api/experiments/${id}/briefs`);
      setBriefs(briefs);
    } catch {/* silencio: si el endpoint no existe en algún env, no bloquear */}
  }

  useEffect(() => {
    load();
    loadBriefs();
  }, [id]);

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
            <>
              <a
                href={`/experiments/${exp.id}/export`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Exportar PDF
              </a>
              <button
                onClick={run}
                disabled={running}
                className="rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm"
              >
                Re-generar ángulos
              </button>
            </>
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
          {exp.executions && (
            <ExecutionsBlock
              executions={exp.executions}
              winnerId={exp.winner_id}
              experimentId={exp.id}
              briefs={briefs}
              onBriefsChange={async () => { await load(); await loadBriefs(); }}
            />
          )}
          {exp.scores            && <ScoresBlock      scores={exp.scores} winnerId={exp.winner_id} champion={exp.champion_score} />}
        </div>
      </section>

      {exp.usage && Array.isArray(exp.usage.skills) && exp.usage.skills.length > 0 && (
        <UsagePanel usage={exp.usage} />
      )}

      {exp.status === 'completed' && (
        <ResultsBlock experiment={exp} />
      )}
    </div>
  );
}

function UsagePanel({ usage }) {
  const skills = usage.skills || [];
  const totalCost = skills.reduce((s, x) => s + (Number(x.cost_usd) || 0), 0);
  const totalInput = skills.reduce((s, x) => s + (x.input_tokens || 0) + (x.cache_creation_input_tokens || 0) + (x.cache_read_input_tokens || 0), 0);
  const totalOutput = skills.reduce((s, x) => s + (x.output_tokens || 0), 0);
  const totalCacheRead = skills.reduce((s, x) => s + (x.cache_read_input_tokens || 0), 0);
  const cachePct = totalInput > 0 ? (totalCacheRead / totalInput) * 100 : 0;

  return (
    <details className="bg-white border border-slate-200 rounded-lg p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-700 select-none flex items-center justify-between">
        <span>Costo API de este experimento</span>
        <span className="text-slate-500 font-mono text-xs">
          USD {totalCost.toFixed(4)} · {(totalInput + totalOutput).toLocaleString('es-AR')} tokens · {cachePct.toFixed(1)}% cache hit
        </span>
      </summary>
      <table className="w-full text-xs mt-3">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1.5 text-left">Skill</th>
            <th className="px-2 py-1.5 text-left">Modelo</th>
            <th className="px-2 py-1.5 text-right">Input</th>
            <th className="px-2 py-1.5 text-right">Output</th>
            <th className="px-2 py-1.5 text-right">Cache read</th>
            <th className="px-2 py-1.5 text-right">Cache write</th>
            <th className="px-2 py-1.5 text-right">Costo USD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {skills.map((s, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5 font-mono">{s.skill_name}</td>
              <td className="px-2 py-1.5 font-mono">{s.model}</td>
              <td className="px-2 py-1.5 text-right">{(s.input_tokens || 0).toLocaleString('es-AR')}</td>
              <td className="px-2 py-1.5 text-right">{(s.output_tokens || 0).toLocaleString('es-AR')}</td>
              <td className="px-2 py-1.5 text-right text-emerald-600">{(s.cache_read_input_tokens || 0).toLocaleString('es-AR')}</td>
              <td className="px-2 py-1.5 text-right">{(s.cache_creation_input_tokens || 0).toLocaleString('es-AR')}</td>
              <td className="px-2 py-1.5 text-right font-semibold">{Number(s.cost_usd || 0).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
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

function ExecutionsBlock({ executions, winnerId, experimentId, briefs, onBriefsChange }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-2">3 · Ejecuciones creativas</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {executions.map((ex, i) => (
          <ExecutionCard
            key={ex.angle_number ?? i}
            ex={ex}
            winnerId={winnerId}
            experimentId={experimentId}
            briefs={briefs}
            onBriefsChange={onBriefsChange}
          />
        ))}
      </div>
    </div>
  );
}

function ExecutionCard({ ex, winnerId, experimentId, briefs, onBriefsChange }) {
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
        {creatives.map((c, i) => {
          const briefForThis = (briefs || []).find((b) =>
            b.angle_number === num &&
            String(b.platform).toLowerCase() === String(c.platform).toLowerCase() &&
            String(b.format).toLowerCase()   === String(c.format).toLowerCase()
          );
          return (
            <CreativeMockup
              key={`${c.platform}-${c.format}-${i}`}
              creative={c}
              experimentId={experimentId}
              angleNumber={num}
              isWinner={isWinner}
              brief={briefForThis}
              onBriefsChange={onBriefsChange}
            />
          );
        })}
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

function CreativeMockup({ creative, experimentId, angleNumber, isWinner, brief, onBriefsChange }) {
  const c = creative;
  const [editing, setEditing] = useState(false);
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

  if (editing && isWinner) {
    return (
      <CreativeEditPanel
        creative={c}
        experimentId={experimentId}
        angleNumber={angleNumber}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          // El parent se refresca via onBriefsChange — ese callback dispara
          // load() del experiment Y loadBriefs() en el componente padre.
          if (onBriefsChange) await onBriefsChange();
        }}
      />
    );
  }

  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">

      {/* Tab del creativo */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${pillCls}`}>
            {c.platform}
          </span>
          {c.format && (
            <span className="text-[10px] text-slate-500">
              <span className="text-slate-400">native:</span> {c.format}
            </span>
          )}
          {c.aspect_ratio && (
            <span className="text-[10px] text-slate-400 font-mono">{c.aspect_ratio}</span>
          )}
          {c.is_edited && (
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
              editado
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {c.post_copy && (
            <div className="text-[10px] font-mono text-slate-500">
              post: {len}c
              {postStatus && <span className={`ml-1 ${postStatus.color}`}>· {postStatus.label}</span>}
            </div>
          )}
          {isWinner && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-brand-600 hover:underline"
            >
              Editar
            </button>
          )}
        </div>
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
            Brief visual (Ogilvy)
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

      {/* Brief de imagen (sólo en el winner) */}
      {isWinner && experimentId && (
        <ImageBriefPanel
          experimentId={experimentId}
          angleNumber={angleNumber}
          platform={c.platform}
          format={c.format}
          existingBrief={brief}
          onBriefsChange={onBriefsChange}
        />
      )}
    </div>
  );
}

function ImageBriefPanel({ experimentId, angleNumber, platform, format, existingBrief, onBriefsChange }) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const brief = existingBrief?.brief?.image_brief || null;
  const dirty = draft != null;

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      await api.post(`/api/experiments/${experimentId}/briefs`, {
        angle_number: angleNumber,
        platform,
        format,
      });
      if (onBriefsChange) await onBriefsChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setError(null);
    try {
      await api.put(`/api/experiments/${experimentId}/briefs/${existingBrief.id}`, {
        brief: { image_brief: draft },
      });
      setDraft(null);
      setEditing(false);
      if (onBriefsChange) await onBriefsChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopy() {
    const text = (dirty ? draft : brief)?.final_nano_banana_prompt || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(brief)));
    setEditing(true);
  }
  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }
  function patch(path, value) {
    setDraft((d) => {
      const next = JSON.parse(JSON.stringify(d));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] == null) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }

  if (!brief) {
    return (
      <div className="border-t border-slate-100 px-3 py-3 bg-emerald-50/30">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <b className="text-slate-700">Brief para imagen final</b>
            <div className="text-[11px] text-slate-500">~$0.005 por brief (Haiku) · editable antes de generar la imagen</div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 whitespace-nowrap"
          >
            {generating ? 'Generando…' : 'Preparar brief'}
          </button>
        </div>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>
    );
  }

  const view = dirty ? draft : brief;

  return (
    <details open className="border-t border-slate-100 px-3 py-3 bg-emerald-50/30 text-xs">
      <summary className="cursor-pointer flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">Brief para imagen final</span>
          {existingBrief?.is_edited && (
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">editado</span>
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button onClick={(e) => { e.preventDefault(); startEdit(); }} className="text-brand-600 hover:underline">
              Editar
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); handleGenerate(); }}
            disabled={generating}
            className="text-slate-500 hover:underline disabled:opacity-50"
          >
            {generating ? 'Regenerando…' : 'Regenerar'}
          </button>
        </div>
      </summary>

      <div className="mt-3 space-y-3">
        {/* Resumen narrativo */}
        <BriefField
          label="Scene description"
          value={view.scene_description}
          editing={editing}
          multiline
          onChange={(v) => patch('scene_description', v)}
        />

        {/* Sujeto */}
        <BriefSection title="Sujeto">
          <BriefField label="Quién/qué"   value={view.subject?.who_what}   editing={editing} multiline onChange={(v) => patch('subject.who_what', v)} />
          <BriefField label="Pose"        value={view.subject?.pose}       editing={editing} onChange={(v) => patch('subject.pose', v)} />
          <BriefField label="Expresión"   value={view.subject?.expression} editing={editing} onChange={(v) => patch('subject.expression', v)} />
          <BriefField label="Vestimenta"  value={view.subject?.attire}     editing={editing} onChange={(v) => patch('subject.attire', v)} />
        </BriefSection>

        {/* Entorno */}
        <BriefSection title="Entorno">
          <BriefField label="Setting" value={view.environment?.setting} editing={editing} multiline onChange={(v) => patch('environment.setting', v)} />
          <BriefField label="Depth"   value={view.environment?.depth}   editing={editing} onChange={(v) => patch('environment.depth', v)} />
          <BriefField label="Props"   value={view.environment?.props}   editing={editing} onChange={(v) => patch('environment.props', v)} />
        </BriefSection>

        {/* Técnicos */}
        <BriefSection title="Técnicos">
          <BriefField label="Composición" value={view.composition} editing={editing} onChange={(v) => patch('composition', v)} />
          <BriefField label="Lighting"    value={view.lighting}    editing={editing} multiline onChange={(v) => patch('lighting', v)} />
          <BriefField label="Style"       value={view.style}       editing={editing} onChange={(v) => patch('style', v)} />
          <BriefField label="Camera"      value={view.camera}      editing={editing} onChange={(v) => patch('camera', v)} />
          <BriefField
            label="Color palette"
            value={Array.isArray(view.color_palette) ? view.color_palette.join(' · ') : view.color_palette}
            editing={editing}
            onChange={(v) => patch('color_palette', v.split(/\s*·\s*|\s*,\s*/).filter(Boolean))}
          />
          <BriefField label="Aspect ratio" value={view.aspect_ratio} editing={editing} onChange={(v) => patch('aspect_ratio', v)} />
        </BriefSection>

        {/* Overlay & CTA */}
        <BriefSection title="Overlay text & CTA">
          <BriefField label="Primary text"     value={view.overlay_specs?.primary_text}       editing={editing} onChange={(v) => patch('overlay_specs.primary_text', v)} />
          <BriefField label="Primary position" value={view.overlay_specs?.primary_position}   editing={editing} onChange={(v) => patch('overlay_specs.primary_position', v)} />
          <BriefField label="Primary typo"     value={view.overlay_specs?.primary_typography} editing={editing} onChange={(v) => patch('overlay_specs.primary_typography', v)} />
          <BriefField label="Secondary text"   value={view.overlay_specs?.secondary_text}     editing={editing} onChange={(v) => patch('overlay_specs.secondary_text', v)} />
          <BriefField label="CTA text"         value={view.overlay_specs?.cta_button?.text}     editing={editing} onChange={(v) => patch('overlay_specs.cta_button.text', v)} />
          <BriefField label="CTA position"     value={view.overlay_specs?.cta_button?.position} editing={editing} onChange={(v) => patch('overlay_specs.cta_button.position', v)} />
          <BriefField label="CTA color"        value={view.overlay_specs?.cta_button?.color}    editing={editing} onChange={(v) => patch('overlay_specs.cta_button.color', v)} />
          <BriefField label="CTA shape"        value={view.overlay_specs?.cta_button?.shape}    editing={editing} onChange={(v) => patch('overlay_specs.cta_button.shape', v)} />
        </BriefSection>

        <BriefField
          label="Negative prompts"
          value={view.negative_prompts}
          editing={editing}
          multiline
          onChange={(v) => patch('negative_prompts', v)}
        />

        {/* final prompt para Nano Banana */}
        <div className="bg-white border border-emerald-300 rounded p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Prompt final para Nano Banana</span>
            <button
              onClick={handleCopy}
              className="text-[11px] text-emerald-700 hover:underline"
            >
              {copied ? '✓ Copiado' : 'Copiar prompt'}
            </button>
          </div>
          {editing ? (
            <textarea
              rows={6}
              value={view.final_nano_banana_prompt || ''}
              onChange={(e) => patch('final_nano_banana_prompt', e.target.value)}
              className="w-full font-mono text-[11px] border border-slate-300 rounded p-2"
            />
          ) : (
            <p className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
              {view.final_nano_banana_prompt || '(sin prompt generado)'}
            </p>
          )}
        </div>

        {error && <div className="text-red-600">{error}</div>}

        {editing && (
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelEdit} className="text-slate-600 hover:underline">Cancelar</button>
            <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded">
              Guardar cambios
            </button>
          </div>
        )}

        {existingBrief?.cost_usd != null && !editing && (
          <div className="text-[10px] text-slate-400 text-right">
            Generado con {existingBrief.generated_by_model} · USD {Number(existingBrief.cost_usd).toFixed(4)}
          </div>
        )}
      </div>
    </details>
  );
}

function BriefSection({ title, children }) {
  return (
    <div className="border border-slate-200 bg-white rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BriefField({ label, value, editing, multiline, onChange }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-slate-500 text-[11px] pt-0.5">{label}</span>
      {editing ? (
        multiline ? (
          <textarea
            rows={2}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 w-full"
          />
        ) : (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 w-full"
          />
        )
      ) : (
        <span className="text-slate-700 break-words">
          {value || <i className="text-slate-400">—</i>}
        </span>
      )}
    </div>
  );
}

function CreativeEditPanel({ creative, experimentId, angleNumber, onCancel, onSaved }) {
  const c = creative;
  const [draft, setDraft] = useState({
    post_copy:       c.post_copy ?? '',
    headline:        c.headline ?? '',
    description:     c.description ?? '',
    cta_button:      c.cta_button ?? '',
    system_cta_type: c.system_cta_type ?? '',
    overlay_text: {
      primary:   c.overlay_text?.primary   ?? '',
      secondary: c.overlay_text?.secondary ?? '',
    },
    visual: {
      main_subject:     c.visual?.main_subject     ?? '',
      scene:            c.visual?.scene            ?? '',
      color_palette:    c.visual?.color_palette    ?? '',
      style:            c.visual?.style            ?? '',
      graphic_elements: c.visual?.graphic_elements ?? '',
      mood:             c.visual?.mood             ?? '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(k, v) { setDraft((d) => ({ ...d, [k]: v })); }
  function setOverlay(k, v) { setDraft((d) => ({ ...d, overlay_text: { ...d.overlay_text, [k]: v } })); }
  function setVisual(k, v)  { setDraft((d) => ({ ...d, visual: { ...d.visual, [k]: v } })); }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const edits = {
        post_copy:       draft.post_copy.trim() || null,
        headline:        draft.headline.trim() || null,
        description:     draft.description.trim() || null,
        cta_button:      draft.cta_button.trim() || null,
        system_cta_type: draft.system_cta_type.trim() || null,
        overlay_text: {
          primary:   draft.overlay_text.primary.trim() || null,
          secondary: draft.overlay_text.secondary.trim() || null,
        },
        visual: { ...draft.visual },
      };
      await api.patch(`/api/experiments/${experimentId}/creative-edit`, {
        angle_number: angleNumber,
        platform:     c.platform,
        format:       c.format,
        edits,
      });
      if (onSaved) await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-amber-300 rounded-md bg-amber-50/40 overflow-hidden">
      <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between">
        <div className="text-xs font-medium text-amber-900">
          Editando creative · {c.platform} {c.format}
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={onCancel} disabled={saving} className="text-slate-700 hover:underline">Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3 text-xs">
        <EditField label="Post copy (texto sobre el aviso)" multiline rows={4}
          value={draft.post_copy} onChange={(v) => set('post_copy', v)} />

        <div className="grid grid-cols-2 gap-3">
          <EditField label="Headline (debajo de imagen)"
            value={draft.headline} onChange={(v) => set('headline', v)} />
          <EditField label="Description (debajo del headline)"
            value={draft.description} onChange={(v) => set('description', v)} />
        </div>

        <fieldset className="border border-slate-200 rounded p-3 space-y-2 bg-white">
          <legend className="text-[10px] uppercase tracking-wide text-slate-500 px-1">Overlay text (sobre la imagen)</legend>
          <EditField label="Primary"
            value={draft.overlay_text.primary} onChange={(v) => setOverlay('primary', v)} />
          <EditField label="Secondary (opcional)"
            value={draft.overlay_text.secondary} onChange={(v) => setOverlay('secondary', v)} />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <EditField label="CTA button (texto en la imagen)"
            value={draft.cta_button} onChange={(v) => set('cta_button', v)} />
          <EditField label="System CTA (Sign Up / Learn More / etc)"
            value={draft.system_cta_type} onChange={(v) => set('system_cta_type', v)} />
        </div>

        <fieldset className="border border-slate-200 rounded p-3 space-y-2 bg-white">
          <legend className="text-[10px] uppercase tracking-wide text-slate-500 px-1">Brief visual (Ogilvy)</legend>
          <EditField label="Sujeto principal" multiline rows={2}
            value={draft.visual.main_subject} onChange={(v) => setVisual('main_subject', v)} />
          <EditField label="Escena / fondo" multiline rows={2}
            value={draft.visual.scene} onChange={(v) => setVisual('scene', v)} />
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Paleta"  value={draft.visual.color_palette} onChange={(v) => setVisual('color_palette', v)} />
            <EditField label="Estilo"  value={draft.visual.style} onChange={(v) => setVisual('style', v)} />
            <EditField label="Mood"    value={draft.visual.mood} onChange={(v) => setVisual('mood', v)} />
            <EditField label="Gráficos" value={draft.visual.graphic_elements} onChange={(v) => setVisual('graphic_elements', v)} />
          </div>
        </fieldset>

        {error && <div className="text-red-600">{error}</div>}
        <div className="text-[10px] text-slate-500 italic">
          Si tenés un brief de imagen ya generado, regeneralo después de guardar para que refleje tus cambios.
        </div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange, multiline, rows }) {
  const cls = 'mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs';
  return (
    <label className="block">
      <span className="text-[11px] text-slate-600">{label}</span>
      {multiline ? (
        <textarea rows={rows || 2} value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
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
            <ResultModalField label="Challenger lanzado" required>
              <select required value={form.challenger_id} onChange={(e) => update('challenger_id', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— elegir —</option>
                {challengerOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </ResultModalField>

            <ResultModalField label="Plataforma" required>
              <select required value={form.platform} onChange={(e) => update('platform', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— elegir —</option>
                {platformOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </ResultModalField>
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

          <ResultModalField
            label="Tu evaluación de performance (0-10, opcional)"
            hint="Score subjetivo del campaign manager. Lo comparamos con el predicted_score que calculó el Scorer para medir calibración."
          >
            <input type="number" value={form.actual_performance_score ?? ''} step="0.5" min="0" max="10"
                   onChange={(e) => update('actual_performance_score', e.target.value)}
                   className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm font-mono" />
          </ResultModalField>

          <ResultModalField label="Notas">
            <textarea rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Aprendizajes, problemas operativos, observaciones del público real, etc." />
          </ResultModalField>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancelar</button>
          <button type="submit" className="rounded-md bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function ResultModalField({ label, required, hint, children }) {
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

// Reglas de longitud por canal — basadas en best practices reales de cada
// plataforma, no en el límite duro del API.
// - facebook|feed: cutoff "Ver más" en ~125c, pero hasta ~200c todavía rinde
// - instagram|feed: cutoff "Ver más" en ~125c, ideal 70-150c, hasta ~220c OK
// - linkedin|feed: long-form storytelling (200-1500c) rinde alto; max 2000c
// - stories: overlay visual, copy mínimo
// - carousel/reel/video: caption corto
// - twitter: 280c hard limit
const COPY_LENGTH_RULES = {
  'facebook|feed':      { ideal: [40, 80],    max: 200  },
  'instagram|feed':     { ideal: [70, 150],   max: 220  },
  'linkedin|feed':      { ideal: [200, 1200], max: 2000 },
  'linkedin|carousel':  { ideal: [200, 800],  max: 1500 },
  'facebook|stories':   { ideal: [10, 50],    max: 80   },
  'instagram|stories':  { ideal: [10, 50],    max: 80   },
  'instagram|carousel': { ideal: [80, 200],   max: 300  },
  'instagram|reel':     { ideal: [40, 100],   max: 200  },
  'tiktok|video':       { ideal: [40, 100],   max: 150  },
  'tiktok|feed':        { ideal: [40, 100],   max: 150  },
  'twitter|feed':       { ideal: [120, 260],  max: 280  },
  'youtube|video':      { ideal: [60, 200],   max: 300  },
  'youtube|shorts':     { ideal: [40, 100],   max: 200  },
  'google|search':      { ideal: [50, 90],    max: 90   },
  'google|display':     { ideal: [50, 120],   max: 200  },
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
