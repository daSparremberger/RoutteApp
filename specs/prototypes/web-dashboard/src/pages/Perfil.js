import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Camera, MapPin, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth';
const regioes = [
    'Sul',
    'Sudeste',
    'Centro-Oeste',
    'Nordeste',
    'Norte',
];
const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];
export function Perfil() {
    const { user } = useAuthStore();
    const [form, setForm] = useState({
        nome: user?.nome || '',
        email: user?.email || '',
        cidade: '',
        estado: 'SP',
        regiao: 'Sudeste',
    });
    const [saving, setSaving] = useState(false);
    const handleSave = async () => {
        setSaving(true);
        // TODO: Implement save
        await new Promise(r => setTimeout(r, 1000));
        setSaving(false);
    };
    const inputClass = "w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200";
    return (_jsxs(PageTransition, { children: [_jsx(PageHeader, { title: "Perfil", subtitle: "Gerencie suas informa\u00E7\u00F5es pessoais" }), _jsxs("div", { className: "max-w-2xl", children: [_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 }, className: "bg-surface2 border border-border/30 rounded-2xl p-6 mb-6", children: [_jsxs("div", { className: "flex items-center gap-6 mb-8", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "w-24 h-24 rounded-2xl bg-accent-muted flex items-center justify-center", children: _jsx("span", { className: "text-3xl font-bold text-accent", children: form.nome.charAt(0).toUpperCase() }) }), _jsx("button", { className: "absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors", children: _jsx(Camera, { size: 14, className: "text-surface" }) })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: form.nome }), _jsx("p", { className: "text-sm text-text-muted", children: form.email })] })] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Nome completo" }), _jsx("input", { value: form.nome, onChange: (e) => setForm({ ...form, nome: e.target.value }), className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), className: inputClass })] })] }) })] }), _jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.2 }, className: "bg-surface2 border border-border/30 rounded-2xl p-6 mb-6", children: [_jsxs("div", { className: "flex items-center gap-3 mb-6", children: [_jsx("div", { className: "w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center", children: _jsx(MapPin, { size: 18, className: "text-accent" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-text", children: "Localiza\u00E7\u00E3o" }), _jsx("p", { className: "text-sm text-text-muted", children: "Regi\u00E3o de opera\u00E7\u00E3o" })] })] }), _jsxs("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Cidade" }), _jsx("input", { value: form.cidade, onChange: (e) => setForm({ ...form, cidade: e.target.value }), placeholder: "Sua cidade", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Estado" }), _jsx("select", { value: form.estado, onChange: (e) => setForm({ ...form, estado: e.target.value }), className: inputClass, children: estados.map(uf => (_jsx("option", { value: uf, children: uf }, uf))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-text-muted mb-2", children: "Regiao" }), _jsx("select", { value: form.regiao, onChange: (e) => setForm({ ...form, regiao: e.target.value }), className: inputClass, children: regioes.map(r => (_jsx("option", { value: r, children: r }, r))) })] })] })] }), _jsxs(motion.button, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 }, onClick: handleSave, disabled: saving, className: "flex items-center justify-center gap-2 w-full h-12 bg-accent hover:bg-accent-hover\n                     text-surface font-semibold rounded-xl transition-colors duration-200 disabled:opacity-50", children: [_jsx(Save, { size: 18 }), saving ? 'Salvando...' : 'Salvar alteracoes'] })] })] }));
}
