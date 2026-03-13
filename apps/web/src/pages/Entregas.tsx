import { useEffect, useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
import type { ClienteEntrega } from '@rotavans/shared';

const initialForm = {
  nome: '',
  telefone: '',
  endereco: '',
  lat: null as number | null,
  lng: null as number | null,
  empresa: '',
  tipo_carga: '',
  peso_max_kg: '',
  instrucoes: '',
  contato_recebedor: '',
};

export function Entregas() {
  const [clientes, setClientes] = useState<ClienteEntrega[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteEntrega | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await api.get<ClienteEntrega[]>('/entregas');
    setClientes(data);
  }

  function openNew() {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openEdit(cliente: ClienteEntrega) {
    setEditing(cliente);
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      lat: cliente.lat ?? null,
      lng: cliente.lng ?? null,
      empresa: cliente.profile?.empresa || '',
      tipo_carga: cliente.profile?.tipo_carga || '',
      peso_max_kg: cliente.profile?.peso_max_kg?.toString() || '',
      instrucoes: cliente.profile?.instrucoes || '',
      contato_recebedor: cliente.profile?.contato_recebedor || '',
    });
    setModalOpen(true);
  }

  async function save() {
    const payload = {
      ...form,
      peso_max_kg: form.peso_max_kg ? parseFloat(form.peso_max_kg) : null,
    };

    if (payload.endereco && (payload.lat == null || payload.lng == null)) {
      const match = await geocodeAddress(payload.endereco);
      if (match) {
        payload.lat = match.lat;
        payload.lng = match.lng;
      }
    }

    if (editing) {
      await api.put(`/entregas/${editing.id}`, payload);
    } else {
      await api.post('/entregas', payload);
    }

    setModalOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Excluir este cliente de entrega?')) return;
    await api.delete(`/entregas/${id}`);
    load();
  }

  return (
    <PageTransition>
      <div>
        <PageHeader
          title="Entregas"
          subtitle={`${clientes.length} cliente(s)`}
          action={
            <button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={18} /> Novo Cliente
            </button>
          }
        />

        {clientes.length === 0 ? (
          <EmptyState icon={Package} message="Nenhum cliente de entrega cadastrado" />
        ) : (
          <div className="ui-table-wrap">
            <table className="w-full">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Tipo de Carga</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="ui-table-row">
                    <td className="px-4 py-3 text-text">{cliente.nome}</td>
                    <td className="px-4 py-3 text-text-muted">{cliente.profile?.empresa || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{cliente.profile?.tipo_carga || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{cliente.telefone || '-'}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(cliente)} className="text-text-muted hover:text-text"><Pencil size={16} /></button>
                      <button onClick={() => remove(cliente.id)} className="text-text-muted hover:text-red-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cliente' : 'Novo Cliente'}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Nome</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Telefone</label>
                <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="w-full ui-input" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Endereco</label>
              <AddressAutocompleteInput
                value={form.endereco}
                onChange={(value) => setForm({ ...form, endereco: value, lat: null, lng: null })}
                onSelect={(suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng })}
                className="h-12"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Empresa</label>
                <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Tipo de Carga</label>
                <input value={form.tipo_carga} onChange={(e) => setForm({ ...form, tipo_carga: e.target.value })} className="w-full ui-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Peso Maximo (kg)</label>
                <input type="number" step="0.01" value={form.peso_max_kg} onChange={(e) => setForm({ ...form, peso_max_kg: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Contato Recebedor</label>
                <input value={form.contato_recebedor} onChange={(e) => setForm({ ...form, contato_recebedor: e.target.value })} className="w-full ui-input" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Instrucoes</label>
              <textarea value={form.instrucoes} onChange={(e) => setForm({ ...form, instrucoes: e.target.value })} rows={3} className="w-full ui-input" />
            </div>
            <button onClick={save} disabled={!form.nome} className="w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
              {editing ? 'Salvar Alteracoes' : 'Cadastrar Cliente'}
            </button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
