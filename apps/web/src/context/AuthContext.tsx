import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDTO } from '@deskbooking/shared';
import { fetchApi } from '../services/api';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, orgName: string, orgCode: string, subdomain: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      setIsLoading(true);
      const savedToken = localStorage.getItem('token');

      if (!savedToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetchApi<{ user: UserDTO; organization: any }>('/auth/me');
        const fullUser = {
          ...res.user,
          organization: res.organization || res.user.organization,
        };
        setUser(fullUser);
        if (fullUser.organization?.subdomain) {
          localStorage.setItem('activeTenantSubdomain', fullUser.organization.subdomain);
        }
      } catch (e) {
        console.warn('Auth token verification failed:', e);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await fetchApi<{ token: string; user: UserDTO; organization: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const fullUser = {
      ...res.user,
      organization: res.organization || res.user.organization,
    };

    localStorage.setItem('token', res.token);
    if (fullUser.organization?.subdomain) {
      localStorage.setItem('activeTenantSubdomain', fullUser.organization.subdomain);
    }
    setToken(res.token);
    setUser(fullUser);
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    orgName: string,
    orgCode: string,
    subdomain: string
  ) => {
    const res = await fetchApi<{ token: string; user: UserDTO; organization: any }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        orgName,
        orgCode,
        subdomain,
      }),
    });

    const fullUser = {
      ...res.user,
      organization: res.organization || res.user.organization,
    };

    localStorage.setItem('token', res.token);
    if (fullUser.organization?.subdomain) {
      localStorage.setItem('activeTenantSubdomain', fullUser.organization.subdomain);
    }
    setToken(res.token);
    setUser(fullUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        refreshUser: initAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
