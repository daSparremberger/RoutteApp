import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../../stores/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-xl hover:bg-surface2
                 flex items-center justify-center transition-colors duration-150"
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      <motion.div
        initial={false}
        animate={{
          rotate: theme === 'dark' ? 0 : 180,
        }}
        transition={{ duration: 0.2 }}
      >
        {theme === 'dark' ? (
          <Moon size={18} strokeWidth={1.5} className="text-text-muted" />
        ) : (
          <Sun size={18} strokeWidth={1.5} className="text-text-muted" />
        )}
      </motion.div>
    </button>
  );
}



