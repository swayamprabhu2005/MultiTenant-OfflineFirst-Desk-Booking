import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../services/api';
import {
  MapPin,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  Sparkles,
  ArrowRight,
  Monitor,
  Zap,
  ShieldAlert,
  X,
  Check,
  UserCheck,
} from 'lucide-react';

interface DeskItem {
  id: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
  status: 'AVAILABLE' | 'BOOKED';
  isMyBooking?: boolean;
  bookingId?: string | null;
}

interface SectionItem {
  id: string;
  name: string;
  direction: string;
  standardDeskCount: number;
  hdmiDeskCount: number;
  desks: DeskItem[];
  meetingRoom?: any;
}

interface FloorItem {
  id: string;
  code: string;
  floorNumber: number;
  name: string;
  sections: SectionItem[];
}

interface BuildingItem {
  id: string;
  code: string;
  name: string;
  floors: FloorItem[];
}

interface BranchItem {
  id: string;
  code: string;
  name: string;
  address?: string;
  buildings: BuildingItem[];
}

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hierarchy Selection State for Quick Floor Plan
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Selected Desk for Booking Drawer
  const [activeDesk, setActiveDesk] = useState<DeskItem | null>(null);

  // Booking Slot & Proxy State
  const [bookForMode, setBookForMode] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [colleagueSearch, setColleagueSearch] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const branchLabel = user?.scopedBranch?.name || user?.baseBranch?.name || summary?.assignedBranch?.name || 'Assigned Branch';

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, floorPlansRes, colleaguesRes] = await Promise.all([
        fetchApi<any>('/employee/dashboard-summary'),
        fetchApi<BranchItem[]>('/employee/floor-plans'),
        fetchApi<any[]>('/employee/colleagues'),
      ]);

      setSummary(summaryRes);
      setBranches(floorPlansRes || []);
      setColleagues(colleaguesRes || []);

      if (floorPlansRes && floorPlansRes.length > 0) {
        const firstBranch = floorPlansRes[0];
        setSelectedBranchId(firstBranch.id);

        if (firstBranch.buildings.length > 0) {
          const firstBld = firstBranch.buildings[0];
          setSelectedBuildingId(firstBld.id);

          if (firstBld.floors.length > 0) {
            const firstFl = firstBld.floors[0];
            setSelectedFloorId(firstFl.id);

            if (firstFl.sections.length > 0) {
              setSelectedSectionId(firstFl.sections[0].id);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const currentBuilding = currentBranch?.buildings.find((bld) => bld.id === selectedBuildingId) || currentBranch?.buildings[0];
  const currentFloor = currentBuilding?.floors.find((fl) => fl.id === selectedFloorId) || currentBuilding?.floors[0];
  const currentSection = currentFloor?.sections.find((sec) => sec.id === selectedSectionId) || currentFloor?.sections[0];

  const filteredColleagues = colleagues.filter(
    (c) =>
      c.name.toLowerCase().includes(colleagueSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(colleagueSearch.toLowerCase())
  );

  const handleBookDeskWithSlot = async (deskId: string) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);

      const baseDate = new Date(selectedDate);
      let startTime = new Date(baseDate);
      let endTime = new Date(baseDate);

      if (selectedSlot === 'MORNING') {
        // Half Day Morning: 9:00 AM - 1:30 PM (4.5 Hours)
        startTime.setHours(9, 0, 0, 0);
        endTime.setHours(13, 30, 0, 0);
      } else if (selectedSlot === 'AFTERNOON') {
        // Half Day Afternoon: 1:30 PM - 6:00 PM (4.5 Hours)
        startTime.setHours(13, 30, 0, 0);
        endTime.setHours(18, 0, 0, 0);
      } else {
        // Full Day: 9:00 AM - 6:00 PM (9 Hours)
        startTime.setHours(9, 0, 0, 0);
        endTime.setHours(18, 0, 0, 0);
      }

      const payload: any = {
        deskId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      if (bookForMode === 'COLLEAGUE' && targetUserId) {
        payload.targetUserId = targetUserId;
      }

      await fetchApi('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const assigneeName =
        bookForMode === 'COLLEAGUE' && targetUserId
          ? colleagues.find((c) => c.id === targetUserId)?.name || 'Colleague'
          : 'You';

      setStatusMessage({
        type: 'success',
        text: `Workstation ${activeDesk?.deskCode} successfully booked for ${assigneeName} on ${new Date(selectedDate).toLocaleDateString()} (${selectedSlot === 'FULL_DAY' ? 'Full Day • 9 Hrs' : 'Half Day • 4.5 Hrs'})!`,
      });
      setActiveDesk(null);
      await loadDashboardData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to book desk' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId?: string, deskId?: string) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);
      await fetchApi('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({ bookingId, deskId }),
      });

      setStatusMessage({ type: 'success', text: 'Desk reservation cancelled and released.' });
      setActiveDesk(null);
      await loadDashboardData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel reservation' });
    } finally {
      setActionLoading(false);
    }
  };

  // Floor plan pod geometry calculations
  const desks = currentSection?.desks || [];
  const podSize = 4;
  const podClusters: DeskItem[][] = [];
  for (let i = 0; i < desks.length; i += podSize) {
    podClusters.push(desks.slice(i, i + podSize));
  }
  const totalPods = podClusters.length;

  const totalHdmiCount = desks.filter((d) => d.hasHdmi).length;
  const baseHdmiPerPod = totalPods > 0 ? Math.floor(totalHdmiCount / totalPods) : 0;
  const remainderHdmi = totalPods > 0 ? totalHdmiCount % totalPods : 0;

  const isDeskHdmi = (pIdx: number, slotIdx: number): boolean => {
    const alloc = baseHdmiPerPod + (pIdx < remainderHdmi ? 1 : 0);
    if (alloc === 1) return slotIdx === 0;
    if (alloc === 2) return slotIdx === 0 || slotIdx === 3;
    if (alloc === 3) return slotIdx !== 2;
    if (alloc >= 4) return true;
    return false;
  };

  const renderPod = (podIdx: number, title: string) => {
    const podDesks = podClusters[podIdx] || [];
    if (podDesks.length === 0) return null;

    return (
      <div
        key={podIdx}
        className="bg-slate-50/90 p-3 rounded-2xl border-2 border-slate-300 shadow-xs flex flex-col justify-between transition-all"
      >
        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 mb-2">
          <span>{title}</span>
          <span className="text-slate-400">{podDesks.length}/4 STATIONS</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {podDesks.map((desk, slotIdx) => {
            const hasHdmi = isDeskHdmi(podIdx, slotIdx);
            const isAvailable = desk.status === 'AVAILABLE';
            const isMyBooking = desk.isMyBooking;
            const isSelected = activeDesk?.id === desk.id;

            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => setActiveDesk({ ...desk, hasHdmi })}
                className={`h-14 rounded-xl border-2 font-bold p-1 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
                  isSelected
                    ? 'ring-3 ring-blue-500 scale-105 z-10'
                    : 'hover:scale-102 hover:shadow-sm'
                } ${
                  isMyBooking
                    ? 'bg-blue-100/90 border-blue-500 text-blue-900 ring-2 ring-blue-400/50'
                    : isAvailable
                    ? 'bg-emerald-100/90 border-emerald-400 text-emerald-900 hover:bg-emerald-200'
                    : 'bg-rose-100/90 border-rose-300 text-rose-800 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-[11px] font-black">{desk.deskCode}</span>
                  {isMyBooking && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" title="Your Booked Desk" />
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {hasHdmi ? (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                      HDMI
                    </span>
                  ) : (
                    <span className="text-[8px] text-slate-500 font-mono">STD</span>
                  )}
                  {isMyBooking && (
                    <span className="text-[8px] px-1 py-0.2 rounded bg-blue-600 text-white font-mono font-bold">
                      YOU
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {Array.from({ length: Math.max(0, 4 - podDesks.length) }).map((_, phIdx) => (
            <div
              key={`ph-${phIdx}`}
              className="h-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-100/50 flex items-center justify-center text-[9px] text-slate-300 font-mono"
            >
              EMPTY
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28 text-slate-500 font-bold text-xs">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Employee Workspace...</span>
        </div>
      </div>
    );
  }

  const activeBooking = summary?.activeBooking;
  const branchStats = summary?.branchStats || {
    totalDesks: 0,
    availableDesks: 0,
    occupiedDesks: 0,
    meetingRoomCount: 0,
  };

  const occupancyRate =
    branchStats.totalDesks > 0
      ? Math.round((branchStats.occupiedDesks / branchStats.totalDesks) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto px-4 sm:px-0 py-4">
      {/* Toast Notification */}
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

      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Employee Portal</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {getGreeting()}, {user?.name?.split(' ')[0] || 'Team Member'}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Welcome to your digital workstation dashboard. View interactive 2D floor plans, reserve available desks in{' '}
              <span className="font-bold text-emerald-400">{branchLabel}</span>, and manage your office bookings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/employee/floor-plans"
              className="py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center space-x-2 transition-all"
            >
              <MapPin className="w-4 h-4" />
              <span>Explore Floor Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/employee/bookings"
              className="py-3 px-5 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold rounded-xl backdrop-blur-xs transition-all flex items-center space-x-2"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>My Bookings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Active Desk Card + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Desk Reservation Card */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Current Reservation</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeBooking
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {activeBooking ? '● ACTIVE TODAY' : 'NONE ACTIVE'}
              </span>
            </div>

            {activeBooking ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center space-x-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-emerald-600/20">
                    {activeBooking.desk?.deskCode || 'DESK'}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-black text-slate-900">
                      Workstation {activeBooking.desk?.deskCode}
                    </div>
                    <div className="text-xs text-slate-600 font-semibold">
                      {activeBooking.desk?.section?.floor?.name || 'Floor'} • {activeBooking.desk?.section?.name || 'Section'}
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium">
                      {activeBooking.desk?.hasHdmi ? '🖥️ HDMI Display Included' : 'Standard Workstation'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Branch:</span>
                    <span className="font-bold text-slate-800">
                      {activeBooking.desk?.section?.floor?.building?.branch?.name || branchLabel}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Building:</span>
                    <span className="font-bold text-slate-800">
                      {activeBooking.desk?.section?.floor?.building?.name || 'Main Building'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Time Window:</span>
                    <span className="font-bold text-slate-800 font-mono text-[11px]">
                      {new Date(activeBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700">No Active Desk Booked</h3>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                    You do not have a desk reserved right now. Select an available cubicle from the floor plan below.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            {activeBooking ? (
              <button
                type="button"
                onClick={() => handleCancelBooking(activeBooking.id, activeBooking.deskId)}
                disabled={actionLoading}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{actionLoading ? 'Releasing Desk...' : 'Release / Cancel Desk Booking'}</span>
              </button>
            ) : (
              <Link
                to="/employee/floor-plans"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <span>Browse Available Desks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* 3 Facility Metric Widgets */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Available Desks Widget */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <Monitor className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {branchStats.availableDesks}{' '}
                <span className="text-xs font-semibold text-slate-400">/ {branchStats.totalDesks}</span>
              </div>
              <div className="text-xs font-bold text-slate-600">Available Desks</div>
              <div className="text-[11px] text-slate-400">Ready for instant reservation</div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      branchStats.totalDesks > 0
                        ? (branchStats.availableDesks / branchStats.totalDesks) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono font-bold mt-1 text-right">
                {100 - occupancyRate}% Free
              </div>
            </div>
          </div>

          {/* Personal Bookings Widget */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {summary?.totalBookings || 0}
              </div>
              <div className="text-xs font-bold text-slate-600">Your Total Bookings</div>
              <div className="text-[11px] text-slate-400">Historical desk reservations</div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className="font-bold text-blue-700 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Verified</span>
              </span>
            </div>
          </div>

          {/* Assigned Office Branch Widget */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-lg font-black text-slate-900 tracking-tight truncate">
                {branchLabel}
              </div>
              <div className="text-xs font-bold text-slate-600">
                Code: {user?.scopedBranch?.code || user?.baseBranch?.code || 'BR'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {summary?.assignedBranch?.address || 'Primary Office Facility'}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Meeting Pods</span>
              <span className="font-bold text-purple-700">
                {branchStats.meetingRoomCount} Configured
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 2D Floor Plan Explorer & Desk Reservation Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              2D ARCHITECTURAL LAYOUT • STRICT NO-SVG GRID ENGINE
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2 mt-0.5">
              <span>Interactive Floor Plan &amp; Desk Reservation</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {currentSection?.name || 'Workspace'}
              </span>
            </h2>
          </div>

          {/* Color Code Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-500 inline-block" />
              <span>Your Desk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-rose-100 border border-rose-300 inline-block" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 text-emerald-400 font-mono font-bold">
                HDMI
              </span>
              <span>Display Setup</span>
            </div>
          </div>
        </div>

        {/* Cascade Selectors: Building -> Floor -> Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Building
            </label>
            <select
              value={currentBuilding?.id}
              onChange={(e) => {
                const bldId = e.target.value;
                setSelectedBuildingId(bldId);
                const bld = currentBranch?.buildings.find((item) => item.id === bldId);
                if (bld && bld.floors.length > 0) {
                  setSelectedFloorId(bld.floors[0].id);
                  if (bld.floors[0].sections.length > 0) {
                    setSelectedSectionId(bld.floors[0].sections[0].id);
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBranch?.buildings.map((bld) => (
                <option key={bld.id} value={bld.id}>
                  {bld.name} ({bld.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Floor Level
            </label>
            <select
              value={currentFloor?.id}
              onChange={(e) => {
                const flId = e.target.value;
                setSelectedFloorId(flId);
                const fl = currentBuilding?.floors.find((item) => item.id === flId);
                if (fl && fl.sections.length > 0) {
                  setSelectedSectionId(fl.sections[0].id);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBuilding?.floors.map((fl) => (
                <option key={fl.id} value={fl.id}>
                  {fl.code} • {fl.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Section Wing
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentFloor?.sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedSectionId === sec.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {sec.name} ({sec.desks.length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2D Canvas Pod Matrix */}
        <div className="bg-slate-50/50 rounded-2xl border-2 border-slate-800 p-6 min-h-[450px] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-slate-700 pb-2 mb-4 font-mono text-[11px] font-bold text-slate-700">
            <span>
              {currentFloor?.code} • {currentSection?.name} • COMPASS: {currentSection?.direction}
            </span>
            <span className="text-slate-500">
              TOTAL STATIONS: {desks.length} | AVAILABLE: {desks.filter((d) => d.status === 'AVAILABLE').length}
            </span>
          </div>

          {desks.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No desks configured for this section.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: totalPods }).map((_, pIdx) =>
                  renderPod(pIdx, `POD CLUSTER #${pIdx + 1}`)
                )}
              </div>

              <div className="py-1 flex items-center justify-center">
                <span className="text-[10px] font-mono tracking-widest text-slate-400 font-bold uppercase select-none">
                  • • • MAIN CIRCULATION AISLE • • •
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center border-t-2 border-slate-800 relative">
            <div className="absolute -top-3 bg-white px-6 py-0.5 border-2 border-slate-800 rounded-md font-mono text-[9px] font-black text-slate-800 tracking-wider">
              🚪 ENTRYWAY
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings Activity Log */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900">Your Recent Activity</h3>
            <p className="text-[11px] text-slate-400">Past and current desk reservations</p>
          </div>
          <Link
            to="/employee/bookings"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {summary?.recentBookings && summary.recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider">
                  <th className="py-2.5 px-3">Workstation</th>
                  <th className="py-2.5 px-3">Facility Location</th>
                  <th className="py-2.5 px-3">Reservation Window</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.recentBookings.map((b: any) => {
                  const isConfirmed = b.status === 'CONFIRMED';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] mr-1.5 font-black">
                          {b.desk?.deskCode || 'Desk'}
                        </span>
                        {b.desk?.hasHdmi && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                            HDMI
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {b.desk?.section?.floor?.name || 'Floor'} • {b.desk?.section?.name || 'Section'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {new Date(b.startTime).toLocaleDateString()}{' '}
                        ({new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isConfirmed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => handleCancelBooking(b.id, b.deskId)}
                            disabled={actionLoading}
                            className="text-rose-600 hover:text-rose-700 font-bold text-xs cursor-pointer disabled:opacity-50"
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
        ) : (
          <div className="py-6 text-center text-slate-400 text-xs">
            No booking history recorded yet.
          </div>
        )}
      </div>

      {/* Desk Booking Drawer / Modal */}
      {activeDesk && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  WORKSTATION INSPECTOR
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDesk(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${
                    activeDesk.isMyBooking
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : activeDesk.status === 'AVAILABLE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {activeDesk.deskCode}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">
                    Desk {activeDesk.deskCode}
                  </div>
                  <div
                    className={`text-[10px] font-bold ${
                      activeDesk.isMyBooking
                        ? 'text-blue-700'
                        : activeDesk.status === 'AVAILABLE'
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {activeDesk.isMyBooking
                      ? '● Your Reserved Desk'
                      : activeDesk.status === 'AVAILABLE'
                      ? '● Ready for Reservation'
                      : '● Currently Occupied'}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Branch Office:</span>
                  <span className="font-bold text-slate-800">{currentBranch?.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Floor &amp; Section:</span>
                  <span className="font-bold text-slate-800">
                    {currentFloor?.code} • {currentSection?.name}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Hardware Setup:</span>
                  <span className="font-bold text-slate-800">
                    {activeDesk.hasHdmi ? '🖥️ HDMI Monitor Setup' : 'Standard Station (BYOD)'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Ergonomics:</span>
                  <span className="font-bold text-slate-800">Standard Height Adjustable</span>
                </div>
              </div>

              {/* Reservation Controls if available */}
              {activeDesk.status === 'AVAILABLE' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Book For Selector */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1 flex items-center space-x-1">
                      <UserCheck className="w-3 h-3 text-slate-500" />
                      <span>Reserve On Behalf Of</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setBookForMode('SELF');
                          setTargetUserId('');
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bookForMode === 'SELF'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        For Myself
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookForMode('COLLEAGUE')}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bookForMode === 'COLLEAGUE'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        For Colleague
                      </button>
                    </div>

                    {bookForMode === 'COLLEAGUE' && (
                      <div className="mt-2 space-y-1.5 animate-fade-in">
                        <input
                          type="text"
                          value={colleagueSearch}
                          onChange={(e) => setColleagueSearch(e.target.value)}
                          placeholder="Search colleague by name or email..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <select
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Choose Colleague --</option>
                          {filteredColleagues.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1 flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>Reservation Date</span>
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Timing Slot (9:00 AM – 6:00 PM)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSlot('FULL_DAY')}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                          selectedSlot === 'FULL_DAY'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Full Day
                        <span className="block text-[9px] font-normal opacity-75">9AM - 6PM • 9 hrs</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSlot('MORNING')}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                          selectedSlot === 'MORNING'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Half Day
                        <span className="block text-[9px] font-normal opacity-75">9AM - 1:30PM • 4.5 hrs</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSlot('AFTERNOON')}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center ${
                          selectedSlot === 'AFTERNOON'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Half Day
                        <span className="block text-[9px] font-normal opacity-75">1:30PM - 6PM • 4.5 hrs</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {activeDesk.isMyBooking ? (
                <button
                  type="button"
                  onClick={() => handleCancelBooking(activeDesk.bookingId || undefined, activeDesk.id)}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Releasing...' : 'Release / Cancel Reservation'}
                </button>
              ) : activeDesk.status === 'AVAILABLE' ? (
                <button
                  type="button"
                  onClick={() => handleBookDeskWithSlot(activeDesk.id)}
                  disabled={actionLoading || (bookForMode === 'COLLEAGUE' && !targetUserId)}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  <Zap className="w-4 h-4 text-emerald-200" />
                  <span>
                    {actionLoading
                      ? 'Confirming...'
                      : bookForMode === 'COLLEAGUE'
                      ? 'Confirm Reservation for Colleague'
                      : `Confirm Desk Reservation (${selectedSlot === 'FULL_DAY' ? 'Full Day • 9 Hrs' : 'Half Day • 4.5 Hrs'})`}
                  </span>
                </button>
              ) : (
                <div className="p-3 bg-slate-100 text-slate-500 text-center rounded-xl text-xs font-semibold">
                  This desk is currently reserved by another team member.
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveDesk(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
