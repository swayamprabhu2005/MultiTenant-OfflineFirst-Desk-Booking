import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlatformAdminDashboard } from '../../components/dashboard/PlatformAdminDashboard';
import { OrganizationAdminDashboard } from '../../components/dashboard/OrganizationAdminDashboard';
import { BranchAdminDashboard } from '../../components/dashboard/BranchAdminDashboard';
import { EmployeeDashboard } from '../../components/dashboard/EmployeeDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Initializing workspace session...
      </div>
    );
  }

  // Switch between separate dashboards based on roles
  if (user.role === 'PLATFORM_ADMIN') {
    return <PlatformAdminDashboard />;
  }

  if (user.role === 'ORGANIZATION_ADMIN') {
    if (!user.scopedBranchId) {
      return <OrganizationAdminDashboard />;
    } else {
      return <BranchAdminDashboard />;
    }
  }

  return <EmployeeDashboard />;
};
