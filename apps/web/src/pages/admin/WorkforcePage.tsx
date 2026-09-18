import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import {
  Users,
  Search,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Globe,
  Key,
  Building,
} from 'lucide-react';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface WorkforceEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  baseBranchId?: string | null;
  baseBranch?: { id: string; name: string; code: string } | null;
  scopedBranchId?: string | null;
  scopedBranch?: { id: string; name: string; code: string } | null;
  status: string;
  createdAt: string;
}

export const WorkforcePage: React.FC = () => {
  const { tenant } = useTenant();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Corporate Domain & Default Temporary Password configuration
  const defaultDomain = tenant?.subdomain ? `${tenant.subdomain}.com` : 'acme.com';
  const defaultFallbackPassword = tenant?.name ? `${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '')}2026!` : 'Welcome2026!';
  const [domain, setDomain] = useState(defaultDomain);
  const [defaultPassword, setDefaultPassword] = useState(defaultFallbackPassword);
  const [savingConfig, setSavingConfig] = useState(false);

  // Load organization-wide roster configuration
  const loadConfig = async () => {
    try {
      const config = await fetchApi<{ domain?: string; defaultPassword?: string }>('/roster/config');
      if (config?.domain) setDomain(config.domain);
      if (config?.defaultPassword) setDefaultPassword(config.defaultPassword);
    } catch {
      // fallback to computed defaults
    }
  };

  // Save organization-wide roster configuration
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      setErrorMsg(null);
      await fetchApi('/roster/config', {
        method: 'POST',
        body: JSON.stringify({
          domain: domain.trim() || defaultDomain,
          defaultPassword: defaultPassword.trim() || defaultFallbackPassword,
        }),
      });
      setStatusMsg('Corporate domain and default temporary password saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save workforce roster configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Load available branches for filter dropdown
  const loadBranches = async () => {
    try {
      const data = await fetchApi<any[]>('/roster/branch-admins');
      if (Array.isArray(data)) {
        const branchList: BranchOption[] = data.map((b) => ({
          id: b.branchId,
          name: b.branchName,
          code: b.branchCode || 'BR',
        }));
        setBranches(branchList);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  // Load workforce employees with filtering & pagination
  const loadWorkforce = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('role', 'EMPLOYEE');
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      if (selectedBranchFilter && selectedBranchFilter !== 'ALL') {
        params.set('branchId', selectedBranchFilter);
      }

      const res = await fetchApi<{
        users: WorkforceEmployee[];
        pagination: { total: number; page: number; totalPages: number };
      }>(`/roster?${params.toString()}`);

      setEmployees(res?.users || []);
      setTotalEmployees(res?.pagination?.total || 0);
      setTotalPages(res?.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load workforce:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await Promise.all([loadBranches(), loadConfig()]);
      setInitialLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    loadWorkforce();
  }, [page, selectedBranchFilter, searchQuery]);

  // 1. Download Multi-Branch Excel Template
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setStatusMsg(null);
      setErrorMsg(null);

      const token = localStorage.getItem('token');
      const targetDomain = encodeURIComponent(domain.trim() || defaultDomain);
      const targetPassword = encodeURIComponent(defaultPassword.trim() || defaultFallbackPassword);
      const res = await fetch(`/api/roster/multi-branch-template?domain=${targetDomain}&defaultPassword=${targetPassword}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download multi-branch employee template.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const orgSlug = tenant?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Enterprise';
      a.download = `Multi_Branch_Employee_Roster_${orgSlug}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatusMsg('Multi-branch employee template downloaded. Fill in the branch sheets and upload below.');
    } catch (err: any) {
      console.error('Download template error:', err);
      setErrorMsg(err.message || 'Failed to download template.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 2. Upload Multi-Branch Excel Roster
  const handleUploadRoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingRoster(true);
      setStatusMsg(null);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/roster/multi-branch-import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import multi-branch roster.');
      }

      setStatusMsg(
        data.message ||
          `Successfully processed ${data.totalProcessed} employees across registered branches.`
      );
      setPage(1);
      await loadWorkforce();
    } catch (err: any) {
      console.error('Upload roster error:', err);
      setErrorMsg(err.message || 'An error occurred during multi-branch roster ingestion.');
    } finally {
      setUploadingRoster(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-2 animate-fade-in">
      {/* Top Header */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>Enterprise Workforce Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage company staff across all branches, download dynamic formula rosters, and bulk ingest personnel.
          </p>
        </div>

        <div className="flex items-center space-x-3 sm:ml-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Total Staff:</span>
            <span className="font-mono font-black">{totalEmployees}</span>
          </div>
        </div>
      </div>

      {/* Notification Banners */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PREREQUISITE GATEKEEPER: If 0 branches exist in DB */}
      {!initialLoading && branches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-4 my-8 animate-fade-in">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-100">
            <Building className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Workspace Configuration Required</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Please configure your workspace layout first. Once physical branches are defined through the Excel ingestion pipeline, you will be able to manage and bulk-ingest your enterprise workforce.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/workspace-setup"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Launch Workspace Setup</span>
              <span className="text-sm font-black">➔</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Ingestion Hub Card */
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Multi-Branch Ingestion Hub
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900">
              Bulk Multi-Sheet Workforce Ingestion
            </h2>
            <p className="text-xs text-slate-500">
              Generate an Excel workbook with dedicated sheets for each branch, pre-filled with automated email and password formulas.
            </p>
          </div>

          <div className="flex flex-row items-center gap-3 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadRoster}
              accept=".xlsx"
              className="hidden"
            />

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate || uploadingRoster}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {downloadingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{downloadingTemplate ? 'Generating Template...' : 'Download Multi-Branch Template'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingRoster || downloadingTemplate}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {uploadingRoster ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{uploadingRoster ? 'Ingesting Roster...' : 'Upload Completed Roster'}</span>
            </button>
          </div>
        </div>

        {/* Corporate Domain & Default Password Configuration Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
          {/* Corporate Domain Input */}
          <div className="lg:col-span-6 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Corporate Email Domain
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder={defaultDomain}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Injected into Excel formulas across all branch sheets so typing "Mohit Kumar" auto-generates "mohit.kumar@{domain || defaultDomain}".
            </p>
          </div>

          {/* Default Temporary Password */}
          <div className="lg:col-span-6 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700">
              Default Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder={defaultFallbackPassword}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="py-2 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center space-x-1"
                title="Save Configuration"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Configure</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Auto-fills in Column D of every branch sheet upon entering employee name in Excel.
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2 w-full sm:w-80">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search staff by name, email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-500">Facility Branch:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => {
                  setSelectedBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Branches ({totalEmployees})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => loadWorkforce()}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Workforce Table */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {loading && employees.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-xs text-slate-400 font-bold">
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
              <span>Loading Enterprise Workforce...</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700">No staff members found.</div>
              <p className="max-w-md mx-auto text-slate-400">
                {searchQuery || selectedBranchFilter !== 'ALL'
                  ? 'No employees match the selected search or branch filter criteria.'
                  : 'Download the multi-branch Excel template to bulk register your enterprise workforce.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Corporate Email</th>
                    <th className="py-3 px-4">Assigned Branch</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Enrolled Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const branch = emp.baseBranch || emp.scopedBranch;
                    const isActive = emp.status === 'ACTIVE';

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[11px] flex items-center justify-center border border-indigo-100">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{emp.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {emp.email}
                        </td>
                        <td className="py-3.5 px-4">
                          {branch ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <span className="font-mono font-black text-indigo-700">{branch.code}</span>
                              <span className="text-slate-400">•</span>
                              <span>{branch.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                            {emp.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <span>{emp.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {new Date(emp.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold">
                Showing page <span className="font-black text-slate-900">{page}</span> of{' '}
                <span className="font-black text-slate-900">{totalPages}</span> ({totalEmployees} total)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold disabled:opacity-40 cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold disabled:opacity-40 cursor-pointer flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
