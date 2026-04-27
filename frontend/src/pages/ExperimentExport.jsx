import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const CATEGORY_COLOR = {
  FUNCTIONAL_BENEFIT:   'bg-sky-100 text-sky-800',
  ECONOMIC_OPPORTUNITY: 'bg-emerald-100 text-emerald-800',
  SOCIAL_STATUS:        'bg-violet-100 text-violet-800',
  EMOTIONAL_IDENTITY:   'bg-rose-100 text-rose-800',
  CULTURAL_TIMING:      'bg-amber-100 text-amber-800',
};

const PLATFORM_COLOR = {
  facebook:  'bg-blue-50 border-blue-200',
  instagram: 'bg-pink-50 border-pink-200',
  linkedin:  'bg-sky-50 border-sky-200',
  tiktok:    'bg-fuchsia-50 border-fuchsia-200',
  youtube:   'bg-red-50 border-red-200',
  twitter:   'bg-slate-50 border-slate-200',
  google:    'bg-emerald-50 border-emerald-200',
};

export default function ExperimentExport() {
  const { id } = useParams();
  const [exp, setExp] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/experiments/${id}`)
      .then((d) => setExp(d.experiment))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!exp) return <div className="p-8 text-slate-500">Cargando…</div>;

  const angles = Array.isArray(exp.angles) ? exp.angles : [];
  const selected = new Set(Array.isArray(exp.selected_angle_numbers) ? exp.selected_angle_numbers : []);
  const executions = Array.isArray(exp.executions) ? exp.executions : [];
  const scores = Array.isArray(exp.scores) ? exp.scores : [];
  const winnerNum = exp.winner_payload?.angle_number;
  const winnerAngle = angles.find((a) => a.angle_number === winnerNum);

  // Mostrar solo los ángulos que se procesaron (selected) o todos si no hubo selección
  const processedAngles = selected.size > 0
    ? angles.filter((a) => selected.has(a.angle_number))
    : angles;

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      {/* Toolbar — visible solo en pantalla, NO en impresión */}
      <div className="print:hidden bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="text-sm text-slate-600">
          Vista de impresión · {exp.name}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.close()}
            className="text-sm px-4 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-white"
          >
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700"
          >
            🖨 Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto px-12 py-10 print:px-8 print:py-6 space-y-10">
        {/* PORTADA */}
        <Cover exp={exp} winnerAngle={winnerAngle} />

        {/* RESUMEN: Champion + Winner */}
        <Section title="Resumen del experimento">
          <div className="grid grid-cols-2 gap-6">
            <ChampionPanel exp={exp} />
            <WinnerPanel exp={exp} winnerAngle={winnerAngle} />
          </div>
        </Section>

        {/* ÁNGULOS */}
        <Section title="Ángulos estratégicos">
          <div className="space-y-3">
            {angles.map((a) => (
              <AngleRow key={a.angle_number} angle={a} isSelected={selected.has(a.angle_number)} isWinner={a.angle_number === winnerNum} />
            ))}
          </div>
        </Section>

        {/* SCORING */}
        {scores.length > 0 && (
          <Section title="Performance scoring">
            <ScoringTable scores={scores} winnerNum={winnerNum} championScore={exp.champion_score} />
          </Section>
        )}

        {/* EJECUCIONES CREATIVAS POR ÁNGULO */}
        {processedAngles.map((a) => {
          const ex = executions.find((e) => e.angle_number === a.angle_number);
          if (!ex) return null;
          return <ExecutionDetail key={a.angle_number} angle={a} execution={ex} isWinner={a.angle_number === winnerNum} />;
        })}

        {/* FOOTER */}
        <div className="text-xs text-slate-400 text-center pt-6 border-t border-slate-200">
          Generado por Challenger Lab · {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>
    </div>
  );
}

// ---------------- componentes ----------------

function Cover({ exp, winnerAngle }) {
  return (
    <div className="break-after-page space-y-4 pb-10 border-b border-slate-200">
      <div className="text-xs uppercase tracking-widest text-slate-500">Challenger Lab · Reporte de experimento</div>
      <h1 className="text-4xl font-bold text-slate-900 leading-tight">{exp.name}</h1>
      <div className="text-lg text-slate-600">{exp.client_name} · {exp.product_name}</div>

      <div className="bg-slate-50 border border-slate-200 rounded-md p-4 mt-6 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Estado</div>
            <div className="font-medium text-slate-900 mt-1">
              {exp.status === 'completed' ? 'Completado' : exp.status}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Completado</div>
            <div className="font-medium text-slate-900 mt-1">
              {exp.completed_at ? new Date(exp.completed_at).toLocaleDateString('es-AR') : '—'}
            </div>
          </div>
          {winnerAngle && (
            <div className="col-span-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Ángulo ganador</div>
              <div className="font-medium text-slate-900 mt-1">
                #{winnerAngle.angle_number} · {winnerAngle.angle_name}
                {exp.uplift_vs_champion != null && (
                  <span className="ml-2 text-emerald-700 font-semibold">
                    uplift {Number(exp.uplift_vs_champion) >= 0 ? '+' : ''}{Number(exp.uplift_vs_champion).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChampionPanel({ exp }) {
  const score = exp.champion_score;
  return (
    <div className="border border-slate-200 rounded-md p-4 space-y-3">
      <div className="text-xs text-slate-500 uppercase tracking-wide">Champion</div>
      {exp.champion_image_url && (
        <img src={exp.champion_image_url} alt="champion" className="rounded border border-slate-200 max-h-48 w-full object-contain" />
      )}
      {score && (
        <div className="grid grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-100 text-center">
          <ScoreCell label="Novelty"    v={score.novelty?.score} />
          <ScoreCell label="Appeal"     v={score.appeal?.score} />
          <ScoreCell label="Conversion" v={score.conversion?.score} />
          <ScoreCell label="Total"      v={score.total} bold />
        </div>
      )}
    </div>
  );
}

function WinnerPanel({ exp, winnerAngle }) {
  if (!winnerAngle) {
    return (
      <div className="border border-slate-200 rounded-md p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide">Winner</div>
        <div className="text-sm text-slate-400 mt-2">Sin ganador asignado.</div>
      </div>
    );
  }
  return (
    <div className="border border-emerald-300 bg-emerald-50 rounded-md p-4 space-y-2">
      <div className="text-xs text-emerald-700 uppercase tracking-wide font-semibold">Ángulo ganador</div>
      <div className="text-sm">
        <span className="font-mono text-emerald-700 mr-2">#{winnerAngle.angle_number}</span>
        <span className="font-semibold text-emerald-900">{winnerAngle.angle_name}</span>
      </div>
      {winnerAngle.category && (
        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLOR[winnerAngle.category] || 'bg-slate-100 text-slate-600'}`}>
          {winnerAngle.category.replace(/_/g, ' ')}
        </span>
      )}
      {exp.winner_payload?.total_score != null && (
        <div className="text-xs">
          Score total: <span className="font-semibold">{Number(exp.winner_payload.total_score).toFixed(2)}</span>
          {exp.uplift_vs_champion != null && (
            <span className={`ml-2 ${Number(exp.uplift_vs_champion) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              ({Number(exp.uplift_vs_champion) >= 0 ? '+' : ''}{Number(exp.uplift_vs_champion).toFixed(2)} vs Champion)
            </span>
          )}
        </div>
      )}
      {exp.winner_payload?.recommendation && (
        <p className="text-xs text-emerald-900 italic mt-2 leading-relaxed">
          {exp.winner_payload.recommendation}
        </p>
      )}
    </div>
  );
}

function ScoreCell({ label, v, bold }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`font-mono ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{v ?? '—'}</div>
    </div>
  );
}

function AngleRow({ angle, isSelected, isWinner }) {
  return (
    <div className={`border rounded-md p-3 ${isWinner ? 'border-emerald-300 bg-emerald-50' : isSelected ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50'}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-mono text-slate-400">#{angle.angle_number}</span>
        <span className="font-semibold text-slate-900">{angle.angle_name || '—'}</span>
        {angle.category && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLOR[angle.category] || 'bg-slate-100 text-slate-600'}`}>
            {angle.category.replace(/_/g, ' ')}
          </span>
        )}
        {isWinner && <span className="ml-auto text-[10px] bg-emerald-600 text-white rounded-full px-2 py-0.5">GANADOR</span>}
        {!isWinner && isSelected && <span className="ml-auto text-[10px] text-slate-500">seleccionado</span>}
      </div>
      {angle.insight && <div className="text-xs text-slate-700 mt-1.5"><b>Insight:</b> {angle.insight}</div>}
      {angle.benefit && <div className="text-xs text-slate-700 mt-0.5"><b>Beneficio:</b> {angle.benefit}</div>}
      {angle.target_emotion && <div className="text-[10px] text-slate-500 mt-1"><b>Emoción:</b> {angle.target_emotion}</div>}
    </div>
  );
}

function ScoringTable({ scores, winnerNum, championScore }) {
  return (
    <table className="w-full text-xs border border-slate-200 rounded">
      <thead className="bg-slate-50 text-slate-600">
        <tr>
          <th className="px-2 py-1.5 text-left">Ángulo</th>
          <th className="px-2 py-1.5 text-right">Novelty</th>
          <th className="px-2 py-1.5 text-right">Appeal</th>
          <th className="px-2 py-1.5 text-right">Conversion</th>
          <th className="px-2 py-1.5 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {championScore && (
          <tr className="bg-slate-50/60 text-slate-600">
            <td className="px-2 py-1.5 font-mono">Champion</td>
            <td className="px-2 py-1.5 text-right">{championScore.novelty?.score ?? '—'}</td>
            <td className="px-2 py-1.5 text-right">{championScore.appeal?.score ?? '—'}</td>
            <td className="px-2 py-1.5 text-right">{championScore.conversion?.score ?? '—'}</td>
            <td className="px-2 py-1.5 text-right font-semibold">{championScore.total ?? '—'}</td>
          </tr>
        )}
        {scores.map((s, i) => {
          const num = s.angle_number ?? s.id;
          const isWinner = num === winnerNum;
          return (
            <tr key={i} className={isWinner ? 'bg-emerald-50' : ''}>
              <td className="px-2 py-1.5 font-mono">#{num}</td>
              <td className="px-2 py-1.5 text-right">{val(s.novelty)}</td>
              <td className="px-2 py-1.5 text-right">{val(s.appeal)}</td>
              <td className="px-2 py-1.5 text-right">{val(s.conversion)}</td>
              <td className="px-2 py-1.5 text-right font-semibold">{s.total ?? '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExecutionDetail({ angle, execution, isWinner }) {
  const creatives = Array.isArray(execution.creatives) ? execution.creatives : [];
  return (
    <div className="break-before-page pt-4 space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <div className="text-xs uppercase tracking-widest text-slate-500">
          Ejecución creativa · ángulo #{angle.angle_number}
          {isWinner && <span className="ml-2 text-emerald-700 font-semibold">(ganador)</span>}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">{angle.angle_name}</h2>
        {execution.big_idea && (
          <p className="text-sm italic text-slate-700 mt-2">{execution.big_idea}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs">
          {angle.category && (
            <span className={`px-1.5 py-0.5 rounded ${CATEGORY_COLOR[angle.category] || 'bg-slate-100 text-slate-600'}`}>
              {angle.category.replace(/_/g, ' ')}
            </span>
          )}
          {execution.template_used && (
            <span className="font-mono text-slate-500">Template: {execution.template_used}</span>
          )}
          {execution.tone && <span className="text-slate-500 italic">Tono: {execution.tone}</span>}
        </div>
      </div>

      {/* Hashtags compartidos */}
      {Array.isArray(execution.hashtags) && execution.hashtags.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs">
          <span className="text-slate-500 uppercase tracking-wide mr-2">Hashtags:</span>
          <span className="text-brand-600 font-medium">
            {execution.hashtags.map((h) => '#' + String(h).replace(/^#/, '')).join(' ')}
          </span>
        </div>
      )}

      {/* Creatives por canal */}
      {creatives.map((c, i) => (
        <CreativeBlock key={i} creative={c} />
      ))}
    </div>
  );
}

function CreativeBlock({ creative }) {
  const c = creative;
  const platformKey = String(c.platform || '').toLowerCase();
  const cls = PLATFORM_COLOR[platformKey] || 'bg-slate-50 border-slate-200';
  const visual = c.visual || {};
  const overlay = c.overlay_text || null;

  return (
    <div className={`border rounded-md p-4 space-y-3 ${cls}`}>
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="text-sm font-semibold text-slate-900">{c.platform}</span>
        {c.format && <span className="text-xs text-slate-600">· {c.format}</span>}
        {c.aspect_ratio && <span className="text-xs font-mono text-slate-500">· {c.aspect_ratio}</span>}
        {c.system_cta_type && (
          <span className="ml-auto text-[10px] bg-slate-700 text-white px-2 py-0.5 rounded">
            CTA: {c.system_cta_type}
          </span>
        )}
      </div>

      {c.post_copy && (
        <Block label="Post copy">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.post_copy}</p>
          <p className="text-[10px] text-slate-400 mt-1">{c.post_copy.length} caracteres</p>
        </Block>
      )}

      {(visual.main_subject || visual.scene || visual.color_palette || visual.style || visual.graphic_elements || visual.mood) && (
        <Block label="Brief visual">
          <div className="text-xs space-y-1">
            {visual.main_subject     && <div><b>Sujeto:</b> {visual.main_subject}</div>}
            {visual.scene            && <div><b>Escena:</b> {visual.scene}</div>}
            {visual.color_palette    && <div><b>Paleta:</b> {visual.color_palette}</div>}
            {visual.style            && <div><b>Estilo:</b> {visual.style}</div>}
            {visual.graphic_elements && <div><b>Gráficos:</b> {visual.graphic_elements}</div>}
            {visual.mood             && <div><b>Mood:</b> {visual.mood}</div>}
          </div>
        </Block>
      )}

      {(overlay?.primary || overlay?.secondary) && (
        <Block label="Texto sobre la imagen">
          {overlay.primary && <p className="text-sm font-bold text-slate-900">{overlay.primary}</p>}
          {overlay.secondary && <p className="text-xs text-slate-600 mt-0.5">{overlay.secondary}</p>}
        </Block>
      )}

      {c.cta_button && (
        <Block label="CTA en la imagen">
          <span className="inline-block bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded">
            {c.cta_button}
          </span>
        </Block>
      )}

      {(c.headline || c.description) && (
        <Block label="Link preview (debajo de la imagen)">
          {c.headline    && <p className="font-bold text-slate-900">{c.headline}</p>}
          {c.description && <p className="text-xs text-slate-600 mt-0.5">{c.description}</p>}
        </Block>
      )}
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function val(v) {
  if (v == null) return '—';
  if (typeof v === 'object') return v.score ?? '—';
  return v;
}
