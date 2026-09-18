import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  isAppOnline, 
  getOutboxCount, 
  syncOutboxQueue 
} from '../services/offlineStore';

interface NetworkStatusIndicatorProps {
  isDarkHeader?: boolean;
  inSidebar?: boolean;
  isCollapsed?: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  isDarkHeader = false,
  inSidebar = false,
  isCollapsed = false,
}) => {
  const { user } = useAuth();
  const [online, setOnline] = useState<boolean>(isAppOnline());
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Strict role restriction: offline-first capabilities are strictly for Employee and Branch Admin
  const isEligible = user && ['EMPLOYEE', 'BRANCH_ADMIN'].includes(user.role);

  const refreshCount = async () => {
    try {
      const count = await getOutboxCount();
      setOutboxCount(count);
    } catch {
      setOutboxCount(0);
    }
  };

  const handleSync = async () => {
    if (!isAppOnline() || isSyncing) return;

    try {
      setIsSyncing(true);
      const result = await syncOutboxQueue();
      await refreshCount();

      if (result.synced > 0) {
        setSyncNotice(`Synced ${result.synced} action(s) with server!`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err) {
      console.error('Outbox synchronization error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isEligible) return;

    refreshCount();

    const handleOnline = () => {
      setOnline(true);
      // Automatically flush outbox upon network reconnection
      handleSync();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleOutboxUpdate = (e: any) => {
      const count = e.detail?.count ?? 0;
      setOutboxCount(count);
    };

    const handleSyncComplete = (e: any) => {
      const { synced } = e.detail || {};
      if (synced > 0) {
        setSyncNotice(`Synced ${synced} change(s) with server.`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-outbox-updated', handleOutboxUpdate);
    window.addEventListener('offline-sync-completed', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-outbox-updated', handleOutboxUpdate);
      window.removeEventListener('offline-sync-completed', handleSyncComplete);
    };
  }, [isEligible]);

  if (!isEligible) {
    return null;
  }

  // Collapsed Sidebar View
  if (inSidebar && isCollapsed) {
    if (!online) {
      return (
        <div className="flex justify-center p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800" title="Offline - Changes Queued Locally">
          <WifiOff className="w-4 h-4 text-amber-700 animate-pulse" />
        </div>
      );
    }
    if (isSyncing) {
      return (
        <div className="flex justify-center p-2 rounded-xl bg-sky-100 border border-sky-300 text-sky-800" title="Syncing...">
          <RefreshCw className="w-4 h-4 text-sky-700 animate-spin" />
        </div>
      );
    }
    if (outboxCount > 0) {
      return (
        <button
          type="button"
          onClick={handleSync}
          className="w-full flex justify-center p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 cursor-pointer"
          title={`${outboxCount} Queued. Click to Sync Now`}
        >
          <RefreshCw className="w-4 h-4 text-amber-700" />
        </button>
      );
    }
    return (
      <div className="flex justify-center p-2 rounded-xl bg-emerald-100 border border-emerald-300" title="System Online & Synced">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    );
  }

  // Expanded Sidebar View: Solid vibrant green pill badge
  if (inSidebar) {
    if (!online) {
      return (
        <div 
          className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
          title="Application is operating offline. Bookings are saved locally in Outbox."
        >
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
            <span>Offline</span>
          </div>
          {outboxCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {outboxCount} queued
            </span>
          )}
        </div>
      );
    }

    if (isSyncing) {
      return (
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300 shadow-2xs"
          title="Synchronizing outbox transactions with server..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-700 animate-spin" />
          <span>Syncing with Server...</span>
        </div>
      );
    }

    if (outboxCount > 0) {
      return (
        <button
          type="button"
          onClick={handleSync}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-2xs"
          title="Click to flush pending outbox queue to server"
        >
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
            <span>{outboxCount} Queued</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5 rounded-md">
            Sync Now
          </span>
        </button>
      );
    }

    return (
      <div 
        className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all"
        title="Connected to Server • Offline-First Engine Active"
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tracking-tight">Online</span>
        </div>
        {syncNotice ? (
          <span className="text-[10px] font-semibold text-emerald-700 truncate max-w-[100px]">
            {syncNotice}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-emerald-600 font-normal">Active</span>
        )}
      </div>
    );
  }

  // Header View (Fallback if ever needed)
  if (!online) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-xs"
        title="Application is operating offline. Bookings are saved locally in Outbox."
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        <span className="hidden sm:inline">Offline</span>
        {outboxCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black">
            {outboxCount} queued
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30"
        title="Synchronizing outbox transactions with server..."
      >
        <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    );
  }

  if (outboxCount > 0) {
    return (
      <button
        type="button"
        onClick={handleSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer"
        title="Click to flush pending outbox queue to server"
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
        <span>{outboxCount} Queued</span>
        <span className="underline ml-0.5 text-[10px]">Sync</span>
      </button>
    );
  }

  return (
    <div 
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
        isDarkHeader
          ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      }`}
      title="Connected to Server • Offline-First Engine Active"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="hidden sm:inline font-bold">Online</span>
      {syncNotice && (
        <span className="text-[10px] font-semibold text-emerald-300 ml-1">
          {syncNotice}
        </span>
      )}
    </div>
  );
};
