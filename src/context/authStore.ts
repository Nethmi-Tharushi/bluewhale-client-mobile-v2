import { create } from 'zustand';
import { clearAuth, getToken, getUser, setToken, setUser } from '../utils/tokenStorage';

export type AuthUser = {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  [k: string]: any;
};

type AuthState = {
  bootstrapped: boolean;
  token: string | null;
  user: AuthUser | null;
  hydrate: () => Promise<void>;
  signIn: (payload: { token: string; user: AuthUser }) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  bootstrapped: false,
  token: null,
  user: null,
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([getToken(), getUser()]);
      let user: AuthUser | null = null;

      if (userJson) {
        try {
          user = JSON.parse(userJson) as AuthUser;
        } catch {
          // Stored user payload is invalid; clear it and continue boot.
          await clearAuth();
          set({ token: null, user: null, bootstrapped: true });
          return;
        }
      }

      set({
        token: token ?? null,
        user,
        bootstrapped: true,
      });
    } catch {
      set({ token: null, user: null, bootstrapped: true });
    }
  },
  signIn: async ({ token, user }) => {
    await Promise.all([setToken(token), setUser(JSON.stringify(user))]);
    set({ token, user });
  },
  signOut: async () => {
    await clearAuth();
    set({ token: null, user: null });
  },
}));
