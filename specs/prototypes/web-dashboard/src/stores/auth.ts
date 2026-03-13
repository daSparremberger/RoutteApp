import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'admin' | 'gestor' | 'motorista' | null;

interface User {
  id: number;
  tenant_id: number | null;
  firebase_uid: string;
  nome: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  role: UserRole;
  token: string | null;
  setAuth: (user: User, role: UserRole, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      token: null,
      setAuth: (user, role, token) => set({ user, role, token }),
      logout: () => set({ user: null, role: null, token: null }),
    }),
    { name: 'rotavans-auth' }
  )
);

