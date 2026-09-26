import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: {
    full_name?: string;
    role?: string;
    current_password?: string;
    new_password?: string;
  }) => Promise<AuthUser>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('datanova_auth_token');
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('datanova_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Validate existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('datanova_auth_token');
      if (savedToken) {
        try {
          const me = await api.getMe();
          setUser(me);
          localStorage.setItem('datanova_user', JSON.stringify(me));
        } catch (err) {
          console.warn('Session verification failed, resetting credentials:', err);
          localStorage.removeItem('datanova_auth_token');
          localStorage.removeItem('datanova_user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const res = await api.login(email, password);
      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem('datanova_auth_token', res.access_token);
      localStorage.setItem('datanova_user', JSON.stringify(res.user));
      localStorage.removeItem('datova_active_dataset_id');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check your credentials or backend server.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string, role?: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const res = await api.register({
        email,
        password,
        full_name: fullName,
        role: role || 'Data Analyst'
      });
      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem('datanova_auth_token', res.access_token);
      localStorage.setItem('datanova_user', JSON.stringify(res.user));
      localStorage.removeItem('datova_active_dataset_id');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed. Please check your details.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignored
    } finally {
      localStorage.removeItem('datanova_auth_token');
      localStorage.removeItem('datanova_user');
      localStorage.removeItem('datova_active_dataset_id');
      setToken(null);
      setUser(null);
      setAuthError(null);
    }
  };

  const updateProfile = async (payload: {
    full_name?: string;
    role?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<AuthUser> => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const res = await api.updateProfile(payload);
      setUser(res.user);
      localStorage.setItem('datanova_user', JSON.stringify(res.user));
      return res.user;
    } catch (err: any) {
      setAuthError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        authError,
        login,
        register,
        logout,
        updateProfile,
        clearAuthError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
