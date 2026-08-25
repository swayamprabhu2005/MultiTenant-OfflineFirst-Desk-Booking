import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Building2, LogOut, Wifi, WifiOff, ChevronDown, UserCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { tenant, availableTenants, setTenantSubdomain } = useTenant();
  const isOnline = navigator.onLine;

  const pendingCount = useLiveQuery(
    () => db.outbox.where('status').equals('PENDING').count(),
    []
  );

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Organization / Tenant Branding */}
        <div className="flex items-center space-x-3">
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-9 h-9 object-contain rounded-lg border border-slate-200 p-0.5 bg-slate-50"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {tenant?.name?.charAt(0) || 'D'}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-base tracking-tight">
                {tenant?.name || 'Desk Booking SaaS'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {tenant?.code || 'TENANT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {tenant?.subdomain ? `${tenant.subdomain}.deskbooking.com` : 'subdomain'}
            </p>
          </div>
        </div>

        {/* Center/Right Actions */}
        <div className="flex items-center space-x-4">

          {/* Dev Tenant Switcher Dropdown */}
          <div className="relative group hidden sm:block">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer border border-slate-200 transition-all">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Switch Tenant</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>

            <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 hidden group-hover:block z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Simulated Subdomains
              </div>
              {availableTenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTenantSubdomain(t.subdomain)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-700 ${
                    t.subdomain === tenant?.subdomain ? 'font-bold text-emerald-600 bg-emerald-50/50' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <div>{t.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{t.subdomain}.deskbooking.com</div>
                  </div>
                  {t.subdomain === tenant?.subdomain && <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Online/Offline Status Indicator */}
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Offline ({pendingCount || 0})</span>
              </>
            )}
          </div>

          {/* User Profile info */}
          {user && (
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-end space-x-1">
                  <span>{user.name}</span>
                  {user.role !== 'EMPLOYEE' && (
                    <span title="Admin User">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {user.role.replace('_', ' ')} • {user.department || 'Staff'}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
