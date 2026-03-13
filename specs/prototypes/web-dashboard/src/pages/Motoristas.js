import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, Pencil, Copy, Truck, ChevronRight, Calendar, MapPin, Users, Navigation } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { api } from '../lib/api';
export function Motoristas() {
    const [motoristas, setMotoristas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [selectedStats, setSelectedStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nome: '', telefone: '' });
    const [conviteUrl, setConviteUrl] = useState('');
    useEffect(() => { load(); }, []);
    async function load() {
        const data = await api.get('/motoristas');
        setMotoristas(data);
    }
    async function selectMotorista(m) {
        setSelected(m);
        setLoadingStats(true);
        try {
            const stats = await api.get(`/motoristas/${m.id}/stats`);
            setSelectedStats(stats);
        }
        catch {
            setSelectedStats(null);
        }
        finally {
            setLoadingStats(false);
        }
    }
    function openNew() {
        setEditing(null);
        setForm({ nome: '', telefone: '' });
        setConviteUrl('');
        setModalOpen(true);
    }
    function openEdit(m, e) {
        e.stopPropagation();
        setEditing(m);
        setForm({ nome: m.nome, telefone: m.telefone || '' });
        setConviteUrl('');
        setModalOpen(true);
    }
    async function save() {
        if (editing) {
            await api.put(`/motoristas/${editing.id}`, form);
            setModalOpen(false);
            // Refresh stats if editing selected motorista
            if (selected?.id === editing.id) {
                selectMotorista(editing);
            }
        }
        else {
            const res = await api.post('/motoristas', form);
            setConviteUrl(res.convite_url);
        }
        load();
    }
    async function reenviarConvite(id, e) {
        e.stopPropagation();
        const res = await api.post(`/motoristas/${id}/reenviar-convite`, {});
        alert(`Link de convite copiado!\n${res.convite_url}`);
        navigator.clipboard.writeText(res.convite_url);
    }
    function copyUrl() {
        navigator.clipboard.writeText(conviteUrl);
        alert('Link copiado!');
    }
    function formatDate(d) {
        if (!d)
            return '-';
        return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function formatDateTime(d) {
        if (!d)
            return '-';
        return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { className: "flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6", children: [_jsxs("div", { className: "w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1", children: [_jsx(PageHeader, { title: "Motoristas", subtitle: `${motoristas.length} motorista(s)`, action: _jsx("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-xl text-sm font-medium", children: _jsx(Plus, { size: 16 }) }) }), motoristas.length === 0 ? (_jsx(EmptyState, { icon: Truck, message: "Nenhum motorista cadastrado" })) : (_jsx("div", { className: "space-y-2", children: motoristas.map((m) => (_jsx("button", { onClick: () => selectMotorista(m), className: `w-full text-left bg-surface2 border rounded-xl p-4 transition-colors ${selected?.id === m.id
                                    ? 'border-accent'
                                    : 'border-border/30 hover:border-border'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-text font-medium truncate", children: m.nome }), m.cadastro_completo ? (_jsx("span", { className: "text-success text-xs bg-success-muted px-2 py-0.5 rounded-full shrink-0", children: "Ativo" })) : (_jsx("span", { className: "text-danger text-xs bg-danger-muted px-2 py-0.5 rounded-full shrink-0", children: "Pendente" }))] }), _jsx("p", { className: "text-text-muted text-xs mt-1", children: m.telefone || 'Sem telefone' })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("button", { onClick: (e) => openEdit(m, e), className: "text-text-muted hover:text-text p-1", children: _jsx(Pencil, { size: 14 }) }), !m.cadastro_completo && (_jsx("button", { onClick: (e) => reenviarConvite(m.id, e), className: "text-text-muted hover:text-accent p-1", title: "Reenviar convite", children: _jsx(Copy, { size: 14 }) })), _jsx(ChevronRight, { size: 18, className: "text-text-muted" })] })] }) }, m.id))) }))] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto p-4 md:p-6", children: selected && selectedStats ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "w-20 h-20 rounded-full bg-surface2 flex items-center justify-center overflow-hidden shrink-0", children: selectedStats.motorista.foto_url ? (_jsx("img", { src: selectedStats.motorista.foto_url, alt: selectedStats.motorista.nome, className: "w-full h-full object-cover" })) : (_jsx(Truck, { size: 32, className: "text-text-muted" })) }), _jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-xl font-bold text-text", children: selectedStats.motorista.nome }), _jsx("p", { className: "text-text-muted text-sm mt-1", children: selectedStats.motorista.telefone || 'Sem telefone' }), _jsxs("div", { className: "flex items-center gap-3 mt-2", children: [selectedStats.motorista.cadastro_completo ? (_jsx("span", { className: "text-success text-xs bg-success-muted px-3 py-1 rounded-full", children: "Ativo" })) : (_jsx("span", { className: "text-danger text-xs bg-danger-muted px-3 py-1 rounded-full", children: "Pendente" })), _jsxs("span", { className: "text-text-muted text-xs", children: ["Desde ", formatDate(selectedStats.motorista.criado_em)] })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Calendar, { size: 16, className: "text-accent" }), _jsx("p", { className: "text-text-muted text-xs", children: "Dias Trabalhados" })] }), _jsx("p", { className: "text-2xl font-bold text-text", children: selectedStats.stats.dias_trabalhados })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(MapPin, { size: 16, className: "text-success" }), _jsx("p", { className: "text-text-muted text-xs", children: "Rotas Realizadas" })] }), _jsx("p", { className: "text-2xl font-bold text-text", children: selectedStats.stats.total_rotas })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Users, { size: 16, className: "text-danger" }), _jsx("p", { className: "text-text-muted text-xs", children: "Alunos Transportados" })] }), _jsx("p", { className: "text-2xl font-bold text-text", children: selectedStats.stats.total_alunos })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Navigation, { size: 16, className: "text-purple-400" }), _jsx("p", { className: "text-text-muted text-xs", children: "KM Percorridos" })] }), _jsx("p", { className: "text-2xl font-bold text-text", children: selectedStats.stats.total_km.toFixed(1) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm text-text-muted mb-3", children: "Rotas Recentes" }), selectedStats.recent_routes.length > 0 ? (_jsx("div", { className: "space-y-2", children: selectedStats.recent_routes.map((r) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl p-4 border border-border/30", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center", children: _jsx(MapPin, { size: 18, className: "text-accent" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-text text-sm font-medium", children: r.rota_nome || 'Rota sem nome' }), _jsx("p", { className: "text-text-muted text-xs", children: formatDateTime(r.data_inicio) })] })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs", children: [_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-success font-medium", children: r.alunos_embarcados }), _jsx("p", { className: "text-text-muted", children: "alunos" })] }), r.km_total && (_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-purple-400 font-medium", children: r.km_total.toFixed(1) }), _jsx("p", { className: "text-text-muted", children: "km" })] }))] })] }, r.id))) })) : (_jsx("div", { className: "rounded-xl p-4 border border-border/30 text-center text-text-muted text-sm", children: "Nenhuma rota realizada ainda" }))] })] })) : loadingStats ? (_jsx("div", { className: "flex items-center justify-center h-full text-text-muted", children: _jsx("p", { children: "Carregando..." }) })) : (_jsx("div", { className: "flex items-center justify-center h-full text-text-muted", children: _jsx("p", { children: "Selecione um motorista para ver detalhes" }) })) }), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editing ? 'Editar Motorista' : 'Novo Motorista', children: conviteUrl ? (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-text-muted text-sm", children: "Motorista criado! Envie o link abaixo para ele completar o cadastro:" }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30 flex items-center gap-2", children: [_jsx("input", { value: conviteUrl, readOnly: true, className: "flex-1 bg-transparent text-text text-sm focus:outline-none" }), _jsx("button", { onClick: copyUrl, className: "text-accent hover:text-accent/80", children: _jsx(Copy, { size: 18 }) })] }), _jsx("button", { onClick: () => setModalOpen(false), className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl", children: "Fechar" })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Telefone" }), _jsx("input", { value: form.telefone, onChange: (e) => setForm({ ...form, telefone: e.target.value }), className: "w-full ui-input" })] }), _jsx("button", { onClick: save, className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl", children: editing ? 'Salvar' : 'Criar e Gerar Convite' })] })) })] }) }));
}
