import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'ORGANIZATION_ADMIN'
  | 'BRANCH_ADMIN'
  | 'TECH_LEAD'
  | 'EMPLOYEE';

export const getHomeRouteForRole = (role?: string | null): string => {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return '/platform/dashboard';
    case 'BRANCH_ADMIN':
      return '/branch/dashboard';
    case 'ORGANIZATION_ADMIN':
      return '/org/dashboard';
    case 'EMPLOYEE':
    case 'TECH_LEAD':
      return '/employee/dashboard';
    default:
      return '/login';
  }
};

interface RoleGuardProps {
  allowedRoles: (UserRole | string)[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs font-semibold">
        Validating administrative credentials...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess) {
    const fallbackHome = getHomeRouteForRole(user.role);
    return <Navigate to={fallbackHome} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
