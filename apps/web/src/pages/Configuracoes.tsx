import { Moon, Sun, Globe, Calendar, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'framer-motion';
import { useThemeStore } from '../stores/theme';
import { useState } from 'react';

const idiomas = [
  { code: 'pt-BR', label: 'Portugues (Brasil)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'es', label: 'Espanol' },
];

const formatosData = [
  { code: 'DD/MM/YYYY', label: '31/12/2026' },
  { code: 'MM/DD/YYYY', label: '12/31/2026' },
  { code: 'YYYY-MM-DD', label: '2026-12-31' },
];

export function Configuracoes() {
  const { theme, toggleTheme } = useThemeStore();
  const [idioma, setIdioma] = useState('pt-BR');
  const [formatoData, setFormatoData] = useState('DD/MM/YYYY');

  return (
    <PageTransition>
      <PageHeader title="Configurações" subtitle="Personalize sua experiência" />

      <div className="max-w-2xl space-y-6">
        {/* Aparencia */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface2 border border-border/30 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-text mb-6">Aparencia</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                {theme === 'dark' ? (
                  <Moon size={18} className="text-accent" />
                ) : (
                  <Sun size={18} className="text-accent" />
                )}
              </div>
              <div>
                <p className="font-medium text-text">Tema</p>
                <p className="text-sm text-text-muted">
                  {theme === 'dark' ? 'Escuro' : 'Claro'}
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                theme === 'light' ? 'bg-accent' : 'bg-surface3'
              }`}
            >
              <motion.div
                animate={{ x: theme === 'light' ? 24 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
              />
            </button>
          </div>
        </motion.div>

        {/* Idioma */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface2 border border-border/30 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-text mb-6">Idioma e Regiao</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                  <Globe size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-medium text-text">Idioma</p>
                  <p className="text-sm text-text-muted">Idioma da interface</p>
                </div>
              </div>
              <select
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="w-48 h-10 px-3 bg-surface3 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none cursor-pointer"
              >
                {idiomas.map(i => (
                  <option key={i.code} value={i.code}>{i.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                  <Calendar size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-medium text-text">Formato de data</p>
                  <p className="text-sm text-text-muted">Como exibir datas</p>
                </div>
              </div>
              <select
                value={formatoData}
                onChange={(e) => setFormatoData(e.target.value)}
                className="w-48 h-10 px-3 bg-surface3 border border-border/50 rounded-xl text-text text-sm focus:border-success focus:outline-none cursor-pointer"
              >
                {formatosData.map(f => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Futuras Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface2 border border-border/30 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-text mb-2">Em breve</h3>
          <p className="text-sm text-text-muted mb-6">Novas funcionalidades em desenvolvimento</p>

          <div className="space-y-3">
            {['Notificacoes', 'Integracoes', 'Backup de dados', 'API Access'].map((feature) => (
              <div
                key={feature}
                className="flex items-center justify-between p-4 bg-surface3/50 rounded-xl opacity-50"
              >
                <span className="text-text-muted">{feature}</span>
                <ChevronRight size={18} className="text-text-muted/50" />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}





