import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    user: null,
    role: null,
    scope: null,
    token: null,
    setAuth: (user, role, token, scope) => set({ user, role, token, scope }),
    logout: () => set({ user: null, role: null, scope: null, token: null }),
}), { name: 'rotavans-auth' }));
