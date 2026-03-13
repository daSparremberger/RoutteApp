import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    user: null,
    role: null,
    token: null,
    setAuth: (user, role, token) => set({ user, role, token }),
    logout: () => set({ user: null, role: null, token: null }),
}), { name: 'rotavans-auth' }));
