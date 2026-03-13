import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { AddressAutocompleteInput } from '../components/ui/AddressAutocompleteInput';
import { api } from '../lib/api';
import { geocodeAddress } from '../lib/mapbox';
import type { Aluno, Escola } from '@rotavans/shared';

const initialForm: {
  nome: string;
  nascimento: string;
  telefone: string;
  endereco: string;
  lat: number | null;
  lng: number | null;
  escola_id: string;
  turno: string;
  turma: string;
  ano: string;
  nome_responsavel: string;
  cpf_responsavel: string;
  nascimento_responsavel: string;
  telefone_responsavel: string;
  valor_mensalidade: string;
  meses_contrato: string;
  inicio_contrato: string;
  restricoes: string;
  observacoes: string;
  face_embeddings: number[][] | null;
} = {
  nome: '',
  nascimento: '',
  telefone: '',
  endereco: '',
  lat: null,
  lng: null,
  escola_id: '',
  turno: 'manha',
  turma: '',
  ano: '',
  nome_responsavel: '',
  cpf_responsavel: '',
  nascimento_responsavel: '',
  telefone_responsavel: '',
  valor_mensalidade: '',
  meses_contrato: '',
  inicio_contrato: '',
  restricoes: '',
  observacoes: '',
  face_embeddings: null,
};

