import { useState } from 'react';
import { Camera, MapPin, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth';

const regioes = [
  'Sul',
  'Sudeste',
  'Centro-Oeste',
  'Nordeste',
  'Norte',
];

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function Perfil() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    nome: user?.nome || '',
    email: user?.email || '',
    cidade: '',
    estado: 'SP',
    regiao: 'Sudeste',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Implement save
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
  };

  const inputClass = "w-full h-12 px-4 bg-surface2 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none transition-all duration-200";

  return (
    <PageTransition>
      <PageHeader title="Perfil" subtitle="Gerencie suas informações pessoais" />

      <div className="max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface2 border border-border/30 rounded-2xl p-6 mb-6"
        >
          {/* Avatar */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-accent-muted flex items-center justify-center">
                <span className="text-3xl font-bold text-accent">
                  {form.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors">
                <Camera size={14} className="text-surface" />
              </button>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">{form.nome}</h3>
              <p className="text-sm text-text-muted">{form.email}</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-text-muted mb-2">Nome completo</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-2">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Localização */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface2 border border-border/30 rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
              <MapPin size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Localização</h3>
              <p className="text-sm text-text-muted">Região de operação</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm text-text-muted mb-2">Cidade</label>
              <input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                placeholder="Sua cidade"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-2">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className={inputClass}
              >
                {estados.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-2">Regiao</label>
              <select
                value={form.regiao}
                onChange={(e) => setForm({ ...form, regiao: e.target.value })}
                className={inputClass}
              >
                {regioes.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Save button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full h-12 bg-accent hover:bg-accent-hover
                     text-surface font-semibold rounded-xl transition-colors duration-200 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </motion.button>
      </div>
    </PageTransition>
  );
}





