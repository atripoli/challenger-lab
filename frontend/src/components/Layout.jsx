import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/',             label: 'Dashboard',   roles: ['admin','analyst','viewer'] },
  { to: '/experiments',  label: 'Experimentos',roles: ['admin','analyst','viewer'] },
  { to: '/clients',      label: 'Clientes',    roles: ['admin','analyst'] },
  { to: '/products',     label: 'Productos',   roles: ['admin','analyst'] },
  { to: '/skill-prompts',label: 'Skills',      roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const visible = navItems.filter((i) => i.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-brand-700">Challenger Lab</span>
            <nav className="flex gap-4 text-sm">
              {visible.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `hover:text-brand-600 ${isActive ? 'text-brand-600 font-medium' : 'text-slate-600'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{user?.full_name} · <span className="text-slate-400">{user?.role}</span></span>
            <button onClick={logout} className="text-slate-500 hover:text-slate-800">Salir</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
