/**
 * Authentication hook
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { verifyAuth, logout as apiLogout } from '@/lib/api';

interface User {
  userId: string;
  role: 'Admin' | 'Viewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const currentUser = await verifyAuth();
    setUser(currentUser);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'Admin',
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

