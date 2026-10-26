import { create } from 'zustand';
import {
  loginAdmin,
  getAdminProfile,
  logoutAdmin,
  type AdminUser,
  type AdminLoginCredentials,
} from '../services/adminApi';

interface AdminAuthState {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<boolean>;
  login: (credentials: AdminLoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await getAdminProfile();
      if (res.success && res.admin) {
        set({ admin: res.admin, isAuthenticated: true, isLoading: false, error: null });
        return true;
      } else {
        set({ admin: null, isAuthenticated: false, isLoading: false, error: null });
        return false;
      }
    } catch (err: any) {
      set({ admin: null, isAuthenticated: false, isLoading: false, error: null });
      return false;
    }
  },

  login: async (credentials: AdminLoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const res = await loginAdmin(credentials);
      if (res.success && res.admin) {
        set({
          admin: res.admin,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      } else {
        set({
          admin: null,
          isAuthenticated: false,
          isLoading: false,
          error: res.error || 'Invalid email or password.',
        });
        return false;
      }
    } catch (err: any) {
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Unable to connect to the authentication server. Please check your network and try again.',
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await logoutAdmin();
    } finally {
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
