import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/api/products');
      setItems(d.products);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(p) {
    if (!confirm(`¿Eliminar el producto "${p.name}"? Soft-delete: queda en DB pero no aparece en listas. Sus experimentos siguen accesibles.`)) return;
    try {
      await api.del(`/api/products/${p.id}`);
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
        <Link
          to="/products/new"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
        >
          Nuevo producto
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          Todavía no hay productos cargados.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Producto</th>
                <th className="px-4 py-2 text-left font-medium">Cliente</th>
                <th className="px-4 py-2 text-left font-medium">Categoría</th>
                <th className="px-4 py-2 text-left font-medium">Plataformas</th>
                <th className="px-4 py-2 text-left font-medium">Formatos</th>
                <th className="px-4 py-2 text-right font-medium w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{p.name}</div>
                    {p.brief_text && (
                      <div className="text-xs text-slate-500 line-clamp-1 max-w-md">{p.brief_text}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.client_name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category || '—'}</td>
                  <td className="px-4 py-3">
                    <Tags items={p.platforms} empty="—" />
                  </td>
                  <td className="px-4 py-3">
                    <Tags items={p.formats} empty="—" />
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link to={`/products/${p.id}/history`} className="text-sm text-slate-600 hover:underline">
                      Histórico
                    </Link>
                    <Link to={`/products/${p.id}/edit`} className="text-sm text-brand-600 hover:underline">
                      Editar
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(p)}
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

function Tags({ items, empty }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <span className="text-slate-400 text-xs">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className="text-[11px] bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
          {t}
        </span>
      ))}
    </div>
  );
}
