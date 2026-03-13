import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp, Camera, Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api, downloadCsv, resolveUploadUrl } from '../lib/api';
import { FileUpload } from '../components/ui/FileUpload';
import { geocodeAddress } from '../lib/mapbox';
const initialForm = {
    nome: '',
    nascimento: '',
    telefone: '',
    endereco: '',
    lat: null,
    lng: null,
    foto_url: '',
    escola_id: '',
    turno: 'manha',
    turma: '',
    ano: '',
    nome_responsavel: '',
    cpf_responsavel: '',
    nascimento_responsavel: '',
    telefone_responsavel: '',
    valor_mensalidade: '',
    meses_contrato: '',
    inicio_contrato: '',
    restricoes: '',
    observacoes: '',
    face_embeddings: null,
};
export function Alunos() {
    const [alunos, setAlunos] = useState([]);
    const [escolas, setEscolas] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [expandedSections, setExpandedSections] = useState({
        responsavel: true,
        contrato: false,
        saude: false,
        biometria: false,
    });
    useEffect(() => {
        load();
    }, []);
    async function load() {
        const [a, e] = await Promise.all([api.get('/alunos'), api.get('/escolas')]);
        setAlunos(a);
        setEscolas(e);
    }
    function openNew() {
        setEditing(null);
        setForm({ ...initialForm, escola_id: escolas[0]?.id?.toString() || '' });
        setExpandedSections({ responsavel: true, contrato: false, saude: false, biometria: false });
        setModalOpen(true);
    }
    function openEdit(aluno) {
        setEditing(aluno);
        setForm({
            nome: aluno.nome,
            nascimento: aluno.nascimento?.split('T')[0] || '',
            telefone: aluno.telefone || '',
            endereco: aluno.endereco || '',
            lat: aluno.lat ?? null,
            lng: aluno.lng ?? null,
            escola_id: aluno.escola_id?.toString() || '',
            turno: aluno.turno || 'manha',
            turma: aluno.turma || '',
            ano: aluno.ano || '',
            nome_responsavel: aluno.nome_responsavel || '',
            cpf_responsavel: aluno.cpf_responsavel || '',
            nascimento_responsavel: aluno.nascimento_responsavel?.split('T')[0] || '',
            telefone_responsavel: aluno.telefone_responsavel || '',
            valor_mensalidade: aluno.valor_mensalidade?.toString() || '',
            meses_contrato: aluno.meses_contrato?.toString() || '',
            inicio_contrato: aluno.inicio_contrato?.split('T')[0] || '',
            restricoes: aluno.restricoes || '',
            observacoes: aluno.observacoes || '',
            foto_url: aluno.foto_url || '',
            face_embeddings: aluno.face_embeddings || null,
        });
        setExpandedSections({
            responsavel: true,
            contrato: !!aluno.valor_mensalidade,
            saude: !!aluno.restricoes || !!aluno.observacoes,
            biometria: false,
        });
        setModalOpen(true);
    }
    async function save() {
        const payload = {
            ...form,
            escola_id: Number(form.escola_id),
            nascimento: form.nascimento || null,
            nascimento_responsavel: form.nascimento_responsavel || null,
            inicio_contrato: form.inicio_contrato || null,
            valor_mensalidade: form.valor_mensalidade ? parseFloat(form.valor_mensalidade) : null,
            meses_contrato: form.meses_contrato ? parseInt(form.meses_contrato, 10) : null,
        };
        if (payload.endereco && (payload.lat == null || payload.lng == null)) {
            const match = await geocodeAddress(payload.endereco);
            if (match) {
                payload.lat = match.lat;
                payload.lng = match.lng;
            }
        }
        if (editing) {
            await api.put(`/alunos/${editing.id}`, payload);
        }
        else {
            await api.post('/alunos', payload);
        }
        setModalOpen(false);
        load();
    }
    async function remove(id) {
        if (!confirm('Excluir este aluno?'))
            return;
        await api.delete(`/alunos/${id}`);
        load();
    }
    function toggleSection(section) {
        setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    }
    const inputClass = 'w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200';
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Alunos", subtitle: `${alunos.length} aluno(s)`, action: _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => downloadCsv('/alunos/export', 'alunos.csv'), className: "flex items-center gap-2 border border-border text-text-muted hover:text-text px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Download, { size: 18 }), " Exportar CSV"] }), _jsxs("button", { onClick: openNew, className: "flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Plus, { size: 18 }), " Novo Aluno"] })] }) }), alunos.length === 0 ? (_jsx(EmptyState, { icon: Users, message: "Nenhum aluno cadastrado" })) : (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Nome" }), _jsx("th", { className: "px-4 py-3", children: "Escola" }), _jsx("th", { className: "px-4 py-3", children: "Turno" }), _jsx("th", { className: "px-4 py-3", children: "Turma" }), _jsx("th", { className: "px-4 py-3", children: "Respons\u00E1vel" }), _jsx("th", { className: "px-4 py-3 w-24" })] }) }), _jsx("tbody", { className: "text-sm", children: alunos.map((aluno) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: aluno.nome }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: aluno.escola_nome || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted capitalize", children: aluno.turno }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: aluno.turma || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: aluno.nome_responsavel || '-' }), _jsxs("td", { className: "px-4 py-3 flex gap-2", children: [_jsx("button", { onClick: () => openEdit(aluno), className: "text-text-muted hover:text-text", children: _jsx(Pencil, { size: 16 }) }), _jsx("button", { onClick: () => remove(aluno.id), className: "text-text-muted hover:text-red-400", children: _jsx(Trash2, { size: 16 }) })] })] }, aluno.id))) })] }) })), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: editing ? 'Editar Aluno' : 'Novo Aluno', size: "lg", children: _jsxs("div", { className: "space-y-6 max-h-[70vh] overflow-y-auto pr-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-text font-medium mb-3", children: "Dados Pessoais" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome Completo *" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Data de Nascimento" }), _jsx("input", { type: "date", value: form.nascimento, onChange: (e) => setForm({ ...form, nascimento: e.target.value }), className: inputClass })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Telefone" }), _jsx("input", { value: form.telefone, onChange: (e) => setForm({ ...form, telefone: e.target.value }), placeholder: "(00) 00000-0000", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Endere\u00E7o *" }), _jsx(AddressAutocompleteInput, { value: form.endereco, onChange: (value) => setForm({ ...form, endereco: value, lat: null, lng: null }), onSelect: (suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng }), className: "h-12" }), _jsx("p", { className: "mt-1 text-xs text-text-muted", children: form.lat != null && form.lng != null
                                                                    ? 'Coordenadas definidas automaticamente.'
                                                                    : 'Selecione um endereço da lista para preencher as coordenadas.' })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Foto do Aluno" }), _jsx(FileUpload, { value: resolveUploadUrl(form.foto_url), onChange: (url) => setForm({ ...form, foto_url: url || '' }), onUpload: (file) => api.upload('/uploads', file), label: "Enviar foto" })] })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-text font-medium mb-3", children: "Dados Escolares" }), _jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Escola *" }), _jsx("select", { value: form.escola_id, onChange: (e) => setForm({ ...form, escola_id: e.target.value }), className: inputClass, children: escolas.map((escola) => _jsx("option", { value: escola.id, children: escola.nome }, escola.id)) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Turno *" }), _jsxs("select", { value: form.turno, onChange: (e) => setForm({ ...form, turno: e.target.value }), className: inputClass, children: [_jsx("option", { value: "manha", children: "Manh\u00E3" }), _jsx("option", { value: "tarde", children: "Tarde" }), _jsx("option", { value: "noite", children: "Noite" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Ano" }), _jsx("input", { value: form.ano, onChange: (e) => setForm({ ...form, ano: e.target.value }), placeholder: "5\u00BA ano", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Turma" }), _jsx("input", { value: form.turma, onChange: (e) => setForm({ ...form, turma: e.target.value }), placeholder: "A", className: inputClass })] })] })] }), _jsxs("div", { className: "ui-table-wrap", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('responsavel'), className: "w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium", children: [_jsx("span", { children: "Dados do Respons\u00E1vel" }), expandedSections.responsavel ? _jsx(ChevronUp, { size: 18 }) : _jsx(ChevronDown, { size: 18 })] }), expandedSections.responsavel && (_jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nome do Respons\u00E1vel" }), _jsx("input", { value: form.nome_responsavel, onChange: (e) => setForm({ ...form, nome_responsavel: e.target.value }), className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "CPF do Respons\u00E1vel" }), _jsx("input", { value: form.cpf_responsavel, onChange: (e) => setForm({ ...form, cpf_responsavel: e.target.value }), placeholder: "000.000.000-00", className: inputClass })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Nascimento Respons\u00E1vel" }), _jsx("input", { type: "date", value: form.nascimento_responsavel, onChange: (e) => setForm({ ...form, nascimento_responsavel: e.target.value }), className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Telefone Respons\u00E1vel" }), _jsx("input", { value: form.telefone_responsavel, onChange: (e) => setForm({ ...form, telefone_responsavel: e.target.value }), placeholder: "(00) 00000-0000", className: inputClass })] })] })] }))] }), _jsxs("div", { className: "ui-table-wrap", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('contrato'), className: "w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium", children: [_jsx("span", { children: "Contrato" }), expandedSections.contrato ? _jsx(ChevronUp, { size: 18 }) : _jsx(ChevronDown, { size: 18 })] }), expandedSections.contrato && (_jsx("div", { className: "p-4 space-y-3", children: _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Valor Mensalidade (R$)" }), _jsx("input", { type: "number", step: "0.01", value: form.valor_mensalidade, onChange: (e) => setForm({ ...form, valor_mensalidade: e.target.value }), placeholder: "0.00", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Meses de Contrato" }), _jsx("input", { type: "number", value: form.meses_contrato, onChange: (e) => setForm({ ...form, meses_contrato: e.target.value }), placeholder: "12", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "In\u00EDcio do Contrato" }), _jsx("input", { type: "date", value: form.inicio_contrato, onChange: (e) => setForm({ ...form, inicio_contrato: e.target.value }), className: inputClass })] })] }) }))] }), _jsxs("div", { className: "ui-table-wrap", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('saude'), className: "w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium", children: [_jsx("span", { children: "Sa\u00FAde e Observa\u00E7\u00F5es" }), expandedSections.saude ? _jsx(ChevronUp, { size: 18 }) : _jsx(ChevronDown, { size: 18 })] }), expandedSections.saude && (_jsxs("div", { className: "p-4 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Restri\u00E7\u00F5es (alergias, necessidades especiais)" }), _jsx("textarea", { value: form.restricoes, onChange: (e) => setForm({ ...form, restricoes: e.target.value }), rows: 2, className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Observa\u00E7\u00F5es Gerais" }), _jsx("textarea", { value: form.observacoes, onChange: (e) => setForm({ ...form, observacoes: e.target.value }), rows: 2, className: inputClass })] })] }))] }), _jsxs("div", { className: "ui-table-wrap", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('biometria'), className: "w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Camera, { size: 18 }), "Biometria Facial"] }), expandedSections.biometria ? _jsx(ChevronUp, { size: 18 }) : _jsx(ChevronDown, { size: 18 })] }), expandedSections.biometria && (_jsxs("div", { className: "p-4 space-y-4", children: [_jsx("div", { className: "flex items-center gap-3", children: _jsx("span", { className: form.face_embeddings ? 'text-green-400' : 'text-red-400', children: form.face_embeddings ? 'Cadastrado' : 'Não cadastrado' }) }), _jsx("p", { className: "text-sm text-text-muted", children: "Capture 5 fotos do rosto do aluno para habilitar check-in por reconhecimento facial." }), _jsx("button", { type: "button", onClick: () => alert('Funcionalidade de captura facial será implementada em breve'), className: "rounded-xl bg-accent px-4 py-2 text-sm text-surface hover:bg-accent-hover", children: "Capturar Fotos" })] }))] }), _jsx("button", { onClick: save, disabled: !form.nome || !form.endereco || !form.escola_id, className: "w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50", children: editing ? 'Salvar Alterações' : 'Cadastrar Aluno' })] }) })] }) }));
}
