import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  LayoutDashboard,
  FileSpreadsheet,
  MapPin,
  Users,
  Palette,
  ShieldCheck,
  Menu,
  ChevronLeft,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';
  const isBranchAdmin = user?.role === 'BRANCH_ADMIN';
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = isPlatformAdmin
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
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
        { name: 'Employee Roster', to: '/admin/roster', icon: Users },
        { name: 'Brand Settings', to: '/admin/branding', icon: Palette },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ];

  const headerTitle = isPlatformAdmin
    ? 'Platform Console'
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
                  `flex items-center ${
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
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Control Plane Indicator */}
      {!isCollapsed ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
          <div className="font-bold text-slate-700 flex items-center justify-between mb-1">
            <span>Control Plane</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-[11px] leading-tight text-slate-400">
            Multi-tenant isolation &amp; dynamic white-label tokens.
          </p>
        </div>
      ) : (
        <div className="flex justify-center p-2" title="System Active">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      )}
    </aside>
  );
};
