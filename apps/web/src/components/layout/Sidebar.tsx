import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  LayoutDashboard,
  FileSpreadsheet,
  MapPin,
  Users,
  Contact,
  Palette,
  ShieldCheck,
  Calendar,
  Menu,
  ChevronLeft,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { SystemDiagnosticsModal } from '../system/SystemDiagnosticsModal';
import { NetworkStatusIndicator } from '../NetworkStatusIndicator';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openIssuesCount, setOpenIssuesCount] = useState<number | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchApi<{ open: number }>('/issues/stats')
        .then(data => setOpenIssuesCount(data.open))
        .catch(() => {});
    }
  }, [isPlatformAdmin]);

  const navItems = isPlatformAdmin
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Issue Reports', to: '/admin/issues', icon: ShieldAlert, badge: openIssuesCount },
      ]
    : isEmployee
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Reserve Workstation', to: '/employee/floor-plan', icon: MapPin },
        { name: 'My Bookings', to: '/employee/my-bookings', icon: Calendar },
      ]
    : isBranchAdmin
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Floor Plans', to: '/admin/floor-plans', icon: MapPin },
        { name: 'Employee Directory', to: '/branch/employees', icon: Users },
        { name: 'Audit Logs', to: '/branch/audit', icon: ShieldCheck },
      ]
    : [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Workspace Setup', to: '/admin/workspace-setup', icon: FileSpreadsheet },
        { name: 'Floor Plans', to: '/admin/floor-plans', icon: MapPin },
        { name: 'Branch Admins', to: '/admin/roster', icon: Users },
        { name: 'Workforce', to: '/admin/workforce', icon: Contact },
        { name: 'Brand Settings', to: '/admin/branding', icon: Palette },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ];

  const headerTitle = isPlatformAdmin
    ? 'Platform Console'
    : isEmployee
    ? 'Workplace Portal'
    : isBranchAdmin
    ? 'Branch Console'
    : 'Organization Portal';

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16 flex-shrink-0 flex flex-col justify-between p-3 transition-all duration-300 ease-in-out overflow-y-auto`}
    >
      <div className="space-y-4">
        {/* Header with Hamburger Collapse Button */}
        <div className="flex items-center justify-between px-2 py-1">
          {!isCollapsed && (
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">
              {headerTitle}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors mx-auto cursor-pointer"
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={isCollapsed ? item.name : undefined}
                style={({ isActive }) =>
                  isActive && !isPlatformAdmin
                    ? {
                        backgroundColor: `${orgColor}15`,
                        color: orgColor,
                        borderColor: `${orgColor}30`,
                      }
                    : undefined
                }
                className={({ isActive }) =>
                  `relative flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-3 py-2.5'
                  } rounded-xl text-sm font-semibold transition-all border ${
                    isActive
                      ? isPlatformAdmin
                        ? 'bg-purple-50 text-purple-700 shadow-xs border-purple-200'
                        : 'shadow-xs'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">{item.name}</span>
                    {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {isCollapsed && item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Container: Network Status Indicator and Control Plane */}
      <div className="mt-auto pt-4 space-y-2">
        <div className="px-1">
          <NetworkStatusIndicator inSidebar isCollapsed={isCollapsed} />
        </div>

        {/* Bottom Control Plane Indicator */}
        {!isCollapsed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 space-y-2">
            <div className="font-bold text-slate-700 flex items-center justify-between">
              <span>Control Plane</span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-700 font-bold">ONLINE</span>
              </span>
            </div>
            <p className="text-[11px] leading-tight text-slate-400">
              Multi-tenant isolation &amp; dynamic white-label tokens.
            </p>
            <button
              type="button"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 rounded-lg text-slate-700 text-[11px] font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs group"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
              <span>System Diagnostics</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="flex justify-center p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer mx-auto" 
            title="System Diagnostics & Versions"
          >
            <Cpu className="w-5 h-5 text-indigo-600" />
          </button>
        )}
      </div>

      {/* In-App System Diagnostics Modal */}
      <SystemDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </aside>
  );
};
