import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WEB_URL = import.meta.env.VITE_WEB_URL;

export function TenantFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const isEdit = !!id && id !== 'novo';
  const [form, setForm] = useState({ nome: '', cidade: '', estado: '' });
  const [loading, setLoading] = useState(false);
  const [conviteLink, setConviteLink] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit) {
      fetch(`${API_URL}/admin/tenants/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setForm({ nome: d.nome, cidade: d.cidade, estado: d.estado }));
    }
  }, [id, token, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(isEdit ? `${API_URL}/admin/tenants/${id}` : `${API_URL}/admin/tenants`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    if (res.ok && !isEdit) { const d = await res.json(); navigate(`/admin/tenants/${d.id}`); }
    setLoading(false);
  }

  async function handleGerarConvite() {
    const res = await fetch(`${API_URL}/admin/tenants/${id}/convite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dias_validade: 7 })
    });
    if (res.ok) {
      const d = await res.json();
      const fallbackOrigin = WEB_URL || window.location.origin;
      setConviteLink(d.link || d.convite_url || `${fallbackOrigin}/convite/${d.token}`);
    }
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





