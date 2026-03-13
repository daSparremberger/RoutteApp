import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { managementApi } from '../../lib/api';
export function InvoicesPage() {
    const [invoices, setInvoices] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [mesFilter, setMesFilter] = useState('');
    const [orgFilter, setOrgFilter] = useState('');
    const [orgs, setOrgs] = useState([]);
    const [batchMes, setBatchMes] = useState('');
    const [batchResult, setBatchResult] = useState(null);
    useEffect(() => {
        managementApi.get('/organizations').then(setOrgs).catch(() => { });
    }, []);
    function load() {
        const params = new URLSearchParams();
        if (statusFilter)
            params.set('status', statusFilter);
        if (mesFilter)
            params.set('mes', mesFilter);
        if (orgFilter)
            params.set('organization_id', orgFilter);
        const qs = params.toString();
        managementApi.get(`/invoices${qs ? `?${qs}` : ''}`).then(setInvoices).catch(() => { });
    }
    useEffect(() => { load(); }, [statusFilter, mesFilter, orgFilter]);
    async function handleBatch(e) {
        e.preventDefault();
        if (!batchMes)
            return;
        const result = await managementApi.post('/invoices/batch', { mes_referencia: batchMes });
        setBatchResult(result);
        load();
    }
    async function handleStatus(invoiceId, status) {
        await managementApi.patch(`/invoices/${invoiceId}/status`, { status });
        load();
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("h2", { className: "font-heading text-3xl font-bold text-text", children: "Faturas" }) }), _jsxs("div", { className: "ui-panel flex items-end gap-4 p-4", children: [_jsxs("form", { onSubmit: handleBatch, className: "flex items-end gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Gerar faturas em lote" }), _jsx("input", { type: "date", value: batchMes, onChange: (e) => setBatchMes(e.target.value), className: "ui-input", required: true })] }), _jsx("button", { type: "submit", className: "ui-btn-primary", children: "Gerar" })] }), batchResult && (_jsxs("p", { className: "text-sm text-text-muted", children: [batchResult.created?.length, " criadas, ", batchResult.skipped?.length, " ignoradas, ", batchResult.errors?.length, " erros"] }))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("div", { className: "flex gap-2", children: ['', 'pendente', 'pago', 'cancelado'].map((s) => (_jsx("button", { onClick: () => setStatusFilter(s), className: `rounded-full px-3 py-1 text-sm transition-colors ${statusFilter === s ? 'bg-accent text-surface' : 'border border-border bg-surface text-text-muted'}`, children: s || 'Todas' }, s))) }), _jsx("input", { type: "month", value: mesFilter, onChange: (e) => setMesFilter(e.target.value ? `${e.target.value}-01` : ''), className: "ui-input w-auto", placeholder: "Mes" }), _jsxs("select", { value: orgFilter, onChange: (e) => setOrgFilter(e.target.value), className: "ui-select w-auto", children: [_jsx("option", { value: "", children: "Todas organizacoes" }), orgs.map((o) => _jsx("option", { value: o.id, children: o.razao_social }, o.id))] })] }), _jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "p-4 text-left", children: "Organizacao" }), _jsx("th", { className: "p-4 text-left", children: "Mes" }), _jsx("th", { className: "p-4 text-left", children: "Valor" }), _jsx("th", { className: "p-4 text-left", children: "Status" }), _jsx("th", { className: "p-4 text-left", children: "Pago em" }), _jsx("th", { className: "p-4 text-left", children: "Acoes" })] }) }), _jsx("tbody", { children: invoices.map((inv) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "p-4 text-text", children: inv.razao_social }), _jsx("td", { className: "p-4 text-text-muted", children: inv.mes_referencia }), _jsxs("td", { className: "p-4 text-text-muted", children: ["R$ ", Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })] }), _jsx("td", { className: "p-4", children: _jsx("span", { className: `rounded-full px-2 py-1 text-xs ${inv.status === 'pago' ? 'bg-success-muted text-success' :
                                                inv.status === 'cancelado' ? 'bg-danger-muted text-danger' :
                                                    'bg-warning-muted text-warning'}`, children: inv.status }) }), _jsx("td", { className: "p-4 text-text-muted", children: inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '-' }), _jsx("td", { className: "p-4 space-x-2", children: inv.status === 'pendente' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleStatus(inv.id, 'pago'), className: "text-sm font-medium text-success hover:underline", children: "Pago" }), _jsx("button", { onClick: () => handleStatus(inv.id, 'cancelado'), className: "text-sm font-medium text-danger hover:underline", children: "Cancelar" })] })) })] }, inv.id))) })] }) })] }));
}
