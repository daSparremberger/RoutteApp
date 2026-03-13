import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, Map, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { RouteMap } from '../components/maps/RouteMap';
import { api } from '../lib/api';
export function Rotas() {
    const [rotas, setRotas] = useState([]);
    const [selected, setSelected] = useState(null);
    const [veiculos, setVeiculos] = useState([]);
    const [alunos, setAlunos] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ nome: '', veiculo_id: '', turno: 'manha', aluno_ids: [] });
    useEffect(() => { load(); }, []);
    async function load() {
        const [r, v, a] = await Promise.all([
            api.get('/rotas'),
            api.get('/veiculos'),
            api.get('/alunos'),
        ]);
        setRotas(r);
        setVeiculos(v.filter((x) => x.ativo));
        setAlunos(a);
    }
    async function selectRota(r) {
        const detail = await api.get(`/rotas/${r.id}`);
        setSelected(detail);
    }
    function openNew() {
        setForm({ nome: '', veiculo_id: veiculos[0]?.id?.toString() || '', turno: 'manha', aluno_ids: [] });
        setModalOpen(true);
    }
    async function save() {
        await api.post('/rotas', { ...form, veiculo_id: Number(form.veiculo_id), aluno_ids: form.aluno_ids });
        setModalOpen(false);
        load();
    }
    function toggleAluno(id) {
        setForm((f) => ({
            ...f,
            aluno_ids: f.aluno_ids.includes(id) ? f.aluno_ids.filter((x) => x !== id) : [...f.aluno_ids, id],
        }));
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { className: "flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6", children: [_jsxs("div", { className: "w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1", children: [_jsx(PageHeader, { title: "Rotas", subtitle: `${rotas.length} rota(s)`, action: _jsx("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-xl text-sm font-medium", children: _jsx(Plus, { size: 16 }) }) }), rotas.length === 0 ? _jsx(EmptyState, { icon: Map, message: "Nenhuma rota" }) : (_jsx("div", { className: "space-y-2", children: rotas.map((r) => (_jsx("button", { onClick: () => selectRota(r), className: `w-full text-left bg-surface2 border rounded-xl p-4 transition-colors ${selected?.id === r.id ? 'border-accent' : 'border-border/30 hover:border-border'}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-text font-medium", children: r.nome }), _jsxs("p", { className: "text-text-muted text-xs mt-1", children: ["Ve\u00EDculo: ", r.veiculo_placa || 'Sem veículo', " - ", r.turno] })] }), _jsx(ChevronRight, { size: 18, className: "text-text-muted" })] }) }, r.id))) }))] }), _jsx("div", { className: "min-h-0 flex-1 overflow-y-auto p-4 md:p-6", children: selected ? (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-text mb-4", children: selected.nome }), _jsx(RouteMap, { paradas: selected.paradas || [], geojson: selected.rota_geojson }), _jsxs("div", { className: "mt-4", children: [_jsxs("h3", { className: "text-sm text-text-muted mb-2", children: ["Paradas (", selected.paradas?.length || 0, ")"] }), _jsx("div", { className: "space-y-2", children: selected.paradas?.map((p, i) => (_jsxs("div", { className: "flex items-center gap-3 bg-surface2 rounded-lg p-3", children: [_jsx("div", { className: "w-6 h-6 rounded-full bg-accent flex items-center justify-center text-text text-xs font-bold", children: i + 1 }), _jsxs("div", { children: [_jsx("p", { className: "text-text text-sm", children: p.aluno_nome }), _jsx("p", { className: "text-text-muted text-xs", children: p.aluno_endereco })] })] }, p.id))) })] })] })) : (_jsx("div", { className: "flex items-center justify-center h-full text-text-muted", children: _jsx("p", { children: "Selecione uma rota para ver detalhes" }) })) }), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: "Nova Rota", size: "lg", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Ve\u00EDculo" }), _jsx("select", { value: form.veiculo_id, onChange: (e) => setForm({ ...form, veiculo_id: e.target.value }), className: "w-full ui-input", children: veiculos.map((v) => _jsxs("option", { value: v.id, children: [v.placa, " - ", v.modelo] }, v.id)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Turno" }), _jsxs("select", { value: form.turno, onChange: (e) => setForm({ ...form, turno: e.target.value }), className: "w-full ui-input", children: [_jsx("option", { value: "manha", children: "Manh\u00E3" }), _jsx("option", { value: "tarde", children: "Tarde" }), _jsx("option", { value: "noite", children: "Noite" })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Alunos (selecione na ordem das paradas)" }), _jsx("div", { className: "max-h-48 overflow-y-auto bg-surface2 rounded-xl p-2 space-y-1", children: alunos.filter((a) => a.turno === form.turno).map((a) => (_jsxs("label", { className: `flex items-center gap-3 p-2 rounded-lg cursor-pointer ${form.aluno_ids.includes(a.id) ? 'bg-accent/20' : 'hover:bg-surface2'}`, children: [_jsx("input", { type: "checkbox", checked: form.aluno_ids.includes(a.id), onChange: () => toggleAluno(a.id), className: "rounded" }), _jsx("span", { className: "text-text text-sm", children: a.nome }), _jsx("span", { className: "text-text-muted text-xs", children: a.escola_nome }), form.aluno_ids.includes(a.id) && _jsxs("span", { className: "ml-auto text-accent text-xs", children: ["#", form.aluno_ids.indexOf(a.id) + 1] })] }, a.id))) })] }), _jsx("button", { onClick: save, disabled: !form.nome || !form.veiculo_id || form.aluno_ids.length === 0, className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50", children: "Criar Rota" })] }) })] }) }));
}
