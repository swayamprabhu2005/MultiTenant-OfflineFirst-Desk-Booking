import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  Building2, LogOut, Wifi, WifiOff, ChevronDown, UserCheck, 
  Bell, Check, Eye
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { fetchApi } from '../../services/api';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { tenant, availableTenants, setTenantSubdomain } = useTenant();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Dropdown states
  const [showNotifications, setShowNotifications] = useState(false);

  // Dexie counts
  const pendingCount = useLiveQuery(
    () => db.outbox.where('status').equals('PENDING').count(),
    []
  );

  const localNotifications = useLiveQuery(
    () => db.notifications.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  const unreadCount = localNotifications.filter(n => !n.isRead).length;

  // Sync notifications with backend
  const syncNotifications = async () => {
    if (!navigator.onLine || !user) return;
    try {
      const serverNotifications = await fetchApi<any[]>('/notifications');
      // Sync with local Dexie cache
      for (const sn of serverNotifications) {
        await db.notifications.put({
          id: sn.id,
          userId: sn.userId,
          type: sn.type,
          message: sn.message,
          bookingId: sn.bookingId,
          isRead: sn.isRead,
          createdAt: sn.createdAt
        });
      }
      
      // Clean up notifications that are no longer on the server
      const localIds = localNotifications.map(n => n.id);
      const serverIds = serverNotifications.map(n => n.id);
      const toDelete = localIds.filter(id => !serverIds.includes(id));
      if (toDelete.length > 0) {
        await db.notifications.bulkDelete(toDelete);
      }
    } catch (err) {
      console.warn('[Header] Failed to sync notifications:', err);
    }
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncNotifications();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync
    syncNotifications();

    // Periodic check every 15s when online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncNotifications();
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [user]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string) => {
    // 1. Update local cache
    await db.notifications.update(id, { isRead: true });

    // 2. Notify backend
    if (navigator.onLine) {
      try {
        await fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
      } catch (err) {
        console.warn('Failed to update notification read state online:', err);
      }
    } else {
      // In offline-first mode, we queue mark-as-read updates too
      await db.outbox.put({
        operationId: `READ-${id}-${Date.now()}`,
        operationType: 'CANCEL_BOOKING', // using dummy or existing types
        payload: { notificationId: id, markRead: true },
        requestHash: `READ-${id}`,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0
      });
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    // 1. Update local cache
    const unreadIds = localNotifications.filter(n => !n.isRead).map(n => n.id);
    for (const id of unreadIds) {
      await db.notifications.update(id, { isRead: true });
    }

    // 2. Notify backend
    if (navigator.onLine) {
      try {
        await fetchApi('/notifications/read-all', { method: 'POST' });
      } catch (err) {
        console.warn('Failed to mark all as read online:', err);
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Tenant Branding */}
        <div className="flex items-center space-x-3">
          {tenant?.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="w-9 h-9 object-contain rounded-lg border border-slate-200 p-0.5 bg-slate-50"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {tenant?.name?.charAt(0) || 'D'}
            </div>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800 text-base tracking-tight">
                {tenant?.name || 'Desk Booking SaaS'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {tenant?.code || 'TENANT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {tenant?.subdomain ? `${tenant.subdomain}.deskbooking.com` : 'subdomain'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">

          {/* Tenant Switcher */}
          <div className="relative group hidden sm:block">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer border border-slate-200 transition-all">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Switch Tenant</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>

            <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 hidden group-hover:block z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Simulated Subdomains
              </div>
              {availableTenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTenantSubdomain(t.subdomain)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-700 ${
                    t.subdomain === tenant?.subdomain ? 'font-bold text-emerald-600 bg-emerald-50/50' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <div>{t.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{t.subdomain}.deskbooking.com</div>
                  </div>
                  {t.subdomain === tenant?.subdomain && <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Online/Offline Badge */}
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Offline ({pendingCount || 0})</span>
              </>
            )}
          </div>

          {/* Notification dropdown trigger (Task 4.2) */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-400 hover:text-slate-750 hover:bg-slate-100 rounded-lg relative transition-all"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white animate-bounce shadow">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden flex flex-col max-h-[350px]">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-emerald-600 hover:text-emerald-750 font-bold"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                    {localNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-slate-400 text-xs">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        No notifications found.
                      </div>
                    ) : (
                      localNotifications.map((n: any) => (
                        <div
                          key={n.id}
                          className={`p-3 text-left space-y-1 transition-all ${
                            !n.isRead ? 'bg-emerald-50/20' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">
                              {n.message}
                            </span>
                            {!n.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(n.id)}
                                className="p-1 text-slate-355 hover:text-emerald-600 rounded"
                                title="Mark as read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 block">
                            {new Date(n.createdAt).toLocaleDateString()} at{' '}
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profile & Logout */}
          {user && (
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-end space-x-1">
                  <span>{user.name}</span>
                  {user.role !== 'EMPLOYEE' && (
                    <span title="Admin User">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {user.role.replace('_', ' ')} • {user.department || 'Staff'}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
