import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Building, Users, Calendar, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const BranchAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allBookings, branchOccupancy, branchList] = await Promise.all([
        fetchApi<any[]>('/bookings'),
        user?.baseBuildingId 
          ? fetchApi<any[]>(`/buildings/${user.baseBuildingId}/occupancy`)
          : Promise.resolve([]),
        fetchApi<any[]>('/branches')
      ]);
      setBranches(branchList);
      // Filter bookings scoped to branch
      const filteredBookings = allBookings.filter(b => b.resource?.floor?.building?.branchId === user?.scopedBranchId);
      setBookings(filteredBookings);
      setOccupancy(branchOccupancy);
    } catch (e) {
      console.warn('Failed to load branch admin dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await fetchApi(`/bookings/${bookingId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel reservation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Loading Scoped Branch Dashboard...
      </div>
    );
  }

  const activeReservationsCount = bookings.filter(b => b.status === 'CONFIRMED').length;
  const activeBranch = branches.find(b => b.id === user?.scopedBranchId);
  const activeBranchName = activeBranch ? activeBranch.name : 'Local Office';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-emerald-800 text-white rounded-2xl p-6 shadow-xl">
        <span className="px-3 py-1 bg-white/20 text-emerald-100 rounded-full text-xs font-bold border border-white/10 inline-block mb-3">
          Branch Administrator &bull; {activeBranchName}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-emerald-105 text-xs mt-1.5 max-w-2xl leading-relaxed">
          You are the manager for the <strong>{activeBranchName}</strong>. Monitor local occupancy and manage desks and employee rosters using the admin portal.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeReservationsCount}</div>
            <div className="text-xs font-medium text-slate-500">Active Bookings in Branch</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{occupancy.length}</div>
            <div className="text-xs font-medium text-slate-500">Employees in Branch Today</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Local Bookings */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-black text-slate-800">Branch Reservations History</h2>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[350px]">
            {bookings.slice(0, 8).map(b => (
              <div key={b.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-extrabold text-slate-850">
                    {b.user?.name} &bull; <span className="font-mono text-xs text-slate-500">{b.resource?.code}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(b.startAt).toLocaleDateString()} &bull; {b.sessionType || 'Full Day'}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    b.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-650'
                  }`}>
                    {b.status}
                  </span>
                  {b.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      className="p-1 text-slate-400 hover:text-rose-650 rounded"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {bookings.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs italic">
                No local branch bookings found.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Local Quick Portal links */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-800">Branch Management Actions</h3>
            
            <div className="space-y-2.5">
              <button
                onClick={() => navigate('/admin/buildings')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-black text-slate-850">Drag-and-Drop Floor Editor</div>
                  <div className="text-slate-450 text-[10px] mt-0.5">Edit layouts & arrange desks visually</div>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/admin/roster')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-black text-slate-850">Employee Roster</div>
                  <div className="text-slate-450 text-[10px] mt-0.5">Import CSV lists & manage employees</div>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Occupancy Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
            <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Who is in the office today</span>
            </h3>

            <div className="overflow-y-auto space-y-2.5 max-h-[220px]">
              {occupancy.map((occ: any, idx: number) => (
                <div key={occ.id || idx} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{occ.user?.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{occ.user?.department || 'Staff'}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-750 font-black text-[10px] border border-emerald-100 rounded-lg">
                    {occ.resource?.name}
                  </span>
                </div>
              ))}

              {occupancy.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-6 italic">
                  Nobody is booked today.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
