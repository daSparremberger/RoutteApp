import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { managementApi } from '../../lib/api';
export function TenantsPage() {
    const [tenants, setTenants] = useState([]);
    useEffect(() => {
        managementApi.get('/tenants').then(setTenants).catch(() => { });
    }, []);
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-3xl font-bold text-text", children: "Regioes" }), _jsx(Link, { to: "/admin/tenants/novo", className: "ui-btn-primary", children: "Nova Regiao" })] }), _jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "p-4 text-left", children: "Nome" }), _jsx("th", { className: "p-4 text-left", children: "Cidade" }), _jsx("th", { className: "p-4 text-left", children: "Estado" }), _jsx("th", { className: "p-4 text-left", children: "Gestores" }), _jsx("th", { className: "p-4 text-left", children: "Status" }), _jsx("th", { className: "p-4 text-left", children: "Acoes" })] }) }), _jsx("tbody", { children: tenants.map((t) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "p-4 text-text", children: t.nome }), _jsx("td", { className: "p-4 text-text-muted", children: t.cidade }), _jsx("td", { className: "p-4 text-text-muted", children: t.estado }), _jsx("td", { className: "p-4 text-text-muted", children: t.max_gestores ?? '-' }), _jsx("td", { className: "p-4", children: _jsx("span", { className: `rounded-full px-2 py-1 text-xs ${t.ativo ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'}`, children: t.ativo ? 'Ativo' : 'Inativo' }) }), _jsx("td", { className: "p-4", children: _jsx(Link, { to: `/admin/tenants/${t.id}`, className: "text-sm font-medium text-text hover:text-accent", children: "Ver" }) })] }, t.id))) })] }) })] }));
}
