import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, AlertCircle, Check, Trash2, Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';
import { PageTransition } from '../components/ui/PageTransition';
import { api, downloadCsv } from '../lib/api';
const CATEGORIAS_RECEITA = ['mensalidade', 'avulso', 'outros'];
const CATEGORIAS_DESPESA = ['combustivel', 'manutencao', 'seguro', 'multa', 'salario', 'outros'];
const initialForm = {
    tipo: 'receita',
    categoria: 'mensalidade',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    aluno_id: '',
    pago: false
};
export function Financeiro() {
    const [transacoes, setTransacoes] = useState([]);
    const [resumo, setResumo] = useState({ receitas: 0, despesas: 0, saldo: 0, inadimplentes: 0 });
    const [alunos, setAlunos] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [gerarModal, setGerarModal] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroPago, setFiltroPago] = useState('');
    const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
    const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
    useEffect(() => { load(); }, [filtroTipo, filtroPago]);
    useEffect(() => { loadResumo(); }, [mesSelecionado, anoSelecionado]);
    async function load() {
        const params = new URLSearchParams();
        if (filtroTipo)
            params.append('tipo', filtroTipo);
        if (filtroPago)
            params.append('pago', filtroPago);
        const [t, a] = await Promise.all([
            api.get(`/financeiro?${params}`),
            api.get('/alunos')
        ]);
        setTransacoes(t);
        setAlunos(a);
    }
    async function loadResumo() {
        const r = await api.get(`/financeiro/resumo?mes=${mesSelecionado}&ano=${anoSelecionado}`);
        setResumo(r);
    }
    function openNew(tipo) {
        setForm({ ...initialForm, tipo, categoria: tipo === 'receita' ? 'mensalidade' : 'combustivel' });
        setModalOpen(true);
    }
    async function save() {
        await api.post('/financeiro', {
            ...form,
            valor: parseFloat(form.valor),
            aluno_id: form.aluno_id ? parseInt(form.aluno_id) : null
        });
        setModalOpen(false);
        load();
        loadResumo();
    }
    async function marcarPago(id) {
        await api.put(`/financeiro/${id}/pagar`, {});
        load();
        loadResumo();
    }
    async function remove(id) {
        if (!confirm('Excluir esta transação?'))
            return;
        await api.delete(`/financeiro/${id}`);
        load();
        loadResumo();
    }
    async function gerarMensalidades() {
        const res = await api.post('/financeiro/gerar-mensalidades', {
            mes: mesSelecionado,
            ano: anoSelecionado
        });
        alert(`${res.criadas} mensalidade(s) gerada(s)!`);
        setGerarModal(false);
        load();
        loadResumo();
    }
    const inputClass = 'w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200';
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Financeiro", subtitle: "Controle de receitas e despesas", action: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("button", { onClick: () => downloadCsv('/financeiro/export', 'financeiro.csv'), className: "flex items-center gap-2 border border-border text-text-muted hover:text-text px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Download, { size: 18 }), " Exportar CSV"] }), _jsx("button", { onClick: () => setGerarModal(true), className: "flex items-center gap-2 bg-surface2 hover:bg-surface2/80 text-text px-4 py-2 rounded-xl text-sm font-medium", children: "Gerar Mensalidades" }), _jsxs("button", { onClick: () => openNew('receita'), className: "flex items-center gap-2 bg-success hover:bg-success/90 text-surface px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Plus, { size: 18 }), " Receita"] }), _jsxs("button", { onClick: () => openNew('despesa'), className: "flex items-center gap-2 bg-danger hover:bg-danger/90 text-surface px-4 py-2 rounded-xl text-sm font-medium", children: [_jsx(Plus, { size: 18 }), " Despesa"] })] }) }), _jsxs("div", { className: "mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2", children: [_jsx("select", { value: mesSelecionado, onChange: (e) => setMesSelecionado(parseInt(e.target.value)), className: "ui-select", children: ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (_jsx("option", { value: i + 1, children: m }, i))) }), _jsx("select", { value: anoSelecionado, onChange: (e) => setAnoSelecionado(parseInt(e.target.value)), className: "ui-select", children: [2024, 2025, 2026, 2027].map(a => _jsx("option", { value: a, children: a }, a)) })] }), _jsxs("div", { className: "mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { icon: TrendingUp, label: "Receitas", value: `R$ ${resumo.receitas.toFixed(2)}` }), _jsx(StatCard, { icon: TrendingDown, label: "Despesas", value: `R$ ${resumo.despesas.toFixed(2)}` }), _jsx(StatCard, { icon: DollarSign, label: "Saldo", value: `R$ ${resumo.saldo.toFixed(2)}` }), _jsx(StatCard, { icon: AlertCircle, label: "Inadimplentes", value: resumo.inadimplentes.toString() })] }), _jsxs("div", { className: "mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2", children: [_jsxs("select", { value: filtroTipo, onChange: (e) => setFiltroTipo(e.target.value), className: "ui-select", children: [_jsx("option", { value: "", children: "Todos os tipos" }), _jsx("option", { value: "receita", children: "Receitas" }), _jsx("option", { value: "despesa", children: "Despesas" })] }), _jsxs("select", { value: filtroPago, onChange: (e) => setFiltroPago(e.target.value), className: "ui-select", children: [_jsx("option", { value: "", children: "Todos" }), _jsx("option", { value: "true", children: "Pagos" }), _jsx("option", { value: "false", children: "Pendentes" })] })] }), _jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Data" }), _jsx("th", { className: "px-4 py-3", children: "Tipo" }), _jsx("th", { className: "px-4 py-3", children: "Categoria" }), _jsx("th", { className: "px-4 py-3", children: "Descri\u00E7\u00E3o" }), _jsx("th", { className: "px-4 py-3", children: "Aluno" }), _jsx("th", { className: "px-4 py-3 text-right", children: "Valor" }), _jsx("th", { className: "px-4 py-3", children: "Status" }), _jsx("th", { className: "px-4 py-3 w-24" })] }) }), _jsx("tbody", { className: "text-sm", children: transacoes.map((t) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: new Date(t.data || t.criado_em).toLocaleDateString('pt-BR') }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `text-xs px-2 py-1 rounded-full ${t.tipo === 'receita' ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'}`, children: t.tipo === 'receita' ? 'Receita' : 'Despesa' }) }), _jsx("td", { className: "px-4 py-3 text-text-muted capitalize", children: t.categoria }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: t.descricao || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: t.aluno_nome || '-' }), _jsxs("td", { className: `px-4 py-3 text-right font-medium ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}`, children: [t.tipo === 'receita' ? '+' : '-', " R$ ", t.valor.toFixed(2)] }), _jsx("td", { className: "px-4 py-3", children: t.pago ? (_jsx("span", { className: "text-xs px-2 py-1 rounded-full bg-success-muted text-success", children: "Pago" })) : (_jsx("span", { className: "text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500", children: "Pendente" })) }), _jsxs("td", { className: "px-4 py-3 flex gap-2", children: [!t.pago && t.tipo === 'receita' && (_jsx("button", { onClick: () => marcarPago(t.id), className: "text-text-muted hover:text-success", title: "Marcar como pago", children: _jsx(Check, { size: 16 }) })), _jsx("button", { onClick: () => remove(t.id), className: "text-text-muted hover:text-red-400", children: _jsx(Trash2, { size: 16 }) })] })] }, t.id))) })] }) }), _jsx(Modal, { open: modalOpen, onClose: () => setModalOpen(false), title: `Nova ${form.tipo === 'receita' ? 'Receita' : 'Despesa'}`, children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Categoria" }), _jsx("select", { value: form.categoria, onChange: (e) => setForm({ ...form, categoria: e.target.value }), className: inputClass, children: (form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => (_jsx("option", { value: c, children: c.charAt(0).toUpperCase() + c.slice(1) }, c))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Valor (R$)" }), _jsx("input", { type: "number", step: "0.01", value: form.valor, onChange: (e) => setForm({ ...form, valor: e.target.value }), className: inputClass })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Descri\u00E7\u00E3o" }), _jsx("input", { value: form.descricao, onChange: (e) => setForm({ ...form, descricao: e.target.value }), className: inputClass })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Data" }), _jsx("input", { type: "date", value: form.data, onChange: (e) => setForm({ ...form, data: e.target.value }), className: inputClass })] }), form.tipo === 'receita' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Aluno (opcional)" }), _jsxs("select", { value: form.aluno_id, onChange: (e) => setForm({ ...form, aluno_id: e.target.value }), className: inputClass, children: [_jsx("option", { value: "", children: "Nenhum" }), alunos.map(a => _jsx("option", { value: a.id, children: a.nome }, a.id))] })] }))] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-muted", children: [_jsx("input", { type: "checkbox", checked: form.pago, onChange: (e) => setForm({ ...form, pago: e.target.checked }), className: "rounded" }), "J\u00E1 foi pago"] }), _jsx("button", { onClick: save, disabled: !form.valor || !form.categoria, className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50", children: "Salvar" })] }) }), _jsx(Modal, { open: gerarModal, onClose: () => setGerarModal(false), title: "Gerar Mensalidades", children: _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-text-muted text-sm", children: "Isso ir\u00E1 criar uma receita de mensalidade para cada aluno ativo que tenha valor de mensalidade cadastrado." }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "M\u00EAs" }), _jsx("select", { value: mesSelecionado, onChange: (e) => setMesSelecionado(parseInt(e.target.value)), className: inputClass, children: ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (_jsx("option", { value: i + 1, children: m }, i))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-1", children: "Ano" }), _jsx("select", { value: anoSelecionado, onChange: (e) => setAnoSelecionado(parseInt(e.target.value)), className: inputClass, children: [2024, 2025, 2026, 2027].map(a => _jsx("option", { value: a, children: a }, a)) })] })] }), _jsx("button", { onClick: gerarMensalidades, className: "w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl", children: "Gerar Mensalidades" })] }) })] }) }));
}
