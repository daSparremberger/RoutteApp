import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { api } from '../lib/api';
export function Historico() {
    const [historico, setHistorico] = useState([]);
    useEffect(() => {
        api.get('/execucao/historico').then(setHistorico).catch(() => { });
    }, []);
    function formatDate(d) {
        if (!d)
            return '-';
        return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }
    return (_jsx(PageTransition, { children: _jsxs("div", { children: [_jsx(PageHeader, { title: "Hist\u00F3rico", subtitle: "\u00DAltimas execu\u00E7\u00F5es de rotas" }), historico.length === 0 ? _jsx(EmptyState, { icon: History, message: "Nenhum historico de execucao" }) : (_jsx("div", { className: "ui-table-wrap", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "ui-table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Data" }), _jsx("th", { className: "px-4 py-3", children: "Rota" }), _jsx("th", { className: "px-4 py-3", children: "Motorista" }), _jsx("th", { className: "px-4 py-3", children: "Embarcados" }), _jsx("th", { className: "px-4 py-3", children: "Pulados" }), _jsx("th", { className: "px-4 py-3", children: "KM" })] }) }), _jsx("tbody", { className: "text-sm", children: historico.map((h) => (_jsxs("tr", { className: "ui-table-row", children: [_jsx("td", { className: "px-4 py-3 text-text", children: formatDate(h.data_inicio) }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: h.rota_nome || '-' }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: h.motorista_nome || '-' }), _jsx("td", { className: "px-4 py-3 text-success", children: h.alunos_embarcados }), _jsx("td", { className: "px-4 py-3 text-danger", children: h.alunos_pulados }), _jsx("td", { className: "px-4 py-3 text-text-muted", children: h.km_total?.toFixed(1) || '-' })] }, h.id))) })] }) }))] }) }));
}
