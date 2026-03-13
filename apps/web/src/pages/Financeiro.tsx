import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, AlertCircle, Check, Trash2, Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Modal } from '../components/ui/Modal';
import { PageTransition } from '../components/ui/PageTransition';
import { api, downloadCsv } from '../lib/api';
import type { Transacao, ResumoFinanceiro, Aluno } from '@rotavans/shared';

const CATEGORIAS_RECEITA = ['mensalidade', 'avulso', 'outros'];
const CATEGORIAS_DESPESA = ['combustivel', 'manutencao', 'seguro', 'multa', 'salario', 'outros'];

const initialForm = {
  tipo: 'receita' as 'receita' | 'despesa',
  categoria: 'mensalidade',
  descricao: '',
  valor: '',
  data: new Date().toISOString().split('T')[0],
  aluno_id: '',
  pago: false
};

export function Financeiro() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>({ receitas: 0, despesas: 0, saldo: 0, inadimplentes: 0 });
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [gerarModal, setGerarModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroPago, setFiltroPago] = useState<string>('');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  useEffect(() => { load(); }, [filtroTipo, filtroPago]);
  useEffect(() => { loadResumo(); }, [mesSelecionado, anoSelecionado]);

  async function load() {
    const params = new URLSearchParams();
    if (filtroTipo) params.append('tipo', filtroTipo);
    if (filtroPago) params.append('pago', filtroPago);

    const [t, a] = await Promise.all([
      api.get<Transacao[]>(`/financeiro?${params}`),
      api.get<Aluno[]>('/alunos')
    ]);
    setTransacoes(t);
    setAlunos(a);
  }

  async function loadResumo() {
    const r = await api.get<ResumoFinanceiro>(`/financeiro/resumo?mes=${mesSelecionado}&ano=${anoSelecionado}`);
    setResumo(r);
  }

  function openNew(tipo: 'receita' | 'despesa') {
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

  async function marcarPago(id: number) {
    await api.put(`/financeiro/${id}/pagar`, {});
    load();
    loadResumo();
  }

  async function remove(id: number) {
    if (!confirm('Excluir esta transação?')) return;
    await api.delete(`/financeiro/${id}`);
    load();
    loadResumo();
  }

  async function gerarMensalidades() {
    const res = await api.post<{ criadas: number }>('/financeiro/gerar-mensalidades', {
      mes: mesSelecionado,
      ano: anoSelecionado
    });
    alert(`${res.criadas} mensalidade(s) gerada(s)!`);
    setGerarModal(false);
    load();
    loadResumo();
  }

  const inputClass = 'w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200';

  return (
    <PageTransition>
    <div>
      <PageHeader title="Financeiro" subtitle="Controle de receitas e despesas"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => downloadCsv('/financeiro/export', 'financeiro.csv')}
              className="flex items-center gap-2 border border-border text-text-muted hover:text-text px-4 py-2 rounded-xl text-sm font-medium"
            >
              <Download size={18} /> Exportar CSV
            </button>
            <button onClick={() => setGerarModal(true)} className="flex items-center gap-2 bg-surface2 hover:bg-surface2/80 text-text px-4 py-2 rounded-xl text-sm font-medium">
              Gerar Mensalidades
            </button>
            <button onClick={() => openNew('receita')} className="flex items-center gap-2 bg-success hover:bg-success/90 text-surface px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={18} /> Receita
            </button>
            <button onClick={() => openNew('despesa')} className="flex items-center gap-2 bg-danger hover:bg-danger/90 text-surface px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={18} /> Despesa
            </button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={mesSelecionado} onChange={(e) => setMesSelecionado(parseInt(e.target.value))} className="ui-select">
          {['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(parseInt(e.target.value))} className="ui-select">
          {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Receitas" value={`R$ ${resumo.receitas.toFixed(2)}`} />
        <StatCard icon={TrendingDown} label="Despesas" value={`R$ ${resumo.despesas.toFixed(2)}`} />
        <StatCard icon={DollarSign} label="Saldo" value={`R$ ${resumo.saldo.toFixed(2)}`} />
        <StatCard icon={AlertCircle} label="Inadimplentes" value={resumo.inadimplentes.toString()} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="ui-select">
          <option value="">Todos os tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value)} className="ui-select">
          <option value="">Todos</option>
          <option value="true">Pagos</option>
          <option value="false">Pendentes</option>
        </select>
      </div>

      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {transacoes.map((t) => (
              <tr key={t.id} className="ui-table-row">
                <td className="px-4 py-3 text-text">{new Date(t.data || t.criado_em).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${t.tipo === 'receita' ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'}`}>
                    {t.tipo === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted capitalize">{t.categoria}</td>
                <td className="px-4 py-3 text-text-muted">{t.descricao || '-'}</td>
                <td className="px-4 py-3 text-text-muted">{t.aluno_nome || '-'}</td>
                <td className={`px-4 py-3 text-right font-medium ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}`}>
                  {t.tipo === 'receita' ? '+' : '-'} R$ {t.valor.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {t.pago ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-success-muted text-success">Pago</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500">Pendente</span>
                  )}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {!t.pago && t.tipo === 'receita' && (
                    <button onClick={() => marcarPago(t.id)} className="text-text-muted hover:text-success" title="Marcar como pago">
                      <Check size={16} />
                    </button>
                  )}
                  <button onClick={() => remove(t.id)} className="text-text-muted hover:text-red-400"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Nova ${form.tipo === 'receita' ? 'Receita' : 'Despesa'}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-text-muted mb-1">Categoria</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputClass}>
                {(form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Descrição</label>
            <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-text-muted mb-1">Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={inputClass} />
            </div>
            {form.tipo === 'receita' && (
              <div>
                <label className="block text-sm text-text-muted mb-1">Aluno (opcional)</label>
                <select value={form.aluno_id} onChange={(e) => setForm({ ...form, aluno_id: e.target.value })} className={inputClass}>
                  <option value="">Nenhum</option>
                  {alunos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" checked={form.pago} onChange={(e) => setForm({ ...form, pago: e.target.checked })} className="rounded" />
            Já foi pago
          </label>
          <button onClick={save} disabled={!form.valor || !form.categoria}
            className="w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50">
            Salvar
          </button>
        </div>
      </Modal>

      <Modal open={gerarModal} onClose={() => setGerarModal(false)} title="Gerar Mensalidades">
        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Isso irá criar uma receita de mensalidade para cada aluno ativo que tenha valor de mensalidade cadastrado.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-text-muted mb-1">Mês</label>
              <select value={mesSelecionado} onChange={(e) => setMesSelecionado(parseInt(e.target.value))} className={inputClass}>
                {['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Ano</label>
              <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(parseInt(e.target.value))} className={inputClass}>
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <button onClick={gerarMensalidades}
            className="w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl">
            Gerar Mensalidades
          </button>
        </div>
      </Modal>
    </div>
    </PageTransition>
  );
}
