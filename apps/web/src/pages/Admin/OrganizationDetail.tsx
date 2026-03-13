import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';

export function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [org, setOrg] = useState<any>(null);
  const [form, setForm] = useState({ razao_social: '', cnpj: '', email_financeiro: '', telefone_financeiro: '', endereco_cobranca: '', tenant_id: '' });
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Contract modal
  const [contractModal, setContractModal] = useState(false);
  const [modules, setModules] = useState<any[]>([]);
  const [contractForm, setContractForm] = useState({
    valor_mensal: '', modulos_incluidos: [] as string[],
    max_veiculos: '', max_motoristas: '', max_gestores: '',
    data_inicio: '', data_fim: '', observacoes: '',
  });

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceMes, setInvoiceMes] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      managementApi.get<any>(`/organizations/${id}`).then((data) => {
        setOrg(data);
        setForm({
          razao_social: data.razao_social, cnpj: data.cnpj || '', email_financeiro: data.email_financeiro || '',
          telefone_financeiro: data.telefone_financeiro || '', endereco_cobranca: data.endereco_cobranca || '', tenant_id: String(data.tenant_id),
        });
      });
    }
    managementApi.get<any[]>('/tenants').then(setTenants).catch(() => {});
    managementApi.get<any[]>('/modules').then(setModules).catch(() => {});
  }, [id, isNew]);

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) {
        const created = await managementApi.post<any>('/organizations', { ...form, tenant_id: Number(form.tenant_id) });
        navigate(`/admin/organizations/${created.id}`);
      } else {
        await managementApi.put<any>(`/organizations/${id}`, form);
        const updated = await managementApi.get<any>(`/organizations/${id}`);
        setOrg(updated);
      }
    } catch {
      // error handled by api client
    }
    setLoading(false);
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    try {
      await managementApi.post<any>(`/organizations/${id}/contracts`, {
        ...contractForm,
        valor_mensal: Number(contractForm.valor_mensal),
        max_veiculos: Number(contractForm.max_veiculos),
        max_motoristas: Number(contractForm.max_motoristas),
        max_gestores: Number(contractForm.max_gestores),
      });
      setContractModal(false);
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleContractStatus(contractId: number, status: string) {
    if (!confirm(`Confirma alteracao de status para "${status}"?`)) return;
    try {
      await managementApi.patch<any>(`/contracts/${contractId}/status`, { status });
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleInvoiceStatus(invoiceId: number, status: string) {
    try {
      await managementApi.patch<any>(`/invoices/${invoiceId}/status`, { status });
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    const activeContract = org?.contracts?.find((c: any) => c.status === 'ativo');
    if (!activeContract) return;
    try {
      await managementApi.post<any>('/invoices', { contract_id: activeContract.id, mes_referencia: invoiceMes });
      setInvoiceModal(false);
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  function toggleModule(slug: string) {
    setContractForm((prev) => ({
      ...prev,
      modulos_incluidos: prev.modulos_incluidos.includes(slug)
        ? prev.modulos_incluidos.filter((s) => s !== slug)
        : [...prev.modulos_incluidos, slug],
    }));
  }

  const activeContract = org?.contracts?.find((c: any) => c.status === 'ativo');

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-3xl font-bold text-text">
        {isNew ? 'Nova Organizacao' : org?.razao_social || '...'}
      </h2>

      {/* Org form */}
      <form onSubmit={handleSaveOrg} className="ui-panel space-y-4 p-6">
        <h3 className="text-lg font-semibold text-text">Dados Comerciais</h3>
        {isNew && (
          <div>
            <label className="mb-1 block text-sm text-text-muted">Tenant</label>
            <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="ui-select" required>
              <option value="">Selecione...</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.nome} ({t.cidade}/{t.estado})</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Razao Social</label>
            <input type="text" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} className="ui-input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">CNPJ</label>
            <input type="text" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="ui-input" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Email Financeiro</label>
            <input type="email" value={form.email_financeiro} onChange={(e) => setForm({ ...form, email_financeiro: e.target.value })} className="ui-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Telefone Financeiro</label>
            <input type="text" value={form.telefone_financeiro} onChange={(e) => setForm({ ...form, telefone_financeiro: e.target.value })} className="ui-input" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-muted">Endereco de Cobranca</label>
          <input type="text" value={form.endereco_cobranca} onChange={(e) => setForm({ ...form, endereco_cobranca: e.target.value })} className="ui-input" />
        </div>
        <button type="submit" disabled={loading} className="ui-btn-primary px-6">
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      {/* Contracts section (only when editing) */}
      {!isNew && org && (
        <div className="ui-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Contratos</h3>
            {!activeContract && (
              <button onClick={() => setContractModal(true)} className="ui-btn-primary text-sm">
                Novo Contrato
              </button>
            )}
          </div>

          {org.contracts?.length ? (
            <div className="space-y-3">
              {org.contracts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        c.status === 'ativo' ? 'bg-success-muted text-success' :
                        c.status === 'suspenso' ? 'bg-warning-muted text-warning' :
                        'bg-danger-muted text-danger'
                      }`}>{c.status}</span>
                      <span className="font-semibold text-text">
                        R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mes
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {c.data_inicio} — {c.data_fim || 'Indeterminado'} | {c.modulos_incluidos?.length} modulos |
                      {c.max_veiculos} veic / {c.max_motoristas} mot / {c.max_gestores} gest
                    </p>
                  </div>
                  {c.status === 'ativo' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleContractStatus(c.id, 'suspenso')} className="ui-btn-secondary text-xs">Suspender</button>
                      <button onClick={() => handleContractStatus(c.id, 'encerrado')} className="ui-btn-secondary text-xs">Encerrar</button>
                    </div>
                  )}
                  {c.status === 'suspenso' && (
                    <button onClick={() => handleContractStatus(c.id, 'ativo')} className="ui-btn-primary text-xs">Reativar</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nenhum contrato registrado.</p>
          )}
        </div>
      )}

      {/* Invoices section */}
      {!isNew && org && (
        <div className="ui-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Faturas</h3>
            {activeContract && (
              <button onClick={() => setInvoiceModal(true)} className="ui-btn-primary text-sm">
                Gerar Fatura
              </button>
            )}
          </div>

          {org.invoices?.length ? (
            <div className="ui-table-wrap">
              <table className="w-full">
                <thead className="ui-table-head">
                  <tr>
                    <th className="p-4 text-left">Mes</th>
                    <th className="p-4 text-left">Valor</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Pago em</th>
                    <th className="p-4 text-left">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {org.invoices.map((inv: any) => (
                    <tr key={inv.id} className="ui-table-row">
                      <td className="p-4 text-text">{inv.mes_referencia}</td>
                      <td className="p-4 text-text-muted">R$ {Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${
                          inv.status === 'pago' ? 'bg-success-muted text-success' :
                          inv.status === 'cancelado' ? 'bg-danger-muted text-danger' :
                          'bg-warning-muted text-warning'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="p-4 text-text-muted">{inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-4 space-x-2">
                        {inv.status === 'pendente' && (
                          <>
                            <button onClick={() => handleInvoiceStatus(inv.id, 'pago')} className="text-sm font-medium text-success hover:underline">Pago</button>
                            <button onClick={() => handleInvoiceStatus(inv.id, 'cancelado')} className="text-sm font-medium text-danger hover:underline">Cancelar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nenhuma fatura gerada.</p>
          )}
        </div>
      )}

      {/* Contract Modal */}
      <Modal open={contractModal} onClose={() => setContractModal(false)} title="Novo Contrato" size="lg">
        <form onSubmit={handleCreateContract} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-text-muted">Valor Mensal (R$)</label>
              <input type="number" step="0.01" value={contractForm.valor_mensal} onChange={(e) => setContractForm({ ...contractForm, valor_mensal: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Data Inicio</label>
              <input type="date" value={contractForm.data_inicio} onChange={(e) => setContractForm({ ...contractForm, data_inicio: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Data Fim (opcional)</label>
              <input type="date" value={contractForm.data_fim} onChange={(e) => setContractForm({ ...contractForm, data_fim: e.target.value })} className="ui-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Veiculos</label>
              <input type="number" value={contractForm.max_veiculos} onChange={(e) => setContractForm({ ...contractForm, max_veiculos: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Motoristas</label>
              <input type="number" value={contractForm.max_motoristas} onChange={(e) => setContractForm({ ...contractForm, max_motoristas: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Gestores</label>
              <input type="number" value={contractForm.max_gestores} onChange={(e) => setContractForm({ ...contractForm, max_gestores: e.target.value })} className="ui-input" required />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-text-muted">Modulos Incluidos</label>
            <div className="flex flex-wrap gap-2">
              {modules.map((m: any) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => toggleModule(m.slug)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    contractForm.modulos_incluidos.includes(m.slug)
                      ? 'bg-accent text-surface'
                      : 'border border-border bg-surface text-text-muted hover:bg-surface2'
                  }`}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Observacoes</label>
            <textarea value={contractForm.observacoes} onChange={(e) => setContractForm({ ...contractForm, observacoes: e.target.value })} className="ui-textarea" rows={2} />
          </div>
          <button type="submit" className="ui-btn-primary px-6">Criar Contrato</button>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="Gerar Fatura">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Mes de Referencia</label>
            <input type="date" value={invoiceMes} onChange={(e) => setInvoiceMes(e.target.value)} className="ui-input" required />
          </div>
          <button type="submit" className="ui-btn-primary px-6">Gerar</button>
        </form>
      </Modal>
    </div>
  );
}
