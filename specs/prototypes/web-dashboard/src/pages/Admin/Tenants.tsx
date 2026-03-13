import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    fetch(`${API_URL}/admin/tenants`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setTenants);
  }, [token]);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-3xl font-bold text-text">Regioes</h2>
        <Link to="/admin/tenants/novo" className="ui-btn-primary">Nova Regiao</Link>
      </div>
      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head"><tr>
            <th className="p-4 text-left">Nome</th>
            <th className="p-4 text-left">Cidade</th>
            <th className="p-4 text-left">Estado</th>
            <th className="p-4 text-left">Gestores</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Acoes</th>
          </tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="ui-table-row">
                <td className="p-4 text-text">{t.nome}</td>
                <td className="p-4 text-text-muted">{t.cidade}</td>
                <td className="p-4 text-text-muted">{t.estado}</td>
                <td className="p-4 text-text-muted">{t.total_gestores}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-1 text-xs ${t.ativo ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'}`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="p-4">
                  <Link to={`/admin/tenants/${t.id}`} className="text-sm font-medium text-text hover:text-accent">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}





