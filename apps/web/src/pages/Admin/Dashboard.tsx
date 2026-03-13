import { useEffect, useState } from 'react';
import { managementApi } from '../../lib/api';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    managementApi.get('/dashboard').then(setStats).catch(() => {});
  }, []);
  const cards = [
    { label: 'Tenants', value: stats?.total_tenants || 0 },
    { label: 'Ativos', value: stats?.active_tenants || 0 },
    { label: 'Alertas', value: stats?.open_alerts || 0 },
    { label: 'Criticos', value: stats?.critical_alerts || 0 },
  ];
  return (
    <div>
      <h2 className="font-heading mb-6 text-3xl font-bold text-text">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="ui-panel p-6">
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-1 text-3xl font-bold text-text">{card.value}</p>
          </div>
        ))}
      </div>

      {stats?.comercial && (
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-text">Comercial</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Contratos Ativos</p>
              <p className="mt-1 text-3xl font-bold text-text">{stats.comercial.contratos_ativos}</p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Receita Mensal</p>
              <p className="mt-1 text-3xl font-bold text-success">
                R$ {Number(stats.comercial.receita_mensal_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Faturas Pendentes</p>
              <p className="mt-1 text-3xl font-bold text-warning">{stats.comercial.faturas_pendentes}</p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Vencendo em 30 dias</p>
              <p className="mt-1 text-3xl font-bold text-danger">{stats.comercial.contratos_vencendo_30d}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





