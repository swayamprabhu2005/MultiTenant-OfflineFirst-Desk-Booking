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
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  isDarkHeader = false,
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

  // Visual Styling depending on network and sync state
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
