import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  CalendarCheck, Clock, MapPin, XCircle, WifiOff, AlertTriangle, 
  Building, RefreshCw, Search, CheckSquare, Square, Trash2, CalendarDays
} from 'lucide-react';
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

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Checkbox selection state
  const [selectedBookingIds, setSelectedBookingIds] = useState<{ [id: string]: boolean }>({});

  // Recurring cancel modal state
  const [cancelModalBooking, setCancelModalBooking] = useState<any | null>(null);

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
            recurringGroupId: b.recurringGroupId,
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

  // Merge local & online bookings deduplicating by operationId/id
  const bookingsMap = new Map();
  (localBookings || []).forEach(b => bookingsMap.set(b.operationId || b.id, b));
  (onlineBookings || []).forEach(b => bookingsMap.set(b.operationId || b.id, b));

  const allBookings = Array.from(bookingsMap.values())
    .filter((b: any) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;

      // 2. Search Query Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const resName = (b.resourceName || '').toLowerCase();
        const bldName = (b.buildingName || '').toLowerCase();
        const dateStr = new Date(b.startAt).toLocaleDateString().toLowerCase();
        return resName.includes(query) || bldName.includes(query) || dateStr.includes(query);
      }
      return true;
    })
    .sort((a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  // Checkbox toggle logic
  const handleToggleSelect = (bookingId: string) => {
    setSelectedBookingIds(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  // Get active non-cancelled bookings list
  const activeBookings = allBookings.filter((b: any) => b.status !== 'CANCELLED');
  const selectedCount = Object.values(selectedBookingIds).filter(Boolean).length;

  const handleSelectAll = () => {
    if (selectedCount === activeBookings.length) {
      // Unselect all
      setSelectedBookingIds({});
    } else {
      // Select all active ones
      const next: { [id: string]: boolean } = {};
      activeBookings.forEach(b => {
        next[b.id || b.operationId] = true;
      });
      setSelectedBookingIds(next);
    }
  };

  // Unified single cancel execution
  const executeCancel = async (bookingId: string, operationId: string, cancelSeries: boolean) => {
    if (navigator.onLine) {
      try {
        await fetchApi(`/bookings/${bookingId}?cancelSeries=${cancelSeries}`, { method: 'DELETE' });
      } catch (err: any) {
        alert(err.message || 'Failed to cancel booking online');
      }
    } else {
      await syncEngine.queueCancelOperation(bookingId, operationId || `CANCEL-${Date.now()}`, tenant?.id || '', cancelSeries);
    }
  };

  // Trigger single booking cancellation (checks for recurring series)
  const handleTriggerCancelSingle = (b: any) => {
    if (b.recurringGroupId) {
      setCancelModalBooking(b);
    } else {
      if (!confirm('Are you sure you want to cancel this booking reservation?')) return;
      executeCancel(b.id, b.operationId, false).then(() => loadBookings());
    }
  };

  // Trigger bulk checked bookings cancellation
  const handleBulkCancelSelected = async () => {
    const idsToCancel = Object.keys(selectedBookingIds).filter(id => selectedBookingIds[id]);
    if (idsToCancel.length === 0) return;

    if (!confirm(`Are you sure you want to cancel the ${idsToCancel.length} selected reservations?`)) return;

    setLoading(true);
    try {
      for (const id of idsToCancel) {
        const item = allBookings.find(x => x.id === id || x.operationId === id);
        if (item) {
          await executeCancel(item.id, item.operationId, false);
        }
      }
      setSelectedBookingIds({});
      loadBookings();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-0">

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600" />
            <span>My Workspace Reservations</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your past, current, and pending offline desk bookings.
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold self-start sm:self-center">
          {['ALL', 'CONFIRMED', 'PENDING', 'CANCELLED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-650 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Bulk Actions bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search bookings by room name, building..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        {activeBookings.length > 0 && (
          <div className="flex items-center space-x-3 self-end md:self-center">
            <button
              onClick={handleSelectAll}
              className="text-xs font-bold text-slate-600 hover:text-slate-950 flex items-center space-x-1.5"
            >
              {selectedCount === activeBookings.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Select All Active ({activeBookings.length})</span>
            </button>

            {selectedCount > 0 && (
              <button
                onClick={handleBulkCancelSelected}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-extrabold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancel Selected ({selectedCount})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bookings List Grid */}
      {allBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No Reservations Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            You do not have any {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} bookings matching query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allBookings.map((b: any) => {
            const isOfflinePending = b.status === 'PENDING';
            const isConflict = b.status === 'CONFLICT';
            const isCancelled = b.status === 'CANCELLED';

            const bookingKey = b.id || b.operationId;
            const isChecked = !!selectedBookingIds[bookingKey];

            return (
              <div
                key={bookingKey}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 transition-all relative ${
                  isConflict
                    ? 'border-rose-300 bg-rose-50/20'
                    : isOfflinePending
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-slate-200 hover:border-slate-350'
                }`}
              >
                
                {/* Selection Checkbox */}
                {!isCancelled && (
                  <button
                    onClick={() => handleToggleSelect(bookingKey)}
                    className="absolute top-4 left-4 p-0.5 rounded text-slate-400 hover:text-slate-900 z-10"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>
                )}

                <div className={`flex items-start justify-between ${!isCancelled ? 'pl-7' : ''}`}>
                  <div>
                    <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : b.status === 'CONFLICT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-205'
                      }`}>
                        {b.status}
                      </span>

                      {b.source === 'OFFLINE' && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <WifiOff className="w-3 h-3 text-amber-600" />
                          <span>Offline Queue</span>
                        </span>
                      )}

                      {b.recurringGroupId && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          <CalendarDays className="w-3 h-3 text-purple-600" />
                          <span>Recurring series</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900">
                      {b.resourceName || b.resource?.name || 'Cubicle Space'}
                    </h3>
                  </div>

                  {!isCancelled && (
                    <button
                      onClick={() => handleTriggerCancelSingle(b)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Cancel Booking"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className={`space-y-1.5 text-xs text-slate-600 ${!isCancelled ? 'pl-7' : ''}`}>
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

      {/* MODAL: Recurring cancellations selection (Task 3.8) */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <CalendarDays className="w-10 h-10 text-purple-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Cancel Recurring Reservation</h3>
              <p className="text-xs text-slate-500">
                This booking is part of a recurring series. How would you like to cancel it?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  executeCancel(cancelModalBooking.id, cancelModalBooking.operationId, false)
                    .then(() => {
                      setCancelModalBooking(null);
                      loadBookings();
                    });
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all"
              >
                Cancel this occurrence only
              </button>

              <button
                onClick={() => {
                  executeCancel(cancelModalBooking.id, cancelModalBooking.operationId, true)
                    .then(() => {
                      setCancelModalBooking(null);
                      loadBookings();
                    });
                }}
                className="w-full py-2.5 bg-rose-650 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all"
              >
                Cancel all future dates in series
              </button>
            </div>

            <div className="pt-2 border-t text-center">
              <button
                onClick={() => setCancelModalBooking(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-655"
              >
                Keep booking (Go back)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
