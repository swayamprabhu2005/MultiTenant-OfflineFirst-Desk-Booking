import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { ShieldAlert, KeyRound, Check } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const ChangePasswordPage: React.FC = () => {
  const { refreshUser, logout } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await fetchApi('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: password }),
      });
      setSuccess(true);
      
      // Update session state
      await refreshUser();

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Make sure you are online.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-250">
            <KeyRound className="w-6 h-6 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-slate-800">Forced Password Reset</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            This account was generated via employee roster CSV imports. You must set a personalized password to protect your account.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-650 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-800 text-center text-xs font-bold space-y-2 animate-bounce">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <p>Password changed! Redirecting to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex space-x-3">
              <button
                type="button"
                onClick={logout}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Sign Out
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {loading ? 'Updating...' : 'Set Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
