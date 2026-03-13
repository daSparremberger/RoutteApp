import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModulesState {
  modules: string[];
  setModules: (modules: string[]) => void;
  clearModules: () => void;
  hasModule: (slug: string) => boolean;
}

export const useModulesStore = create<ModulesState>()(
  persist(
    (set, get) => ({
      modules: [],
      setModules: (modules) => set({ modules }),
      clearModules: () => set({ modules: [] }),
      hasModule: (slug) => get().modules.includes(slug),
    }),
    { name: 'rotavans-modules' }
  )
);
