import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const MODELS = [
  { id: 'claude-opus-4-6',   family: 'Opus',   tier: 'max',    hint: 'Razonamiento profundo · más caro' },
  { id: 'claude-sonnet-4-6', family: 'Sonnet', tier: 'smart',  hint: 'Balance óptimo · análisis y creatividad' },
  { id: 'claude-haiku-4-5',  family: 'Haiku',  tier: 'fast',   hint: 'Barato y veloz · tareas estructuradas' },
];
const MODEL_BADGE = {
  'claude-opus-4-6':   'bg-fuchsia-100 text-fuchsia-700',
  'claude-sonnet-4-6': 'bg-blue-100 text-blue-700',
  'claude-haiku-4-5':  'bg-emerald-100 text-emerald-700',
};

export default function SkillPrompts() {
  const [skills, setSkills] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const selected = useMemo(
    () => skills.find((s) => s.id === selectedId) || null,
    [skills, selectedId],
  );

  useEffect(() => { load(); }, []);

  async function load() {
    const { skill_prompts } = await api.get('/api/skill-prompts');
    setSkills(skill_prompts);
    if (skill_prompts.length && !selectedId) pick(skill_prompts[0]);
  }

  function pick(skill) {
    setSelectedId(skill.id);
    setDraft({
      system_prompt: skill.system_prompt,
      model:        skill.model,
      max_tokens:   skill.max_tokens,
      temperature:  Number(skill.temperature),
    });
    setStatus(null);
  }

  const dirty = selected && draft && (
    draft.system_prompt !== selected.system_prompt ||
    draft.model         !== selected.model ||
    Number(draft.max_tokens)  !== Number(selected.max_tokens) ||
    Number(draft.temperature) !== Number(selected.temperature)
  );

  async function save() {
    if (!selected || !dirty) return;
    setSaving(true);
    setStatus(null);
    try {
      const { skill_prompt } = await api.put(
        `/api/skill-prompts/${selected.skill_name}`,
        {
          system_prompt: draft.system_prompt,
          model:         draft.model,
          max_tokens:    Number(draft.max_tokens),
          temperature:   Number(draft.temperature),
        },
      );
      setSkills((prev) => prev.map((s) => (s.id === skill_prompt.id ? skill_prompt : s)));
      setSelectedId(skill_prompt.id);
      setDraft({
        system_prompt: skill_prompt.system_prompt,
        model:         skill_prompt.model,
        max_tokens:    skill_prompt.max_tokens,
        temperature:   Number(skill_prompt.temperature),
      });
      setStatus({ kind: 'ok', msg: `Guardado · v${skill_prompt.version}` });
    } catch (err) {
      setStatus({ kind: 'err', msg: err.message });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (selected) pick(selected);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-1">
        <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">Skills</h2>
        {skills.map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm border ${
              selectedId === s.id
                ? 'bg-brand-50 border-brand-500 text-brand-700'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className="font-medium">{s.display_name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${MODEL_BADGE[s.model] || 'bg-slate-100 text-slate-600'}`}>
                {modelShort(s.model)}
              </span>
              <span className="text-xs text-slate-500">v{s.version}</span>
            </div>
          </button>
        ))}
      </aside>

      {selected && draft && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{selected.display_name}</h1>
            <p className="text-sm text-slate-500 mt-1">{selected.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
              <select
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.family} · {m.id}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {MODELS.find((m) => m.id === draft.model)?.hint}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">max_tokens</label>
              <input
                type="number"
                min={256}
                max={16384}
                step={128}
                value={draft.max_tokens}
                onChange={(e) => setDraft({ ...draft, max_tokens: Number(e.target.value) })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Tope de tokens de salida (256–16384)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                temperature · <span className="font-mono">{Number(draft.temperature).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.temperature}
                onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-[11px] text-slate-500 mt-1">0 = determinístico · 1 = creativo</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">System prompt</label>
            <textarea
              value={draft.system_prompt}
              onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })}
              rows={20}
              className="w-full font-mono text-xs border border-slate-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              {status && (
                <span className={status.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}>
                  {status.msg}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                disabled={!dirty || saving}
                className="text-sm px-3 py-2 rounded-md border border-slate-300 text-slate-700 disabled:opacity-40"
              >
                Descartar
              </button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                className="text-sm px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar nueva versión'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function modelShort(id) {
  if (!id) return '—';
  return id.replace('claude-', '').replace(/-[\d-]+$/, '').replace(/^(.)/, (c) => c.toUpperCase());
}
