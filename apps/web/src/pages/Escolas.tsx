import { Fragment, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, School, X, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
import type { Escola, EscolaContato } from '@rotavans/shared';

interface ContatoForm {
  id?: number;
  cargo: string;
  nome: string;
  telefone: string;
}

const CARGO_OPTIONS = ['Diretor', 'Coordenador', 'Secretário', 'Outro'] as const;

export function Escolas() {
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Escola | null>(null);
  const [form, setForm] = useState({
    nome: '',
    endereco: '',
    lat: null as number | null,
    lng: null as number | null,
    turno_manha: false,
    turno_tarde: false,
    turno_noite: false,
  });
  const [contatos, setContatos] = useState<ContatoForm[]>([]);
  const [originalContatos, setOriginalContatos] = useState<EscolaContato[]>([]);
  const [expandedSchool, setExpandedSchool] = useState<number | null>(null);
  const [schoolContatos, setSchoolContatos] = useState<EscolaContato[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await api.get<Escola[]>('/escolas');
    setEscolas(data);
  }

  function openNew() {
    setEditing(null);
    setForm({
      nome: '',
      endereco: '',
      lat: null,
      lng: null,
      turno_manha: false,
      turno_tarde: false,
      turno_noite: false,
    });
    setContatos([]);
    setOriginalContatos([]);
    setModalOpen(true);
  }

  async function openEdit(escola: Escola) {
    setEditing(escola);
    setForm({
      nome: escola.nome,
      endereco: escola.endereco,
      lat: escola.lat ?? null,
      lng: escola.lng ?? null,
      turno_manha: escola.turno_manha ?? false,
      turno_tarde: escola.turno_tarde ?? false,
      turno_noite: escola.turno_noite ?? false,
    });

    try {
      const detail = await api.get<Escola>(`/escolas/${escola.id}`);
      const contatosData = detail.contatos || [];
      setOriginalContatos(contatosData);
      setContatos(contatosData.map((c) => ({ id: c.id, cargo: c.cargo || '', nome: c.nome, telefone: c.telefone || '' })));
    } catch {
      setContatos([]);
      setOriginalContatos([]);
    }

    setModalOpen(true);
  }

  function addContato() {
    setContatos([...contatos, { cargo: 'Diretor', nome: '', telefone: '' }]);
  }

  function removeContato(index: number) {
    setContatos(contatos.filter((_, i) => i !== index));
  }

  function updateContato(index: number, field: keyof ContatoForm, value: string) {
    setContatos(contatos.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
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

    let escolaId: number;

    if (editing) {
      await api.put(`/escolas/${editing.id}`, payload);
      escolaId = editing.id;
    } else {
      const newEscola = await api.post<Escola>('/escolas', payload);
      escolaId = newEscola.id;
    }

    if (editing) {
      const currentIds = contatos.filter((c) => c.id).map((c) => c.id);
      for (const original of originalContatos) {
        if (original.id && !currentIds.includes(original.id)) {
          await api.delete(`/escolas/${escolaId}/contatos/${original.id}`);
        }
      }
    }

    for (const contato of contatos) {
      if (!contato.nome.trim()) continue;

      const contatoPayload = {
        cargo: contato.cargo,
        nome: contato.nome,
        telefone: contato.telefone || null,
      };

      if (contato.id) {
        await api.put(`/escolas/${escolaId}/contatos/${contato.id}`, contatoPayload);
      } else {
        await api.post(`/escolas/${escolaId}/contatos`, contatoPayload);
      }
    }

    setModalOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Excluir esta escola?')) return;
    await api.delete(`/escolas/${id}`);
    load();
  }

  async function toggleContatos(escolaId: number) {
    if (expandedSchool === escolaId) {
      setExpandedSchool(null);
      setSchoolContatos([]);
      return;
    }

    try {
      const escola = await api.get<Escola>(`/escolas/${escolaId}`);
      setSchoolContatos(escola.contatos || []);
    } catch {
      setSchoolContatos([]);
    }

    setExpandedSchool(escolaId);
  }

  return (
    <PageTransition>
      <div>
        <PageHeader
          title="Escolas"
          subtitle={`${escolas.length} escola(s) cadastrada(s)`}
          action={
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-surface rounded-xl hover:bg-accent-hover"
            >
              <Plus size={18} /> Nova Escola
            </button>
          }
        />

        {escolas.length === 0 ? (
          <EmptyState icon={School} message="Nenhuma escola cadastrada" />
        ) : (
          <div className="ui-table-wrap">
            <table className="w-full">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Endereço</th>
                  <th className="px-4 py-3">Turnos</th>
                  <th className="px-4 py-3">Contatos</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {escolas.map((escola) => (
                  <Fragment key={escola.id}>
                    <tr className="ui-table-row">
                      <td className="px-4 py-3 text-text">{escola.nome}</td>
                      <td className="px-4 py-3 text-text-muted">{escola.endereco}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {[escola.turno_manha && 'M', escola.turno_tarde && 'T', escola.turno_noite && 'N'].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleContatos(escola.id)}
                          className="flex items-center gap-1 text-text-muted hover:text-accent"
                        >
                          <Users size={16} />
                          <span className="text-xs">Ver</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEdit(escola)} className="text-text-muted hover:text-text"><Pencil size={16} /></button>
                        <button onClick={() => remove(escola.id)} className="text-text-muted hover:text-red-400"><Trash2 size={16} /></button>
                      </td>
                    </tr>

                    {expandedSchool === escola.id && (
                      <tr className="bg-surface2/30">
                        <td colSpan={5} className="px-4 py-3">
                          {schoolContatos.length === 0 ? (
                            <p className="text-sm text-text-muted">Nenhum contato cadastrado</p>
                          ) : (
                            <div className="space-y-2">
                              {schoolContatos.map((contato) => (
                                <div key={contato.id} className="flex items-center gap-4 text-sm">
                                  <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">{contato.cargo}</span>
                                  <span className="text-text">{contato.nome}</span>
                                  {contato.telefone && <span className="text-text-muted">{contato.telefone}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Escola' : 'Nova Escola'}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Nome</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full ui-input" />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">Endereço</label>
              <AddressAutocompleteInput
                value={form.endereco}
                onChange={(value) => setForm({ ...form, endereco: value, lat: null, lng: null })}
                onSelect={(suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng })}
              />
              <p className="mt-1 text-xs text-text-muted">
                {form.lat != null && form.lng != null
                  ? 'Coordenadas definidas automaticamente.'
                  : 'Selecione um endereço da lista para preencher as coordenadas.'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">Turnos</label>
              <div className="flex gap-4">
                {(['manha', 'tarde', 'noite'] as const).map((turno) => (
                  <label key={turno} className="flex items-center gap-2 text-sm text-text-muted">
                    <input
                      type="checkbox"
                      checked={form[`turno_${turno}`]}
                      onChange={(e) => setForm({ ...form, [`turno_${turno}`]: e.target.checked })}
                      className="rounded border-border/30 bg-surface2"
                    />
                    {turno.charAt(0).toUpperCase() + turno.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">Contatos</label>
              <div className="space-y-2">
                {contatos.map((contato, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={contato.cargo}
                      onChange={(e) => updateContato(index, 'cargo', e.target.value)}
                      className="rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none"
                    >
                      {CARGO_OPTIONS.map((cargo) => (
                        <option key={cargo} value={cargo}>{cargo}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Nome"
                      value={contato.nome}
                      onChange={(e) => updateContato(index, 'nome', e.target.value)}
                      className="flex-1 rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none"
                    />
                    <input
                      placeholder="Telefone"
                      value={contato.telefone}
                      onChange={(e) => updateContato(index, 'telefone', e.target.value)}
                      className="w-32 rounded-xl border border-border/30 bg-surface2 px-3 py-2 text-sm text-text focus:border-success focus:outline-none"
                    />
                    <button onClick={() => removeContato(index)} type="button" className="p-1 text-text-muted hover:text-red-400">
                      <X size={18} />
                    </button>
                  </div>
                ))}

                <button onClick={addContato} type="button" className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80">
                  <Plus size={16} /> Adicionar Contato
                </button>
              </div>
            </div>

            <button onClick={save} className="w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover">
              {editing ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
