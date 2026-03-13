import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
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
    endereco: '',
    lat: null,
    lng: null,
    empresa: '',
    tipo_carga: '',
    peso_max_kg: '',
    instrucoes: '',
    contato_recebedor: '',
};
export function Entregas() {
    const [clientes, setClientes] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialForm);
    useEffect(() => {
        load();
    }, []);
    async function load() {
        const data = await api.get('/entregas');
        setClientes(data);
    }
    function openNew() {
        setEditing(null);
        setForm(initialForm);
        setModalOpen(true);
    }
    function openEdit(cliente) {
        setEditing(cliente);
        setForm({
            nome: cliente.nome,
            telefone: cliente.telefone || '',
            endereco: cliente.endereco || '',
            lat: cliente.lat ?? null,
            lng: cliente.lng ?? null,
            empresa: cliente.profile?.empresa || '',
            tipo_carga: cliente.profile?.tipo_carga || '',
            peso_max_kg: cliente.profile?.peso_max_kg?.toString() || '',
            instrucoes: cliente.profile?.instrucoes || '',
            contato_recebedor: cliente.profile?.contato_recebedor || '',
        });
        setModalOpen(true);
    }
    async function save() {
        const payload = {
            ...form,
            peso_max_kg: form.peso_max_kg ? parseFloat(form.peso_max_kg) : null,
        };
        if (payload.endereco && (payload.lat == null || payload.lng == null)) {
            const match = await geocodeAddress(payload.endereco);
            if (match) {
                payload.lat = match.lat;
                payload.lng = match.lng;
            }
        }
        if (editing) {
            await api.put(`/entregas/${editing.id}`, payload);
        }
        else {
            await api.post('/entregas', payload);
        }
        setModalOpen(false);
        load();
    }
    async function remove(id) {
        if (!confirm('Excluir este cliente de entrega?'))
            return;
        await api.delete(`/entregas/${id}`);
        load();
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Entregas", subtitle: `${clientes.length} cliente(s)`, action: _jsxs("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Plus, { size: 18 }), " Novo Cliente"] }) }), clientes.length === 0 ? (_jsx(EmptyState, { icon: Package, message: "Nenhum cliente de entrega cadastrado" })) : (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Nome" }), _jsx("th", { className: "px-4 py-3", children: "Empresa" }), _jsx("th", { className: "px-4 py-3", children: "Tipo de Carga" }), _jsx("th", { className: "px-4 py-3", children: "Telefone" }), _jsx("th", { className: "px-4 py-3 w-24" })] }) }), _jsx("tbody", { className: "text-sm", children: clientes.map((cliente) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: cliente.nome }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: cliente.profile?.empresa || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: cliente.profile?.tipo_carga || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: cliente.telefone || '-' }), _jsxs("td", { className: "px-4 py-3 flex gap-2", children: [_jsx("button", { onClick: () => openEdit(cliente), className: "text-text-muted hover:text-text", children: _jsx(Pencil, { size: 16 }) }), _jsx("button", { onClick: () => remove(cliente.id), className: "text-text-muted hover:text-red-400", children: _jsx(Trash2, { size: 16 }) })] })] }, cliente.id))) })] }) })), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editing ? 'Editar Cliente' : 'Novo Cliente', children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Telefone" }), _jsx("input", { value: form.telefone, onChange: (e) => setForm({ ...form, telefone: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Endereco" }), _jsx(AddressAutocompleteInput, { value: form.endereco, onChange: (value) => setForm({ ...form, endereco: value, lat: null, lng: null }), onSelect: (suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng }), className: "h-12" })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Empresa" }), _jsx("input", { value: form.empresa, onChange: (e) => setForm({ ...form, empresa: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Tipo de Carga" }), _jsx("input", { value: form.tipo_carga, onChange: (e) => setForm({ ...form, tipo_carga: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Peso Maximo (kg)" }), _jsx("input", { type: "number", step: "0.01", value: form.peso_max_kg, onChange: (e) => setForm({ ...form, peso_max_kg: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Contato Recebedor" }), _jsx("input", { value: form.contato_recebedor, onChange: (e) => setForm({ ...form, contato_recebedor: e.target.value }), className: "w-full ui-input" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Instrucoes" }), _jsx("textarea", { value: form.instrucoes, onChange: (e) => setForm({ ...form, instrucoes: e.target.value }), rows: 3, className: "w-full ui-input" })] }), _jsx("button", { onClick: save, disabled: !form.nome, className: "w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50", children: editing ? 'Salvar Alteracoes' : 'Cadastrar Cliente' })] }) })] }) }));
}
