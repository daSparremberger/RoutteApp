import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, School, X, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
const CARGO_OPTIONS = ['Diretor', 'Coordenador', 'Secretário', 'Outro'];
export function Escolas() {
    const [escolas, setEscolas] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        nome: '',
        endereco: '',
        lat: null,
        lng: null,
        turno_manha: false,
        turno_tarde: false,
        turno_noite: false,
    });
    const [contatos, setContatos] = useState([]);
    const [originalContatos, setOriginalContatos] = useState([]);
    const [expandedSchool, setExpandedSchool] = useState(null);
    const [schoolContatos, setSchoolContatos] = useState([]);
    useEffect(() => {
        load();
    }, []);
    async function load() {
        const data = await api.get('/escolas');
        setEscolas(data);
    }
    function openNew() {
        setEditing(null);
        setForm({
            nome: '',
            endereco: '',
            lat: null,
            lng: null,
            turno_manha: false,
            turno_tarde: false,
            turno_noite: false,
        });
        setContatos([]);
        setOriginalContatos([]);
        setModalOpen(true);
    }
    async function openEdit(escola) {
        setEditing(escola);
        setForm({
            nome: escola.nome,
            endereco: escola.endereco,
            lat: escola.lat,
            lng: escola.lng,
            turno_manha: escola.turno_manha,
            turno_tarde: escola.turno_tarde,
            turno_noite: escola.turno_noite,
        });
        try {
            const detail = await api.get(`/escolas/${escola.id}`);
            const contatosData = detail.contatos || [];
            setOriginalContatos(contatosData);
            setContatos(contatosData.map((c) => ({ id: c.id, cargo: c.cargo, nome: c.nome, telefone: c.telefone || '' })));
        }
        catch {
            setContatos([]);
            setOriginalContatos([]);
        }
        setModalOpen(true);
    }
    function addContato() {
        setContatos([...contatos, { cargo: 'Diretor', nome: '', telefone: '' }]);
    }
    function removeContato(index) {
        setContatos(contatos.filter((_, i) => i !== index));
    }
    function updateContato(index, field, value) {
        setContatos(contatos.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
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
        let escolaId;
        if (editing) {
            await api.put(`/escolas/${editing.id}`, payload);
            escolaId = editing.id;
        }
        else {
            const newEscola = await api.post('/escolas', payload);
            escolaId = newEscola.id;
        }
        if (editing) {
            const currentIds = contatos.filter((c) => c.id).map((c) => c.id);
            for (const original of originalContatos) {
                if (!currentIds.includes(original.id)) {
                    await api.delete(`/escolas/${escolaId}/contatos/${original.id}`);
                }
            }
        }
        for (const contato of contatos) {
            if (!contato.nome.trim())
                continue;
            const contatoPayload = {
                cargo: contato.cargo,
                nome: contato.nome,
                telefone: contato.telefone || null,
            };
            if (contato.id) {
                await api.put(`/escolas/${escolaId}/contatos/${contato.id}`, contatoPayload);
            }
            else {
                await api.post(`/escolas/${escolaId}/contatos`, contatoPayload);
            }
        }
        setModalOpen(false);
        load();
    }
    async function remove(id) {
        if (!confirm('Excluir esta escola?'))
            return;
        await api.delete(`/escolas/${id}`);
        load();
    }
    async function toggleContatos(escolaId) {
        if (expandedSchool === escolaId) {
            setExpandedSchool(null);
            setSchoolContatos([]);
            return;
        }
        try {
            const escola = await api.get(`/escolas/${escolaId}`);
            setSchoolContatos(escola.contatos || []);
        }
        catch {
            setSchoolContatos([]);
        }
        setExpandedSchool(escolaId);
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Escolas", subtitle: `${escolas.length} escola(s) cadastrada(s)`, action: _jsxs("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-surface rounded-xl hover:bg-accent-hover", children: [_jsx(Plus, { size: 18 }), " Nova Escola"] }) }), escolas.length === 0 ? (_jsx(EmptyState, { icon: School, message: "Nenhuma escola cadastrada" })) : (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Nome" }), _jsx("th", { className: "px-4 py-3", children: "Endere\u00E7o" }), _jsx("th", { className: "px-4 py-3", children: "Turnos" }), _jsx("th", { className: "px-4 py-3", children: "Contatos" }), _jsx("th", { className: "px-4 py-3 w-24" })] }) }), _jsx("tbody", { className: "text-sm", children: escolas.map((escola) => (_jsxs(Fragment, { children: [_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: escola.nome }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: escola.endereco }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: [escola.turno_manha && 'M', escola.turno_tarde && 'T', escola.turno_noite && 'N'].filter(Boolean).join(', ') || '-' }), _jsx("td", { className: "px-4 py-3", children: _jsxs("button", { onClick: () => toggleContatos(escola.id), className: "flex items-center gap-1 text-text-muted hover:text-accent", children: [_jsx(Users, { size: 16 }), _jsx("span", { className: "text-xs", children: "Ver" })] }) }), _jsxs("td", { className: "px-4 py-3 flex gap-2", children: [_jsx("button", { onClick: () => openEdit(escola), className: "text-text-muted hover:text-text", children: _jsx(Pencil, { size: 16 }) }), _jsx("button", { onClick: () => remove(escola.id), className: "text-text-muted hover:text-red-400", children: _jsx(Trash2, { size: 16 }) })] })] }), expandedSchool === escola.id && (_jsx("tr", { className: "bg-surface2/30", children: _jsx("td", { colSpan: 5, className: "px-4 py-3", children: schoolContatos.length === 0 ? (_jsx("p", { className: "text-sm text-text-muted", children: "Nenhum contato cadastrado" })) : (_jsx("div", { className: "space-y-2", children: schoolContatos.map((contato) => (_jsxs("div", { className: "flex items-center gap-4 text-sm", children: [_jsx("span", { className: "rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent", children: contato.cargo }), _jsx("span", { className: "text-text", children: contato.nome }), contato.telefone && _jsx("span", { className: "text-text-muted", children: contato.telefone })] }, contato.id))) })) }) }))] }, escola.id))) })] }) })), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editing ? 'Editar Escola' : 'Nova Escola', children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: "w-full ui-input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Endere\u00E7o" }), _jsx(AddressAutocompleteInput, { value: form.endereco, onChange: (value) => setForm({ ...form, endereco: value, lat: null, lng: null }), onSelect: (suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng }) }), _jsx("p", { className: "mt-1 text-xs text-text-muted", children: form.lat != null && form.lng != null
                                            ? 'Coordenadas definidas automaticamente.'
                                            : 'Selecione um endereço da lista para preencher as coordenadas.' })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Turnos" }), _jsx("div", { className: "flex gap-4", children: ['manha', 'tarde', 'noite'].map((turno) => (_jsxs("label", { className: "flex items-center gap-2 text-sm text-text-muted", children: [_jsx("input", { type: "checkbox", checked: form[`turno_${turno}`], onChange: (e) => setForm({ ...form, [`turno_${turno}`]: e.target.checked }), className: "rounded border-border/30 bg-surface2" }), turno.charAt(0).toUpperCase() + turno.slice(1)] }, turno))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Contatos" }), _jsxs("div", { className: "space-y-2", children: [contatos.map((contato, index) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("select", { value: contato.cargo, onChange: (e) => updateContato(index, 'cargo', e.target.value), className: "rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none", children: CARGO_OPTIONS.map((cargo) => (_jsx("option", { value: cargo, children: cargo }, cargo))) }), _jsx("input", { placeholder: "Nome", value: contato.nome, onChange: (e) => updateContato(index, 'nome', e.target.value), className: "flex-1 rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none" }), _jsx("input", { placeholder: "Telefone", value: contato.telefone, onChange: (e) => updateContato(index, 'telefone', e.target.value), className: "w-32 rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none" }), _jsx("button", { onClick: () => removeContato(index), type: "button", className: "p-1 text-text-muted hover:text-red-400", children: _jsx(X, { size: 18 }) })] }, index))), _jsxs("button", { onClick: addContato, type: "button", className: "flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80", children: [_jsx(Plus, { size: 16 }), " Adicionar Contato"] })] })] }), _jsx("button", { onClick: save, className: "w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover", children: editing ? 'Salvar' : 'Criar' })] }) })] }) }));
}
