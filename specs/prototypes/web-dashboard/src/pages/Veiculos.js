import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, Car, ChevronRight, Save, Map } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { api } from '../lib/api';
export function Veiculos() {
    const [veiculos, setVeiculos] = useState([]);
    const [selected, setSelected] = useState(null);
    const [motoristas, setMotoristas] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedMotoristaIds, setSelectedMotoristaIds] = useState([]);
    const [form, setForm] = useState({
        placa: '',
        ano: '',
        fabricante: '',
        modelo: '',
        capacidade: '',
        consumo_km: '',
    });
    useEffect(() => {
        load();
    }, []);
    async function load() {
        const [v, m] = await Promise.all([
            api.get('/veiculos'),
            api.get('/motoristas'),
        ]);
        setVeiculos(v);
        setMotoristas(m.filter((x) => x.cadastro_completo));
    }
    async function selectVeiculo(v) {
        const detail = await api.get(`/veiculos/${v.id}`);
        setSelected(detail);
        setSelectedMotoristaIds(detail.motoristas_habilitados?.map((m) => m.motorista_id) || []);
    }
    function openNew() {
        setForm({
            placa: '',
            ano: '',
            fabricante: '',
            modelo: '',
            capacidade: '',
            consumo_km: '',
        });
        setModalOpen(true);
    }
    async function createVeiculo() {
        await api.post('/veiculos', {
            placa: form.placa,
            ano: form.ano ? Number(form.ano) : null,
            fabricante: form.fabricante,
            modelo: form.modelo,
            capacidade: Number(form.capacidade),
            consumo_km: form.consumo_km ? Number(form.consumo_km) : null,
        });
        setModalOpen(false);
        load();
    }
    function toggleMotorista(id) {
        setSelectedMotoristaIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
    async function saveMotoristas() {
        if (!selected)
            return;
        setSaving(true);
        try {
            await api.put(`/veiculos/${selected.id}/motoristas`, {
                motorista_ids: selectedMotoristaIds,
            });
            await selectVeiculo(selected);
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { className: "flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6", children: [_jsxs("div", { className: "w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1", children: [_jsx(PageHeader, { title: "Ve\u00EDculos", subtitle: `${veiculos.length} veículo(s)`, action: _jsx("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-xl text-sm font-medium", children: _jsx(Plus, { size: 16 }) }) }), veiculos.length === 0 ? (_jsx(EmptyState, { icon: Car, message: "Nenhum ve\u00EDculo cadastrado" })) : (_jsx("div", { className: "space-y-2", children: veiculos.map((v) => (_jsx("button", { onClick: () => selectVeiculo(v), className: `w-full text-left bg-surface2 border rounded-xl p-4 transition-colors ${selected?.id === v.id
                                    ? 'border-accent'
                                    : 'border-border/30 hover:border-border'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-text font-medium", children: v.placa }), _jsxs("p", { className: "text-text-muted text-xs mt-1", children: [v.modelo, " ", v.fabricante, " ", v.ano || ''] })] }), _jsx(ChevronRight, { size: 18, className: "text-text-muted" })] }) }, v.id))) }))] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto p-4 md:p-6", children: selected ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-text mb-4", children: selected.placa }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsx("p", { className: "text-text-muted text-xs mb-1", children: "Modelo" }), _jsx("p", { className: "text-text", children: selected.modelo })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsx("p", { className: "text-text-muted text-xs mb-1", children: "Fabricante" }), _jsx("p", { className: "text-text", children: selected.fabricante })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsx("p", { className: "text-text-muted text-xs mb-1", children: "Capacidade" }), _jsxs("p", { className: "text-text", children: [selected.capacidade, " passageiros"] })] }), _jsxs("div", { className: "rounded-xl p-4 border border-border/30", children: [_jsx("p", { className: "text-text-muted text-xs mb-1", children: "Consumo" }), _jsx("p", { className: "text-text", children: selected.consumo_km ? `${selected.consumo_km} km/L` : '-' })] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("h3", { className: "text-sm text-text-muted", children: ["Motoristas Habilitados (", selectedMotoristaIds.length, ")"] }), _jsxs("button", { onClick: saveMotoristas, disabled: saving, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50", children: [_jsx(Save, { size: 14 }), saving ? 'Salvando...' : 'Salvar'] })] }), _jsx("div", { className: "rounded-xl p-3 border border-border/30 max-h-48 overflow-y-auto space-y-1", children: motoristas.length === 0 ? (_jsx("p", { className: "text-text-muted text-sm p-2", children: "Nenhum motorista dispon\u00EDvel" })) : (motoristas.map((m) => (_jsxs("label", { className: `flex items-center gap-3 p-2 rounded-lg cursor-pointer ${selectedMotoristaIds.includes(m.id)
                                                ? 'bg-accent/20'
                                                : 'hover:bg-surface2'}`, children: [_jsx("input", { type: "checkbox", checked: selectedMotoristaIds.includes(m.id), onChange: () => toggleMotorista(m.id), className: "rounded" }), _jsx("span", { className: "text-text text-sm", children: m.nome }), m.telefone && (_jsx("span", { className: "text-text-muted text-xs", children: m.telefone }))] }, m.id)))) })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-sm text-text-muted mb-3", children: ["Rotas Vinculadas (", selected.rotas_vinculadas?.length || 0, ")"] }), selected.rotas_vinculadas && selected.rotas_vinculadas.length > 0 ? (_jsx("div", { className: "space-y-2", children: selected.rotas_vinculadas.map((r) => (_jsxs("div", { className: "flex items-center gap-3 bg-surface2 rounded-lg p-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center", children: _jsx(Map, { size: 16, className: "text-accent" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-text text-sm", children: r.nome }), _jsxs("p", { className: "text-text-muted text-xs", children: [r.motorista_nome || 'Sem motorista', " - ", r.turno] })] })] }, r.id))) })) : (_jsx("div", { className: "rounded-xl p-4 border border-border/30 text-center text-text-muted text-sm", children: "Nenhuma rota vinculada a este ve\u00EDculo" }))] })] })) : (_jsx("div", { className: "flex items-center justify-center h-full text-text-muted", children: _jsx("p", { children: "Selecione um ve\u00EDculo para ver detalhes" }) })) }), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: "Novo Ve\u00EDculo", size: "md", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Placa" }), _jsx("input", { value: form.placa, onChange: (e) => setForm({ ...form, placa: e.target.value.toUpperCase() }), placeholder: "ABC1D23", className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Ano" }), _jsx("input", { value: form.ano, onChange: (e) => setForm({ ...form, ano: e.target.value }), type: "number", placeholder: "2020", className: "w-full ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Fabricante" }), _jsx("input", { value: form.fabricante, onChange: (e) => setForm({ ...form, fabricante: e.target.value }), placeholder: "Fiat", className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Modelo" }), _jsx("input", { value: form.modelo, onChange: (e) => setForm({ ...form, modelo: e.target.value }), placeholder: "Ducato", className: "w-full ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Capacidade (passageiros)" }), _jsx("input", { value: form.capacidade, onChange: (e) => setForm({ ...form, capacidade: e.target.value }), type: "number", placeholder: "15", className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Consumo (km/L)" }), _jsx("input", { value: form.consumo_km, onChange: (e) => setForm({ ...form, consumo_km: e.target.value }), type: "number", step: "0.1", placeholder: "8.5", className: "w-full ui-input" })] })] }), _jsx("button", { onClick: createVeiculo, disabled: !form.placa || !form.fabricante || !form.modelo || !form.capacidade, className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50", children: "Criar Ve\u00EDculo" })] }) })] }) }));
}
