export const STATUS_META = {
  draft:           { label: 'Borrador',         className: 'bg-slate-100 text-slate-700' },
  analyzing:       { label: 'Analizando',       className: 'bg-blue-100 text-blue-700' },
  awaiting_review: { label: 'Revisión',         className: 'bg-amber-100 text-amber-800' },
  optimizing:      { label: 'Optimizando',      className: 'bg-indigo-100 text-indigo-700' },
  executing:       { label: 'Generando',        className: 'bg-violet-100 text-violet-700' },
  scoring:         { label: 'Puntuando',        className: 'bg-amber-100 text-amber-700' },
  completed:       { label: 'Completado',       className: 'bg-emerald-100 text-emerald-700' },
  failed:          { label: 'Fallido',          className: 'bg-red-100 text-red-700' },
};

// Estados en los que el orchestrator está corriendo. `awaiting_review` NO está
// porque es una pausa para input humano — el polling debe seguir activo igual,
// pero es una pausa estable, no "running".
export const RUNNING_STATUSES = new Set(['analyzing', 'optimizing', 'executing', 'scoring']);

export const STEP_ORDER = [
  'analyzing',
  'awaiting_review',
  'optimizing',
  'executing',
  'scoring',
  'completed',
];

export const STEP_LABELS = {
  analyzing:       '1 · Analyzer',
  awaiting_review: '⏸ Revisión',
  optimizing:      '2 · Optimizer',
  executing:       '3 · Ogilvy',
  scoring:         '4 · Scorer',
};