export function Alunos() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Aluno | null>(null);
  const [form, setForm] = useState(initialForm);
  const [expandedSections, setExpandedSections] = useState({
    responsavel: true,
    contrato: false,
    saude: false,
    biometria: false,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [a, e] = await Promise.all([api.get<Aluno[]>('/alunos'), api.get<Escola[]>('/escolas')]);
    setAlunos(a);
    setEscolas(e);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...initialForm, escola_id: escolas[0]?.id?.toString() || '' });
    setExpandedSections({ responsavel: true, contrato: false, saude: false, biometria: false });
    setModalOpen(true);
  }

  function openEdit(aluno: Aluno) {
    setEditing(aluno);
    setForm({
      nome: aluno.nome,
      nascimento: aluno.nascimento?.split('T')[0] || '',
      telefone: aluno.telefone || '',
      endereco: aluno.endereco,
      lat: aluno.lat,
      lng: aluno.lng,
      escola_id: aluno.escola_id.toString(),
      turno: aluno.turno,
      turma: aluno.turma || '',
      ano: aluno.ano || '',
      nome_responsavel: aluno.nome_responsavel || '',
      cpf_responsavel: aluno.cpf_responsavel || '',
      nascimento_responsavel: aluno.nascimento_responsavel?.split('T')[0] || '',
      telefone_responsavel: aluno.telefone_responsavel || '',
      valor_mensalidade: aluno.valor_mensalidade?.toString() || '',
      meses_contrato: aluno.meses_contrato?.toString() || '',
      inicio_contrato: aluno.inicio_contrato?.split('T')[0] || '',
      restricoes: aluno.restricoes || '',
      observacoes: aluno.observacoes || '',
      face_embeddings: aluno.face_embeddings || null,
    });

    setExpandedSections({
      responsavel: true,
      contrato: !!aluno.valor_mensalidade,
      saude: !!aluno.restricoes || !!aluno.observacoes,
      biometria: false,
    });

    setModalOpen(true);
  }

  async function save() {
    const payload = {
      ...form,
      escola_id: Number(form.escola_id),
      nascimento: form.nascimento || null,
      nascimento_responsavel: form.nascimento_responsavel || null,
      inicio_contrato: form.inicio_contrato || null,
      valor_mensalidade: form.valor_mensalidade ? parseFloat(form.valor_mensalidade) : null,
      meses_contrato: form.meses_contrato ? parseInt(form.meses_contrato, 10) : null,
    };

    if (payload.endereco && (payload.lat == null || payload.lng == null)) {
      const match = await geocodeAddress(payload.endereco);
      if (match) {
        payload.lat = match.lat;
        payload.lng = match.lng;
      }
    }

    if (editing) {
      await api.put(`/alunos/${editing.id}`, payload);
    } else {
      await api.post('/alunos', payload);
    }

    setModalOpen(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm('Excluir este aluno?')) return;
    await api.delete(`/alunos/${id}`);
    load();
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  const inputClass = 'w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200';

  return (
    <PageTransition>
      <div>
        <PageHeader
          title="Alunos"
          subtitle={`${alunos.length} aluno(s)`}
          action={
            <button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-4 py-2 rounded-xl text-sm font-medium">
              <Plus size={18} /> Novo Aluno
            </button>
          }
        />

        {alunos.length === 0 ? (
          <EmptyState icon={Users} message="Nenhum aluno cadastrado" />
        ) : (
          <div className="ui-table-wrap">
            <table className="w-full">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Escola</th>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {alunos.map((aluno) => (
                  <tr key={aluno.id} className="ui-table-row">
                    <td className="px-4 py-3 text-text">{aluno.nome}</td>
                    <td className="px-4 py-3 text-text-muted">{aluno.escola_nome || '-'}</td>
                    <td className="px-4 py-3 text-text-muted capitalize">{aluno.turno}</td>
                    <td className="px-4 py-3 text-text-muted">{aluno.turma || '-'}</td>
                    <td className="px-4 py-3 text-text-muted">{aluno.nome_responsavel || '-'}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => openEdit(aluno)} className="text-text-muted hover:text-text"><Pencil size={16} /></button>
                      <button onClick={() => remove(aluno.id)} className="text-text-muted hover:text-red-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Aluno' : 'Novo Aluno'} size="lg">
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <h3 className="text-text font-medium mb-3">Dados Pessoais</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Nome Completo *</label>
                    <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Data de Nascimento</label>
                    <input type="date" value={form.nascimento} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Telefone</label>
                    <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Endereço *</label>
                    <AddressAutocompleteInput
                      value={form.endereco}
                      onChange={(value) => setForm({ ...form, endereco: value, lat: null, lng: null })}
                      onSelect={(suggestion) => setForm({ ...form, endereco: suggestion.address, lat: suggestion.lat, lng: suggestion.lng })}
                      className="h-12"
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      {form.lat != null && form.lng != null
                        ? 'Coordenadas definidas automaticamente.'
                        : 'Selecione um endereço da lista para preencher as coordenadas.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-text font-medium mb-3">Dados Escolares</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Escola *</label>
                  <select value={form.escola_id} onChange={(e) => setForm({ ...form, escola_id: e.target.value })} className={inputClass}>
                    {escolas.map((escola) => <option key={escola.id} value={escola.id}>{escola.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Turno *</label>
                  <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className={inputClass}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Ano</label>
                  <input value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} placeholder="5º ano" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Turma</label>
                  <input value={form.turma} onChange={(e) => setForm({ ...form, turma: e.target.value })} placeholder="A" className={inputClass} />
                </div>
              </div>
            </div>

            <div className="ui-table-wrap">
              <button type="button" onClick={() => toggleSection('responsavel')} className="w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium">
                <span>Dados do Responsável</span>
                {expandedSections.responsavel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.responsavel && (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Nome do Responsável</label>
                      <input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-1">CPF do Responsável</label>
                      <input value={form.cpf_responsavel} onChange={(e) => setForm({ ...form, cpf_responsavel: e.target.value })} placeholder="000.000.000-00" className={inputClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Nascimento Responsável</label>
                      <input type="date" value={form.nascimento_responsavel} onChange={(e) => setForm({ ...form, nascimento_responsavel: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Telefone Responsável</label>
                      <input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(00) 00000-0000" className={inputClass} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="ui-table-wrap">
              <button type="button" onClick={() => toggleSection('contrato')} className="w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium">
                <span>Contrato</span>
                {expandedSections.contrato ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.contrato && (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Valor Mensalidade (R$)</label>
                      <input type="number" step="0.01" value={form.valor_mensalidade} onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })} placeholder="0.00" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Meses de Contrato</label>
                      <input type="number" value={form.meses_contrato} onChange={(e) => setForm({ ...form, meses_contrato: e.target.value })} placeholder="12" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-1">Início do Contrato</label>
                      <input type="date" value={form.inicio_contrato} onChange={(e) => setForm({ ...form, inicio_contrato: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="ui-table-wrap">
              <button type="button" onClick={() => toggleSection('saude')} className="w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium">
                <span>Saúde e Observações</span>
                {expandedSections.saude ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.saude && (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Restrições (alergias, necessidades especiais)</label>
                    <textarea value={form.restricoes} onChange={(e) => setForm({ ...form, restricoes: e.target.value })} rows={2} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Observações Gerais</label>
                    <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className={inputClass} />
                  </div>
                </div>
              )}
            </div>

            <div className="ui-table-wrap">
              <button type="button" onClick={() => toggleSection('biometria')} className="w-full flex items-center justify-between px-4 py-3 bg-surface2 text-text font-medium">
                <span className="flex items-center gap-2"><Camera size={18} />Biometria Facial</span>
                {expandedSections.biometria ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedSections.biometria && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={form.face_embeddings ? 'text-green-400' : 'text-red-400'}>
                      {form.face_embeddings ? 'Cadastrado' : 'Não cadastrado'}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted">Capture 5 fotos do rosto do aluno para habilitar check-in por reconhecimento facial.</p>
                  <button
                    type="button"
                    onClick={() => alert('Funcionalidade de captura facial será implementada em breve')}
                    className="rounded-xl bg-accent px-4 py-2 text-sm text-surface hover:bg-accent-hover"
                  >
                    Capturar Fotos
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={save}
              disabled={!form.nome || !form.endereco || !form.escola_id}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50"
            >
              {editing ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
