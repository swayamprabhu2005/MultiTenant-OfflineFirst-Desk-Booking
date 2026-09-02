import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { LogOut, UserCheck, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();

  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';

  return (
    <header 
      className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm transition-colors duration-300"
      style={{
        borderTop: `4px solid ${orgColor}`
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Tenant Branding */}
        <div className="flex items-center space-x-3">
          {activeOrg?.logoUrl ? (
            <img
              src={activeOrg.logoUrl}
              alt={activeOrg.name}
              className="w-9 h-9 object-contain rounded-lg border border-slate-200 p-0.5 bg-slate-50 shadow-sm"
            />
          ) : (
            <div 
              className="w-9 h-9 rounded-lg text-white flex items-center justify-center font-bold text-lg shadow-sm transition-colors"
              style={{ backgroundColor: orgColor }}
            >
              {activeOrg?.name?.charAt(0) || 'D'}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-base tracking-tight">
                {activeOrg?.name || 'SaaS Management Portal'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeOrg?.code || 'TENANT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {activeOrg?.subdomain ? `${activeOrg.subdomain}.deskbooking.com` : 'subdomain'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">

          {/* Profile & Logout */}
          {user && (
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-end space-x-1">
                  <span>{user.name}</span>
                  <span title="Administrator">
                    {user.role === 'PLATFORM_ADMIN' ? (
                      <Shield className="w-3.5 h-3.5 text-purple-600 inline" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                    )}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {user.role.replace('_', ' ')}
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
