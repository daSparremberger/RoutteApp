import { useEffect, useState } from 'react';
import { managementApi } from '../../lib/api';

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [orgs, setOrgs] = useState<any[]>([]);
  const [batchMes, setBatchMes] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);

  useEffect(() => {
    managementApi.get<any[]>('/organizations').then(setOrgs).catch(() => {});
  }, []);

  function load() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (mesFilter) params.set('mes', mesFilter);
    if (orgFilter) params.set('organization_id', orgFilter);
    const qs = params.toString();
    managementApi.get<any[]>(`/invoices${qs ? `?${qs}` : ''}`).then(setInvoices).catch(() => {});
  }

  useEffect(() => { load(); }, [statusFilter, mesFilter, orgFilter]);

  async function handleBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchMes) return;
    const result = await managementApi.post<any>('/invoices/batch', { mes_referencia: batchMes });
    setBatchResult(result);
    load();
  }

  async function handleStatus(invoiceId: number, status: string) {
    await managementApi.patch<any>(`/invoices/${invoiceId}/status`, { status });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-3xl font-bold text-text">Faturas</h2>
      </div>

      {/* Batch generation */}
      <div className="ui-panel flex items-end gap-4 p-4">
        <form onSubmit={handleBatch} className="flex items-end gap-4">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Gerar faturas em lote</label>
            <input type="date" value={batchMes} onChange={(e) => setBatchMes(e.target.value)} className="ui-input" required />
          </div>
          <button type="submit" className="ui-btn-primary">Gerar</button>
        </form>
        {batchResult && (
          <p className="text-sm text-text-muted">
            {batchResult.created?.length} criadas, {batchResult.skipped?.length} ignoradas, {batchResult.errors?.length} erros
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {['', 'pendente', 'pago', 'cancelado'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                statusFilter === s ? 'bg-accent text-surface' : 'border border-border bg-surface text-text-muted'
              }`}
            >
              {s || 'Todas'}
            </button>
          ))}
        </div>
        <input
          type="month"
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value ? `${e.target.value}-01` : '')}
          className="ui-input w-auto"
          placeholder="Mes"
        />
        <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="ui-select w-auto">
          <option value="">Todas organizacoes</option>
          {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.razao_social}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head">
            <tr>
              <th className="p-4 text-left">Organizacao</th>
              <th className="p-4 text-left">Mes</th>
              <th className="p-4 text-left">Valor</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Pago em</th>
              <th className="p-4 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="ui-table-row">
                <td className="p-4 text-text">{inv.razao_social}</td>
                <td className="p-4 text-text-muted">{inv.mes_referencia}</td>
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
                      <button onClick={() => handleStatus(inv.id, 'pago')} className="text-sm font-medium text-success hover:underline">Pago</button>
                      <button onClick={() => handleStatus(inv.id, 'cancelado')} className="text-sm font-medium text-danger hover:underline">Cancelar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
