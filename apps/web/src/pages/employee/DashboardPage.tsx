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
  Users
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/indexedDB';
import { fetchApi } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';

export const DashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [onlineBookings, setOnlineBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [occupancy, setOccupancy] = useState<any[]>([]);
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);

  // One-time base branch selection states (Task 4.6)
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [selectedBranchModalId, setSelectedBranchModalId] = useState('');
  const [submittingBranch, setSubmittingBranch] = useState(false);

  // Live Dexie local bookings & pending outbox
  const localBookings = useLiveQuery(() => db.localBookings.toArray(), []);
  const pendingOutbox = useLiveQuery(() => db.outbox.where('status').equals('PENDING').count(), []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      if (navigator.onLine) {
        const data = await fetchApi<any[]>('/bookings');
        setOnlineBookings(data);
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

  const fetchBuildings = async () => {
    try {
      if (navigator.onLine) {
        const data = await fetchApi<any[]>('/buildings');
        setBuildings(data);
        if (data.length > 0 && !selectedBuildingId) {
          const defaultB = data.find((b: any) => b.id === user?.baseBuildingId) || data[0];
          setSelectedBuildingId(defaultB.id);
        }
      } else {
        const cached = await db.buildings.toArray();
        setBuildings(cached);
        if (cached.length > 0 && !selectedBuildingId) {
          const defaultB = cached.find((b: any) => b.id === user?.baseBuildingId) || cached[0];
          setSelectedBuildingId(defaultB.id);
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const fetchOccupancy = async () => {
    if (!selectedBuildingId) return;
    try {
      setLoadingOccupancy(true);
      if (navigator.onLine) {
        const data = await fetchApi<any[]>(`/buildings/${selectedBuildingId}/occupancy`);
        setOccupancy(data);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        const bldName = buildings.find(b => b.id === selectedBuildingId)?.name || '';
        const localToday = (localBookings || []).filter((b: any) => {
          return b.status === 'CONFIRMED' && 
                 b.startAt.startsWith(todayStr) && 
                 (b.buildingName === bldName || !bldName);
        });
        const mapped = localToday.map((b: any) => ({
          id: b.id,
          user: { name: b.userName || 'Colleague', department: 'Staff' },
          resource: { name: b.resourceName || 'Desk' }
        }));
        setOccupancy(mapped);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingOccupancy(false);
    }
  };

  const fetchBranches = async () => {
    try {
      if (navigator.onLine) {
        const data = await fetchApi<any[]>('/branches');
        setBranchesList(data);
        await db.branches.clear();
        for (const b of data) {
          await db.branches.put(b);
        }
      } else {
        const cached = await db.branches.toArray();
        setBranchesList(cached);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchBuildings();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (user && !user.baseBranchId) {
      setBranchModalOpen(true);
    } else {
      setBranchModalOpen(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOccupancy();
  }, [selectedBuildingId, localBookings, buildings]);

  const handleSelectBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchModalId) return;

    try {
      setSubmittingBranch(true);
      if (navigator.onLine) {
        await fetchApi('/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({ baseBranchId: selectedBranchModalId }),
        });
        await refreshUser();
      } else {
        await syncEngine.queueProfileUpdateOperation(selectedBranchModalId);
        await refreshUser();
      }
      setBranchModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update base branch.');
    } finally {
      setSubmittingBranch(false);
    }
  };

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

  const activeBuildingName = buildings.find(b => b.id === user?.baseBuildingId)?.name || 'HQ Building';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div className="max-w-2xl">
          <span className="px-3 py-1 bg-emerald-500/30 text-emerald-100 rounded-full text-xs font-bold border border-emerald-400/20 inline-block mb-3">
            Offline-First SaaS • {tenant?.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
            Reserve hot desks, cubicles, and meeting rooms with automatic offline sync. Your active base building is set to {activeBuildingName}.
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
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Today's Assignment</div>
              <h3 className="text-lg font-bold text-slate-800">
                {upcomingToday.resourceName || upcomingToday.resource?.name || 'Reserved Desk'}
              </h3>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{upcomingToday.buildingName || 'Office'}</span>
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
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-850 border border-emerald-200">
            {upcomingToday.status}
          </span>
        </div>
      )}

      {/* KPI Cards */}
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
            <div className="text-sm font-bold text-slate-900 truncate">{activeBuildingName}</div>
            <div className="text-xs font-medium text-slate-500">Assigned Base Office</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Reservations & Occupancy (Task 4.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">Your Recent Desk Reservations</h2>
            <Link to="/my-bookings" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              View All →
            </Link>
          </div>
          {allBookings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs flex-1 flex flex-col justify-center items-center">
              No desk reservations found yet. Click "Book a Space Now" to reserve a cubicle!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto flex-1">
              {allBookings.slice(0, 5).map((b: any) => (
                <div key={b.id || b.operationId} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      b.status === 'CONFIRMED' ? 'bg-emerald-500' : b.status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <div>
                      <div className="text-sm font-bold text-slate-850">
                        {b.resourceName || b.resource?.name || 'Cubicle Space'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(b.startAt).toLocaleDateString()} • {new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      b.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {b.status}
                    </span>
                    {b.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleCancelBooking(b.id, b.operationId)}
                        className="p-1 text-slate-400 hover:text-rose-650 rounded transition-colors"
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

        {/* Occupancy Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Who's in office today</span>
            </h3>
            {buildings.length > 0 && (
              <select
                value={selectedBuildingId}
                onChange={e => setSelectedBuildingId(e.target.value)}
                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none"
              >
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[250px]">
            {loadingOccupancy ? (
              <div className="text-center text-xs text-slate-400 py-6">Loading occupancy...</div>
            ) : occupancy.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">Nobody is booked today.</div>
            ) : (
              occupancy.map((occ: any, i: number) => (
                <div key={occ.id || i} className="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{occ.user?.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{occ.user?.department || 'Staff'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-750 font-black text-[10px] border border-emerald-100">
                    {occ.resource?.name}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {branchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSelectBranch} className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                <Building className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-base font-black text-slate-800">Assign Your Base Branch Office</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select your home base branch office. We will use this location to search for available desks and cubicles.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Branch Location</label>
              <select
                required
                value={selectedBranchModalId}
                onChange={e => setSelectedBranchModalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-805 focus:outline-none"
              >
                <option value="">-- Choose Branch --</option>
                {branchesList.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingBranch || !selectedBranchModalId}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-350 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
            >
              {submittingBranch ? 'Saving...' : 'Confirm Base Office'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
