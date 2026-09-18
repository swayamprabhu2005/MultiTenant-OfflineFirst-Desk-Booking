import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Calendar, 
  UserCheck, 
  AlertCircle, 
  Sparkles, 
  X, 
  Clock, 
  MapPin 
} from 'lucide-react';
import { fetchApi } from '../services/api';

export interface InAppNotification {
  id: string;
  type: 'BOOKING_CONFIRMED' | 'PROXY_BOOKING' | 'BOOKING_CANCELLED' | 'ADMIN_BROADCAST' | 'SYSTEM';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: Record<string, any>;
}

interface NotificationBellProps {
  isDarkHeader?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ isDarkHeader = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const res = await fetchApi<{ success: boolean; notifications: InAppNotification[]; unreadCount: number }>(
        '/notifications'
      );
      if (res?.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Graceful fallback if offline or endpoint unreachable
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 25000); // 25s polling
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await fetchApi('/notifications/mark-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      await fetchApi('/notifications/clear', { method: 'POST' });
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'PROXY_BOOKING':
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case 'BOOKING_CANCELLED':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'ADMIN_BROADCAST':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'BOOKING_CONFIRMED':
      default:
        return <Calendar className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getNotificationBadgeClass = (type: InAppNotification['type']) => {
    switch (type) {
      case 'PROXY_BOOKING':
        return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'BOOKING_CANCELLED':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      case 'ADMIN_BROADCAST':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'BOOKING_CONFIRMED':
      default:
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            handleMarkAllRead();
          }
        }}
        className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
          isDarkHeader
            ? 'text-white/80 hover:text-white hover:bg-white/20'
            : 'text-slate-700 hover:text-slate-950 hover:bg-black/10'
        }`}
        title="Activity Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center px-1 text-[10px] font-black text-white bg-rose-500 rounded-full shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Panel Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 ? (
                <span className="bg-rose-100 text-rose-700 text-[11px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                  {unreadCount} new
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                  All caught up
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {notifications.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={loading || unreadCount === 0}
                    title="Mark all as read"
                    className="p-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={loading}
                    title="Clear history"
                    className="p-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                <p className="text-xs font-medium">No activity notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Bookings, approvals, and proxy reservations will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition-colors hover:bg-slate-50/80 flex items-start space-x-3 ${
                    !n.read ? 'bg-indigo-50/40' : 'bg-white'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white shadow-xs border border-slate-100 mt-0.5 shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{n.title}</h4>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(n.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed break-words">{n.message}</p>
                    {n.metadata?.deskCode && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getNotificationBadgeClass(n.type)}`}>
                          Desk {n.metadata.deskCode}
                        </span>
                        {n.metadata?.branchName && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {n.metadata.branchName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Panel Footer */}
          <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-medium">
              Real-time activity feed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
