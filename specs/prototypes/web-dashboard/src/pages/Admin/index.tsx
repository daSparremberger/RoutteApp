import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  return (
    <div className="app-container flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
      <aside className="flex w-full flex-col rounded-[22px] border border-border bg-surface2 md:w-64 md:rounded-[28px]">
        <div className="border-b border-border px-5 py-5">
          <h1 className="font-heading text-xl font-bold text-text">RotaVans Admin</h1>
          <p className="mt-1 text-sm text-text-muted">{user?.email}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3 md:space-y-1">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface hover:text-text'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/tenants"
            className={({ isActive }) =>
              `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface hover:text-text'
              }`
            }
          >
            Regioes
          </NavLink>
        </nav>
        <div className="border-t border-border p-4">
          <button onClick={logout} className="ui-btn-secondary w-full">
            Sair
          </button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-[22px] border border-border bg-surface p-4 shadow-[0_24px_48px_rgba(16,18,20,0.08)] md:rounded-[28px] md:p-6">
        <Outlet />
      </main>
    </div>
  );
}





