import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { managementApi } from '../../lib/api';

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => {
    managementApi.get<any[]>('/organizations').then(setOrgs).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-3xl font-bold text-text">Organizacoes</h2>
        <Link to="/admin/organizations/novo" className="ui-btn-primary">Nova Organizacao</Link>
      </div>

      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head">
            <tr>
              <th className="p-4 text-left">Razao Social</th>
              <th className="p-4 text-left">CNPJ</th>
              <th className="p-4 text-left">Tenant</th>
              <th className="p-4 text-left">Contrato</th>
              <th className="p-4 text-left">Valor Mensal</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="ui-table-row">
                <td className="p-4 text-text">{o.razao_social}</td>
                <td className="p-4 text-text-muted">{o.cnpj ?? '-'}</td>
                <td className="p-4 text-text-muted">{o.tenant_nome} ({o.cidade}/{o.estado})</td>
                <td className="p-4">
                  {o.contrato_id ? (
                    <span className={`rounded-full px-2 py-1 text-xs ${
                      o.contrato_status === 'ativo' ? 'bg-success-muted text-success' :
                      o.contrato_status === 'suspenso' ? 'bg-warning-muted text-warning' :
                      'bg-danger-muted text-danger'
                    }`}>
                      {o.contrato_status}
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted">Sem contrato</span>
                  )}
                </td>
                <td className="p-4 text-text-muted">
                  {o.valor_mensal ? `R$ ${Number(o.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    o.ativo ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'
                  }`}>
                    {o.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="p-4">
                  <Link to={`/admin/organizations/${o.id}`} className="text-sm font-medium text-text hover:text-accent">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
