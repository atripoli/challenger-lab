import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/api/clients');
      setItems(d.clients);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(c) {
    if (!confirm(`¿Eliminar al cliente "${c.name}"? Soft-delete: el cliente y sus productos siguen en DB pero no aparecen en listas.`)) return;
    try {
      await api.del(`/api/clients/${c.id}`);
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
        <Link
          to="/clients/new"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
        >
          Nuevo cliente
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          Todavía no hay clientes cargados.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Cliente</th>
                <th className="px-4 py-2 text-left font-medium">Industria</th>
                <th className="px-4 py-2 text-left font-medium">Notas</th>
                <th className="px-4 py-2 text-right font-medium w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.industry || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs line-clamp-1 max-w-md">
                    {c.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link to={`/clients/${c.id}/edit`} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(c)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}
    </div>
  );
}
