import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementApi } from '../../lib/api';
const WEB_URL = import.meta.env.VITE_WEB_URL;
export function TenantFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id && id !== 'novo';
    const [form, setForm] = useState({ nome: '', cidade: '', estado: '' });
    const [loading, setLoading] = useState(false);
    const [conviteLink, setConviteLink] = useState(null);
    const [modules, setModules] = useState([]);
    const [moduleError, setModuleError] = useState(null);
    useEffect(() => {
        if (isEdit) {
            managementApi.get(`/tenants/${id}`)
                .then((d) => {
                setForm({ nome: d.nome, cidade: d.cidade, estado: d.estado });
                if (d.modules)
                    setModules(d.modules);
            });
        }
    }, [id, isEdit]);
    async function handleToggleModule(slug, habilitado) {
        setModuleError(null);
        try {
            await managementApi.put(`/tenants/${id}/modules`, { slug, habilitado });
            const d = await managementApi.get(`/tenants/${id}`);
            if (d.modules)
                setModules(d.modules);
        }
        catch (err) {
            setModuleError(err?.message || 'Erro ao alterar modulo');
        }
    }
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        const d = isEdit
            ? await managementApi.put(`/tenants/${id}`, form)
            : await managementApi.post('/tenants', form);
        if (!isEdit) {
            navigate(`/admin/tenants/${d.id}`);
        }
        setLoading(false);
    }
    async function handleGerarConvite() {
        const d = await managementApi.post(`/tenants/${id}/invite`, {});
        const fallbackOrigin = WEB_URL || window.location.origin;
        setConviteLink(d.link || d.convite_url || `${fallbackOrigin}/convite/${d.token}`);
    }
    return (_jsxs("div", { className: "max-w-2xl", children: [_jsx("h2", { className: "mb-6 font-heading text-3xl font-bold text-text", children: isEdit ? 'Editar Regiao' : 'Nova Regiao' }), _jsxs("form", { onSubmit: handleSubmit, className: "ui-panel space-y-4 p-6", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Nome da Prefeitura" }), _jsx("input", { type: "text", value: form.nome, onChange: e => setForm({ ...form, nome: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Cidade" }), _jsx("input", { type: "text", value: form.cidade, onChange: e => setForm({ ...form, cidade: e.target.value }), className: "ui-input", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm text-text-muted", children: "Estado" }), _jsx("input", { type: "text", value: form.estado, onChange: e => setForm({ ...form, estado: e.target.value.toUpperCase() }), className: "ui-input", maxLength: 2, required: true })] })] }), _jsx("button", { type: "submit", disabled: loading, className: "ui-btn-primary px-6", children: loading ? 'Salvando...' : 'Salvar' })] }), isEdit && modules.length > 0 && (_jsxs("div", { className: "ui-panel mt-6 p-6", children: [_jsx("h3", { className: "mb-4 text-lg font-bold text-text", children: "Modulos" }), moduleError && (_jsx("div", { className: "mb-4 rounded-xl bg-danger-muted p-3 text-sm text-danger", children: moduleError })), _jsx("div", { className: "space-y-1", children: ['cadastro', 'operacional', 'suporte'].map((tipo) => {
                            const group = modules.filter((m) => m.tipo === tipo);
                            if (!group.length)
                                return null;
                            return (_jsxs("div", { children: [_jsx("p", { className: "mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted", children: tipo }), _jsx("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2", children: group.map((m) => (_jsxs("label", { className: "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface2", children: [_jsx("input", { type: "checkbox", checked: m.habilitado, onChange: () => handleToggleModule(m.slug, !m.habilitado), className: "h-4 w-4 rounded accent-accent" }), _jsx("span", { className: "text-sm font-medium text-text", children: m.nome })] }, m.slug))) })] }, tipo));
                        }) })] })), isEdit && (_jsxs("div", { className: "ui-panel mt-6 p-6", children: [_jsx("h3", { className: "mb-4 text-lg font-bold text-text", children: "Convite para Gestor" }), conviteLink ? (_jsxs("div", { className: "rounded-2xl bg-surface p-4", children: [_jsx("p", { className: "mb-2 text-sm text-text-muted", children: "Link (valido 7 dias):" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: conviteLink, readOnly: true, className: "ui-input flex-1" }), _jsx("button", { onClick: () => navigator.clipboard.writeText(conviteLink), className: "ui-btn-secondary", children: "Copiar" })] })] })) : _jsx("button", { onClick: handleGerarConvite, className: "ui-btn-primary", children: "Gerar Link de Convite" })] }))] }));
}
