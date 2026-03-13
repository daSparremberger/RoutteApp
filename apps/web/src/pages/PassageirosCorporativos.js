import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
const initialForm = {
    nome: '',
    telefone: '',
    email: '',
    endereco: '',
    lat: null,
    lng: null,
    empresa: '',
    cargo: '',
    centro_custo: '',
    horario_entrada: '',
    horario_saida: '',
};
export function PassageirosCorporativos() {
    const [passageiros, setPassageiros] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialForm);
    useEffect(() => {
        load();
    }, []);
    async function load() {
        const data = await api.get('/passageiros-corporativos');
        setPassageiros(data);
    }
    function openNew() {
        setEditing(null);
        setForm(initialForm);
        setModalOpen(true);
    }
    function openEdit(passageiro) {
        setEditing(passageiro);
        setForm({
            nome: passageiro.nome,
            telefone: passageiro.telefone || '',
            email: passageiro.email || '',
            endereco: passageiro.endereco || '',
            lat: passageiro.lat ?? null,
            lng: passageiro.lng ?? null,
            empresa: passageiro.profile?.empresa || '',
            cargo: passageiro.profile?.cargo || '',
            centro_custo: passageiro.profile?.centro_custo || '',
            horario_entrada: passageiro.profile?.horario_entrada || '',
            horario_saida: passageiro.profile?.horario_saida || '',
        });
        setModalOpen(true);
    }
    async function save() {
        const payload = { ...form };
        if (payload.endereco && (payload.lat == null || payload.lng == null)) {
            const match = await geocodeAddress(payload.endereco);
            if (match) {
                payload.lat = match.lat;
                payload.lng = match.lng;
            }
        }
        if (editing) {
            await api.put(`/passageiros-corporativos/${editing.id}`, payload);
        }
        else {
            await api.post('/passageiros-corporativos', payload);
        }
        setModalOpen(false);
        load();
    }
    async function remove(id) {
        if (!confirm('Excluir este passageiro corporativo?'))
            return;
        await api.delete(`/passageiros-corporativos/${id}`);
        load();
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Passageiros Corporativos", subtitle: `${passageiros.length} passageiro(s)`, action: _jsxs("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Plus, { size: 18 }), " Novo Passageiro"] }) }), passageiros.length === 0 ? (_jsx(EmptyState, { icon: Briefcase, message: "Nenhum passageiro corporativo cadastrado" })) : (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Nome" }), _jsx("th", { className: "px-4 py-3", children: "Empresa" }), _jsx("th", { className: "px-4 py-3", children: "Cargo" }), _jsx("th", { className: "px-4 py-3", children: "Centro de Custo" }), _jsx("th", { className: "px-4 py-3 w-24" })] }) }), _jsx("tbody", { className: "text-sm", children: passageiros.map((passageiro) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: passageiro.nome }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: passageiro.profile?.empresa || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: passageiro.profile?.cargo || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: passageiro.profile?.centro_custo || '-' }), _jsxs("td", { className: "px-4 py-3 flex gap-2", children: [_jsx("button", { onClick: () => openEdit(passageiro), className: "text-text-muted hover:text-text", children: _jsx(Pencil, { size: 16 }) }), _jsx("button", { onClick: () => remove(passageiro.id), className: "text-text-muted hover:text-red-400", children: _jsx(Trash2, { size: 16 }) })] })] }, passageiro.id))) })] }) })), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editing ? 'Editar Passageiro' : 'Novo Passageiro', children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Telefone" }), _jsx("input", { value: form.telefone, onChange: (e) => setForm({ ...form, telefone: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Email" }), _jsx("input", { value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Empresa" }), _jsx("input", { value: form.empresa, onChange: (e) => setForm({ ...form, empresa: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Endereco" }), _jsx(AddressAutocompleteInput, { value: form.endereco, onChange: (value) => setForm({ ...form, endereco: value, lat: null, lng: null }), onSelect: (suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng }), className: "h-12" })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Cargo" }), _jsx("input", { value: form.cargo, onChange: (e) => setForm({ ...form, cargo: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Centro de Custo" }), _jsx("input", { value: form.centro_custo, onChange: (e) => setForm({ ...form, centro_custo: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Horario de Entrada" }), _jsx("input", { value: form.horario_entrada, onChange: (e) => setForm({ ...form, horario_entrada: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Horario de Saida" }), _jsx("input", { value: form.horario_saida, onChange: (e) => setForm({ ...form, horario_saida: e.target.value }), className: "w-full ui-input" })] })] }), _jsx("button", { onClick: save, disabled: !form.nome, className: "w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50", children: editing ? 'Salvar Alteracoes' : 'Cadastrar Passageiro' })] }) })] }) }));
}
