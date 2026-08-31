import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarCheck,
  RefreshCw,
  Building,
  Building2,
  Users,
  ShieldCheck,
  Globe,
  Palette,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isGlobalOrgAdmin = user?.role === 'ORGANIZATION_ADMIN' && !user.scopedBranchId;
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';
  const isAdmin = isPlatformAdmin || user?.role === 'ORGANIZATION_ADMIN';

  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.where('status').equals('PENDING').count(),
    []
  );

  const employeeNav = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Book a Space', to: '/book', icon: CalendarPlus },
    { name: 'My Bookings', to: '/my-bookings', icon: CalendarCheck },
    {
      name: 'Sync Center',
      to: '/sync-center',
      icon: RefreshCw,
      badge: pendingOutboxCount && pendingOutboxCount > 0 ? pendingOutboxCount : null,
    },
  ];

  const adminNav = isPlatformAdmin
    ? [
        { name: 'Organizations', to: '/admin/organizations', icon: Globe },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ]
    : isGlobalOrgAdmin
    ? [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Create Branch', to: '/admin/branches', icon: Building2 },
        { name: 'Employee Roster', to: '/admin/roster', icon: Users },
        { name: 'Brand Settings', to: '/admin/branding', icon: Palette },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ]
    : [
        { name: 'Buildings & Spaces', to: '/admin/buildings', icon: Building },
        { name: 'Employee Roster', to: '/admin/roster', icon: Users },
        { name: 'Audit Logs', to: '/admin/audit', icon: ShieldCheck },
      ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16 flex-shrink-0 flex flex-col justify-between p-4 overflow-y-auto">
      <div className="space-y-6">

        {/* Employee Section */}
        {!isGlobalOrgAdmin && !isPlatformAdmin && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Employee Workspace
            </div>
            <nav className="space-y-1">
              {employeeNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}

        {/* Admin Portal Section */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Admin Portal
            </div>
            <nav className="space-y-1">
              {adminNav.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
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
        )}

      </div>

      {/* Offline PWA Badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
        <div className="font-bold text-slate-700 flex items-center justify-between mb-1">
          <span>PWA Engine</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-[11px] leading-tight text-slate-400">
          IndexedDB enabled. Sync conflicts use "First to sync wins".
        </p>
      </div>
    </aside>
  );
};
