import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../common/Toast';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ReportIssueButton } from '../issues/ReportIssueButton';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { tenant, applyThemeColor, resetDefaultTheme } = useTenant();

  // Strict multi-tenant theme isolation:
  // - Platform Superadmin retains neutral platform styles (never overridden by tenant brand)
  // - Tenant organizations and employees strictly view their configured brand colors
  // - Cleanly resets on unmount to prevent bleeding onto public landing / login pages
  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN') {
      resetDefaultTheme();
    } else {
      const activeColor = tenant?.themeColor || (user as any)?.organization?.themeColor;
      if (activeColor) {
        applyThemeColor(activeColor);
      } else {
        resetDefaultTheme();
      }
    }

    return () => {
      resetDefaultTheme();
    };
  }, [user?.role, tenant?.themeColor, (user as any)?.organization?.themeColor]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <ErrorBoundary>
            {children || <Outlet />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Floating Issue Report Trigger (Scoped to tenant roles: Employee, Branch Admin, Org Admin) */}
      {user?.role !== 'PLATFORM_ADMIN' && <ReportIssueButton />}

      <ToastContainer />
    </div>
  );
};
