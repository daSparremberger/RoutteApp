import { useEffect, useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
import type { PassageiroCorporativo } from '@rotavans/shared';

const initialForm = {
  nome: '',
  telefone: '',
  email: '',
  endereco: '',
  lat: null as number | null,
  lng: null as number | null,
  empresa: '',
  cargo: '',
  centro_custo: '',
  horario_entrada: '',
  horario_saida: '',
};

export function PassageirosCorporativos() {
  const [passageiros, setPassageiros] = useState<PassageiroCorporativo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PassageiroCorporativo | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await api.get<PassageiroCorporativo[]>('/passageiros-corporativos');
    setPassageiros(data);
  }

  function openNew() {
    setEditing(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openEdit(passageiro: PassageiroCorporativo) {
    setEditing(passageiro);
    setForm({
      nome: passageiro.nome,
      telefone: passageiro.telefone || '',
      email: passageiro.email || '',
      endereco: passageiro.endereco || '',
      lat: passageiro.lat ?? null,
      lng: passageiro.lng ?? null,
      empresa: passageiro.profile?.empresa || '',
      cargo: passageiro.profile?.cargo || '',
      centro_custo: passageiro.profile?.centro_custo || '',
      horario_entrada: passageiro.profile?.horario_entrada || '',
      horario_saida: passageiro.profile?.horario_saida || '',
    });
    setModalOpen(true);
  }

  async function save() {
    const payload = { ...form };

    if (payload.endereco && (payload.lat == null || payload.lng == null)) {
      const match = await geocodeAddress(payload.endereco);
      if (match) {
        payload.lat = match.lat;
        payload.lng = match.lng;
      }
    }

    if (editing) {
      await api.put(`/passageiros-corporativos/${editing.id}`, payload);
    } else {
      await api.post('/passageiros-corporativos', payload);
    }

    setModalOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Excluir este passageiro corporativo?')) return;
    await api.delete(`/passageiros-corporativos/${id}`);
    load();
  }

  return (
    <PageTransition>
      <div>
        <PageHeader
          title="Passageiros Corporativos"
          subtitle={`${passageiros.length} passageiro(s)`}
          action={
            <button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={18} /> Novo Passageiro
            </button>
          }
        />

        {passageiros.length === 0 ? (
          <EmptyState icon={Briefcase} message="Nenhum passageiro corporativo cadastrado" />
        ) : (
          <div className="ui-table-wrap">
            <table className="w-full">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Centro de Custo</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {passageiros.map((passageiro) => (
                  <tr key={passageiro.id} className="ui-table-row">
                    <td className="px-4 py-3 text-text">{passageiro.nome}</td>
                    <td className="px-4 py-3 text-text-muted">{passageiro.profile?.empresa || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{passageiro.profile?.cargo || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{passageiro.profile?.centro_custo || '-'}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(passageiro)} className="text-text-muted hover:text-text"><Pencil size={16} /></button>
                      <button onClick={() => remove(passageiro.id)} className="text-text-muted hover:text-red-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Passageiro' : 'Novo Passageiro'}>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Empresa</label>
                <input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="w-full ui-input" />
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
                <label className="block text-sm text-text-muted mb-1">Cargo</label>
                <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Centro de Custo</label>
                <input value={form.centro_custo} onChange={(e) => setForm({ ...form, centro_custo: e.target.value })} className="w-full ui-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Horario de Entrada</label>
                <input value={form.horario_entrada} onChange={(e) => setForm({ ...form, horario_entrada: e.target.value })} className="w-full ui-input" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Horario de Saida</label>
                <input value={form.horario_saida} onChange={(e) => setForm({ ...form, horario_saida: e.target.value })} className="w-full ui-input" />
              </div>
            </div>
            <button onClick={save} disabled={!form.nome} className="w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50">
              {editing ? 'Salvar Alteracoes' : 'Cadastrar Passageiro'}
            </button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
