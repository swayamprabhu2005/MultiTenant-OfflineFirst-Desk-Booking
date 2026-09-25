import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import { Lock, ShieldAlert, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';

function isColorDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 145;
}

export const ForcePasswordChangePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a'; // Matches dynamic brand or fallback
  const isDark = isColorDark(orgColor);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long for corporate compliance.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);
    try {
      await fetchApi('/auth/force-password-change', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      setSuccess('Your permanent password has been activated! Unlocking your workspace console...');
      await refreshUser();
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: `radial-gradient(circle at 15% 20%, ${orgColor}30 0%, transparent 45%), radial-gradient(circle at 85% 80%, ${orgColor}25 0%, transparent 45%), linear-gradient(135deg, ${orgColor}12 0%, #f1f5f9 100%)`,
      }}
    >
      {/* Dynamic Ambient Background Glows */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ backgroundColor: orgColor }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ backgroundColor: orgColor }}
      />

      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/90 p-8 shadow-2xl space-y-6 relative z-10 animate-fade-in">
        
        {/* Organization Brand Header */}
        <div className="text-center space-y-2.5">
          {activeOrg?.logoUrl ? (
            <img
              src={activeOrg.logoUrl}
              alt={activeOrg.name}
              className="h-12 max-w-[180px] object-contain mx-auto mb-1"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md mx-auto mb-1 font-black text-xl text-white"
              style={{ backgroundColor: orgColor }}
            >
              {activeOrg?.name ? activeOrg.name.charAt(0).toUpperCase() : 'M'}
            </div>
          )}

          <div
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border"
            style={{
              backgroundColor: `${orgColor}15`,
              color: orgColor,
              borderColor: `${orgColor}35`,
            }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Mandatory First-Time Password Setup</span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Protect Your Account
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Welcome, <span className="font-bold text-slate-700">{user?.name || 'Administrator'}</span> ({user?.email}). 
            As part of {activeOrg?.name || 'organization'} security protocols, please choose a permanent, confidential password to replace your initial temporary credentials.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2.5 animate-shake">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Permanent Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all"
                style={{
                  // @ts-ignore
                  '--tw-ring-color': orgColor,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Confirm Permanent Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all"
              style={{
                // @ts-ignore
                '--tw-ring-color': orgColor,
              }}
            />
          </div>

          {/* Password Policy Guidelines */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700">Password Policy Requirements:</div>
            <div
              className={`flex items-center space-x-1.5 ${
                newPassword.length >= 8 ? 'font-bold' : ''
              }`}
              style={{ color: newPassword.length >= 8 ? orgColor : undefined }}
            >
              <span>• Minimum 8 characters</span>
            </div>
            <div
              className={`flex items-center space-x-1.5 ${
                newPassword && confirmPassword && newPassword === confirmPassword
                  ? 'font-bold'
                  : ''
              }`}
              style={{
                color:
                  newPassword && confirmPassword && newPassword === confirmPassword
                    ? orgColor
                    : undefined,
              }}
            >
              <span>• Passwords match</span>
            </div>
          </div>

          {/* Submit button with dynamic org theme color */}
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: orgColor,
              color: isDark ? '#ffffff' : '#0f172a',
            }}
            className="w-full py-3.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 shadow-md hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'Activating Credentials...' : 'Save and Unlock Account'}</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-slate-400">Need to switch accounts?</span>
          <button
            type="button"
            onClick={logout}
            className="text-slate-600 hover:text-red-600 font-bold cursor-pointer"
          >
            Log Out
          </button>
        </div>

      </div>
    </div>
  );
};
