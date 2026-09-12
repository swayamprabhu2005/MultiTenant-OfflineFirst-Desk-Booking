import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import {
  CheckCircle2,
  Zap,
  ShieldAlert,
  X,
  Clock,
  Calendar,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface DeskItem {
  id: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
  isMeetingRoom?: boolean;
  status: 'AVAILABLE' | 'BOOKED';
  isMyBooking?: boolean;
  bookingId?: string | null;
  bookedForName?: string | null;
}

interface MeetingRoomItem {
  id: string;
  name: string;
  capacity: number;
  hasHdmi: boolean;
  hdmiCount: number;
}

interface SectionItem {
  id: string;
  name: string;
  direction: string;
  standardDeskCount: number;
  hdmiDeskCount: number;
  desks: DeskItem[];
  meetingRoom?: MeetingRoomItem | null;
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

interface ColleagueItem {
  id: string;
  name: string;
  email: string;
  department?: string;
  role: string;
}

export const EmployeeFloorPlansPage: React.FC = () => {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hierarchy Selection State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Bulk Selection Mode State
  const [bulkMode, setBulkMode] = useState<boolean>(false);
  const [selectedDeskIds, setSelectedDeskIds] = useState<string[]>([]);

  // Selected Desk for Slide Drawer
  const [activeDesk, setActiveDesk] = useState<DeskItem | null>(null);
  const [showBulkDrawer, setShowBulkDrawer] = useState<boolean>(false);

  // Booking Slot & Proxy Booking State
  const [bookForMode, setBookForMode] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [colleagueSearch, setColleagueSearch] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hierarchyData, colleaguesData] = await Promise.all([
        fetchApi<BranchItem[]>('/employee/floor-plans'),
        fetchApi<ColleagueItem[]>('/employee/colleagues'),
      ]);

      setBranches(hierarchyData || []);
      setColleagues(colleaguesData || []);

      if (hierarchyData && hierarchyData.length > 0) {
        const firstBranch = hierarchyData[0];
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
      console.error('Failed to load floor plans data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const currentBuilding = currentBranch?.buildings.find((bld) => bld.id === selectedBuildingId) || currentBranch?.buildings[0];
  const currentFloor = currentBuilding?.floors.find((fl) => fl.id === selectedFloorId) || currentBuilding?.floors[0];
  const currentSection = currentFloor?.sections.find((sec) => sec.id === selectedSectionId) || currentFloor?.sections[0];

  const filteredColleagues = colleagues.filter(
    (c) =>
      c.name.toLowerCase().includes(colleagueSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(colleagueSearch.toLowerCase()) ||
      (c.department && c.department.toLowerCase().includes(colleagueSearch.toLowerCase()))
  );

  const calculateSlotTimes = () => {
    const baseDate = new Date(selectedDate);
    const startTime = new Date(baseDate);
    const endTime = new Date(baseDate);

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

    return { startTime, endTime };
  };

  // Single Desk Booking
  const handleSingleBooking = async (deskId: string) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);

      const { startTime, endTime } = calculateSlotTimes();
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
        text: `Workstation ${activeDesk?.deskCode} successfully reserved for ${assigneeName} on ${new Date(selectedDate).toLocaleDateString()} (${selectedSlot === 'FULL_DAY' ? 'Full Day • 9 Hrs' : selectedSlot === 'MORNING' ? 'Morning • 4.5 Hrs' : 'Afternoon • 4.5 Hrs'})!`,
      });

      await loadData();
      setActiveDesk(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reserve workstation' });
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Desks Booking
  const handleBulkBooking = async () => {
    try {
      if (selectedDeskIds.length === 0) return;
      setActionLoading(true);
      setStatusMessage(null);

      const { startTime, endTime } = calculateSlotTimes();
      const payload: any = {
        deskIds: selectedDeskIds,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      if (bookForMode === 'COLLEAGUE' && targetUserId) {
        payload.targetUserId = targetUserId;
      }

      const res = await fetchApi<any>('/employee/bulk-bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setStatusMessage({
        type: 'success',
        text: res.message || `Successfully reserved ${selectedDeskIds.length} workstations simultaneously!`,
      });

      setSelectedDeskIds([]);
      setShowBulkDrawer(false);
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed bulk desk reservation' });
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId?: string, deskId?: string) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);
      await fetchApi('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({ bookingId, deskId }),
      });

      setStatusMessage({ type: 'success', text: 'Reservation cancelled. Workstation is now released and available.' });
      await loadData();
      setActiveDesk(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to cancel reservation' });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleDeskSelection = (deskId: string) => {
    if (selectedDeskIds.includes(deskId)) {
      setSelectedDeskIds(selectedDeskIds.filter((id) => id !== deskId));
    } else {
      setSelectedDeskIds([...selectedDeskIds, deskId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-bold text-xs">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Architectural Floor Plans...</span>
        </div>
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4 bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
        <div className="text-3xl">🏢</div>
        <h2 className="text-lg font-black text-slate-900">No Floor Plans Found for Branch</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your assigned office branch does not have an ingested workspace configuration yet. Please contact your Branch Administrator to upload the facility blueprint.
        </p>
      </div>
    );
  }

  const allDesks = currentSection?.desks || [];
  const standardDesks = allDesks.filter((d) => !d.isMeetingRoom && !d.deskCode.startsWith('M-'));
  const meetingDesks = allDesks.filter((d) => d.isMeetingRoom || d.deskCode.startsWith('M-'));
  const meetingRoom = currentSection?.meetingRoom;

  // Pod calculations for standard open-plan clusters
  const podSize = 4;
  const podClusters: DeskItem[][] = [];
  for (let i = 0; i < standardDesks.length; i += podSize) {
    podClusters.push(standardDesks.slice(i, i + podSize));
  }
  const totalPods = podClusters.length;
  const numColumns = Math.max(1, Math.ceil(totalPods / 2));

  const totalHdmiCount = standardDesks.filter((d) => d.hasHdmi).length;
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

  const colGridClass =
    numColumns === 2
      ? 'grid grid-cols-2 gap-5'
      : numColumns === 3
      ? 'grid grid-cols-3 gap-3.5'
      : numColumns >= 4
      ? 'grid grid-cols-4 gap-2.5'
      : 'grid grid-cols-1 gap-4';

  const renderPod = (podIdx: number, title: string) => {
    const podDesks = podClusters[podIdx] || [];
    if (podDesks.length === 0) return null;

    return (
      <div
        key={podIdx}
        className={`bg-slate-50/85 p-3 rounded-2xl border-2 border-slate-300 shadow-xs flex flex-col justify-between transition-all ${
          numColumns >= 3 ? 'text-[10px]' : 'text-xs'
        }`}
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
            const isBulkSelected = selectedDeskIds.includes(desk.id);
            const isSelected = activeDesk?.id === desk.id || isBulkSelected;

            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => {
                  if (bulkMode) {
                    if (isAvailable) {
                      toggleDeskSelection(desk.id);
                    }
                  } else {
                    setActiveDesk({ ...desk, hasHdmi });
                  }
                }}
                className={`${
                  numColumns >= 3 ? 'h-13 sm:h-14' : 'h-15 sm:h-16'
                } rounded-xl border-2 font-bold p-1 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
                  isBulkSelected
                    ? 'ring-3 ring-emerald-600 bg-emerald-200 border-emerald-600 scale-105 z-10'
                    : isSelected
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
                  {bulkMode && isAvailable ? (
                    isBulkSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-800" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )
                  ) : isMyBooking ? (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" title="Your Booked Desk" />
                  ) : null}
                </div>
                <div className="flex items-center space-x-1">
                  {hasHdmi ? (
                    <span className="text-[8.5px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                      HDMI
                    </span>
                  ) : (
                    <span className="text-[8.5px] text-slate-400 font-mono">STD</span>
                  )}
                  {isMyBooking && (
                    <span className="text-[8.5px] px-1 py-0.2 rounded bg-blue-600 text-white font-mono font-bold">
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
              className={`${
                numColumns >= 3 ? 'h-13 sm:h-14' : 'h-15 sm:h-16'
              } rounded-xl border-2 border-dashed border-slate-200 bg-slate-100/50 flex items-center justify-center text-[9px] text-slate-300 font-mono`}
            >
              EMPTY
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMeetingRoomSeats = () => {
    if (!meetingRoom) {
      return (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic">
          No conference room in this section.
        </div>
      );
    }

    const capacity = meetingRoom.capacity || 0;
    const seatsToRender: DeskItem[] = [];

    for (let i = 1; i <= capacity; i++) {
      const code = `M-${String(i).padStart(2, '0')}`;
      const found = meetingDesks.find((d) => d.deskCode === code);
      if (found) {
        seatsToRender.push(found);
      } else {
        seatsToRender.push({
          id: `mr-seat-${i}`,
          deskCode: code,
          deskNumber: 1000 + i,
          hasHdmi: i <= meetingRoom.hdmiCount,
          isMeetingRoom: true,
          status: 'AVAILABLE',
        });
      }
    }

    const availableMeetingSeats = seatsToRender.filter((s) => s.status === 'AVAILABLE');

    return (
      <div className="border-3 border-purple-900 bg-white rounded-2xl p-4 shadow-sm relative">
        <div className="absolute -left-2 top-8 w-2 h-6 bg-white border-y-2 border-l-2 border-purple-900" />

        <div className="border-b border-purple-100 pb-2 mb-3 flex items-start justify-between">
          <div>
            <div className="text-[9px] font-mono font-bold text-purple-700 uppercase tracking-wider flex items-center space-x-1">
              <span>CONFERENCE POD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <h3 className="text-xs font-black text-slate-900 truncate mt-0.5">
              {meetingRoom.name}
            </h3>
            <div className="text-[10px] text-slate-500 font-bold mt-0.5">
              Capacity: {capacity} Seats {meetingRoom.hasHdmi ? '• HDMI Enabled' : ''}
            </div>
          </div>

          {availableMeetingSeats.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const availableIds = availableMeetingSeats.map((s) => s.id);
                setSelectedDeskIds(availableIds);
                setShowBulkDrawer(true);
              }}
              title="Reserve all available seats in this meeting pod simultaneously"
              className="px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-extrabold transition-all cursor-pointer shadow-xs flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Book Pod ({availableMeetingSeats.length})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-200/80">
          {seatsToRender.map((desk) => {
            const isAvailable = desk.status === 'AVAILABLE';
            const isMyBooking = desk.isMyBooking;
            const isBulkSelected = selectedDeskIds.includes(desk.id);
            const isSelected = activeDesk?.id === desk.id || isBulkSelected;

            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => {
                  if (bulkMode) {
                    if (isAvailable) {
                      toggleDeskSelection(desk.id);
                    }
                  } else {
                    setActiveDesk(desk);
                  }
                }}
                className={`h-11 rounded-lg border-2 font-bold p-1 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
                  isBulkSelected
                    ? 'ring-3 ring-purple-600 bg-purple-200 border-purple-600 scale-105 z-10'
                    : isSelected
                    ? 'ring-3 ring-purple-500 scale-105 z-10'
                    : 'hover:scale-102 hover:shadow-sm'
                } ${
                  isMyBooking
                    ? 'bg-blue-100/95 border-blue-500 text-blue-900 ring-2 ring-blue-400/50'
                    : isAvailable
                    ? 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-950'
                    : 'bg-rose-100/90 border-rose-300 text-rose-800 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-[10px] font-black">{desk.deskCode}</span>
                  {bulkMode && isAvailable ? (
                    isBulkSelected ? (
                      <CheckSquare className="w-3 h-3 text-purple-800" />
                    ) : (
                      <Square className="w-3 h-3 text-slate-400" />
                    )
                  ) : isMyBooking ? (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" title="Your Booked Conference Seat" />
                  ) : !isAvailable ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Occupied" />
                  ) : null}
                </div>
                <div className="flex items-center space-x-1">
                  {desk.hasHdmi ? (
                    <span className="text-[7.5px] px-1 py-0.2 rounded bg-purple-900 text-purple-200 font-mono font-bold">
                      HDMI
                    </span>
                  ) : (
                    <span className="text-[7.5px] text-purple-600 font-mono">SEAT</span>
                  )}
                  {isMyBooking && (
                    <span className="text-[7.5px] px-1 py-0.2 rounded bg-blue-600 text-white font-mono font-bold">
                      YOU
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto px-4 sm:px-0 py-4 relative">
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

      {/* Top Header & Cascade Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              FACILITY EXPLORER • STRICT NO-SVG ENGINE
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <span>Branch Architectural Floor Plan</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {currentSection?.name || 'Overview'}
              </span>
            </h1>
          </div>

          {/* Action Bar & Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            {/* Bulk Selection Toggle */}
            <button
              type="button"
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedDeskIds([]);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                bulkMode
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{bulkMode ? 'Bulk Mode Active' : 'Bulk Select Desks'}</span>
            </button>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-purple-100 border border-purple-300 inline-block" />
              <span>Conf Pod</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-blue-100 border border-blue-500 inline-block" />
              <span>Your Seat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300 inline-block" />
              <span>Reserved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-emerald-400 font-mono font-bold">
                HDMI
              </span>
              <span>Display</span>
            </div>
          </div>
        </div>

        {/* Cascade Selectors: Building -> Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Select Building
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
              Select Floor Level
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
        </div>

        {/* Section Quick Toggle Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-2">
            Section Wings:
          </span>
          {currentFloor?.sections.map((sec) => {
            const isSelected = selectedSectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sec.name} ({sec.desks.length} Stations)
              </button>
            );
          })}
        </div>
      </div>

      {/* 2D ARCHITECTURAL FLOOR PLAN CANVAS */}
      <div className="bg-white rounded-3xl border-4 border-slate-900 p-6 shadow-2xl relative overflow-hidden min-h-[580px] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-6">
          <div className="font-mono text-xs font-black tracking-widest text-slate-800 uppercase">
            LEVEL: {currentFloor?.code} • {currentSection?.name} • COMPASS: {currentSection?.direction}
          </div>
          <div className="text-[10px] font-mono text-slate-500 font-bold">
            TOTAL STATIONS: {allDesks.length} | AVAILABLE:{' '}
            {allDesks.filter((d) => d.status === 'AVAILABLE').length} | OPEN PODS: {totalPods} | MEETING ROOMS:{' '}
            {meetingRoom ? 1 : 0}
          </div>
        </div>

        {/* Main Floor Geometry Container */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="lg:col-span-3">
            {numColumns === 1 ? (
              <div className="max-w-sm mx-auto space-y-6 py-4">
                {renderPod(0, 'CLUSTER #1 (Top-Left)')}
                {totalPods > 1 && (
                  <>
                    <div className="py-1 text-center text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest select-none">
                      • • • CIRCULATION AISLE • • •
                    </div>
                    {renderPod(1, 'CLUSTER #3 (Bottom-Left)')}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className={colGridClass}>
                  {Array.from({ length: numColumns }).map((_, c) => {
                    const topPodIdx = 2 * c;
                    if (topPodIdx >= totalPods) {
                      return <div key={`empty-top-${c}`} />;
                    }
                    const title =
                      c === 0
                        ? 'CLUSTER #1 (Top-Left)'
                        : c === 1
                        ? 'CLUSTER #2 (Top-Right)'
                        : `CLUSTER #${topPodIdx + 1} (Top)`;
                    return renderPod(topPodIdx, title);
                  })}
                </div>

                <div className="py-1 flex items-center justify-center">
                  <span className="text-[10px] font-mono tracking-widest text-slate-400 font-bold uppercase select-none">
                    • • • CENTRAL CIRCULATION AISLE • • •
                  </span>
                </div>

                <div className={colGridClass}>
                  {Array.from({ length: numColumns }).map((_, c) => {
                    const btmPodIdx = 2 * c + 1;
                    if (btmPodIdx >= totalPods) {
                      return <div key={`empty-btm-${c}`} />;
                    }
                    const title =
                      c === 0
                        ? 'CLUSTER #3 (Bottom-Left)'
                        : c === 1
                        ? 'CLUSTER #4 (Bottom-Right)'
                        : `CLUSTER #${btmPodIdx + 1} (Bottom)`;
                    return renderPod(btmPodIdx, title);
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Walled Meeting Room Pod */}
          <div className="lg:col-span-1 space-y-4">
            {renderMeetingRoomSeats()}

            <div className="border-2 border-slate-300 bg-slate-50 rounded-2xl p-3.5 text-center text-[10px] font-mono font-bold text-slate-500">
              SERVICE CORE &amp; UTILITIES
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center border-t-2 border-slate-900 relative">
          <div className="absolute -top-3.5 bg-white px-8 py-0.5 border-2 border-slate-900 rounded-md font-mono text-[10px] font-black tracking-widest text-slate-900 uppercase">
            🚪 MAIN SECTION ENTRY
          </div>
        </div>
      </div>

      {/* Floating Bulk Selection Action Bar */}
      {bulkMode && selectedDeskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-6 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-xl bg-emerald-500 text-white font-black text-xs flex items-center justify-center">
              {selectedDeskIds.length}
            </span>
            <span className="text-xs font-bold">Desks Selected</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowBulkDrawer(true)}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Bulk Reserve ({selectedDeskIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDeskIds([])}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Single Desk Booking Drawer */}
      {activeDesk && !bulkMode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  {activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                    ? 'CONFERENCE POD INSPECTOR'
                    : 'WORKSTATION INSPECTOR'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDesk(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Station Badge */}
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${
                    activeDesk.isMyBooking
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : activeDesk.status === 'AVAILABLE'
                      ? activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {activeDesk.deskCode}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">
                    {activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                      ? `Conference Seat ${activeDesk.deskCode}`
                      : `Desk ${activeDesk.deskCode}`}
                  </div>
                  <div
                    className={`text-[10px] font-bold ${
                      activeDesk.isMyBooking
                        ? 'text-blue-700'
                        : activeDesk.status === 'AVAILABLE'
                        ? activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                          ? 'text-purple-700'
                          : 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {activeDesk.isMyBooking
                      ? '● Your Reserved Seat / Desk'
                      : activeDesk.status === 'AVAILABLE'
                      ? '● Ready for Reservation'
                      : activeDesk.bookedForName
                      ? `● Occupied by ${activeDesk.bookedForName}`
                      : '● Currently Reserved'}
                  </div>
                </div>
              </div>

              {/* Specifications List */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-bold text-slate-800">
                    {currentBranch?.name} • {currentBuilding?.name}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Floor &amp; Section:</span>
                  <span className="font-bold text-slate-800">
                    {currentFloor?.code} • {currentSection?.name}
                  </span>
                </div>
                {(activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')) && meetingRoom && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Conference Room:</span>
                    <span className="font-bold text-purple-800">
                      {meetingRoom.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">HDMI Display:</span>
                  <span className="font-bold text-slate-800">
                    {activeDesk.hasHdmi ? '🖥️ Yes (Display Included)' : 'None (BYOD)'}
                  </span>
                </div>
              </div>

              {/* Reservation Controls if available */}
              {activeDesk.status === 'AVAILABLE' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Book For Selector (Myself vs Colleague) */}
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

                    {/* Colleague Search & Dropdown */}
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
                              {c.name} ({c.email}) {c.department ? `• ${c.department}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Date Selector */}
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

                  {/* User-Friendly Time Slot Selector */}
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

            {/* Action Buttons */}
            <div className="space-y-2">
              {activeDesk.isMyBooking ? (
                <button
                  type="button"
                  onClick={() => handleCancelBooking(activeDesk.bookingId || undefined, activeDesk.id)}
                  disabled={actionLoading}
                  className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Releasing Station...' : 'Release / Cancel Desk Booking'}
                </button>
              ) : activeDesk.status === 'AVAILABLE' ? (
                <button
                  type="button"
                  onClick={() => handleSingleBooking(activeDesk.id)}
                  disabled={actionLoading || (bookForMode === 'COLLEAGUE' && !targetUserId)}
                  className={`w-full py-3.5 rounded-xl text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 ${
                    activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                      ? 'bg-purple-700 hover:bg-purple-800'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Zap className="w-4 h-4 text-emerald-200" />
                  <span>
                    {actionLoading
                      ? 'Reserving Seat...'
                      : bookForMode === 'COLLEAGUE'
                      ? activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                        ? 'Confirm Conference Seat for Colleague'
                        : 'Confirm Reservation for Colleague'
                      : activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                      ? `Confirm Conference Seat (${selectedSlot === 'FULL_DAY' ? 'Full Day • 9 Hrs' : selectedSlot === 'MORNING' ? 'Morning • 4.5 Hrs' : 'Afternoon • 4.5 Hrs'})`
                      : `Confirm Desk Booking (${selectedSlot === 'FULL_DAY' ? 'Full Day • 9 Hrs' : selectedSlot === 'MORNING' ? 'Morning • 4.5 Hrs' : 'Afternoon • 4.5 Hrs'})`}
                  </span>
                </button>
              ) : (
                <div className="p-3 bg-slate-100 text-slate-500 text-center rounded-xl text-xs font-semibold">
                  This workstation is currently occupied.
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

      {/* Bulk Booking Drawer Modal */}
      {showBulkDrawer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between space-y-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  BULK WORKSTATION RESERVATION
                </span>
                <button
                  type="button"
                  onClick={() => setShowBulkDrawer(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-900 font-black text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>{selectedDeskIds.length} Stations Selected</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedDeskIds.map((id) => {
                    const d = allDesks.find((item) => item.id === id);
                    const isMeetingDesk = d?.isMeetingRoom || d?.deskCode.startsWith('M-');
                    return (
                      <span
                        key={id}
                        className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-black ${
                          isMeetingDesk
                            ? 'bg-purple-100 border-purple-300 text-purple-900'
                            : 'bg-white border-emerald-300 text-emerald-800'
                        }`}
                      >
                        {d?.deskCode || id.slice(0, 4)}
                      </span>
                    );
                  })}
                </div>
              </div>

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
                    My Team / Myself
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
                    Lead / Colleague
                  </button>
                </div>

                {bookForMode === 'COLLEAGUE' && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Choose Team Member / Colleague --</option>
                      {colleagues.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Date */}
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

              {/* Slot */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Time Slot (9:00 AM – 6:00 PM)</span>
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
                    <span className="block text-[9px] font-normal opacity-75">9AM - 1:30PM</span>
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
                    <span className="block text-[9px] font-normal opacity-75">1:30PM - 6PM</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleBulkBooking}
                disabled={actionLoading || (bookForMode === 'COLLEAGUE' && !targetUserId)}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <Zap className="w-4 h-4 text-emerald-200" />
                <span>
                  {actionLoading
                    ? 'Reserving All Desks...'
                    : `Confirm Bulk Reservation (${selectedDeskIds.length} Desks)`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDrawer(false)}
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
