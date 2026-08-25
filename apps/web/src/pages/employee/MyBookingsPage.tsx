import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { CalendarCheck, Clock, MapPin, XCircle, WifiOff, AlertTriangle, Building, RefreshCw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { fetchApi } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [onlineBookings, setOnlineBookings] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Dexie local bookings & outbox pending queue
  const localBookings = useLiveQuery(() => db.localBookings.toArray(), []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      if (navigator.onLine) {
        const data = await fetchApi<any[]>('/bookings');
        setOnlineBookings(data);
        // Cache to IndexedDB
        for (const b of data) {
          await db.localBookings.put({
            id: b.id,
            organizationId: b.organizationId,
            resourceId: b.resourceId,
            resourceName: b.resource?.name || 'Cubicle',
            buildingName: b.resource?.floor?.building?.name || 'HQ Office',
            userId: b.userId,
            userName: b.user?.name,
            createdById: b.createdById,
            startAt: b.startAt,
            endAt: b.endAt,
            status: b.status,
            source: b.source,
            operationId: b.operationId,
            createdAt: b.createdAt,
          });
        }
      }
    } catch (err) {
      console.warn('Network error loading online bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string, operationId: string) => {
    if (!confirm('Are you sure you want to cancel this booking reservation?')) return;

    if (navigator.onLine) {
      try {
        await fetchApi(`/bookings/${bookingId}`, { method: 'DELETE' });
        loadBookings();
      } catch (err: any) {
        alert(err.message || 'Failed to cancel booking');
      }
    } else {
      await syncEngine.queueCancelOperation(bookingId, operationId || `CANCEL-${Date.now()}`, tenant?.id || '');
    }
  };

  // Merge local & online bookings deduplicating by operationId/id
  const bookingsMap = new Map();
  (localBookings || []).forEach(b => bookingsMap.set(b.operationId || b.id, b));
  (onlineBookings || []).forEach(b => bookingsMap.set(b.operationId || b.id, b));

  const allBookings = Array.from(bookingsMap.values())
    .filter((b: any) => {
      if (statusFilter === 'ALL') return true;
      return b.status === statusFilter;
    })
    .sort((a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Workspace Reservations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your past, current, and pending offline desk bookings.
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
          {['ALL', 'CONFIRMED', 'PENDING', 'CANCELLED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {allBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No Reservations Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            You do not have any {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} bookings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allBookings.map((b: any) => {
            const isOfflinePending = b.status === 'PENDING';
            const isConflict = b.status === 'CONFLICT';

            return (
              <div
                key={b.id || b.operationId}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition-all ${
                  isConflict
                    ? 'border-rose-300 bg-rose-50/30'
                    : isOfflinePending
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : b.status === 'CONFLICT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {b.status}
                      </span>

                      {b.source === 'OFFLINE' && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <WifiOff className="w-3 h-3 text-amber-600" />
                          <span>Offline Created</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {b.resourceName || b.resource?.name || 'Cubicle Space'}
                    </h3>
                  </div>

                  {b.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCancelBooking(b.id, b.operationId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Cancel Booking"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.buildingName || b.resource?.floor?.building?.name || 'HQ Building'}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(b.startAt).toLocaleDateString()} •{' '}
                      {new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {isConflict && (
                  <div className="p-3 rounded-xl bg-rose-100/70 border border-rose-200 text-rose-900 text-xs flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Conflict Rejection:</strong> {b.syncError || 'This slot was reserved by another employee during your offline period.'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
