import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { 
  Building2, ShieldCheck, Clock, Trash2, AlertTriangle, 
  CheckCircle2, X, Search, Users, AlertCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const PlatformAdminDashboard: React.FC = () => {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Deletion modal state
  const [orgToDelete, setOrgToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [orgs, logs] = await Promise.all([
        fetchApi<any[]>('/organizations'),
        fetchApi<any[]>('/audit')
      ]);
      setOrganizations(Array.isArray(orgs) ? orgs : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      console.error('Failed to load platform admin dashboard data:', err);
      setErrorMsg('Failed to load organizations or audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;

    try {
      setIsDeleting(true);
      setStatusMsg(null);
      setErrorMsg(null);

      const res = await fetchApi<{ success: boolean; message: string }>(`/organizations/${orgToDelete.id}`, {
        method: 'DELETE',
      });

      setStatusMsg(res.message || `Organization "${orgToDelete.name}" was permanently deleted.`);
      setOrgToDelete(null);
      await loadDashboardData();
    } catch (err: any) {
      console.error('Failed to delete organization:', err);
      setErrorMsg(err.message || 'Failed to delete organization.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Loading Platform Administration Panel...
      </div>
    );
  }

  // Filter out the core system platform admin organization
  const tenantOrgs = organizations.filter(org => org.subdomain !== 'system' && org.code !== 'SYSTEM');

  const filteredOrgs = tenantOrgs.filter(org => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      org.name?.toLowerCase().includes(q) ||
      org.code?.toLowerCase().includes(q) ||
      org.subdomain?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span>Platform Administration Console</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Global SaaS Orchestrator: Monitor registered tenants, configure subdomains, manage organization lifecycles, and view audit trails.
          </p>
        </div>
        <Link
          to="/admin/organizations"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Building2 className="w-4 h-4" />
          <span>Manage Organizations</span>
        </Link>
      </div>

      {/* Status & Error Notification Banners */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between shadow-sm">
          <span className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Panels: Registered Organizations with Delete Action */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-800">
                  Tenant Organizations ({tenantOrgs.length})
                </h2>
                <p className="text-[11px] text-slate-400">
                  Organizations created by organization administrators through registration
                </p>
              </div>
              
              {/* Search Filter */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {filteredOrgs.map(org => (
                <div key={org.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center space-x-3.5">
                    <div 
                      className="w-10 h-10 rounded-xl border shadow-sm flex items-center justify-center font-black text-white text-base flex-shrink-0"
                      style={{ backgroundColor: org.themeColor || '#16a34a' }}
                    >
                      {org.name?.charAt(0) || 'O'}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                        <span>{org.name}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                          {org.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Subdomain: <strong className="text-slate-700 font-mono">{org.subdomain}.deskbooking.com</strong>
                        </span>
                        {org._count?.users !== undefined && (
                          <span className="flex items-center space-x-1 text-slate-400">
                            <Users className="w-3 h-3" />
                            <span>{org._count.users} user{org._count.users === 1 ? '' : 's'}</span>
                          </span>
                        )}
                        <span className="text-slate-400">
                          Created: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Delete Button */}
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => setOrgToDelete(org)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-sm transition-all flex items-center space-x-1.5"
                      title={`Delete ${org.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {filteredOrgs.length === 0 && (
                <div className="p-10 text-center text-slate-400 italic text-xs">
                  {searchQuery ? 'No organizations match your search query.' : 'No tenant organizations registered yet.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Registration Audit Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center space-x-2 border-b pb-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-black text-slate-800">Registration &amp; Lifecycle Audit</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[480px] pr-1">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                  </span>
                  <span className={`font-bold uppercase text-[8px] tracking-wider px-1.5 py-0.5 rounded-full ${
                    log.action === 'DELETE_ORGANIZATION'
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {log.action}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {log.action === 'DELETE_ORGANIZATION'
                    ? `Organization "${log.metadata?.name || 'Unknown'}" (${log.metadata?.subdomain || ''}) was deleted.`
                    : `Tenant "${log.metadata?.name || log.metadata?.orgName || 'Organization'}" registered under subdomain "${log.metadata?.subdomain || 'subdomain'}".`
                  }
                </p>
                <div className="text-[9px] text-slate-400 font-semibold">
                  Triggered by: <span className="text-slate-500">{log.actorUser?.name || 'Platform Admin'}</span>
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-10 italic">
                No audit logs recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: DELETE ORGANIZATION */}
      {orgToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Organization</h3>
                <p className="text-xs text-rose-600 font-medium">Permanent Destruction Warning</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                Are you sure you want to permanently delete <strong className="text-slate-900 font-bold">{orgToDelete.name}</strong> (Code: <code className="bg-slate-200 px-1 py-0.5 rounded">{orgToDelete.code}</code>, Subdomain: <code className="bg-slate-200 px-1 py-0.5 rounded">{orgToDelete.subdomain}</code>)?
              </p>
              <p className="text-rose-700 font-semibold leading-relaxed">
                This will permanently destroy all physical office branches, building floors, sections, cubicle desks, meeting rooms, employee rosters, and booking histories associated with this tenant organization.
              </p>
              <p className="text-slate-400 text-[11px] italic">
                This action is irreversible.
              </p>
            </div>

            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setOrgToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteOrg}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Organization'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
