import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { syncEngine } from '../../services/syncEngine';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Trash2,
} from 'lucide-react';

export const SyncCenterPage: React.FC = () => {
  const isOnline = navigator.onLine;
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  // Live query outbox items from Dexie IndexedDB
  const outboxItems = useLiveQuery(() => db.outbox.orderBy('createdAt').reverse().toArray(), []);
  const pendingCount = useLiveQuery(() => db.outbox.where('status').equals('PENDING').count(), []);
  const successCount = useLiveQuery(() => db.outbox.where('status').equals('SUCCESS').count(), []);
  const rejectedCount = useLiveQuery(() => db.outbox.where('status').equals('REJECTED').count(), []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncSummary(null);
    const res = await syncEngine.flushOutbox();
    setIsSyncing(false);
    setSyncSummary(`Synced ${res.success} operation(s) successfully. ${res.conflicts} conflict(s), ${res.failed} error(s).`);
  };

  const handleClearOutbox = async () => {
    if (confirm('Clear non-pending sync history logs from local storage?')) {
      await db.outbox.where('status').notEqual('PENDING').delete();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 text-emerald-600" />
            <span>PWA Sync Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor browser IndexedDB outbox queue, background sync, and conflict resolution history.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTriggerSync}
            disabled={isSyncing || !isOnline || !pendingCount || pendingCount === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Outbox...' : 'Force Sync Outbox Now'}</span>
          </button>
        </div>
      </div>

      {syncSummary && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>{syncSummary}</span>
          <button onClick={() => setSyncSummary(null)} className="text-emerald-700 text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Network & IndexedDB Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        
        {/* Network state */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{isOnline ? 'Online' : 'Offline'}</div>
            <div className="text-xs font-medium text-slate-500">Browser Network</div>
          </div>
        </div>

        {/* Pending outbox */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{pendingCount || 0}</div>
            <div className="text-xs font-medium text-slate-500">Pending Outbox</div>
          </div>
        </div>

        {/* Synced Success */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{successCount || 0}</div>
            <div className="text-xs font-medium text-slate-500">Synced Success</div>
          </div>
        </div>

        {/* Conflicts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{rejectedCount || 0}</div>
            <div className="text-xs font-medium text-slate-500">Conflict Rejections</div>
          </div>
        </div>

      </div>

      {/* Outbox Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">IndexedDB Outbox Execution Queue</h2>
          </div>

          {outboxItems && outboxItems.length > 0 && (
            <button
              onClick={handleClearOutbox}
              className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log History</span>
            </button>
          )}
        </div>

        {!outboxItems || outboxItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Outbox queue is currently empty. Offline booking requests will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {outboxItems.map(item => (
              <div key={item.operationId} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{item.operationType}</span>
                    <span className="text-[10px] font-mono text-slate-400">({item.operationId})</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Payload: Resource ID {item.payload?.resourceId || item.payload?.bookingId} • Queued at {new Date(item.createdAt).toLocaleString()}
                  </div>

                  {item.lastError && (
                    <div className="text-xs text-rose-600 font-semibold mt-1">
                      Error: {item.lastError}
                    </div>
                  )}
                </div>

                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    item.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : item.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
