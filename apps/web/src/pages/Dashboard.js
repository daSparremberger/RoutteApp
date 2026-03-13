import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Car, Map, Truck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { PageTransition, staggerContainer } from '../components/ui/PageTransition';
import { StatCard } from '../components/ui/StatCard';
import { api } from '../lib/api';
import { useModulesStore } from '../stores/modules';
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
        return 'Manha';
    if (turno === 'tarde')
        return 'Tarde';
    if (turno === 'noite')
        return 'Noite';
    return 'Indefinido';
}
export function Dashboard() {
    const hasModule = useModulesStore((s) => s.hasModule);
    const modules = useModulesStore((s) => s.modules);
    const [stats, setStats] = useState({
        pessoas_total: 0,
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
    const rotasPorDia = charts.rotas_por_dia || [];
    const alunosPorEscola = charts.alunos_por_escola || [];
    const financeiroMensal = charts.financeiro_mensal || [];
    const atividadePorTurno = charts.atividade_por_turno || [];
    const financialSummary = useMemo(() => {
        const latest = financeiroMensal.length > 0 ? financeiroMensal[financeiroMensal.length - 1] : undefined;
        const previous = financeiroMensal.length > 1 ? financeiroMensal[financeiroMensal.length - 2] : undefined;
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
    }, [financeiroMensal]);
    const peakRoutes = useMemo(() => {
        if (rotasPorDia.length === 0)
            return 0;
        return Math.max(...rotasPorDia.map((item) => item.total));
    }, [rotasPorDia]);
    const routesTotal = useMemo(() => rotasPorDia.reduce((acc, item) => acc + item.total, 0), [rotasPorDia]);
    const popularSchools = alunosPorEscola.slice(0, 5);
    const latestActivity = rotasPorDia.slice(-4).reverse();
    return (_jsx(PageTransition, { className: "pt-2 md:pt-6", children: _jsxs("div", { className: "grid grid-cols-1 gap-4 md:gap-6 xl:h-full xl:grid-cols-[minmax(0,1fr)_340px]", children: [_jsxs("section", { className: "min-w-0 space-y-4 md:space-y-6", children: [_jsxs("div", { className: "rounded-[26px] border border-border bg-surface2 p-4 md:p-6", children: [_jsxs("div", { className: "mb-5 flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-heading text-xl font-bold text-text", children: "Visao geral" }), _jsxs("div", { className: "rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted", children: [modules.length, " modulos ativos"] })] }), _jsxs(motion.div, { variants: staggerContainer, initial: "initial", animate: "animate", className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [hasModule('alunos') ? (_jsx(StatCard, { label: "Alunos", value: (stats.alunos_total || 0).toLocaleString('pt-BR'), icon: Users })) : (_jsx(StatCard, { label: "Pessoas", value: (stats.pessoas_total || 0).toLocaleString('pt-BR'), icon: Users })), hasModule('financeiro') && (_jsx(StatCard, { label: "Saldo", value: moneyFormatter.format(financialSummary.latestBalance), icon: Car, trend: { value: Math.abs(financialSummary.trend), positive: financialSummary.positive }, subtitle: `periodo ${financialSummary.period}` }))] }), hasModule('rastreamento') && (_jsxs("div", { className: "mt-6", children: [_jsxs("p", { className: "text-lg font-semibold text-text", children: [stats.motoristas_em_acao || 0, " motoristas em acao agora"] }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Monitore rotas em andamento e acompanhe as equipes." }), _jsx("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: popularSchools.map((item, index) => (_jsxs("div", { className: "flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-text", children: item.escola.slice(0, 2).toUpperCase() }), _jsx("span", { className: "text-xs font-medium text-text-muted", children: item.escola }), index === popularSchools.length - 1 && _jsx(ArrowRight, { size: 14, className: "text-text-muted" })] }, item.escola))) })] }))] }), hasModule('rotas') && (_jsxs("div", { className: "rounded-[26px] border border-border bg-surface2 p-4 md:p-6", children: [_jsx("div", { className: "mb-5 flex items-center justify-between gap-3", children: _jsxs("div", { children: [_jsx("h2", { className: "font-heading text-xl font-bold text-text", children: "Desempenho de rotas" }), _jsx("p", { className: "text-sm text-text-muted", children: "Rotas realizadas nos ultimos 7 dias" })] }) }), _jsx("div", { className: "mb-4 flex items-end justify-between", children: _jsx("p", { className: "text-4xl font-bold tracking-tight text-text", children: routesTotal.toLocaleString('pt-BR') }) }), _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: rotasPorDia, barCategoryGap: 26, children: [_jsx(CartesianGrid, { stroke: "var(--color-border)", strokeDasharray: "4 6", vertical: false }), _jsx(XAxis, { dataKey: "data", stroke: "var(--color-text-muted)", tickFormatter: formatShortDate, fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle, labelFormatter: (label) => `Dia ${formatShortDate(String(label))}` }), _jsx(Bar, { dataKey: "total", radius: [10, 10, 0, 0], children: rotasPorDia.map((entry) => (_jsx(Cell, { fill: entry.total === peakRoutes ? 'var(--color-success)' : 'var(--color-surface3)' }, entry.data))) })] }) })] })), _jsxs("div", { className: "grid grid-cols-1 gap-6 lg:grid-cols-2", children: [hasModule('financeiro') && (_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Resumo financeiro" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Receitas vs despesas" }), _jsx("div", { className: "mt-4 h-[190px]", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: financeiroMensal, children: [_jsx(XAxis, { dataKey: "mes", stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle }), _jsx(Bar, { dataKey: "receitas", fill: "var(--color-success)", radius: [8, 8, 0, 0] }), _jsx(Bar, { dataKey: "despesas", fill: "var(--color-danger)", radius: [8, 8, 0, 0] })] }) }) })] })), hasModule('execucao') && (_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Atividade por turno" }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Ultimos 30 dias" }), _jsx("div", { className: "mt-4 h-[190px]", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: atividadePorTurno, layout: "vertical", children: [_jsx(XAxis, { type: "number", stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { dataKey: "turno", type: "category", width: 74, tickFormatter: normalizeTurno, stroke: "var(--color-text-muted)", fontSize: 11, tickLine: false, axisLine: false }), _jsx(Tooltip, { ...tooltipStyle }), _jsx(Bar, { dataKey: "rotas", fill: "var(--color-accent)", radius: [0, 8, 8, 0] })] }) }) })] }))] })] }), _jsxs("aside", { className: "space-y-6", children: [hasModule('escolas') && (_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Escolas em destaque" }), _jsx("div", { className: "mt-4 space-y-3", children: popularSchools.map((item) => (_jsxs("div", { className: "flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-xs font-semibold text-text", children: item.escola.slice(0, 2).toUpperCase() }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-sm font-semibold text-text", children: item.escola }), _jsxs("p", { className: "text-xs text-text-muted", children: [item.total, " alunos"] })] })] }, item.escola))) })] })), hasModule('rotas') && (_jsxs("div", { className: "rounded-[24px] border border-border bg-surface2 p-5", children: [_jsx("h3", { className: "font-heading text-lg font-bold text-text", children: "Atividade recente" }), _jsx("div", { className: "mt-4 space-y-4", children: latestActivity.map((item) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted", children: _jsx(Map, { size: 15 }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-sm font-medium text-text", children: [item.total, " rotas registradas em ", formatShortDate(item.data)] }), _jsx("p", { className: "mt-1 text-xs text-text-muted", children: "Atualizacao automatica do painel operacional." })] })] }, item.data))) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [hasModule('veiculos') && _jsx(StatCard, { label: "Veiculos ativos", value: stats.veiculos_ativos || 0, icon: Truck }), hasModule('rotas') && _jsx(StatCard, { label: "Rotas hoje", value: stats.rotas_hoje || 0, icon: Activity })] })] })] }) }));
}
