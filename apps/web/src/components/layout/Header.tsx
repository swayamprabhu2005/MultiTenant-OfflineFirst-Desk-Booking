import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { LogOut, UserCheck, Shield } from 'lucide-react';

// Helper to calculate relative brightness / luminance from hex
function isColorDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 145;
}

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();

  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';
  const isDark = isColorDark(orgColor);

  return (
    <header 
      className="sticky top-0 z-30 shadow-md transition-all duration-300"
      style={{ backgroundColor: orgColor }}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Tenant Branding */}
        <div className="flex items-center space-x-3">
          {activeOrg?.logoUrl ? (
            <img
              src={activeOrg.logoUrl}
              alt={activeOrg.name}
              className={`w-9 h-9 object-contain rounded-lg p-0.5 shadow-sm ${
                isDark ? 'bg-white border border-white/20' : 'bg-white border border-slate-200'
              }`}
            />
          ) : (
            <div 
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg shadow-sm border ${
                isDark
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-black/15 text-slate-950 border-black/20'
              }`}
            >
              {activeOrg?.name?.charAt(0) || 'D'}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className={`font-black text-base tracking-tight ${
                isDark ? 'text-white' : 'text-slate-950'
              }`}>
                {activeOrg?.name || 'SaaS Management Portal'}
              </span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isDark
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-black/10 text-slate-900 border-black/20'
              }`}>
                {activeOrg?.code || 'TENANT'}
              </span>
            </div>
            <p className={`text-xs font-mono font-medium ${
              isDark ? 'text-white/80' : 'text-slate-700'
            }`}>
              {activeOrg?.subdomain ? `${activeOrg.subdomain}.deskbooking.com` : 'subdomain'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">

          {/* Profile & Logout */}
          {user && (
            <div className={`flex items-center space-x-3 border-l pl-4 ${
              isDark ? 'border-white/20' : 'border-black/15'
            }`}>
              <div className="text-right hidden md:block">
                <div className={`text-xs font-black flex items-center justify-end space-x-1 ${
                  isDark ? 'text-white' : 'text-slate-950'
                }`}>
                  <span>{user.name}</span>
                  <span title="Administrator">
                    {user.role === 'PLATFORM_ADMIN' ? (
                      <Shield className={`w-3.5 h-3.5 inline ${isDark ? 'text-purple-200' : 'text-purple-800'}`} />
                    ) : (
                      <UserCheck className={`w-3.5 h-3.5 inline ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`} />
                    )}
                  </span>
                </div>
                <div className={`text-[10px] font-bold ${
                  isDark ? 'text-white/75' : 'text-slate-700'
                }`}>
                  {user.role.replace('_', ' ')}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'text-white/80 hover:text-white hover:bg-white/20'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-black/10'
                }`}
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
