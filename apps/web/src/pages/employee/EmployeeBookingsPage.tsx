import React, { useState, useEffect, useMemo } from 'react';
import { fetchApi } from '../../services/api';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Monitor,
  CheckSquare,
  Square,
  Trash2,
  User,
} from 'lucide-react';

interface BookingRecord {
  id: string;
  organizationId: string;
  deskId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    department?: string;
  };
  desk?: {
    deskCode: string;
    deskNumber: number;
    hasHdmi: boolean;
    section?: {
      name: string;
      floor?: {
        name: string;
        code: string;
        building?: {
          name: string;
          code: string;
          branch?: {
            name: string;
            code: string;
          };
        };
      };
    };
  };
}

export const EmployeeBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<BookingRecord[]>('/employee/bookings');
      setBookings(data || []);
      setSelectedBookingIds([]);
    } catch (err: any) {
      console.error('Failed to load employee bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancelSingle = async (bookingId: string, deskId: string) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);
      await fetchApi('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({ bookingId, deskId }),
      });

      setStatusMessage({ type: 'success', text: 'Desk reservation cancelled and released.' });
      await loadBookings();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel reservation' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkCancel = async () => {
    try {
      if (selectedBookingIds.length === 0) return;
      setActionLoading(true);
      setStatusMessage(null);

      const res = await fetchApi<any>('/employee/bulk-cancel', {
        method: 'POST',
        body: JSON.stringify({ bookingIds: selectedBookingIds }),
      });

      setStatusMessage({
        type: 'success',
        text: res.message || `Successfully cancelled ${selectedBookingIds.length} desk reservation(s).`,
      });
      await loadBookings();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel selected reservations' });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectBooking = (id: string) => {
    if (selectedBookingIds.includes(id)) {
      setSelectedBookingIds(selectedBookingIds.filter((item) => item !== id));
    } else {
      setSelectedBookingIds([...selectedBookingIds, id]);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Status filter
      if (statusFilter !== 'ALL' && b.status !== statusFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const deskCode = b.desk?.deskCode?.toLowerCase() || '';
        const sectionName = b.desk?.section?.name?.toLowerCase() || '';
        const floorName = b.desk?.section?.floor?.name?.toLowerCase() || '';
        const buildingName = b.desk?.section?.floor?.building?.name?.toLowerCase() || '';
        const branchName = b.desk?.section?.floor?.building?.branch?.name?.toLowerCase() || '';
        const userName = b.user?.name?.toLowerCase() || '';
        const userEmail = b.user?.email?.toLowerCase() || '';

        return (
          deskCode.includes(q) ||
          sectionName.includes(q) ||
          floorName.includes(q) ||
          buildingName.includes(q) ||
          branchName.includes(q) ||
          userName.includes(q) ||
          userEmail.includes(q)
        );
      }

      return true;
    });
  }, [bookings, statusFilter, searchQuery]);

  const confirmedBookings = filteredBookings.filter((b) => b.status === 'CONFIRMED');
  const allConfirmedSelected =
    confirmedBookings.length > 0 &&
    confirmedBookings.every((b) => selectedBookingIds.includes(b.id));

  const toggleSelectAllConfirmed = () => {
    if (allConfirmedSelected) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(confirmedBookings.map((b) => b.id));
    }
  };

  const activeCount = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const cancelledCount = bookings.filter((b) => b.status === 'CANCELLED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-bold text-xs">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Reservation Records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto px-4 sm:px-0 py-4">
      {/* Toast Feedback */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between shadow-sm animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              PERSONAL &amp; TEAM WORKSPACE LOGS
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <span>My Desk Bookings &amp; Reservations</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                {bookings.length} Total
              </span>
            </h1>
          </div>

          {/* Action Area: Bulk Cancel & Filter Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {selectedBookingIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkCancel}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 animate-fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bulk Cancel ({selectedBookingIds.length})</span>
              </button>
            )}

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({bookings.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CONFIRMED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'CONFIRMED'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Confirmed ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'CANCELLED'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cancelled ({cancelledCount})
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by desk code (e.g. C-01), colleague name, floor, wing, building..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700">No Reservations Found</h3>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                {searchQuery
                  ? 'No bookings matched your search filter criteria.'
                  : 'You have not made any workstation bookings in this category yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-3.5 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAllConfirmed}
                      title="Select all active"
                      className="cursor-pointer text-slate-500 hover:text-slate-800"
                    >
                      {allConfirmedSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Station</th>
                  <th className="py-3.5 px-4">Reserved For</th>
                  <th className="py-3.5 px-4">Branch &amp; Building</th>
                  <th className="py-3.5 px-4">Floor &amp; Wing</th>
                  <th className="py-3.5 px-4">Hardware Setup</th>
                  <th className="py-3.5 px-4">Booking Time Window</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const isConfirmed = b.status === 'CONFIRMED';
                  const isSelected = selectedBookingIds.includes(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="py-4 px-4">
                        {isConfirmed ? (
                          <button
                            type="button"
                            onClick={() => toggleSelectBooking(b.id)}
                            className="cursor-pointer text-slate-400 hover:text-emerald-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 h-4 inline-block text-slate-200">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-mono font-black text-xs flex items-center justify-center">
                            {b.desk?.deskCode || 'D'}
                          </span>
                          <div>
                            <div className="font-black text-slate-900">Desk {b.desk?.deskCode}</div>
                            <div className="text-[10px] text-slate-400">ID: {b.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.user?.name || 'Assigned Colleague'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{b.user?.email}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">
                          {b.desk?.section?.floor?.building?.branch?.name || 'Assigned Branch'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {b.desk?.section?.floor?.building?.name || 'Main Building'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">
                          {b.desk?.section?.floor?.name || 'Floor'} ({b.desk?.section?.floor?.code})
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {b.desk?.section?.name || 'Section'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {b.desk?.hasHdmi ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900 text-emerald-400 text-[10px] font-mono font-bold">
                            <Monitor className="w-3 h-3" />
                            <span>HDMI Display</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Standard (BYOD)</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-700">
                        <div className="font-bold">
                          {new Date(b.startTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isConfirmed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isConfirmed ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-slate-400" />
                          )}
                          <span>{b.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => handleCancelSingle(b.id, b.deskId)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            Release
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
