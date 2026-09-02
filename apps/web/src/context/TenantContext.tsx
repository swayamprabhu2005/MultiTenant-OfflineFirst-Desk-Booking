import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../services/api';

export interface TenantInfo {
  id: string;
  name: string;
  code: string;
  subdomain: string;
  logoUrl?: string | null;
  themeColor: string;
  status?: string;
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

  // Helper to convert HEX to HSL
  const hexToHsl = (hex: string) => {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };

  // Apply CSS Custom Variables for dynamic white-label brand colors
  const applyThemeColor = (color: string) => {
    if (!color) return;
    try {
      const { h, s, l } = hexToHsl(color);
      const root = document.documentElement;
      
      root.style.setProperty('--primary-color', `hsl(${h}, ${s}%, ${l}%)`);
      root.style.setProperty('--primary-accent', `hsl(${h}, ${s}%, ${Math.max(0, l - 6)}%)`);
      root.style.setProperty('--primary-dark', `hsl(${h}, ${s}%, ${Math.max(0, l - 12)}%)`);
    } catch (e) {
      console.error('Failed to parse hex brand color:', color, e);
    }
  };

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      let sub = localStorage.getItem('activeTenantSubdomain');

      if (!sub && typeof window !== 'undefined') {
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
          sub = parts[0];
        }
      }

      if (!sub) {
        sub = 'system';
      }

      localStorage.setItem('activeTenantSubdomain', sub);

      try {
        const orgs = await fetchApi<TenantInfo[]>('/auth/organizations');
        setAvailableTenants(orgs);

        const current = orgs.find(o => o.subdomain === sub) || orgs[0];
        if (current) {
          setTenant(current);
          applyThemeColor(current.themeColor || '#16a34a');
        }
      } catch (e) {
        console.warn('[TenantContext] Failed to fetch organizations:', e);
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
