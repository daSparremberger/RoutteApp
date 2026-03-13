import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { managementApi } from '../../lib/api';
export function AdminDashboard() {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        managementApi.get('/dashboard').then(setStats).catch(() => { });
    }, []);
    const cards = [
        { label: 'Tenants', value: stats?.total_tenants || 0 },
        { label: 'Ativos', value: stats?.active_tenants || 0 },
        { label: 'Alertas', value: stats?.open_alerts || 0 },
        { label: 'Criticos', value: stats?.critical_alerts || 0 },
    ];
    return (_jsxs("div", { children: [_jsx("h2", { className: "font-heading mb-6 text-3xl font-bold text-text", children: "Dashboard" }), _jsx("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", children: cards.map((card) => (_jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: card.label }), _jsx("p", { className: "mt-1 text-3xl font-bold text-text", children: card.value })] }, card.label))) }), stats?.comercial && (_jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "mb-4 text-lg font-semibold text-text", children: "Comercial" }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4", children: [_jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: "Contratos Ativos" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-text", children: stats.comercial.contratos_ativos })] }), _jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: "Receita Mensal" }), _jsxs("p", { className: "mt-1 text-3xl font-bold text-success", children: ["R$ ", Number(stats.comercial.receita_mensal_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })] })] }), _jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: "Faturas Pendentes" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-warning", children: stats.comercial.faturas_pendentes })] }), _jsxs("div", { className: "ui-panel p-6", children: [_jsx("p", { className: "text-sm text-text-muted", children: "Vencendo em 30 dias" }), _jsx("p", { className: "mt-1 text-3xl font-bold text-danger", children: stats.comercial.contratos_vencendo_30d })] })] })] }))] }));
}
