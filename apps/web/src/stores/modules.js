import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useModulesStore = create()(persist((set, get) => ({
    modules: [],
    setModules: (modules) => set({ modules }),
    clearModules: () => set({ modules: [] }),
    hasModule: (slug) => get().modules.includes(slug),
}), { name: 'rotavans-modules' }));
