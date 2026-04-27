import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_BADGE = {
  admin:   'bg-fuchsia-100 text-fuchsia-700',
  analyst: 'bg-blue-100 text-blue-700',
  viewer:  'bg-slate-100 text-slate-700',
};

export default function Team() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { users } = await api.get('/api/users');
      setItems(users);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(u) {
    if (!confirm(`¿Eliminar a ${u.full_name} (${u.email})? Esta acción es reversible vía DB pero no desde la UI.`)) return;
    try {
      await api.del(`/api/users/${u.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Equipo</h1>
          <p className="text-sm text-slate-500 mt-1">
            Usuarios con acceso a la plataforma. Roles: <b>admin</b> (total), <b>analyst</b> (crear/correr experimentos), <b>viewer</b> (solo lectura).
          </p>
        </div>
        <Link
          to="/team/new"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md"
        >
          Sumar miembro
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{error}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-500 text-sm">
          No hay usuarios cargados.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nombre</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Rol</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2 text-left font-medium">Último login</th>
                <th className="px-4 py-2 text-right font-medium w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => {
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.full_name}
                      {isMe && <span className="ml-2 text-[10px] text-slate-400">(vos)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${ROLE_BADGE[u.role] || ROLE_BADGE.viewer}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="text-emerald-600 text-xs">activo</span>
                        : <span className="text-slate-400 text-xs">inactivo</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-AR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link to={`/team/${u.id}/edit`} className="text-sm text-brand-600 hover:underline">
                        Editar
                      </Link>
                      {!isMe && (
                        <button onClick={() => handleDelete(u)} className="text-sm text-red-600 hover:underline">
                          Eliminar
                        </button>
                      )}
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
