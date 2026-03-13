import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export function AdminDashboard() {
    const [stats, setStats] = useState(null);
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
    return (_jsxs("div", { children: [_jsx("h2", { className: "font-heading mb-6 text-3xl font-bold text-text", children: "Dashboard" }), _jsx("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", children: cards.map((card) => (_jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: card.label }), _jsx("p", { className: "mt-1 text-3xl font-bold text-text", children: card.value })] }, card.label))) })] }));
}
