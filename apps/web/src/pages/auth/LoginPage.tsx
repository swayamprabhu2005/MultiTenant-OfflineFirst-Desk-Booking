import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Lock, Mail, Building, ArrowRight, Shield, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { tenant, availableTenants, setTenantSubdomain } = useTenant();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@deskbooking.com');
  const [password, setPassword] = useState('Password123!');
  const [orgCode, setOrgCode] = useState(tenant?.code || 'SYSTEM');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password, orgCode);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials or tenant code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string, demoOrgCode: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setOrgCode(demoOrgCode);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Emerald Accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-2xl shadow-lg shadow-emerald-600/20 mb-3 border border-emerald-500/20">
            {tenant?.name?.charAt(0) || 'D'}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {tenant?.name || 'Desk & Cubicle SaaS'}
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Enterprise Multi-Tenant Offline-First Workplace Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tenant / Organization Subdomain Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Organization Subdomain / Tenant Code
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <select
                  value={tenant?.subdomain || 'system'}
                  onChange={e => {
                    setTenantSubdomain(e.target.value);
                    const selected = availableTenants.find(t => t.subdomain === e.target.value);
                    if (selected) setOrgCode(selected.code);
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  {availableTenants.length === 0 ? (
                    <option value="system">Platform Administration (system.deskbooking.com)</option>
                  ) : (
                    availableTenants.map(t => (
                      <option key={t.id} value={t.subdomain}>
                        {t.name} ({t.subdomain}.deskbooking.com)
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@deskbooking.com"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins Bar */}
          {availableTenants.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 mb-3">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Demo Accounts (Autofill)</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => handleDemoLogin('admin@deskbooking.com', 'SYSTEM')}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-600 border border-slate-200 transition-colors"
                >
                  <div className="font-bold text-purple-600">Platform Admin</div>
                  <div className="text-[10px] text-slate-400 truncate">admin@deskbooking.com</div>
                </button>
              </div>
            </div>
          )}

          {/* Switch to signup */}
          <div className="mt-5 text-center text-xs text-slate-500">
            Need to register a new organization?{' '}
            <Link to="/signup" className="font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
              Sign Up Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
