import { jsx as _jsx } from "react/jsx-runtime";
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../../stores/theme';
export function ThemeToggle() {
    const { theme, toggleTheme } = useThemeStore();
    return (_jsx("button", { onClick: toggleTheme, className: "relative w-9 h-9 rounded-xl hover:bg-surface2\n                 flex items-center justify-center transition-colors duration-150", "aria-label": theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro', children: _jsx(motion.div, { initial: false, animate: {
                rotate: theme === 'dark' ? 0 : 180,
            }, transition: { duration: 0.2 }, children: theme === 'dark' ? (_jsx(Moon, { size: 18, strokeWidth: 1.5, className: "text-text-muted" })) : (_jsx(Sun, { size: 18, strokeWidth: 1.5, className: "text-text-muted" })) }) }));
}
