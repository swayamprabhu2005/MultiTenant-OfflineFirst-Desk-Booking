import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../services/api';
import { db } from '../db/indexedDB';

export interface TenantInfo {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  logoUrl?: string | null;
  themeColor: string;
}

interface TenantContextType {
  tenant: TenantInfo | null;
  availableTenants: TenantInfo[];
  setTenantSubdomain: (subdomain: string) => void;
  isLoading: boolean;
  applyThemeColor: (color: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Apply CSS Custom Variables for dynamic white-label brand colors
  const applyThemeColor = (color: string) => {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--primary-accent', color);
    // Darker shade fallback or calculation
    root.style.setProperty('--primary-dark', color);
  };

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      // Determine initial subdomain
      let sub = localStorage.getItem('activeTenantSubdomain');

      if (!sub && typeof window !== 'undefined') {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
          sub = parts[0];
        }
      }

      if (!sub) {
        sub = 'acme'; // Default demo tenant
      }

      localStorage.setItem('activeTenantSubdomain', sub);

      // Fetch org list or offline cached orgs
      if (navigator.onLine) {
        try {
          const orgs = await fetchApi<TenantInfo[]>('/auth/organizations');
          setAvailableTenants(orgs);
          await db.organizations.bulkPut(orgs);

          const current = orgs.find(o => o.subdomain === sub) || orgs[0];
          if (current) {
            setTenant(current);
            applyThemeColor(current.themeColor || '#16a34a');
          }
        } catch (e) {
          const cachedOrgs = await db.organizations.toArray();
          setAvailableTenants(cachedOrgs);
          const current = cachedOrgs.find((o: any) => o.subdomain === sub) || cachedOrgs[0];
          if (current) {
            setTenant(current);
            applyThemeColor(current.themeColor || '#16a34a');
          }
        }
      } else {
        const cachedOrgs = await db.organizations.toArray();
        setAvailableTenants(cachedOrgs);
        const current = cachedOrgs.find((o: any) => o.subdomain === sub) || cachedOrgs[0];
        if (current) {
          setTenant(current);
          applyThemeColor(current.themeColor || '#16a34a');
        }
      }
    } catch (err) {
      console.error('Tenant context error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setTenantSubdomain = (subdomain: string) => {
    localStorage.setItem('activeTenantSubdomain', subdomain);
    const found = availableTenants.find(t => t.subdomain === subdomain);
    if (found) {
      setTenant(found);
      applyThemeColor(found.themeColor || '#16a34a');
    } else {
      loadTenants();
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        availableTenants,
        setTenantSubdomain,
        isLoading,
        applyThemeColor,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
