import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, X, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Listen for conflict events from SyncEngine
    const handleSyncConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast({
        type: 'error',
        title: 'Booking Conflict ("First to Sync Wins")',
        message: detail.message || 'Your offline request collided with another booking. Please select another slot.',
      });
    };

    window.addEventListener('booking-sync-conflict', handleSyncConflict);
    return () => window.removeEventListener('booking-sync-conflict', handleSyncConflict);
  }, []);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-md w-full px-4">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all transform translate-y-0 ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-900'
              : toast.type === 'warning'
              ? 'bg-amber-50/95 border-amber-200 text-amber-900'
              : toast.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
              : 'bg-slate-50/95 border-slate-200 text-slate-900'
          }`}
        >
          <div className="mr-3 mt-0.5 flex-shrink-0">
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-slate-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">{toast.title}</h4>
            <p className="text-xs mt-1 leading-relaxed opacity-90">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-3 text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
