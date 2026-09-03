import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { PlatformAdminDashboard } from './components/dashboard/PlatformAdminDashboard';
import { OrganizationAdminDashboard } from './components/dashboard/OrganizationAdminDashboard';
import { EmployeeRosterPage } from './pages/admin/EmployeeRosterPage';
import { BrandSettingsPage } from './pages/admin/BrandSettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { WorkspaceSetupPage } from './pages/admin/WorkspaceSetupPage';
import { FloorPlansPage } from './pages/admin/FloorPlansPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const DashboardRoute: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'PLATFORM_ADMIN') {
    return <PlatformAdminDashboard />;
  }
  return <OrganizationAdminDashboard />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-semibold">
        Loading SaaS Control Plane...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />

              {/* Protected Administration Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardRoute />} />
                <Route path="admin/workspace-setup" element={<WorkspaceSetupPage />} />
                <Route path="admin/floor-plans" element={<FloorPlansPage />} />
                <Route path="admin/roster" element={<EmployeeRosterPage />} />
                <Route path="admin/branding" element={<BrandSettingsPage />} />
                <Route path="admin/audit" element={<AuditLogsPage />} />
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
};
