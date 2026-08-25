import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, User, FileText } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/audit');
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <span>Audit Logs & Security Monitoring</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete audit trail of system actions, tenant configurations, and offline sync operations.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Recent Audit Records ({logs.length})</h2>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit log entries recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {log.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Target: {log.entityType} ({log.entityId})
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mt-1 flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.actorUser?.name || 'System / Auto Sync'}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {log.metadata && (
                  <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 max-w-xs truncate">
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
