import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ArrowRight, Shield, Zap, Eye, EyeOff, Sparkles } from 'lucide-react';
export const LoginPage: React.FC = () => {
  const { isAuthenticated, login, loginWithToken, loginWithSsoSandbox } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxEmail, setSandboxEmail] = useState('');

  // If already authenticated, redirect to dashboard immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle SSO redirect callbacks (?sso_token=... or ?error=...)
  useEffect(() => {
    const ssoToken = searchParams.get('sso_token');
    const ssoError = searchParams.get('error');

    if (ssoError) {
      setError(decodeURIComponent(ssoError));
      setSearchParams({}, { replace: true });
    } else if (ssoToken) {
      setSsoLoading(true);
      loginWithToken(ssoToken)
        .then(() => {
          navigate('/', { replace: true });
        })
        .catch((err: any) => {
          setError(err.message || 'SSO Authentication failed to initialize session.');
          setSearchParams({}, { replace: true });
          setSsoLoading(false);
        });
    }
  }, [searchParams, navigate, loginWithToken]);

  const handleMicrosoftLogin = () => {
    setError(null);
    setSsoLoading(true);
    // Direct browser redirect to Microsoft Entra OIDC endpoint via API proxy
    window.location.href = '/api/auth/sso/microsoft';
  };

  const handleSandboxLogin = async (targetEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSsoSandbox(targetEmail);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'SSO Sandbox login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('DeskBook$2026#SecureOps!X9');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Emerald Accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-2xl shadow-lg shadow-emerald-600/20 mb-3 border border-emerald-500/20">
              M
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Multi-Tenant SaaS
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Platform &amp; Organization Administration Console
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Microsoft Entra ID (SSO) Primary Button */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={ssoLoading || loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-sm flex items-center justify-center space-x-3 transition-all hover:border-slate-400 disabled:opacity-60"
            >
              {/* Microsoft 4-Square Logo */}
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span>{ssoLoading ? 'Connecting to Microsoft...' : 'Sign in with Microsoft (Entra SSO)'}</span>
            </button>
          </div>

          {/* Clean Divider between SSO and Traditional Password Login */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-white px-3 text-slate-400">Or sign in with password</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@deskbooking.com"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || ssoLoading}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo & SSO Sandbox Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-3">
              <div className="flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Demo Accounts</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSandbox(!showSandbox)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{showSandbox ? 'Hide Sandbox' : 'SSO Sandbox'}</span>
              </button>
            </div>

            {showSandbox ? (
              <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl mb-3 space-y-2">
                <div className="text-[10px] font-semibold text-blue-800">
                  Simulate Microsoft SSO for any registered email:
                </div>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={sandboxEmail}
                    onChange={e => setSandboxEmail(e.target.value)}
                    placeholder="e.g. employee@company.com"
                    className="flex-1 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSandboxLogin(sandboxEmail || 'admin@deskbooking.com')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg transition-colors"
                  >
                    Simulate SSO
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => handleDemoLogin('admin@deskbooking.com')}
              className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-600 border border-slate-200 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-purple-600">Platform Administrator</div>
                <div className="text-[10px] text-slate-400">admin@deskbooking.com</div>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md font-semibold">Autofill</span>
            </button>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">
            Need to register a new tenant organization?{' '}
            <Link to="/signup" className="font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
              Sign Up Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
