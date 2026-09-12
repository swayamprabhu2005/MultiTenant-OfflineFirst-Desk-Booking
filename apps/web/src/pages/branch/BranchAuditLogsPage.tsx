import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, User, Activity, Search, RefreshCw } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const BranchAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/audit');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load branch audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('BULK')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (action.includes('PROXY')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (action.includes('BOOK')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('CUBICLE')) {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    if (action.includes('CANCEL') || action.includes('DEACTIVATE') || action.includes('DELETE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('PASSWORD') || action.includes('UPDATE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('IMPORT') || action.includes('CREATE') || action.includes('REACTIVATE')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(q) ||
      (log.entityType || '').toLowerCase().includes(q) ||
      (log.actorUser?.name || '').toLowerCase().includes(q) ||
      (log.actorUser?.email || '').toLowerCase().includes(q) ||
      JSON.stringify(log.metadata || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            FACILITY COMPLIANCE &amp; GOVERNANCE
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2 mt-0.5">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>Branch Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident audit trail of employee provisioning, batch roster ingestions, account status modifications, and branch configurations.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Logs Console */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by action, employee, or actor..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            Showing {filteredLogs.length} of {logs.length} records
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-slate-400">
            Loading facility audit history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Activity className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Audit Records Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No recorded events match your filter query.'
                : 'No operational activity has been logged for this branch yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Target: {log.entityType}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.actorUser?.name || 'Branch Administrator'} ({log.actorUser?.email || 'admin'})</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {log.metadata && (
                  <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 max-w-md overflow-hidden truncate">
                    {JSON.stringify(log.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
