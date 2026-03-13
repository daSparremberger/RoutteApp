import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
export function OrganizationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = id === 'novo';
    const [org, setOrg] = useState(null);
    const [form, setForm] = useState({ razao_social: '', cnpj: '', email_financeiro: '', telefone_financeiro: '', endereco_cobranca: '', tenant_id: '' });
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(false);
    // Contract modal
    const [contractModal, setContractModal] = useState(false);
    const [modules, setModules] = useState([]);
    const [contractForm, setContractForm] = useState({
        valor_mensal: '', modulos_incluidos: [],
        max_veiculos: '', max_motoristas: '', max_gestores: '',
        data_inicio: '', data_fim: '', observacoes: '',
    });
    // Invoice modal
    const [invoiceModal, setInvoiceModal] = useState(false);
    const [invoiceMes, setInvoiceMes] = useState('');
    useEffect(() => {
        if (!isNew && id) {
            managementApi.get(`/organizations/${id}`).then((data) => {
                setOrg(data);
                setForm({
                    razao_social: data.razao_social, cnpj: data.cnpj || '', email_financeiro: data.email_financeiro || '',
                    telefone_financeiro: data.telefone_financeiro || '', endereco_cobranca: data.endereco_cobranca || '', tenant_id: String(data.tenant_id),
                });
            });
        }
        managementApi.get('/tenants').then(setTenants).catch(() => { });
        managementApi.get('/modules').then(setModules).catch(() => { });
    }, [id, isNew]);
    async function handleSaveOrg(e) {
        e.preventDefault();
        setLoading(true);
        try {
            if (isNew) {
                const created = await managementApi.post('/organizations', { ...form, tenant_id: Number(form.tenant_id) });
                navigate(`/admin/organizations/${created.id}`);
            }
            else {
                await managementApi.put(`/organizations/${id}`, form);
                const updated = await managementApi.get(`/organizations/${id}`);
                setOrg(updated);
            }
        }
        catch {
            // error handled by api client
        }
        setLoading(false);
    }
    async function handleCreateContract(e) {
        e.preventDefault();
        try {
            await managementApi.post(`/organizations/${id}/contracts`, {
                ...contractForm,
                valor_mensal: Number(contractForm.valor_mensal),
                max_veiculos: Number(contractForm.max_veiculos),
                max_motoristas: Number(contractForm.max_motoristas),
                max_gestores: Number(contractForm.max_gestores),
            });
            setContractModal(false);
            const updated = await managementApi.get(`/organizations/${id}`);
            setOrg(updated);
        }
        catch {
            // error handled by api client
        }
    }
    async function handleContractStatus(contractId, status) {
        if (!confirm(`Confirma alteracao de status para "${status}"?`))
            return;
        try {
            await managementApi.patch(`/contracts/${contractId}/status`, { status });
            const updated = await managementApi.get(`/organizations/${id}`);
            setOrg(updated);
        }
        catch {
            // error handled by api client
        }
    }
    async function handleInvoiceStatus(invoiceId, status) {
        try {
            await managementApi.patch(`/invoices/${invoiceId}/status`, { status });
            const updated = await managementApi.get(`/organizations/${id}`);
            setOrg(updated);
        }
        catch {
            // error handled by api client
        }
    }
    async function handleCreateInvoice(e) {
        e.preventDefault();
        const activeContract = org?.contracts?.find((c) => c.status === 'ativo');
        if (!activeContract)
            return;
        try {
            await managementApi.post('/invoices', { contract_id: activeContract.id, mes_referencia: invoiceMes });
            setInvoiceModal(false);
            const updated = await managementApi.get(`/organizations/${id}`);
            setOrg(updated);
        }
        catch {
            // error handled by api client
        }
    }
    function toggleModule(slug) {
        setContractForm((prev) => ({
            ...prev,
            modulos_incluidos: prev.modulos_incluidos.includes(slug)
                ? prev.modulos_incluidos.filter((s) => s !== slug)
                : [...prev.modulos_incluidos, slug],
        }));
    }
    const activeContract = org?.contracts?.find((c) => c.status === 'ativo');
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "font-heading text-3xl font-bold text-text", children: isNew ? 'Nova Organizacao' : org?.razao_social || '...' }), _jsxs("form", { onSubmit: handleSaveOrg, className: "ui-panel space-y-4 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: "Dados Comerciais" }), isNew && (_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Tenant" }), _jsxs("select", { value: form.tenant_id, onChange: (e) => setForm({ ...form, tenant_id: e.target.value }), className: "ui-select", required: true, children: [_jsx("option", { value: "", children: "Selecione..." }), tenants.map((t) => _jsxs("option", { value: t.id, children: [t.nome, " (", t.cidade, "/", t.estado, ")"] }, t.id))] })] })), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Razao Social" }), _jsx("input", { type: "text", value: form.razao_social, onChange: (e) => setForm({ ...form, razao_social: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "CNPJ" }), _jsx("input", { type: "text", value: form.cnpj, onChange: (e) => setForm({ ...form, cnpj: e.target.value }), className: "ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Email Financeiro" }), _jsx("input", { type: "email", value: form.email_financeiro, onChange: (e) => setForm({ ...form, email_financeiro: e.target.value }), className: "ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Telefone Financeiro" }), _jsx("input", { type: "text", value: form.telefone_financeiro, onChange: (e) => setForm({ ...form, telefone_financeiro: e.target.value }), className: "ui-input" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Endereco de Cobranca" }), _jsx("input", { type: "text", value: form.endereco_cobranca, onChange: (e) => setForm({ ...form, endereco_cobranca: e.target.value }), className: "ui-input" })] }), _jsx("button", { type: "submit", disabled: loading, className: "ui-btn-primary px-6", children: loading ? 'Salvando...' : 'Salvar' })] }), !isNew && org && (_jsxs("div", { className: "ui-panel p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: "Contratos" }), !activeContract && (_jsx("button", { onClick: () => setContractModal(true), className: "ui-btn-primary text-sm", children: "Novo Contrato" }))] }), org.contracts?.length ? (_jsx("div", { className: "space-y-3", children: org.contracts.map((c) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-border bg-surface p-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `rounded-full px-2 py-1 text-xs ${c.status === 'ativo' ? 'bg-success-muted text-success' :
                                                        c.status === 'suspenso' ? 'bg-warning-muted text-warning' :
                                                            'bg-danger-muted text-danger'}`, children: c.status }), _jsxs("span", { className: "font-semibold text-text", children: ["R$ ", Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), "/mes"] })] }), _jsxs("p", { className: "mt-1 text-sm text-text-muted", children: [c.data_inicio, " \u2014 ", c.data_fim || 'Indeterminado', " | ", c.modulos_incluidos?.length, " modulos |", c.max_veiculos, " veic / ", c.max_motoristas, " mot / ", c.max_gestores, " gest"] })] }), c.status === 'ativo' && (_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleContractStatus(c.id, 'suspenso'), className: "ui-btn-secondary text-xs", children: "Suspender" }), _jsx("button", { onClick: () => handleContractStatus(c.id, 'encerrado'), className: "ui-btn-secondary text-xs", children: "Encerrar" })] })), c.status === 'suspenso' && (_jsx("button", { onClick: () => handleContractStatus(c.id, 'ativo'), className: "ui-btn-primary text-xs", children: "Reativar" }))] }, c.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "Nenhum contrato registrado." }))] })), !isNew && org && (_jsxs("div", { className: "ui-panel p-6", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: "Faturas" }), activeContract && (_jsx("button", { onClick: () => setInvoiceModal(true), className: "ui-btn-primary text-sm", children: "Gerar Fatura" }))] }), org.invoices?.length ? (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "p-4 text-left", children: "Mes" }), _jsx("th", { className: "p-4 text-left", children: "Valor" }), _jsx("th", { className: "p-4 text-left", children: "Status" }), _jsx("th", { className: "p-4 text-left", children: "Pago em" }), _jsx("th", { className: "p-4 text-left", children: "Acoes" })] }) }), _jsx("tbody", { children: org.invoices.map((inv) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "p-4 text-text", children: inv.mes_referencia }), _jsxs("td", { className: "p-4 text-text-muted", children: ["R$ ", Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })] }), _jsx("td", { className: "p-4", children: _jsx("span", { className: `rounded-full px-2 py-1 text-xs ${inv.status === 'pago' ? 'bg-success-muted text-success' :
                                                        inv.status === 'cancelado' ? 'bg-danger-muted text-danger' :
                                                            'bg-warning-muted text-warning'}`, children: inv.status }) }), _jsx("td", { className: "p-4 text-text-muted", children: inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '-' }), _jsx("td", { className: "p-4 space-x-2", children: inv.status === 'pendente' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleInvoiceStatus(inv.id, 'pago'), className: "text-sm font-medium text-success hover:underline", children: "Pago" }), _jsx("button", { onClick: () => handleInvoiceStatus(inv.id, 'cancelado'), className: "text-sm font-medium text-danger hover:underline", children: "Cancelar" })] })) })] }, inv.id))) })] }) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "Nenhuma fatura gerada." }))] })), _jsx(Modal, { open: contractModal, onClose: () => setContractModal(false), title: "Novo Contrato", size: "lg", children: _jsxs("form", { onSubmit: handleCreateContract, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Valor Mensal (R$)" }), _jsx("input", { type: "number", step: "0.01", value: contractForm.valor_mensal, onChange: (e) => setContractForm({ ...contractForm, valor_mensal: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Data Inicio" }), _jsx("input", { type: "date", value: contractForm.data_inicio, onChange: (e) => setContractForm({ ...contractForm, data_inicio: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Data Fim (opcional)" }), _jsx("input", { type: "date", value: contractForm.data_fim, onChange: (e) => setContractForm({ ...contractForm, data_fim: e.target.value }), className: "ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Max Veiculos" }), _jsx("input", { type: "number", value: contractForm.max_veiculos, onChange: (e) => setContractForm({ ...contractForm, max_veiculos: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Max Motoristas" }), _jsx("input", { type: "number", value: contractForm.max_motoristas, onChange: (e) => setContractForm({ ...contractForm, max_motoristas: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Max Gestores" }), _jsx("input", { type: "number", value: contractForm.max_gestores, onChange: (e) => setContractForm({ ...contractForm, max_gestores: e.target.value }), className: "ui-input", required: true })] })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-2 block text-sm text-text-muted", children: "Modulos Incluidos" }), _jsx("div", { className: "flex flex-wrap gap-2", children: modules.map((m) => (_jsx("button", { type: "button", onClick: () => toggleModule(m.slug), className: `rounded-full px-3 py-1 text-sm transition-colors ${contractForm.modulos_incluidos.includes(m.slug)
                                            ? 'bg-accent text-surface'
                                            : 'border border-border bg-surface text-text-muted hover:bg-surface2'}`, children: m.nome }, m.slug))) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Observacoes" }), _jsx("textarea", { value: contractForm.observacoes, onChange: (e) => setContractForm({ ...contractForm, observacoes: e.target.value }), className: "ui-textarea", rows: 2 })] }), _jsx("button", { type: "submit", className: "ui-btn-primary px-6", children: "Criar Contrato" })] }) }), _jsx(Modal, { open: invoiceModal, onClose: () => setInvoiceModal(false), title: "Gerar Fatura", children: _jsxs("form", { onSubmit: handleCreateInvoice, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Mes de Referencia" }), _jsx("input", { type: "date", value: invoiceMes, onChange: (e) => setInvoiceMes(e.target.value), className: "ui-input", required: true })] }), _jsx("button", { type: "submit", className: "ui-btn-primary px-6", children: "Gerar" })] }) })] }));
}
