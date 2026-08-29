import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/employee/DashboardPage';
import { BookingWizardPage } from './pages/employee/BookingWizardPage';
import { MyBookingsPage } from './pages/employee/MyBookingsPage';
import { SyncCenterPage } from './pages/employee/SyncCenterPage';
import { OrganizationsPage } from './pages/admin/OrganizationsPage';
import { BuildingsManagementPage } from './pages/admin/BuildingsManagementPage';
import { EmployeeRosterPage } from './pages/admin/EmployeeRosterPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-semibold">
        Loading Tenant Workspace...
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

const PasswordResetRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-semibold">
        Loading Tenant Workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="book" element={<BookingWizardPage />} />
                <Route path="my-bookings" element={<MyBookingsPage />} />
                <Route path="sync-center" element={<SyncCenterPage />} />

                {/* Admin Portal */}
                <Route path="admin/organizations" element={<OrganizationsPage />} />
                <Route path="admin/buildings" element={<BuildingsManagementPage />} />
                <Route path="admin/roster" element={<EmployeeRosterPage />} />
                <Route path="admin/audit" element={<AuditLogsPage />} />
              </Route>

              <Route
                path="/change-password"
                element={
                  <PasswordResetRoute>
                    <ChangePasswordPage />
                  </PasswordResetRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
};
