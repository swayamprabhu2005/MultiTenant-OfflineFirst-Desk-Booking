import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Globe, Plus, Palette, ShieldCheck, Clock } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const OrganizationsPage: React.FC = () => {
  const { user } = useAuth();
  const { applyThemeColor } = useTenant();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Org Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [themeColor, setThemeColor] = useState('#16a34a');
  const [logoUrl, setLogoUrl] = useState('');

  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      const [orgs, logs] = await Promise.all([
        fetchApi<any[]>('/organizations'),
        fetchApi<any>('/audit?limit=50').catch(() => ({ logs: [] }))
      ]);
      setOrganizations(orgs);
      setAuditLogs(logs.logs || []);
    } catch (err) {
      console.error('Failed to load platform data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code,
          subdomain,
          themeColor,
          logoUrl,
        }),
      });

      setShowCreateModal(false);
      setName('');
      setCode('');
      setSubdomain('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create organization');
    }
  };

  const handleUpdateBranding = async (orgId: string, color: string, logo: string) => {
    try {
      await fetchApi(`/organizations/${orgId}/branding`, {
        method: 'PATCH',
        body: JSON.stringify({ themeColor: color, logoUrl: logo }),
      });

      applyThemeColor(color);
      alert('White-label brand theme tokens updated successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update white-label branding');
    }
  };

  const registrationLogs = auditLogs.filter(log => log.action === 'CREATE_ORGANIZATION');

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-0">

      {/* Top Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center space-x-2">
            <Globe className="w-6 h-6 text-emerald-400" />
            <span>Platform Administration Console</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Global SaaS Orchestrator: Monitor registered tenants, configure subdomains, and view registration audit logs.
          </p>
        </div>

        {isPlatformAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Tenant</span>
          </button>
        )}
      </div>

      {/* Two Column Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Columns: Registered Organizations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Registered Organizations ({organizations.length})
            </h2>
          </div>

          <div className="space-y-4">
            {organizations.map(org => (
              <div key={org.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5 bg-slate-50"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg text-white shadow-sm"
                        style={{ backgroundColor: org.themeColor || '#16a34a' }}
                      >
                        {org.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{org.name}</h3>
                      <div className="text-xs text-slate-400 font-mono">
                        Subdomain: <span className="font-semibold text-slate-700">{org.subdomain}.deskbooking.com</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {org.code}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-end space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        Created: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic White Label branding controls */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-500">Theme Color Token:</span>
                    <span className="w-4 h-4 rounded-full border shadow-sm inline-block" style={{ backgroundColor: org.themeColor || '#16a34a' }} />
                    <span className="font-mono text-[11px] text-slate-700 font-bold">{org.themeColor || '#16a34a'}</span>
                  </div>

                  <button
                    onClick={() => {
                      const color = prompt('Enter new Hex Theme Color:', org.themeColor || '#16a34a');
                      if (color) handleUpdateBranding(org.id, color, org.logoUrl || '');
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 flex items-center space-x-1"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>Edit Brand Token</span>
                  </button>
                </div>
              </div>
            ))}

            {organizations.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 italic">
                No organizations registered yet.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Registration Audit Logs Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Registration Audit Logs</span>
            </h2>
            <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-600">
              {registrationLogs.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {registrationLogs.map(log => (
              <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-700 text-[11px]">
                    {log.metadata?.orgName || log.entityId}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-[10px] text-slate-600 font-mono">
                  Subdomain: <span className="font-bold">{log.metadata?.subdomain}.deskbooking.com</span>
                </div>

                {log.metadata?.adminEmail && (
                  <div className="text-[10px] text-slate-400">
                    Registrant: <span className="font-medium text-slate-700">{log.metadata.adminEmail}</span>
                  </div>
                )}

                <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-200/60">
                  {new Date(log.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}

            {registrationLogs.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No registration logs recorded yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Register New Tenant Organization</h3>

            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Acme Global Inc"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="ACME"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subdomain Slug</label>
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={e => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="acme"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
