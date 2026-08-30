import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDTO, Role } from '@deskbooking/shared';
import { fetchApi } from '../services/api';
import { db } from '../db/indexedDB';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, organizationCode?: string) => Promise<void>;
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
        // Check offline cached user
        const cached = await db.cachedUser.toArray();
        if (cached.length > 0) {
          setUser(cached[0]);
        } else {
          setUser(null);
        }
        setIsLoading(false);
        return;
      }

      if (navigator.onLine) {
        try {
          const res = await fetchApi<{ user: UserDTO }>('/auth/me');
          setUser(res.user);
          await db.cachedUser.clear();
          await db.cachedUser.put({ ...res.user, token: savedToken });
        } catch (e) {
          // Token expired or invalid
          console.warn('Auth token verification failed:', e);
          const cached = await db.cachedUser.toArray();
          if (cached.length > 0) {
            setUser(cached[0]);
          } else {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
          }
        }
      } else {
        const cached = await db.cachedUser.toArray();
        if (cached.length > 0) {
          setUser(cached[0]);
        }
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, organizationCode?: string) => {
    const activeSubdomain = localStorage.getItem('activeTenantSubdomain') || 'system';

    const res = await fetchApi<{ token: string; user: UserDTO; organization: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        organizationCode,
        subdomain: activeSubdomain,
      }),
    });

    localStorage.setItem('token', res.token);
    if (res.organization?.subdomain) {
      localStorage.setItem('activeTenantSubdomain', res.organization.subdomain);
    }
    setToken(res.token);
    setUser(res.user);

    // Save to offline storage
    await db.cachedUser.clear();
    await db.cachedUser.put({ ...res.user, token: res.token });

    if (res.organization) {
      await db.organizations.put(res.organization);
    }
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

    localStorage.setItem('token', res.token);
    localStorage.setItem('activeTenantSubdomain', res.organization.subdomain);
    setToken(res.token);
    setUser(res.user);

    // Save to offline storage
    await db.cachedUser.clear();
    await db.cachedUser.put({ ...res.user, token: res.token });

    if (res.organization) {
      await db.organizations.put(res.organization);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    db.cachedUser.clear();
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
