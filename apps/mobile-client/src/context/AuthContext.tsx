import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authApi } from '../services/api';
import { getItem, setItem, deleteItem } from '../utils/storage';

interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  fullName: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getItem('accessToken');
        if (token) {
          const { data } = await authApi.me();
          setUser(data);
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore failed:', err);
        try {
          await deleteItem('accessToken');
          await deleteItem('refreshToken');
        } catch {
          // ignore cleanup errors
        }
      } finally {
        setIsLoading(false);
      }
    })().catch((err) => {
      console.error('[AuthContext] Unhandled init error:', err);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    const accessToken = String(data.accessToken ?? '');
    const refreshToken = String(data.refreshToken ?? '');
    await setItem('accessToken', accessToken);
    await setItem('refreshToken', refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await deleteItem('accessToken');
    await deleteItem('refreshToken');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
