import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { Building2, Plus, ShieldCheck, Clock, Check } from 'lucide-react';

export const PlatformAdminDashboard: React.FC = () => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for creating a new Organization
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [themeColor, setThemeColor] = useState('#16a34a');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [orgs, logs] = await Promise.all([
        fetchApi<any[]>('/auth/organizations'),
        fetchApi<any[]>('/audit')
      ]);
      setOrganizations(orgs);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed to load platform admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      await fetchApi('/auth/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, code, subdomain, themeColor }),
      });
      setFormSuccess(`Organization "${name}" registered successfully.`);
      setName('');
      setCode('');
      setSubdomain('');
      setThemeColor('#16a34a');
      loadDashboardData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Loading Platform Administration Panel...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-emerald-500" />
            <span>Platform Administration Console</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Global SaaS Orchestrator: Monitor registered tenants, configure subdomains, and view registration audit logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Registered Organizations */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-black text-slate-800">Registered Organizations ({organizations.length})</h2>
            </div>
            
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {organizations.map(org => (
                <div key={org.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3.5 h-3.5 rounded-full border shadow-sm"
                      style={{ backgroundColor: org.themeColor || '#16a34a' }}
                    />
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                        <span>{org.name}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                          {org.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Subdomain: <strong className="text-slate-600">{org.subdomain}.deskbooking.com</strong>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right text-[11px] text-slate-400 font-medium">
                    Created: {new Date(org.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}

              {organizations.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No organizations registered yet.
                </div>
              )}
            </div>
          </div>

          {/* Create New Organization */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-850 flex items-center space-x-2">
                <Plus className="w-4.5 h-4.5 text-emerald-600" />
                <span>Register New Organization Tenant</span>
              </h3>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-250 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Organization Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="ACME"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subdomain Name</label>
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value)}
                  placeholder="acme"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dynamic Brand Color Hex</label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded border p-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    required
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    placeholder="#16a34a"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  {submitting ? 'Creating...' : 'Register Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel: Audit Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center space-x-2 border-b pb-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-black text-slate-800">Registration Audit Logs</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[480px] pr-1">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                  </span>
                  <span className="text-emerald-600 font-bold uppercase text-[8px] tracking-wider bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                    {log.action}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  Tenant "{log.metadata?.name || 'New Organization'}" registered under subdomain "{log.metadata?.subdomain || 'subdomain'}".
                </p>
                <div className="text-[9px] text-slate-400 font-semibold">
                  Triggered by: <span className="text-slate-500">{log.actorUser?.name || 'Platform Admin'}</span>
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-10 italic">
                No registration logs recorded yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
