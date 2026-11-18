import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getJSON, postJSON } from '../lib/apiClient';

export interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  full_name?: string;
  profile: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  me: () => Promise<void>;
  isAuthenticated: () => boolean;
  isRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const data = await getJSON('/api/auth/me');
      setUser(data.user);
    } catch { setUser(null); } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (email: string, password: string) => {
    const data = await postJSON('/api/auth/login', { email, password });
    setUser(data.user);
  };

  const logout = async () => {
    try { await postJSON('/api/auth/logout', {}); } catch { void null; }
    setUser(null);
  };

  const isAuthenticated = () => !!user;
  const isRole = (role: string) => user?.role === role;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, me: loadMe, isAuthenticated, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
};
