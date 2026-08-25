import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { syncEngine } from '../../services/syncEngine';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = useLiveQuery(
    () => db.outbox.where('status').equals('PENDING').count(),
    []
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncEngine.flushOutbox();
    setIsSyncing(false);
  };

  if (isOnline && (!pendingCount || pendingCount === 0)) {
    return null;
  }

  return (
    <div className={`px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between shadow-inner transition-all ${
      !isOnline
        ? 'bg-amber-500 text-amber-950 border-b border-amber-600'
        : 'bg-emerald-600 text-white border-b border-emerald-700'
    }`}>
      <div className="flex items-center space-x-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-950 animate-pulse" />
            <span>
              <strong>Offline Mode Active:</strong> You are disconnected. Bookings are saved locally to IndexedDB outbox.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>
              <strong>Network Restored:</strong> {pendingCount} offline booking request(s) pending sync to backend API.
            </span>
          </>
        )}
      </div>

      {isOnline && pendingCount && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="ml-4 px-3 py-1 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg shadow font-semibold text-xs flex items-center space-x-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
};
