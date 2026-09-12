import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, User, Search, RefreshCw, Activity, Layers } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/audit');
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
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
    if (action.includes('IMPORT') || action.includes('CREATE')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const renderMetadataSummary = (action: string, metadata: any) => {
    if (!metadata) return null;

    if (action === 'BOOK_DESK' || action === 'PROXY_BOOK_DESK') {
      return (
        <div className="text-[11px] text-slate-600 space-x-2 flex items-center flex-wrap">
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {metadata.deskCode || 'Desk'}
          </span>
          <span className="text-slate-500">Slot: {metadata.slotType || 'FULL_DAY'}</span>
        </div>
      );
    }

    if (action === 'BULK_BOOK_POD') {
      return (
        <div className="text-[11px] text-slate-600 space-x-1.5 flex items-center flex-wrap">
          <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            {metadata.totalDesksBooked || 0} Desks
          </span>
          <span className="font-mono text-slate-500 truncate max-w-xs">
            {Array.isArray(metadata.deskCodes) ? metadata.deskCodes.join(', ') : ''}
          </span>
        </div>
      );
    }

    if (action === 'CANCEL_BOOKING') {
      return (
        <div className="text-[11px] text-slate-600 space-x-1.5 flex items-center flex-wrap">
          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            {metadata.deskCode || 'Desk'}
          </span>
          {metadata.reason && <span className="text-slate-500 italic">"{metadata.reason}"</span>}
        </div>
      );
    }

    if (action === 'ADD_CUBICLE') {
      return (
        <div className="text-[11px] text-slate-600 space-x-1.5 flex items-center flex-wrap">
          <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
            {metadata.deskCode}
          </span>
          <span className="text-slate-500">{metadata.type}</span>
          {metadata.hasHdmi && <span className="text-emerald-600 font-bold text-[10px]">HDMI</span>}
        </div>
      );
    }

    return (
      <span className="text-[10px] font-mono text-slate-400 truncate max-w-xs block">
        {JSON.stringify(metadata)}
      </span>
    );
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
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            SECURITY &amp; COMPLIANCE AUDIT
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2 mt-0.5">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>Audit Logs &amp; Security Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit trail of system actions, tenant configurations, workstation reservations, and administrative events.
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

      {/* Logs Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by action, user, desk code, or note..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            Showing {filteredLogs.length} of {logs.length} records
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-slate-400">
            Loading system audit history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Activity className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Audit Records Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No recorded events match your search query.'
                : 'No operational activity has been logged yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>
                        {log.entityType} ({log.entityId.slice(0, 8)}...)
                      </span>
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-600">{log.actorUser?.name || 'System / Admin'}</span>
                      {log.actorUser?.email && <span className="text-slate-400">({log.actorUser.email})</span>}
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 max-w-sm">
                  {renderMetadataSummary(log.action, log.metadata)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsPage;
