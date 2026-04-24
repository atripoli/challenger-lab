import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function Dashboard() {
  const [stats, setStats] = useState({ experiments: 0, clients: 0, products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/experiments').catch(() => ({ experiments: [] })),
      api.get('/api/clients').catch(() => ({ clients: [] })),
      api.get('/api/products').catch(() => ({ products: [] })),
    ]).then(([e, c, p]) => {
      setStats({
        experiments: e.experiments?.length ?? 0,
        clients:     c.clients?.length     ?? 0,
        products:    p.products?.length    ?? 0,
      });
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: 'Experimentos', value: stats.experiments },
    { label: 'Clientes',     value: stats.clients },
    { label: 'Productos',    value: stats.products },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {loading ? '—' : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-medium text-slate-900">Fase 1 completa</h2>
        <p className="text-sm text-slate-600 mt-2">
          Estructura base lista: auth, schema, CRUD y configuración de prompts. La Fase 2 suma
          subida del Champion y orquestación de los 4 skills.
        </p>
      </div>
    </div>
  );
}
