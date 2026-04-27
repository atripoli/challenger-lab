import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const PLATFORM_OPTIONS = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Google', 'Twitter'];

const EMPTY = {
  campaign_name: '',
  period_start:  '',
  period_end:    '',
  platform:      '',
  impressions:   '',
  clicks:        '',
  ctr:           '',
  conversions:   '',
  conversion_rate: '',
  cpc:           '',
  cpa:           '',
  budget_spent:  '',
  currency:      'USD',
  notes:         '',
};

export default function ProductHistory() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // entry being edited or 'new'

  async function load() {
    try {
      const [{ product: p }, { history }] = await Promise.all([
        api.get(`/api/products/${id}`),
        api.get(`/api/products/${id}/history`),
      ]);
      setProduct(p);
      setItems(history);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDelete(entry) {
    if (!confirm(`¿Eliminar la campaña "${entry.campaign_name}"?`)) return;
    try {
      await api.del(`/api/products/${id}/history/${entry.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave(formData) {
    setError(null);
    const body = normalizeForSubmit(formData);
    try {
      if (editing && editing.id) {
        await api.put(`/api/products/${id}/history/${editing.id}`, body);
      } else {
        await api.post(`/api/products/${id}/history`, body);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Cargando…</div>;
  if (!product) return <div className="text-red-600 text-sm">Producto no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/products" className="text-xs text-slate-500 hover:text-slate-800">← Productos</Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">Histórico · {product.name}</h1>
          <div className="text-sm text-slate-500">{product.client_name}</div>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
        >
          Sumar campaña
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}

      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          Aún no hay campañas históricas cargadas. El orchestrator usa esto para
          alimentar al Analyzer y al Scorer con contexto de qué funcionó antes.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Campaña</th>
                <th className="px-3 py-2 text-left">Período</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-right">Impres.</th>
                <th className="px-3 py-2 text-right">Clicks</th>
                <th className="px-3 py-2 text-right">CTR</th>
                <th className="px-3 py-2 text-right">CVR</th>
                <th className="px-3 py-2 text-right">CPA</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">{h.campaign_name}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{periodLabel(h)}</td>
                  <td className="px-3 py-2 text-slate-600">{h.platform || '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtInt(h.impressions)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtInt(h.clicks)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtPct(h.ctr)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtPct(h.conversion_rate)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(h.cpa, h.currency)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(h.budget_spent, h.currency)}</td>
                  <td className="px-3 py-2 text-right space-x-3">
                    <button onClick={() => setEditing(stringifyForForm(h))} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(h)} className="text-sm text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <HistoryEntryModal
          initial={editing}
          isNew={!editing.id}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ---------------- modal ----------------

function HistoryEntryModal({ initial, isNew, onSave, onCancel }) {
  const [form, setForm] = useState(initial);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    if (!form.campaign_name?.trim()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-lg w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNew ? 'Nueva campaña histórica' : 'Editar campaña'}
          </h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ModalField label="Nombre de campaña" required>
              <input type="text" required value={form.campaign_name}
                     onChange={(e) => update('campaign_name', e.target.value)}
                     className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ModalField>

            <ModalField label="Plataforma">
              <select value={form.platform || ''} onChange={(e) => update('platform', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">— sin especificar —</option>
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </ModalField>

            <ModalField label="Inicio de período">
              <input type="date" value={form.period_start || ''}
                     onChange={(e) => update('period_start', e.target.value)}
                     className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ModalField>

            <ModalField label="Fin de período">
              <input type="date" value={form.period_end || ''}
                     onChange={(e) => update('period_end', e.target.value)}
                     className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ModalField>
          </div>

          <fieldset className="border border-slate-200 rounded-md p-4 space-y-3">
            <legend className="text-xs uppercase tracking-wide text-slate-500 px-2">Performance</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumField label="Impresiones" value={form.impressions} onChange={(v) => update('impressions', v)} step="1" />
              <NumField label="Clicks"      value={form.clicks}      onChange={(v) => update('clicks', v)}      step="1" />
              <NumField label="CTR (0-1)"   value={form.ctr}         onChange={(v) => update('ctr', v)}         step="0.0001" max="1" />
              <NumField label="Conversiones" value={form.conversions} onChange={(v) => update('conversions', v)} step="1" />
              <NumField label="CVR (0-1)"   value={form.conversion_rate} onChange={(v) => update('conversion_rate', v)} step="0.0001" max="1" />
              <NumField label="CPC"         value={form.cpc}         onChange={(v) => update('cpc', v)}         step="0.01" />
              <NumField label="CPA"         value={form.cpa}         onChange={(v) => update('cpa', v)}         step="0.01" />
              <NumField label="Budget gastado" value={form.budget_spent} onChange={(v) => update('budget_spent', v)} step="0.01" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Moneda</span>
              <input type="text" value={form.currency || 'USD'} maxLength={3}
                     onChange={(e) => update('currency', e.target.value.toUpperCase())}
                     className="rounded-md border border-slate-300 px-2 py-1 text-sm w-16 uppercase" />
            </div>
          </fieldset>

          <ModalField label="Notas">
            <textarea rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Aprendizajes clave, hipótesis usadas, etc." />
          </ModalField>
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

function ModalField({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function NumField({ label, value, onChange, step, max }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <input type="number" value={value ?? ''} step={step} min={0} max={max}
             onChange={(e) => onChange(e.target.value)}
             className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono" />
    </label>
  );
}

// ---------------- helpers ----------------

function periodLabel(h) {
  if (h.period_start && h.period_end) return `${h.period_start} → ${h.period_end}`;
  if (h.period_start) return `desde ${h.period_start}`;
  if (h.period_end)   return `hasta ${h.period_end}`;
  return '—';
}
function fmtInt(n) { return n != null ? Number(n).toLocaleString('es-AR') : '—'; }
function fmtPct(n) { return n != null ? `${(Number(n) * 100).toFixed(2)}%` : '—'; }
function fmtMoney(n, ccy) { return n != null ? `${ccy || 'USD'} ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }

function stringifyForForm(h) {
  return {
    ...h,
    period_start: h.period_start ? String(h.period_start).slice(0, 10) : '',
    period_end:   h.period_end   ? String(h.period_end).slice(0, 10)   : '',
    notes: h.notes || '',
  };
}
function normalizeForSubmit(f) {
  const out = { ...f };
  ['impressions', 'clicks', 'ctr', 'conversions', 'conversion_rate', 'cpc', 'cpa', 'budget_spent']
    .forEach((k) => {
      if (out[k] === '' || out[k] == null) out[k] = null;
      else out[k] = Number(out[k]);
    });
  if (!out.period_start) out.period_start = null;
  if (!out.period_end)   out.period_end   = null;
  if (!out.platform)     out.platform     = null;
  if (!out.notes)        out.notes        = null;
  return out;
}
