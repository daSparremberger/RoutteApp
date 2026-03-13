import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementApi } from '../../lib/api';
const WEB_URL = import.meta.env.VITE_WEB_URL;

export function TenantFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'novo';
  const [form, setForm] = useState({ nome: '', cidade: '', estado: '' });
  const [loading, setLoading] = useState(false);
  const [conviteLink, setConviteLink] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [moduleError, setModuleError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) {
      managementApi.get<any>(`/tenants/${id}`)
        .then((d) => {
          setForm({ nome: d.nome, cidade: d.cidade, estado: d.estado });
          if (d.modules) setModules(d.modules);
        });
    }
  }, [id, isEdit]);

  async function handleToggleModule(slug: string, habilitado: boolean) {
    setModuleError(null);
    try {
      await managementApi.put<any>(`/tenants/${id}/modules`, { slug, habilitado });
      const d = await managementApi.get<any>(`/tenants/${id}`);
      if (d.modules) setModules(d.modules);
    } catch (err: any) {
      setModuleError(err?.message || 'Erro ao alterar modulo');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const d = isEdit
      ? await managementApi.put<any>(`/tenants/${id}`, form)
      : await managementApi.post<any>('/tenants', form);
    if (!isEdit) {
      navigate(`/admin/tenants/${d.id}`);
    }
    setLoading(false);
  }

  async function handleGerarConvite() {
    const d = await managementApi.post<any>(`/tenants/${id}/invite`, {});
    const fallbackOrigin = WEB_URL || window.location.origin;
    setConviteLink(d.link || d.convite_url || `${fallbackOrigin}/convite/${d.token}`);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-6 font-heading text-3xl font-bold text-text">{isEdit ? 'Editar Regiao' : 'Nova Regiao'}</h2>
      <form onSubmit={handleSubmit} className="ui-panel space-y-4 p-6">
        <div><label className="mb-1 block text-sm text-text-muted">Nome da Prefeitura</label>
          <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ui-input" required /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm text-text-muted">Cidade</label>
            <input type="text" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} className="ui-input" required /></div>
          <div><label className="mb-1 block text-sm text-text-muted">Estado</label>
            <input type="text" value={form.estado} onChange={e => setForm({...form, estado: e.target.value.toUpperCase()})} className="ui-input" maxLength={2} required /></div>
        </div>
        <button type="submit" disabled={loading} className="ui-btn-primary px-6">{loading ? 'Salvando...' : 'Salvar'}</button>
      </form>
      {isEdit && modules.length > 0 && (
        <div className="ui-panel mt-6 p-6">
          <h3 className="mb-4 text-lg font-bold text-text">Modulos</h3>
          {moduleError && (
            <div className="mb-4 rounded-xl bg-danger-muted p-3 text-sm text-danger">{moduleError}</div>
          )}
          <div className="space-y-1">
            {['cadastro', 'operacional', 'suporte'].map((tipo) => {
              const group = modules.filter((m) => m.tipo === tipo);
              if (!group.length) return null;
              return (
                <div key={tipo}>
                  <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{tipo}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.map((m: any) => (
                      <label key={m.slug} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface2">
                        <input
                          type="checkbox"
                          checked={m.habilitado}
                          onChange={() => handleToggleModule(m.slug, !m.habilitado)}
                          className="h-4 w-4 rounded accent-accent"
                        />
                        <span className="text-sm font-medium text-text">{m.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isEdit && (
        <div className="ui-panel mt-6 p-6">
          <h3 className="mb-4 text-lg font-bold text-text">Convite para Gestor</h3>
          {conviteLink ? (
            <div className="rounded-2xl bg-surface p-4">
              <p className="mb-2 text-sm text-text-muted">Link (valido 7 dias):</p>
              <div className="flex gap-2">
                <input type="text" value={conviteLink} readOnly className="ui-input flex-1" />
                <button onClick={() => navigator.clipboard.writeText(conviteLink)} className="ui-btn-secondary">Copiar</button>
              </div>
            </div>
          ) : <button onClick={handleGerarConvite} className="ui-btn-primary">Gerar Link de Convite</button>}
        </div>
      )}
    </div>
  );
}





