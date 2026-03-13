import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Car, Map, Truck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageTransition, staggerContainer } from '../components/ui/PageTransition';
import { StatCard } from '../components/ui/StatCard';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
const tooltipStyle = {
    contentStyle: {
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
        borderRadius: '12px',
    },
    cursor: { fill: 'var(--color-accent-muted)' },
};
const moneyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
});
function formatShortDate(date) {
    if (!date)
        return '--';
    const [year, month, day] = date.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}
function normalizeTurno(turno) {
    if (turno === 'manha')
        return 'ManhÃ£';
    if (turno === 'tarde')
        return 'Tarde';
    if (turno === 'noite')
        return 'Noite';
    return 'Indefinido';
}
export function Dashboard() {
    const [stats, setStats] = useState({
        veiculos_ativos: 0,
        veiculos_total: 0,
        motoristas_em_acao: 0,
        rotas_hoje: 0,
        alunos_total: 0,
    });
    const [charts, setCharts] = useState({
        rotas_por_dia: [],
        alunos_por_escola: [],
        financeiro_mensal: [],
        atividade_por_turno: [],
    });
    useEffect(() => {
        api.get('/dashboard/stats').then(setStats).catch(() => { });
        api.get('/dashboard/charts').then(setCharts).catch(() => { });
    }, []);
    const financialSummary = useMemo(() => {
        const months = charts.financeiro_mensal;
        const latest = months.length > 0 ? months[months.length - 1] : undefined;
        const previous = months.length > 1 ? months[months.length - 2] : undefined;
        const latestBalance = latest ? latest.receitas - latest.despesas : 0;
        const previousBalance = previous ? previous.receitas - previous.despesas : 0;
        let trend = 0;
        if (previousBalance !== 0) {
            trend = ((latestBalance - previousBalance) / Math.abs(previousBalance)) * 100;
        }
        return {
            latestBalance,
            trend,
            positive: trend >= 0,
            period: latest?.mes ?? '--',
        };
    }, [charts.financeiro_mensal]);
    const peakRoutes = useMemo(() => {
        if (charts.rotas_por_dia.length === 0)
            return 0;
        return Math.max(...charts.rotas_por_dia.map((item) => item.total));
    }, [charts.rotas_por_dia]);
    const routesTotal = useMemo(() => charts.rotas_por_dia.reduce((acc, item) => acc + item.total, 0), [charts.rotas_por_dia]);
    const popularSchools = charts.alunos_por_escola.slice(0, 5);
    const latestActivity = charts.rotas_por_dia.slice(-4).reverse();
    return (_jsx(PageTransition, { className: "pt-2 md:h-full md:overflow-hidden md:pt-6", children: _jsxs("div", { className: "grid grid-cols-1 gap-4 md:gap-6 xl:h-full xl:grid-cols-[minmax(0,1fr)_340px]", children: [_jsxs("section", { className: "min-w-0 space-y-4 md:space-y-6 md:overflow-hidden", children: [_jsxs("div", { className: "rounded-[26px] border border-border bg-surface2 p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-heading text-xl font-bold text-text", children: "Vis\u00C3\u00A3o geral" }), _jsx("button", { className: "rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:text-text", children: "\u00C3\u0161ltimo m\u00C3\u00AAs" })] }), _jsxs(motion.div, { variants: staggerContainer, initial: "initial", animate: "animate", className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(StatCard, { label: "Alunos", value: stats.alunos_total.toLocaleString('pt-BR'), icon: Users, trend: { value: Math.abs(financialSummary.trend), positive: financialSummary.positive }, subtitle: "vs. \u00C3\u00BAltimo m\u00C3\u00AAs" }), _jsx(StatCard, { label: "Saldo", value: moneyFormatter.format(financialSummary.latestBalance), icon: Car, trend: { value: Math.abs(financialSummary.trend), positive: financialSummary.positive }, subtitle: `perÃ­odo ${financialSummary.period}` })] }), _jsxs("div", { className: "mt-6", children: [_jsxs("p", { className: "text-lg font-semibold text-text", children: [stats.motoristas_em_acao, " motoristas em a\u00C3\u00A7\u00C3\u00A3o agora"] }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Monitore rotas em andamento e acompanhe as equipes." }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [popularSchools.map((item, index) => (_jsxs("div", { className: "flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-text", children: item.escola.slice(0, 2).toUpperCase() }), _jsx("span", { className: "text-xs font-medium text-text-muted", children: item.escola }), index === popularSchools.length - 1 && _jsx(ArrowRight, { size: 14, className: "text-text-muted" })] }, item.escola))), popularSchools.length === 0 && (_jsx("span", { className: "text-sm text-text-muted", children: "Sem escolas para exibir." }))] })] })] }), _jsxs("div", { className: "rounded-[26px] border border-border bg-surface2 p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-xl font-bold text-text", children: "Desempenho de rotas" }), _jsx("p", { className: "text-sm text-text-muted", children: "Rotas realizadas nos \u00C3\u00BAltimos 7 dias" })] }), _jsx("button", { className: "rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:text-text", children: "\u00C3\u0161ltimos 7 dias" })] }), _jsxs("div", { className: "mb-4 flex items-end justify-between", children: [_jsx("p", { className: "text-4xl font-bold tracking-tight text-text", children: routesTotal.toLocaleString('pt-BR') }), _jsx("span", { className: "rounded-full bg-success-muted px-3 py-1 text-xs font-semibold text-success", children: "Meta semanal" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: charts.rotas_por_dia, barCategoryGap: 26, children: [_jsx(CartesianGrid, { stroke: "var(--color-border)", strokeDasharray: "4 6", vertical: false }), _jsx(XAxis, { dataKey: "data", stroke: "var(--color-text-muted)", tickFormatter: formatShortDate, fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle, labelFormatter: (label) => `Dia ${formatShortDate(String(label))}` }), _jsx(Bar, { dataKey: "total", radius: [10, 10, 0, 0], children: charts.rotas_por_dia.map((entry) => (_jsx(Cell, { fill: entry.total === peakRoutes ? 'var(--color-success)' : 'var(--color-surface3)' }, entry.data))) })] }) })] }), _jsxs("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-2", children: [_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Resumo financeiro" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Receitas vs despesas" }), _jsx("div", { className: "mt-4 h-[190px]", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: charts.financeiro_mensal, children: [_jsx(XAxis, { dataKey: "mes", stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle }), _jsx(Bar, { dataKey: "receitas", fill: "var(--color-success)", radius: [8, 8, 0, 0] }), _jsx(Bar, { dataKey: "despesas", fill: "var(--color-danger)", radius: [8, 8, 0, 0] })] }) }) })] }), _jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Atividade por turno" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "\u00C3\u0161ltimos 30 dias" }), _jsx("div", { className: "mt-4 h-[190px]", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: charts.atividade_por_turno, layout: "vertical", children: [_jsx(XAxis, { type: "number", stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { dataKey: "turno", type: "category", width: 74, tickFormatter: normalizeTurno, stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle }), _jsx(Bar, { dataKey: "rotas", fill: "var(--color-accent)", radius: [0, 8, 8, 0] })] }) }) })] })] })] }), _jsxs("aside", { className: "space-y-6", children: [_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Escolas em destaque" }), _jsxs("div", { className: "mt-4 space-y-3", children: [popularSchools.map((item) => (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-xs font-semibold text-text", children: item.escola.slice(0, 2).toUpperCase() }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-text", children: item.escola }), _jsxs("p", { className: "text-xs text-text-muted", children: [item.total, " alunos"] })] }), _jsx("span", { className: "rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-semibold text-success", children: "Ativa" })] }, item.escola))), popularSchools.length === 0 && (_jsx("p", { className: "text-sm text-text-muted", children: "Sem dados de escolas no momento." }))] }), _jsx("button", { className: "mt-4 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text", children: "Todas as escolas" })] }), _jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Coment\u00C3\u00A1rios" }), _jsxs("div", { className: "mt-4 space-y-4", children: [latestActivity.map((item) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted", children: _jsx(Map, { size: 15 }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-sm font-medium text-text", children: [item.total, " rotas registradas em ", formatShortDate(item.data)] }), _jsx("p", { className: "mt-1 text-xs text-text-muted", children: "Atualiza\u00C3\u00A7\u00C3\u00A3o autom\u00C3\u00A1tica do painel operacional." })] })] }, item.data))), latestActivity.length === 0 && (_jsx("p", { className: "text-sm text-text-muted", children: "Sem atualiza\u00C3\u00A7\u00C3\u00B5es recentes." }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(StatCard, { label: "Ve\u00C3\u00ADculos ativos", value: stats.veiculos_ativos, icon: Truck }), _jsx(StatCard, { label: "Rotas hoje", value: stats.rotas_hoje, icon: Activity })] })] })] }) }));
}
