import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setStats);
  }, [token]);
  const cards = [
    { label: 'Regioes', value: stats?.total_tenants || 0 },
    { label: 'Gestores', value: stats?.total_gestores || 0 },
    { label: 'Motoristas', value: stats?.total_motoristas || 0 },
    { label: 'Alunos', value: stats?.total_alunos || 0 },
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
    </div>
  );
}





