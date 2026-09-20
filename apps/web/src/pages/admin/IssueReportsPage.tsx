import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldAlert, Search, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, Image as ImageIcon, Eye, Trash2, 
  ChevronRight, Building2, User, Shield, X, 
  Save, Loader2, Cpu, Server, Database, Copy, Check, Terminal, Box, Download
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { showToast } from '../../components/common/Toast';
import { IssueStatus, IssuePriority, IssueReportDTO } from '@deskbooking/shared';

export const IssueReportsPage: React.FC = () => {
  const [issues, setIssues] = useState<IssueReportDTO[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected issue for inspector drawer/modal
  const [selectedIssue, setSelectedIssue] = useState<IssueReportDTO | null>(null);
  const [editStatus, setEditStatus] = useState<IssueStatus>(IssueStatus.OPEN);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);

  // Lightbox modal for screenshot
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (orgFilter !== 'ALL') params.append('organizationId', orgFilter);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      params.append('page', String(page));
      params.append('limit', '12');

      const [issueData, statsData, orgData] = await Promise.all([
        fetchApi<{ issues: IssueReportDTO[]; pagination: { totalPages: number } }>(`/issues?${params.toString()}`),
        fetchApi<typeof stats>('/issues/stats').catch(() => ({ total: 0, open: 0, inProgress: 0, resolved: 0, critical: 0 })),
        fetchApi<any[]>('/organizations').catch(() => []),
      ]);

      setIssues(issueData.issues || []);
      setTotalPages(issueData.pagination?.totalPages || 1);
      setStats(statsData);
      setOrganizations(Array.isArray(orgData) ? orgData : []);
    } catch (err: any) {
      console.error('Failed to load issue reports:', err);
      showToast(err.message || 'Failed to fetch issue reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter, priorityFilter, orgFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleOpenDetail = (issue: IssueReportDTO) => {
    setSelectedIssue(issue);
    setEditStatus(issue.status);
    setResolutionNote(issue.resolutionNote || '');
  };

  const handleCopyManifest = (manifest: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopiedManifest(true);
      showToast('System diagnostics manifest copied to clipboard!', 'success');
      setTimeout(() => setCopiedManifest(false), 2500);
    } catch {
      showToast('Failed to copy manifest to clipboard', 'error');
    }
  };

  const handleDownloadReportFile = (issue: IssueReportDTO) => {
    if (issue.systemDiagnostics?.fileUrl) {
      window.open(issue.systemDiagnostics.fileUrl, '_blank');
      showToast('Opening diagnostics file...', 'success');
      return;
    }
    window.open('http://localhost:4000/api/system/download-report', '_blank');
    showToast('Downloading diagnostics file...', 'success');
  };

  const handleUpdateStatus = async () => {
    if (!selectedIssue) return;

    try {
      setIsUpdating(true);
      const res = await fetchApi<{ success: boolean; issue: IssueReportDTO }>(
        `/issues/${selectedIssue.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: editStatus,
            resolutionNote: resolutionNote.trim(),
          }),
        }
      );

      showToast(`Issue status updated to ${editStatus}.`, 'success');
      setSelectedIssue(res.issue);
      await loadData();
    } catch (err: any) {
      console.error('Failed to update issue:', err);
      showToast(err.message || 'Failed to update issue status', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!selectedIssue) return;
    if (!window.confirm(`Are you sure you want to permanently delete issue "${selectedIssue.title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await fetchApi(`/issues/${selectedIssue.id}`, { method: 'DELETE' });
      showToast('Issue report deleted successfully.', 'success');
      setSelectedIssue(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete issue:', err);
      showToast(err.message || 'Failed to delete issue report', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white shadow-xl shadow-slate-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight">Platform Issue Reports</h1>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Global Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Centralized operational grievance stream. Investigate and resolve issues escalated by Employees, Branch Admins, and Organization Admins.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="self-start md:self-auto flex items-center space-x-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-colors cursor-pointer text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stream</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total Reports</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Open */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-amber-50/40">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <p className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">Open / Pending</p>
            </div>
            <h3 className="text-2xl font-black text-amber-900 mt-1">{stats.open}</h3>
          </div>
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-blue-50/40">
          <div>
            <p className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">Investigating</p>
            <h3 className="text-2xl font-black text-blue-900 mt-1">{stats.inProgress}</h3>
          </div>
          <div className="p-2.5 bg-blue-100 rounded-xl text-blue-700">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <div>
            <p className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">Resolved</p>
            <h3 className="text-2xl font-black text-emerald-900 mt-1">{stats.resolved}</h3>
          </div>
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by title, description, reporter, or organization..."
              className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                  loadData();
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">🔴 Open / Pending</option>
              <option value="IN_PROGRESS">🔵 In Progress</option>
              <option value="RESOLVED">🟢 Resolved</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">🔥 Critical</option>
              <option value="HIGH">⚡ High</option>
              <option value="MEDIUM">⚖️ Medium</option>
              <option value="LOW">🌱 Low</option>
            </select>

            {/* Tenant Org Filter */}
            <select
              value={orgFilter}
              onChange={(e) => {
                setOrgFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate"
            >
              <option value="ALL">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.subdomain})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table / Card List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
            <p className="font-semibold">Loading platform issue reports...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No issue reports found</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto">
              {statusFilter !== 'ALL' || priorityFilter !== 'ALL' || searchQuery
                ? 'No reports matched your current filter query.'
                : 'All platform operations are healthy. No unresolved issues reported.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Status & Priority</th>
                  <th className="py-3.5 px-4">Issue Details</th>
                  <th className="py-3.5 px-4">Tenant Org</th>
                  <th className="py-3.5 px-4">Reporter</th>
                  <th className="py-3.5 px-4">Reported</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {issues.map((issue) => {
                  const isOpen = issue.status === IssueStatus.OPEN;
                  const isInProgress = issue.status === IssueStatus.IN_PROGRESS;

                  return (
                    <tr 
                      key={issue.id}
                      onClick={() => handleOpenDetail(issue)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Status & Priority */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {/* Status */}
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isOpen
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isInProgress
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isOpen ? 'bg-rose-500 animate-pulse' : isInProgress ? 'bg-blue-500' : 'bg-emerald-500'
                            }`}></span>
                            <span>{issue.status}</span>
                          </span>

                          {/* Priority */}
                          <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              issue.priority === IssuePriority.CRITICAL
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : issue.priority === IssuePriority.HIGH
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : issue.priority === IssuePriority.LOW
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}>
                              {issue.priority}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Issue Details */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded">
                              {issue.category || 'GENERAL'}
                            </span>
                            {issue.screenshotUrl && (
                              <span 
                                title="Screenshot Attached"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImage(issue.screenshotUrl!);
                                }}
                                className="inline-flex items-center text-[10px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              >
                                <ImageIcon className="w-3 h-3 mr-1 text-indigo-500" />
                                Image
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {issue.title}
                          </h4>
                          <div className="flex items-center space-x-2 text-[10px]">
                            <span className="font-mono bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                              {issue.clientVersion || 'v1.0.0'}
                            </span>
                            {issue.deviceInfo && (
                              <span className="text-slate-400 truncate max-w-[180px]" title={issue.deviceInfo}>
                                {issue.deviceInfo}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-[11px] line-clamp-1">
                            {issue.description}
                          </p>
                        </div>
                      </td>

                      {/* Tenant Org */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-800">
                              {issue.organization?.name || 'Unknown'}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-medium text-slate-500 block">
                            {issue.organization?.subdomain}.deskbooking.com
                          </span>
                        </div>
                      </td>

                      {/* Reporter */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{issue.reporter?.name || 'Anonymous'}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <span className="font-mono">{issue.reporter?.email}</span>
                            <span>•</span>
                            <span className="font-bold text-indigo-600 uppercase">
                              {issue.reporter?.role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Reported At */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(issue.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(issue);
                          }}
                          className="px-3 py-1.5 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-700 font-bold rounded-lg transition-all text-xs inline-flex items-center space-x-1"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspector / Resolution Modal */}
      {selectedIssue && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-900 text-white">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase">
                    {selectedIssue.category || 'GENERAL'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase">
                    Priority: {selectedIssue.priority}
                  </span>
                </div>
                <h3 className="text-base font-bold tracking-tight mt-1.5 text-white">
                  {selectedIssue.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reported on {new Date(selectedIssue.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedIssue(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              
              {/* Context Cards (Reporter & Tenant) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Reporter Context */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Reporter Profile
                  </span>
                  <p className="font-bold text-slate-900 text-sm">{selectedIssue.reporter?.name}</p>
                  <p className="text-slate-600 font-mono text-[11px]">{selectedIssue.reporter?.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                    Role: {selectedIssue.reporter?.role}
                  </span>
                </div>

                {/* Tenant Context */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Tenant Organization
                  </span>
                  <p className="font-bold text-slate-900 text-sm">{selectedIssue.organization?.name}</p>
                  <p className="text-indigo-600 font-mono text-[11px]">{selectedIssue.organization?.subdomain}.deskbooking.com</p>
                  <span className="inline-block mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    Code: {selectedIssue.organization?.code}
                  </span>
                </div>

                {/* Client Software & Environment Versions */}
                <div className="sm:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Client Software &amp; System Version Diagnostics
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Captured at time of report escalation
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Version: {selectedIssue.clientVersion || 'v1.0.0'}
                      </span>
                      {selectedIssue.systemDiagnostics && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDownloadReportFile(selectedIssue)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 inline-flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                            title="Download system-diagnostics.txt report file"
                          >
                            <Download className="w-3 h-3 text-indigo-600" />
                            <span>Download Log (.txt)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyManifest(selectedIssue.systemDiagnostics)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 inline-flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                            title="Copy entire system diagnostics JSON to clipboard"
                          >
                            {copiedManifest ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>Copy JSON</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Browser / Device Info */}
                  <div className="p-2.5 bg-white border border-slate-200/90 rounded-lg">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                      Reporter Browser &amp; Operating Environment
                    </span>
                    <p className="text-slate-800 text-xs font-mono font-medium">
                      {selectedIssue.deviceInfo || 'No client environment string available.'}
                    </p>
                  </div>

                  {/* Complete Stack Grid (Docker, Postgres, OS, Node, Frameworks) */}
                  {selectedIssue.systemDiagnostics && (
                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Server &amp; Infrastructure Runtime Manifest
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Docker & Containerization */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1">
                              <Box className="w-3 h-3 text-blue-600" />
                              <span>Docker &amp; Containers</span>
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                              selectedIssue.systemDiagnostics.runtimes?.dockerDaemonActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {selectedIssue.systemDiagnostics.runtimes?.dockerDaemonActive ? 'DAEMON ACTIVE' : 'DAEMON OFFLINE'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-800 font-bold">
                            {selectedIssue.systemDiagnostics.runtimes?.docker || 'Docker CLI'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {selectedIssue.systemDiagnostics.runtimes?.dockerCompose || 'Docker Compose'}
                          </div>
                        </div>

                        {/* Database Engine */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1">
                              <Database className="w-3 h-3 text-indigo-600" />
                              <span>Database Engine</span>
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                              selectedIssue.systemDiagnostics.database?.status === 'HEALTHY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {selectedIssue.systemDiagnostics.database?.status || 'HEALTHY'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-800 font-bold truncate" title={selectedIssue.systemDiagnostics.database?.version}>
                            {selectedIssue.systemDiagnostics.database?.version || 'PostgreSQL 16'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Port {selectedIssue.systemDiagnostics.database?.port || 5432} • Latency: {selectedIssue.systemDiagnostics.database?.latencyMs ?? 0}ms
                          </div>
                        </div>

                        {/* Host OS & Hardware */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1">
                              <Server className="w-3 h-3 text-amber-600" />
                              <span>Host Operating System</span>
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-500">
                              {selectedIssue.systemDiagnostics.os?.arch}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-800 font-bold">
                            {selectedIssue.systemDiagnostics.os?.humanName || selectedIssue.systemDiagnostics.os?.type}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            RAM: {selectedIssue.systemDiagnostics.os?.freeMemoryGB} free / {selectedIssue.systemDiagnostics.os?.totalMemoryGB} • CPU: {selectedIssue.systemDiagnostics.os?.cpuCores} Cores
                          </div>
                        </div>

                        {/* Runtimes & Frameworks */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1">
                              <Terminal className="w-3 h-3 text-emerald-600" />
                              <span>Runtimes &amp; Frameworks</span>
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-800 font-bold">
                            Node {selectedIssue.systemDiagnostics.runtimes?.node} • pnpm {selectedIssue.systemDiagnostics.runtimes?.pnpm}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate" title="Express, React, Vite, Prisma, TypeScript">
                            Express 4.22 • React 18.3 • Vite 5.4 • Prisma 5.22
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Reported Issue Description
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedIssue.description}
                </div>
              </div>

              {/* Screenshot Attachment */}
              {selectedIssue.screenshotUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Attached Screenshot Evidence
                    </h4>
                    <span className="text-[10px] text-slate-400">Click to zoom full size</span>
                  </div>
                  <div 
                    onClick={() => setExpandedImage(selectedIssue.screenshotUrl!)}
                    className="relative group border border-slate-200 rounded-xl overflow-hidden cursor-pointer bg-slate-900 max-h-56 flex items-center justify-center"
                  >
                    <img
                      src={selectedIssue.screenshotUrl}
                      alt="Issue Screenshot"
                      className="object-contain max-h-56 w-full group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes(':4000') && selectedIssue.screenshotUrl?.startsWith('/')) {
                          target.src = `http://localhost:4000${selectedIssue.screenshotUrl}`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs space-x-1.5">
                      <Eye className="w-4 h-4" />
                      <span>View Full-Size Screenshot</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution & Status Management Panel */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center space-x-1.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Superadmin Resolution Action</span>
                  </h4>
                  {selectedIssue.resolvedBy && (
                    <span className="text-[10px] text-indigo-700 font-semibold">
                      Resolved by: {selectedIssue.resolvedBy.name}
                    </span>
                  )}
                </div>

                {/* Status Switcher Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Set Operational Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditStatus(IssueStatus.OPEN)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        editStatus === IssueStatus.OPEN
                          ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🔴 OPEN / PENDING
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus(IssueStatus.IN_PROGRESS)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        editStatus === IssueStatus.IN_PROGRESS
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🔵 IN PROGRESS
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus(IssueStatus.RESOLVED)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        editStatus === IssueStatus.RESOLVED
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🟢 MARK RESOLVED
                    </button>
                  </div>
                </div>

                {/* Resolution Note */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Resolution Notes / Corrective Actions
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Document the root cause and steps taken to resolve (e.g., cleared corrupt reservation lock, adjusted branch quota, reset password)..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleDeleteIssue}
                    disabled={isDeleting}
                    className="text-rose-600 hover:text-rose-700 font-bold text-xs inline-flex items-center space-x-1 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Test Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUpdateStatus}
                    disabled={isUpdating}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Status...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Resolution</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Lightbox Modal for Screenshot Preview */}
      {expandedImage && createPortal(
        <div 
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={expandedImage}
              alt="Expanded Screenshot"
              className="max-h-[85vh] max-w-full rounded-xl object-contain border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes(':4000') && expandedImage.startsWith('/')) {
                  target.src = `http://localhost:4000${expandedImage}`;
                }
              }}
            />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
