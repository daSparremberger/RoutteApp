import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Car, Map, Truck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';

import { PageTransition, staggerContainer } from '../components/ui/PageTransition';
import { StatCard } from '../components/ui/StatCard';
import { api } from '../lib/api';
import { useModulesStore } from '../stores/modules';
import type { DashboardChartData, DashboardStats } from '@rotavans/shared';

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

function formatShortDate(date: string) {
  if (!date) return '--';
  const [year, month, day] = date.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

function normalizeTurno(turno: string) {
  if (turno === 'manha') return 'Manha';
  if (turno === 'tarde') return 'Tarde';
  if (turno === 'noite') return 'Noite';
  return 'Indefinido';
}

export function Dashboard() {
  const hasModule = useModulesStore((s) => s.hasModule);
  const modules = useModulesStore((s) => s.modules);

  const [stats, setStats] = useState<DashboardStats>({
    pessoas_total: 0,
    veiculos_ativos: 0,
    veiculos_total: 0,
    motoristas_em_acao: 0,
    rotas_hoje: 0,
    alunos_total: 0,
  });
  const [charts, setCharts] = useState<DashboardChartData>({
    rotas_por_dia: [],
    alunos_por_escola: [],
    financeiro_mensal: [],
    atividade_por_turno: [],
  });

  useEffect(() => {
    api.get<DashboardStats>('/dashboard/stats').then(setStats).catch(() => {});
    api.get<DashboardChartData>('/dashboard/charts').then(setCharts).catch(() => {});
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
    if (rotasPorDia.length === 0) return 0;
    return Math.max(...rotasPorDia.map((item) => item.total));
  }, [rotasPorDia]);

  const routesTotal = useMemo(
    () => rotasPorDia.reduce((acc, item) => acc + item.total, 0),
    [rotasPorDia]
  );

  const popularSchools = alunosPorEscola.slice(0, 5);
  const latestActivity = rotasPorDia.slice(-4).reverse();

  return (
    <PageTransition className="pt-2 md:pt-6">
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:h-full xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-4 md:space-y-6">
          <div className="rounded-[26px] border border-border bg-surface2 p-4 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-bold text-text">Visao geral</h2>
              <div className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted">
                {modules.length} modulos ativos
              </div>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {hasModule('alunos') ? (
                <StatCard
                  label="Alunos"
                  value={(stats.alunos_total || 0).toLocaleString('pt-BR')}
                  icon={Users}
                />
              ) : (
                <StatCard
                  label="Pessoas"
                  value={(stats.pessoas_total || 0).toLocaleString('pt-BR')}
                  icon={Users}
                />
              )}

              {hasModule('financeiro') && (
                <StatCard
                  label="Saldo"
                  value={moneyFormatter.format(financialSummary.latestBalance)}
                  icon={Car}
                  trend={{ value: Math.abs(financialSummary.trend), positive: financialSummary.positive }}
                  subtitle={`periodo ${financialSummary.period}`}
                />
              )}
            </motion.div>

            {hasModule('rastreamento') && (
              <div className="mt-6">
                <p className="text-lg font-semibold text-text">{stats.motoristas_em_acao || 0} motoristas em acao agora</p>
                <p className="mt-1 text-sm text-text-muted">Monitore rotas em andamento e acompanhe as equipes.</p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {popularSchools.map((item, index) => (
                    <div key={item.escola} className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-text">
                        {item.escola.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-text-muted">{item.escola}</span>
                      {index === popularSchools.length - 1 && <ArrowRight size={14} className="text-text-muted" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {hasModule('rotas') && (
            <div className="rounded-[26px] border border-border bg-surface2 p-4 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-bold text-text">Desempenho de rotas</h2>
                  <p className="text-sm text-text-muted">Rotas realizadas nos ultimos 7 dias</p>
                </div>
              </div>

              <div className="mb-4 flex items-end justify-between">
                <p className="text-4xl font-bold tracking-tight text-text">{routesTotal.toLocaleString('pt-BR')}</p>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rotasPorDia} barCategoryGap={26}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="4 6" vertical={false} />
                  <XAxis dataKey="data" stroke="var(--color-text-muted)" tickFormatter={formatShortDate} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipStyle} labelFormatter={(label) => `Dia ${formatShortDate(String(label))}`} />
                  <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                    {rotasPorDia.map((entry) => (
                      <Cell
                        key={entry.data}
                        fill={entry.total === peakRoutes ? 'var(--color-success)' : 'var(--color-surface3)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {hasModule('financeiro') && (
              <div className="rounded-[24px] border border-border bg-surface2 p-5">
                <h3 className="font-heading text-lg font-bold text-text">Resumo financeiro</h3>
                <p className="mt-1 text-sm text-text-muted">Receitas vs despesas</p>
                <div className="mt-4 h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financeiroMensal}>
                      <XAxis dataKey="mes" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="receitas" fill="var(--color-success)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="despesas" fill="var(--color-danger)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {hasModule('execucao') && (
              <div className="rounded-[24px] border border-border bg-surface2 p-5">
                <h3 className="font-heading text-lg font-bold text-text">Atividade por turno</h3>
                <p className="mt-1 text-sm text-text-muted">Ultimos 30 dias</p>
                <div className="mt-4 h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={atividadePorTurno} layout="vertical">
                      <XAxis type="number" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis
                        dataKey="turno"
                        type="category"
                        width={74}
                        tickFormatter={normalizeTurno}
                        stroke="var(--color-text-muted)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="rotas" fill="var(--color-accent)" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          {hasModule('escolas') && (
            <div className="rounded-[24px] border border-border bg-surface2 p-5">
              <h3 className="font-heading text-lg font-bold text-text">Escolas em destaque</h3>
              <div className="mt-4 space-y-3">
                {popularSchools.map((item) => (
                  <div key={item.escola} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-xs font-semibold text-text">
                      {item.escola.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">{item.escola}</p>
                      <p className="text-xs text-text-muted">{item.total} alunos</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasModule('rotas') && (
            <div className="rounded-[24px] border border-border bg-surface2 p-5">
              <h3 className="font-heading text-lg font-bold text-text">Atividade recente</h3>
              <div className="mt-4 space-y-4">
                {latestActivity.map((item) => (
                  <div key={item.data} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-muted">
                      <Map size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">{item.total} rotas registradas em {formatShortDate(item.data)}</p>
                      <p className="mt-1 text-xs text-text-muted">Atualizacao automatica do painel operacional.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {hasModule('veiculos') && <StatCard label="Veiculos ativos" value={stats.veiculos_ativos || 0} icon={Truck} />}
            {hasModule('rotas') && <StatCard label="Rotas hoje" value={stats.rotas_hoje || 0} icon={Activity} />}
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
