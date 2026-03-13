import { useEffect, useState } from 'react';
import { Plus, Map, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { RouteMap } from '../components/maps/RouteMap';
import { api } from '../lib/api';
import type { Rota, Veiculo, Aluno } from '@rotavans/shared';

export function Rotas() {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [selected, setSelected] = useState<Rota | null>(null);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ nome: '', veiculo_id: '', turno: 'manha', aluno_ids: [] as number[] });

  useEffect(() => { load(); }, []);

  async function load() {
    const [r, v, a] = await Promise.all([
      api.get<Rota[]>('/rotas'),
      api.get<Veiculo[]>('/veiculos'),
      api.get<Aluno[]>('/alunos'),
    ]);
    setRotas(r);
    setVeiculos(v.filter((x) => x.ativo));
    setAlunos(a);
  }

  async function selectRota(r: Rota) {
    const detail = await api.get<Rota>(`/rotas/${r.id}`);
    setSelected(detail);
  }

  function openNew() {
    setForm({ nome: '', veiculo_id: veiculos[0]?.id?.toString() || '', turno: 'manha', aluno_ids: [] });
    setModalOpen(true);
  }

  async function save() {
    await api.post('/rotas', { ...form, veiculo_id: Number(form.veiculo_id), aluno_ids: form.aluno_ids });
    setModalOpen(false);
    load();
  }

  function toggleAluno(id: number) {
    setForm((f) => ({
      ...f,
      aluno_ids: f.aluno_ids.includes(id) ? f.aluno_ids.filter((x) => x !== id) : [...f.aluno_ids, id],
    }));
  }

  return (
    <PageTransition>
      <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1">
          <PageHeader title="Rotas" subtitle={`${rotas.length} rota(s)`}
            action={<button onClick={openNew} className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-xl text-sm font-medium"><Plus size={16} /></button>} />

          {rotas.length === 0 ? <EmptyState icon={Map} message="Nenhuma rota" /> : (
            <div className="space-y-2">
              {rotas.map((r) => (
                <button key={r.id} onClick={() => selectRota(r)}
                  className={`w-full text-left bg-surface2 border rounded-xl p-4 transition-colors ${selected?.id === r.id ? 'border-accent' : 'border-border/30 hover:border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text font-medium">{r.nome}</p>
                      <p className="text-text-muted text-xs mt-1">Veículo: {r.veiculo_placa || 'Sem veículo'} - {r.turno}</p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {selected ? (
            <div>
              <h2 className="text-xl font-bold text-text mb-4">{selected.nome}</h2>
              <RouteMap paradas={selected.paradas || []} geojson={selected.rota_geojson} />
              <div className="mt-4">
                <h3 className="text-sm text-text-muted mb-2">Paradas ({selected.paradas?.length || 0})</h3>
                <div className="space-y-2">
                  {selected.paradas?.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 bg-surface2 rounded-lg p-3">
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-text text-xs font-bold">{i + 1}</div>
                      <div>
                        <p className="text-text text-sm">{p.aluno_nome}</p>
                        <p className="text-text-muted text-xs">{p.aluno_endereco}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <p>Selecione uma rota para ver detalhes</p>
            </div>
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Rota" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div><label className="block text-sm text-text-muted mb-1">Nome</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full ui-input" /></div>
              <div><label className="block text-sm text-text-muted mb-1">Veículo</label>
                <select value={form.veiculo_id} onChange={(e) => setForm({ ...form, veiculo_id: e.target.value })} className="w-full ui-input">
                  {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>)}
                </select></div>
              <div><label className="block text-sm text-text-muted mb-1">Turno</label>
                <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className="w-full ui-input">
                  <option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option>
                </select></div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-2">Alunos (selecione na ordem das paradas)</label>
              <div className="max-h-48 overflow-y-auto bg-surface2 rounded-xl p-2 space-y-1">
                {alunos.filter((a) => a.turno === form.turno).map((a) => (
                  <label key={a.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${form.aluno_ids.includes(a.id) ? 'bg-accent/20' : 'hover:bg-surface2'}`}>
                    <input type="checkbox" checked={form.aluno_ids.includes(a.id)} onChange={() => toggleAluno(a.id)} className="rounded" />
                    <span className="text-text text-sm">{a.nome}</span>
                    <span className="text-text-muted text-xs">{a.escola_nome}</span>
                    {form.aluno_ids.includes(a.id) && <span className="ml-auto text-accent text-xs">#{form.aluno_ids.indexOf(a.id) + 1}</span>}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={save} disabled={!form.nome || !form.veiculo_id || form.aluno_ids.length === 0}
              className="w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50">Criar Rota</button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
