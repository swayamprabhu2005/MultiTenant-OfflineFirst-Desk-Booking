import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  CalendarPlus,
  Building,
  CheckCircle2,
  Clock,
  WifiOff,
  MapPin,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { fetchApi } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [onlineBookings, setOnlineBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Live Dexie local bookings & pending outbox
  const localBookings = useLiveQuery(() => db.localBookings.toArray(), []);
  const pendingOutbox = useLiveQuery(() => db.outbox.where('status').equals('PENDING').count(), []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      if (navigator.onLine) {
        const data = await fetchApi<any[]>('/bookings');
        setOnlineBookings(data);
        // Sync online bookings to Dexie IndexedDB
        for (const b of data) {
          await db.localBookings.put({
            id: b.id,
            organizationId: b.organizationId,
            resourceId: b.resourceId,
            resourceName: b.resource?.name || 'Cubicle',
            buildingName: b.resource?.floor?.building?.name || 'Office',
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
      console.warn('Could not fetch online bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string, operationId: string) => {
    if (!confirm('Are you sure you want to cancel this booking reservation?')) return;

    if (navigator.onLine) {
      try {
        await fetchApi(`/bookings/${bookingId}`, { method: 'DELETE' });
        fetchBookings();
      } catch (err: any) {
        alert(err.message || 'Failed to cancel booking');
      }
    } else {
      await syncEngine.queueCancelOperation(bookingId, operationId || `CANCEL-${Date.now()}`, tenant?.id || '');
    }
  };

  // Combine online & local bookings (filtering duplicates by id/operationId)
  const allBookingsMap = new Map();
  (localBookings || []).forEach(b => allBookingsMap.set(b.operationId || b.id, b));
  (onlineBookings || []).forEach(b => allBookingsMap.set(b.operationId || b.id, b));

  const allBookings = Array.from(allBookingsMap.values()).sort(
    (a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
  );

  const activeBookings = allBookings.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING');
  const upcomingToday = activeBookings.find((b: any) => {
    const today = new Date().toISOString().split('T')[0];
    return b.startAt.startsWith(today);
  });

  return (
    <div className="space-y-6">

      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="px-3 py-1 bg-emerald-500/30 text-emerald-100 rounded-full text-xs font-bold border border-emerald-400/20 inline-block mb-3">
            Offline-First SaaS • {tenant?.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
            Reserve hot desks, cubicles, and meeting rooms with automatic offline sync. Your active base building is set to HQ Tower.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/book')}
              className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2 transition-all"
            >
              <CalendarPlus className="w-4 h-4 text-emerald-600" />
              <span>Book a Space Now</span>
            </button>
            <button
              onClick={() => navigate('/sync-center')}
              className="px-4 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl border border-emerald-500/30 flex items-center space-x-2 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-emerald-200" />
              <span>Sync Center ({pendingOutbox || 0})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Today Desk Highlight */}
      {upcomingToday && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Today's Desk Assignment
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {upcomingToday.resourceName || upcomingToday.resource?.name || 'Reserved Desk'}
              </h3>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{upcomingToday.buildingName || 'HQ Tower'}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(upcomingToday.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {new Date(upcomingToday.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            upcomingToday.status === 'CONFIRMED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {upcomingToday.status}
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeBookings.length}</div>
            <div className="text-xs font-medium text-slate-500">Active Reservations</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <WifiOff className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{pendingOutbox || 0}</div>
            <div className="text-xs font-medium text-slate-500">Pending Sync Items</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 truncate">HQ Tower</div>
            <div className="text-xs font-medium text-slate-500">Assigned Base Office</div>
          </div>
        </div>

      </div>

      {/* Recent Reservations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Your Recent Desk Reservations</h2>
          <Link to="/my-bookings" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
            View All →
          </Link>
        </div>

        {allBookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No desk reservations found yet. Click "Book a Space Now" to reserve a cubicle!
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {allBookings.slice(0, 5).map((b: any) => (
              <div key={b.id || b.operationId} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center space-x-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    b.status === 'CONFIRMED' ? 'bg-emerald-500' : b.status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {b.resourceName || b.resource?.name || 'Cubicle Space'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(b.startAt).toLocaleDateString()} • {new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    b.status === 'CONFIRMED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : b.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {b.status}
                  </span>

                  {b.status !== 'CANCELLED' && (
                    <button
                      onClick={() => handleCancelBooking(b.id, b.operationId)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Cancel Booking"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
