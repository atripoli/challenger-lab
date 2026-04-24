import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { STATUS_META } from '../lib/status.js';

export default function Experiments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/experiments')
      .then((d) => setItems(d.experiments))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Experimentos</h1>
        <Link
          to="/experiments/new"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
        >
          Nuevo experimento
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          Todavía no hay experimentos. Creá el primero.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nombre</th>
                <th className="px-4 py-2 text-left font-medium">Cliente / Producto</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2 text-left font-medium">Ganador</th>
                <th className="px-4 py-2 text-right font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => {
                const meta = STATUS_META[e.status] || STATUS_META.draft;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/experiments/${e.id}`} className="text-brand-600 hover:underline">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.client_name} · {e.product_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.className}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.winner_id || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(e.updated_at).toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
