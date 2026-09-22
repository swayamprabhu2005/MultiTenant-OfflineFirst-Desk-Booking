import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { ForcePasswordChangePage } from './pages/auth/ForcePasswordChangePage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { PlatformAdminDashboard } from './components/dashboard/PlatformAdminDashboard';
import { OrganizationAdminDashboard } from './components/dashboard/OrganizationAdminDashboard';
import { BranchAdminDashboard } from './components/dashboard/BranchAdminDashboard';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { EmployeeRosterPage } from './pages/admin/EmployeeRosterPage';
import { WorkforcePage } from './pages/admin/WorkforcePage';
import { BranchEmployeeRosterPage } from './pages/branch/BranchEmployeeRosterPage';
import { BranchAuditLogsPage } from './pages/branch/BranchAuditLogsPage';
import { BrandSettingsPage } from './pages/admin/BrandSettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { WorkspaceSetupPage } from './pages/admin/WorkspaceSetupPage';
import { FloorPlansPage } from './pages/admin/FloorPlansPage';
import { EmployeeFloorPlanPage } from './pages/employee/EmployeeFloorPlanPage';
import { MyBookingsPage } from './pages/employee/MyBookingsPage';
import { OutlookCalendarPage } from './pages/employee/OutlookCalendarPage';
import { IssueReportsPage } from './pages/admin/IssueReportsPage';
import { PermissionsPage } from './pages/admin/PermissionsPage';

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
  if (user?.role === 'BRANCH_ADMIN') {
    return <BranchAdminDashboard />;
  }
  if (user?.role === 'EMPLOYEE') {
    return <EmployeeDashboard />;
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
    return <Navigate to="/force-password-change" replace />;
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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/force-password-change" element={<ForcePasswordChangePage />} />
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
                <Route path="admin/organizations" element={<Navigate to="/" replace />} />
                <Route path="admin/issues" element={<IssueReportsPage />} />
                <Route path="employee/issues" element={<IssueReportsPage />} />
                <Route path="admin/workspace-setup" element={<WorkspaceSetupPage />} />
                <Route path="admin/floor-plans" element={<FloorPlansPage />} />
                <Route path="admin/roster" element={<EmployeeRosterPage />} />
                <Route path="admin/workforce" element={<WorkforcePage />} />
                <Route path="admin/permissions" element={<PermissionsPage />} />
                <Route path="admin/branding" element={<BrandSettingsPage />} />
                <Route path="admin/audit" element={<AuditLogsPage />} />
                <Route path="branch/employees" element={<BranchEmployeeRosterPage />} />
                <Route path="branch/audit" element={<BranchAuditLogsPage />} />
                <Route path="employee/floor-plan" element={<EmployeeFloorPlanPage />} />
                <Route path="employee/calendar" element={<OutlookCalendarPage />} />
                <Route path="employee/my-bookings" element={<MyBookingsPage />} />
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
