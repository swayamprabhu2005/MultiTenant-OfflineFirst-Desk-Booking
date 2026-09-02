import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Palette,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  const navItems = isPlatformAdmin
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
      ]
    : [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Create Branch', to: '/admin/branches', icon: Building2 },
        { name: 'Employee Roster', to: '/admin/roster', icon: Users },
        { name: 'Brand Settings', to: '/admin/branding', icon: Palette },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16 flex-shrink-0 flex flex-col justify-between p-4 overflow-y-auto">
      <div className="space-y-6">

        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            {isPlatformAdmin ? 'Platform Admin Console' : 'Organization Portal'}
          </div>
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
        <div className="font-bold text-slate-700 flex items-center justify-between mb-1">
          <span>Control Plane</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-[11px] leading-tight text-slate-400">
          Multi-tenant isolation &amp; dynamic white-label tokens.
        </p>
      </div>
    </aside>
  );
};
