import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export const OrganizationAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const activeOrg = user?.organization || tenant;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-xl">
        <span className="px-3 py-1 bg-white/20 text-emerald-100 rounded-full text-xs font-bold border border-white/10 inline-block mb-3">
          Global Organization Panel • {activeOrg?.name || tenant?.name}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-emerald-100 text-xs mt-1.5 max-w-2xl leading-relaxed">
          Manage your organization structure, workplace configuration, dynamic white-label branding, and security audit logs.
        </p>
      </div>

      {/* Clean Dashboard Placeholder */}
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
          🏢
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
            Workspace Configuration Center
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Legacy manual branch creation has been retired. Your organization workspace and floor plans will be configured through the unified Excel-driven ingestion pipeline.
          </p>
        </div>
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/admin/workspace-setup"
            className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition-all inline-flex items-center gap-2"
          >
            <span>Launch Workspace Setup</span>
            <span>➔</span>
          </Link>
          <Link
            to="/admin/floor-plans"
            className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm transition-all inline-flex items-center gap-2"
          >
            <span>View Floor Plans</span>
            <span>➔</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
