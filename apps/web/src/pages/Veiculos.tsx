import { useEffect, useState } from 'react';
import { Plus, Car, ChevronRight, Save, Map } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageTransition } from '../components/ui/PageTransition';
import { api } from '../lib/api';
import type { Veiculo, Motorista } from '@rotavans/shared';

export function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [selected, setSelected] = useState<Veiculo | null>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedMotoristaIds, setSelectedMotoristaIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    placa: '',
    ano: '',
    fabricante: '',
    modelo: '',
    capacidade: '',
    consumo_km: '',
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [v, m] = await Promise.all([
      api.get<Veiculo[]>('/veiculos'),
      api.get<Motorista[]>('/motoristas'),
    ]);
    setVeiculos(v);
    setMotoristas(m.filter((x) => x.cadastro_completo));
  }

  async function selectVeiculo(v: Veiculo) {
    const detail = await api.get<Veiculo>(`/veiculos/${v.id}`);
    setSelected(detail);
    setSelectedMotoristaIds(
      detail.motoristas_habilitados
        ?.map((m) => m.motorista_id ?? m.id)
        .filter((id): id is number => id != null) || []
    );
  }

  function openNew() {
    setForm({
      placa: '',
      ano: '',
      fabricante: '',
      modelo: '',
      capacidade: '',
      consumo_km: '',
    });
    setModalOpen(true);
  }

  async function createVeiculo() {
    await api.post('/veiculos', {
      placa: form.placa,
      ano: form.ano ? Number(form.ano) : null,
      fabricante: form.fabricante,
      modelo: form.modelo,
      capacidade: Number(form.capacidade),
      consumo_km: form.consumo_km ? Number(form.consumo_km) : null,
    });
    setModalOpen(false);
    load();
  }

  function toggleMotorista(id: number) {
    setSelectedMotoristaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveMotoristas() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/veiculos/${selected.id}/motoristas`, {
        motorista_ids: selectedMotoristaIds,
      });
      await selectVeiculo(selected);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageTransition>
      <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Lista de veículos */}
        <div className="w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1">
          <PageHeader
            title="Veículos"
            subtitle={`${veiculos.length} veículo(s)`}
            action={
              <button
                onClick={openNew}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-2 rounded-xl text-sm font-medium"
              >
                <Plus size={16} />
              </button>
            }
          />

          {veiculos.length === 0 ? (
            <EmptyState icon={Car} message="Nenhum veículo cadastrado" />
          ) : (
            <div className="space-y-2">
              {veiculos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVeiculo(v)}
                  className={`w-full text-left bg-surface2 border rounded-xl p-4 transition-colors ${
                    selected?.id === v.id
                      ? 'border-accent'
                      : 'border-border/30 hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text font-medium">{v.placa}</p>
                      <p className="text-text-muted text-xs mt-1">
                        {v.modelo} {v.fabricante} {v.ano || ''}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalhes do veículo */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {selected ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-text mb-4">
                  {selected.placa}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl p-4 border border-border/30">
                    <p className="text-text-muted text-xs mb-1">Modelo</p>
                    <p className="text-text">{selected.modelo}</p>
                  </div>
                  <div className="rounded-xl p-4 border border-border/30">
                    <p className="text-text-muted text-xs mb-1">Fabricante</p>
                    <p className="text-text">{selected.fabricante}</p>
                  </div>
                  <div className="rounded-xl p-4 border border-border/30">
                    <p className="text-text-muted text-xs mb-1">Capacidade</p>
                    <p className="text-text">{selected.capacidade} passageiros</p>
                  </div>
                  <div className="rounded-xl p-4 border border-border/30">
                    <p className="text-text-muted text-xs mb-1">Consumo</p>
                    <p className="text-text">
                      {selected.consumo_km ? `${selected.consumo_km} km/L` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pool de motoristas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm text-text-muted">
                    Motoristas Habilitados ({selectedMotoristaIds.length})
                  </h3>
                  <button
                    onClick={saveMotoristas}
                    disabled={saving}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-surface px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Save size={14} />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
                <div className="rounded-xl p-3 border border-border/30 max-h-48 overflow-y-auto space-y-1">
                  {motoristas.length === 0 ? (
                    <p className="text-text-muted text-sm p-2">
                      Nenhum motorista disponível
                    </p>
                  ) : (
                    motoristas.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                          selectedMotoristaIds.includes(m.id)
                            ? 'bg-accent/20'
                            : 'hover:bg-surface2'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMotoristaIds.includes(m.id)}
                          onChange={() => toggleMotorista(m.id)}
                          className="rounded"
                        />
                        <span className="text-text text-sm">{m.nome}</span>
                        {m.telefone && (
                          <span className="text-text-muted text-xs">
                            {m.telefone}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Rotas vinculadas */}
              <div>
                <h3 className="text-sm text-text-muted mb-3">
                  Rotas Vinculadas ({selected.rotas_vinculadas?.length || 0})
                </h3>
                {selected.rotas_vinculadas && selected.rotas_vinculadas.length > 0 ? (
                  <div className="space-y-2">
                    {selected.rotas_vinculadas.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 bg-surface2 rounded-lg p-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Map size={16} className="text-accent" />
                        </div>
                        <div>
                          <p className="text-text text-sm">{r.nome}</p>
                          <p className="text-text-muted text-xs">
                            {r.motorista_nome || 'Sem motorista'} - {r.turno}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl p-4 border border-border/30 text-center text-text-muted text-sm">
                    Nenhuma rota vinculada a este veículo
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
              <p>Selecione um veículo para ver detalhes</p>
            </div>
          )}
        </div>

        {/* Modal novo veículo */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Novo Veículo"
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Placa</label>
                <input
                  value={form.placa}
                  onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                  placeholder="ABC1D23"
                  className="w-full ui-input"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Ano</label>
                <input
                  value={form.ano}
                  onChange={(e) => setForm({ ...form, ano: e.target.value })}
                  type="number"
                  placeholder="2020"
                  className="w-full ui-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Fabricante
                </label>
                <input
                  value={form.fabricante}
                  onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                  placeholder="Fiat"
                  className="w-full ui-input"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Modelo</label>
                <input
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  placeholder="Ducato"
                  className="w-full ui-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Capacidade (passageiros)
                </label>
                <input
                  value={form.capacidade}
                  onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                  type="number"
                  placeholder="15"
                  className="w-full ui-input"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Consumo (km/L)
                </label>
                <input
                  value={form.consumo_km}
                  onChange={(e) => setForm({ ...form, consumo_km: e.target.value })}
                  type="number"
                  step="0.1"
                  placeholder="8.5"
                  className="w-full ui-input"
                />
              </div>
            </div>
            <button
              onClick={createVeiculo}
              disabled={!form.placa || !form.fabricante || !form.modelo || !form.capacidade}
              className="w-full bg-accent hover:bg-accent-hover text-surface font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              Criar Veículo
            </button>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
