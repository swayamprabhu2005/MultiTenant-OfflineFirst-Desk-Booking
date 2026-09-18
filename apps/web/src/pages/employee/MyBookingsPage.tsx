import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  cacheMyBookings,
  getCachedMyBookings,
  getPendingOutboxItems,
  isAppOnline,
  syncOutboxQueue,
  OutboxItem,
} from '../../services/offlineStore';
import {
  Calendar,
  Clock,
  MapPin,
  Monitor,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  X,
  Trash2,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Loader2,
  Building2,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export interface BookingDesk {
  id: string;
  deskCode: string;
  hasHdmi: boolean;
  isMeetingRoom?: boolean;
  sectionName: string;
  floorCode: string;
  floorName: string;
  buildingName: string;
  branchName: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface BookingRecord {
  id: string;
  slotType: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  desk: BookingDesk;
  isProxyBooking: boolean;
  user: UserSummary;
  bookedByUser?: UserSummary | null;
}

export interface MyBookingsResponse {
  bookings: BookingRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const orgColor = tenant?.themeColor || user?.organization?.themeColor || '#16a34a';
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PAST' | 'QUEUED'>('ALL');
  const [queuedItems, setQueuedItems] = useState<OutboxItem[]>([]);
  const [isSyncingQueued, setIsSyncingQueued] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Cancellation State
  const [cancellingBooking, setCancellingBooking] = useState<BookingRecord | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Bulk Multi-Select Cancellation State
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isBulkCancelling, setIsBulkCancelling] = useState<boolean>(false);

  // Notices
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const loadQueuedItems = async () => {
    try {
      const items = await getPendingOutboxItems();
      const bookingItems = items.filter((i) =>
        ['CREATE_BOOKING', 'BULK_BOOKING', 'CANCEL_BOOKING'].includes(i.action)
      );
      setQueuedItems(bookingItems);
    } catch {
      setQueuedItems([]);
    }
  };

  const handleSyncQueued = async () => {
    if (!isAppOnline() || isSyncingQueued) return;
    try {
      setIsSyncingQueued(true);
      const result = await syncOutboxQueue();
      if (result.synced > 0) {
        setSuccessNotice(`Successfully synchronized ${result.synced} offline transaction(s) with the server!`);
        setTimeout(() => setSuccessNotice(null), 5000);
      }
      await loadQueuedItems();
      await loadBookings();
    } catch (err: any) {
      console.error('Failed to sync queue:', err);
      setErrorNotice(err.message || 'Synchronization failed.');
    } finally {
      setIsSyncingQueued(false);
    }
  };

  const loadBookings = async () => {
    await loadQueuedItems();

    if (!isAppOnline()) {
      if (user?.id) {
        const cached = await getCachedMyBookings(user.id);
        if (cached && cached.length > 0) {
          setBookings(cached);
          setTotalCount(cached.length);
          setTotalPages(1);
          setErrorNotice('Operating in Offline Mode — viewing cached bookings.');
          setLoading(false);
          return;
        }
      }
    }

    try {
      setLoading(true);
      setErrorNotice(null);

      const params = new URLSearchParams({
        status: statusFilter === 'QUEUED' ? 'ALL' : statusFilter,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetchApi<MyBookingsResponse>(`/employee/my-bookings?${params.toString()}`);
      const serverBookings = res?.bookings || [];
      setBookings(serverBookings);
      setTotalPages(res?.pagination?.totalPages || 1);
      setTotalCount(res?.pagination?.total || 0);

      if (user?.id && serverBookings.length > 0 && statusFilter === 'ALL') {
        cacheMyBookings(user.id, serverBookings);
      }
    } catch (err: any) {
      console.error('Failed to load my bookings:', err);
      if (user?.id) {
        const cached = await getCachedMyBookings(user.id);
        if (cached && cached.length > 0) {
          setBookings(cached);
          setTotalCount(cached.length);
          setTotalPages(1);
          setErrorNotice('Network unavailable — viewing cached bookings.');
        } else {
          setErrorNotice(err.message || 'Unable to load your bookings history.');
        }
      } else {
        setErrorNotice(err.message || 'Unable to load your bookings history.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedBookingIds([]);
    loadBookings();
  }, [statusFilter, page]);

  useEffect(() => {
    const handleOutboxChange = () => {
      loadQueuedItems();
    };
    window.addEventListener('offline-outbox-updated', handleOutboxChange);
    window.addEventListener('offline-sync-completed', handleOutboxChange);
    return () => {
      window.removeEventListener('offline-outbox-updated', handleOutboxChange);
      window.removeEventListener('offline-sync-completed', handleOutboxChange);
    };
  }, []);

  // Handle Bulk Multi-Select Cancellation
  const handleBulkCancel = async () => {
    if (selectedBookingIds.length === 0) return;

    try {
      setIsBulkCancelling(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string; cancelledCount: number }>(
        '/employee/bulk-cancel',
        {
          method: 'POST',
          body: JSON.stringify({
            bookingIds: selectedBookingIds,
          }),
        }
      );

      setSuccessNotice(
        res?.message || `Successfully released ${selectedBookingIds.length} desk reservation(s).`
      );
      setTimeout(() => setSuccessNotice(null), 5000);

      setSelectedBookingIds([]);
      await loadBookings();
    } catch (err: any) {
      console.error('Failed to cancel selected bookings:', err);
      setErrorNotice(err.message || 'Failed to cancel selected bookings.');
    } finally {
      setIsBulkCancelling(false);
    }
  };

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;

    try {
      setIsSubmittingCancel(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: cancellingBooking.id,
          reason: cancellationReason.trim() || 'Cancelled from My Bookings portal',
        }),
      });

      setSuccessNotice(
        res?.message || `Reservation for Desk ${cancellingBooking.desk.deskCode} successfully cancelled.`
      );
      setTimeout(() => setSuccessNotice(null), 5000);

      setCancellingBooking(null);
      setCancellationReason('');
      await loadBookings();
    } catch (err: any) {
      console.error('Failed to cancel reservation:', err);
      setErrorNotice(err.message || 'Failed to cancel reservation.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Filter in-memory search
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.desk.deskCode.toLowerCase().includes(q) ||
      b.desk.branchName.toLowerCase().includes(q) ||
      b.desk.buildingName.toLowerCase().includes(q) ||
      b.desk.sectionName.toLowerCase().includes(q) ||
      b.notes?.toLowerCase().includes(q) ||
      b.user.name.toLowerCase().includes(q)
    );
  });

  const isBookingActive = (b: BookingRecord) => {
    return b.status === 'CONFIRMED' && new Date(b.endTime).getTime() >= Date.now();
  };

  const isBookingPast = (b: BookingRecord) => {
    return b.status === 'CONFIRMED' && new Date(b.endTime).getTime() < Date.now();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 max-w-2xl relative z-10">
          <div
            style={{ color: orgColor }}
            className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reservation Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            My Desk Reservations
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Review your workstation booking schedule, track team proxy reservations, and manage cancellations with real-time audit verification.
          </p>
        </div>

        <div className="flex items-center space-x-3 relative z-10">
          <Link
            to="/employee/floor-plan"
            style={{ backgroundColor: orgColor }}
            className="px-5 py-3 rounded-2xl text-white text-xs font-black shadow-lg flex items-center space-x-2 hover:opacity-95 transition-all cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            <span>New Workstation Booking</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Success Alert */}
      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-medium animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="p-1 text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Offline Outbox Notice */}
      {queuedItems.length > 0 && statusFilter !== 'QUEUED' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs font-medium animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
            <span>
              You have <strong>{queuedItems.length}</strong> offline desk reservation action(s) queued in local storage waiting to sync.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('QUEUED')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center space-x-1"
          >
            <span>View Queued</span>
            <span className="bg-amber-800/60 px-1.5 py-0.2 rounded-full text-[10px]">{queuedItems.length}</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Bookings
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('CONFIRMED');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'CONFIRMED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Upcoming &amp; Active
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('PAST');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'PAST'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Completed Past
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('QUEUED');
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              statusFilter === 'QUEUED'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Queued / Sync Pending</span>
            {queuedItems.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  statusFilter === 'QUEUED' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200 text-amber-900'
                }`}
              >
                {queuedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, branch, note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadBookings}
            title="Refresh List"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bookings Table / Card List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {statusFilter === 'QUEUED' ? (
          queuedItems.length === 0 ? (
            <div className="text-center py-20 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Pending Offline Reservations</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All your desk reservations are currently synchronized with the server database.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">
                      {queuedItems.length} Offline Transaction(s) Queued in Local Storage
                    </h4>
                    <p className="text-[11px] text-amber-700">
                      Created while operating offline. Click Sync Now or reconnect to synchronize.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isAppOnline() || isSyncingQueued}
                  onClick={handleSyncQueued}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center space-x-2 transition-all cursor-pointer ${
                    !isAppOnline()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isSyncingQueued ? 'animate-spin' : ''}`} />
                  <span>{isSyncingQueued ? 'Syncing...' : isAppOnline() ? 'Sync Now' : 'Offline'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Action Type</th>
                      <th className="py-3.5 px-5">Workstation Details</th>
                      <th className="py-3.5 px-5">Requested Date(s)</th>
                      <th className="py-3.5 px-5">Queued At</th>
                      <th className="py-3.5 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {queuedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-mono text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300">
                            {item.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-800">
                            {item.payload?.deskCode ? `Desk ${item.payload.deskCode}` : item.payload?.deskId ? `Desk ID: ${item.payload.deskId.substring(0, 8)}...` : item.payload?.deskIds ? `${item.payload.deskIds.length} Desks (Bulk)` : 'Reservation'}
                          </div>
                          {item.payload?.notes && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Note: {item.payload.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center space-x-1.5 text-slate-600 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {Array.isArray(item.payload?.bookingDates)
                                ? item.payload.bookingDates.join(', ')
                                : item.payload?.date || 'Today'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Slot: {item.payload?.slotType ? item.payload.slotType.replace('_', ' ') : 'Full Day'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-500 font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Sync Pending</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-500">Retrieving Reservation History...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No Reservations Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You do not have any desk reservations matching the selected filter criteria.
            </p>
            <div className="pt-2">
              <Link
                to="/employee/floor-plan"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                <span>Reserve a Desk Now</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      title="Select All Active on Page"
                      checked={
                        filteredBookings.filter(isBookingActive).length > 0 &&
                        filteredBookings.filter(isBookingActive).every((b) => selectedBookingIds.includes(b.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const activeIds = filteredBookings.filter(isBookingActive).map((b) => b.id);
                          setSelectedBookingIds(activeIds);
                        } else {
                          setSelectedBookingIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-5">Workstation</th>
                  <th className="py-3.5 px-5">Location Hierarchy</th>
                  <th className="py-3.5 px-5">Date &amp; Time Slot</th>
                  <th className="py-3.5 px-5">Booking Recipient</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBookings.map((b) => {
                  const active = isBookingActive(b);
                  const past = isBookingPast(b);
                  const isOwner = b.user.id === user?.id;

                  const dateFormatted = new Date(b.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Selection Checkbox */}
                      <td className="py-4 px-4 text-center">
                        {active ? (
                          <input
                            type="checkbox"
                            checked={selectedBookingIds.includes(b.id)}
                            onChange={() => {
                              setSelectedBookingIds((prev) =>
                                prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                              );
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300">&bull;</span>
                        )}
                      </td>

                      {/* Workstation Desk Code */}
                      <td className="py-4 px-5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                            {b.desk.deskCode}
                          </span>
                          {b.desk.hasHdmi && (
                            <span title="HDMI Equipped Monitor" className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                              <Monitor className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {b.desk.isMeetingRoom && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                              Meeting Seat
                            </span>
                          )}
                        </div>
                        {b.notes && (
                          <span className="text-[10px] text-slate-400 block mt-1 truncate max-w-xs" title={b.notes}>
                            Note: {b.notes}
                          </span>
                        )}
                      </td>

                      {/* Location Hierarchy */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-800 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span>{b.desk.branchName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Layers className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <span>
                            {b.desk.buildingName} &bull; {b.desk.floorName} &bull; {b.desk.sectionName}
                          </span>
                        </div>
                      </td>

                      {/* Date & Time Slot */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateFormatted}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{b.slotType.replace('_', ' ')}</span>
                        </div>
                      </td>

                      {/* Booking Recipient / Proxy Details */}
                      <td className="py-4 px-5">
                        {isOwner ? (
                          b.bookedByUser && b.bookedByUser.id !== user?.id ? (
                            <div>
                              <span className="font-bold text-slate-800 block">Myself</span>
                              <span className="text-[10px] text-purple-700 font-medium">
                                Booked by {b.bookedByUser.name}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800 block">Myself</span>
                              <span className="text-[10px] text-slate-400">Direct Reservation</span>
                            </div>
                          )
                        ) : (
                          <div>
                            <span className="font-bold text-purple-900 block flex items-center space-x-1">
                              <Users className="w-3 h-3 text-purple-600" />
                              <span>{b.user.name} (Proxy)</span>
                            </span>
                            <span className="text-[10px] text-slate-400">{b.user.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        {b.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Cancelled</span>
                          </span>
                        ) : active ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Confirmed Active</span>
                          </span>
                        ) : past ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Completed Past</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                            <span>Confirmed</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right">
                        {active ? (
                          <button
                            type="button"
                            onClick={() => setCancellingBooking(b)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Release</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {statusFilter !== 'QUEUED' && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page <span className="font-bold text-slate-700">{page}</span> of{' '}
              <span className="font-bold text-slate-700">{totalPages}</span> ({totalCount} total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Release Desk Reservation</h3>
                  <p className="text-xs text-slate-400">Cancel workstation booking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Desk Code:</span>
                <span className="font-extrabold text-slate-900 font-mono">
                  {cancellingBooking.desk.deskCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Date &amp; Slot:</span>
                <span className="font-extrabold text-slate-800">
                  {new Date(cancellingBooking.startTime).toISOString().split('T')[0]} (
                  {cancellingBooking.slotType.replace('_', ' ')})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Branch Facility:</span>
                <span className="font-extrabold text-slate-800">
                  {cancellingBooking.desk.branchName}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Change in schedule, working remotely..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Keep Reservation
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCancel ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Releasing Workstation...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Release</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Multi-Select Cancellation Action Bar */}
      {selectedBookingIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[110] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-6 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-xl bg-rose-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
              {selectedBookingIds.length}
            </span>
            <span className="text-xs font-bold">Bookings Selected</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleBulkCancel}
              disabled={isBulkCancelling}
              className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isBulkCancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Releasing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancel Selected ({selectedBookingIds.length})</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelectedBookingIds([])}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
