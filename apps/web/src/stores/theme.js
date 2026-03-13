import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useThemeStore = create()(persist((set, get) => ({
    theme: 'light',
    setTheme: (theme) => {
        set({ theme });
        updateDocumentTheme(theme);
    },
    toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        updateDocumentTheme(newTheme);
    },
}), {
    name: 'rotavans-theme',
    onRehydrateStorage: () => (state) => {
        if (state) {
            updateDocumentTheme(state.theme);
        }
    },
}));
function updateDocumentTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    else {
        document.documentElement.classList.remove('dark');
    }
}
