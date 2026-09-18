import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  Clock,
  Monitor,
  Sparkles,
  CheckCircle2,
  XCircle,
  X,
  ShieldCheck,
  Search,
  UserCheck,
  Loader2,
  Trash2,
  Zap,
  CheckSquare,
  Square,
} from 'lucide-react';

export interface DeskBookingInfo {
  id: string;
  slotType: string;
  startTime: string;
  endTime: string;
  status?: string;
  notes?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    department?: string;
  };
  bookedByUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface EmployeeDeskItem {
  id: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
  isMeetingRoom?: boolean;
  status: 'AVAILABLE' | 'BOOKED';
  isReserved: boolean;
  isMyBooking: boolean;
  bookings?: DeskBookingInfo[];
  activeBooking?: DeskBookingInfo | null;
}

export interface MeetingRoomItem {
  id: string;
  name: string;
  capacity: number;
  hasHdmi: boolean;
  hdmiCount: number;
}

export interface SectionItem {
  id: string;
  name: string;
  direction: string;
  standardDeskCount: number;
  hdmiDeskCount: number;
  desks: EmployeeDeskItem[];
  meetingRoom?: MeetingRoomItem | null;
}

export interface FloorItem {
  id: string;
  code: string;
  floorNumber: number;
  name: string;
  sections: SectionItem[];
}

export interface BuildingItem {
  id: string;
  code: string;
  name: string;
  floors: FloorItem[];
}

export interface BranchItem {
  id: string;
  code: string;
  name: string;
  buildings: BuildingItem[];
}

export interface ColleagueItem {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  hasActiveBookingToday: boolean;
  reservedDeskCode: string | null;
}

export interface FloorPlanResponse {
  branches: BranchItem[];
  slotInfo: {
    bookingDate?: string;
    startDate?: string;
    endDate?: string;
    slotType: string;
    startTime: string;
    endTime: string;
  };
  myActiveBooking?: {
    id: string;
    deskCode: string;
    deskId: string;
    slotType: string;
    startTime: string;
    endTime: string;
  } | null;
}

function formatFloorDisplayName(fl?: { name?: string; code?: string; floorNumber?: number } | null): string {
  if (!fl) return 'Floor 1';
  if (fl.name && fl.name.trim()) {
    const trimmed = fl.name.trim();
    const match = trimmed.match(/^FL0*(\d+)$/i);
    if (match) return `Floor ${match[1]}`;
    if (trimmed.includes('•')) {
      const parts = trimmed.split('•');
      return parts[parts.length - 1].trim();
    }
    return trimmed;
  }
  if (fl.floorNumber !== undefined && fl.floorNumber !== null) {
    return `Floor ${fl.floorNumber}`;
  }
  if (fl.code) {
    const match = fl.code.match(/FL0*(\d+)/i);
    if (match) return `Floor ${match[1]}`;
    return fl.code;
  }
  return 'Floor 1';
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dStr: string): Date {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getTodayString(): string {
  return formatLocalDate(new Date());
}

function getFutureDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [startStr];
  }
  const curr = new Date(start);
  let limit = 0;
  while (curr <= end && limit < 31) {
    dates.push(formatLocalDate(curr));
    curr.setDate(curr.getDate() + 1);
    limit++;
  }
  return dates.length > 0 ? dates : [startStr];
}

function formatDateDisplay(dStr: string): { day: string; date: string; full: string } {
  try {
    const d = parseLocalDate(dStr);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { day, date, full: `${day}, ${date}` };
  } catch {
    return { day: '', date: dStr, full: dStr };
  }
}

export const EmployeeFloorPlanPage: React.FC = () => {
  const { user } = useAuth();

  // Hierarchy Data
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Multi-Day Date Range Selection
  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [endDate, setEndDate] = useState<string>(getFutureDateString(7));

  // Active Branch / Building / Floor / Section navigation
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Workstation selection & Central Glassmorphic Modal
  const [activeDesk, setActiveDesk] = useState<EmployeeDeskItem | null>(null);
  const [modalSelectedDates, setModalSelectedDates] = useState<string[]>([]);
  const [modalSlotType, setModalSlotType] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingForMode, setBookingForMode] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [colleagueSearch, setColleagueSearch] = useState<string>('');
  const [colleaguesList, setColleaguesList] = useState<ColleagueItem[]>([]);
  const [selectedColleague, setSelectedColleague] = useState<ColleagueItem | null>(null);
  const [isLoadingColleagues, setIsLoadingColleagues] = useState<boolean>(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState<boolean>(false);

  // Bulk Selection / Team Pod Mode
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkSelectedDesks, setBulkSelectedDesks] = useState<EmployeeDeskItem[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState<boolean>(false);

  // Load floor plan layout with date range availability
  const loadFloorPlans = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (selectedBranchId) {
        params.append('branchId', selectedBranchId);
      }

      const res = await fetchApi<FloorPlanResponse>(`/employee/floor-plans?${params.toString()}`);
      const branchList = res?.branches || [];
      setBranches(branchList);

      if (branchList.length > 0) {
        const currBranch = branchList.find((b) => b.id === selectedBranchId) || branchList[0];
        setSelectedBranchId(currBranch.id);

        if (currBranch.buildings.length > 0) {
          const currBld = currBranch.buildings.find((bld) => bld.id === selectedBuildingId) || currBranch.buildings[0];
          setSelectedBuildingId(currBld.id);

          if (currBld.floors.length > 0) {
            const currFl = currBld.floors.find((fl) => fl.id === selectedFloorId) || currBld.floors[0];
            setSelectedFloorId(currFl.id);

            if (currFl.sections.length > 0) {
              const currSec = currFl.sections.find((sec) => sec.id === selectedSectionId) || currFl.sections[0];
              setSelectedSectionId(currSec.id);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load floor plans:', err);
      setErrorNotice(err.message || 'Unable to retrieve floor plan layout.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloorPlans();
  }, [startDate, endDate]);

  // Search colleagues for proxy booking
  useEffect(() => {
    if (bookingForMode !== 'COLLEAGUE') return;

    let isMounted = true;
    const searchColleagues = async () => {
      try {
        setIsLoadingColleagues(true);
        const params = new URLSearchParams();
        if (colleagueSearch.trim()) {
          params.append('search', colleagueSearch.trim());
        }
        if (selectedBranchId) {
          params.append('branchId', selectedBranchId);
        }

        const res = await fetchApi<{ colleagues: ColleagueItem[] }>(`/employee/colleagues?${params.toString()}`);
        if (isMounted) {
          setColleaguesList(res?.colleagues || []);
        }
      } catch (err) {
        console.error('Failed to fetch colleagues:', err);
      } finally {
        if (isMounted) setIsLoadingColleagues(false);
      }
    };

    const debounceTimer = setTimeout(searchColleagues, 300);
    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [bookingForMode, colleagueSearch, selectedBranchId]);

  // When a desk is opened in modal, set defaults without pre-selecting all dates
  const openDeskInspector = (desk: EmployeeDeskItem) => {
    setActiveDesk(desk);
    setBookingForMode('SELF');
    setSelectedColleague(null);
    setColleagueSearch('');
    setBookingNotes('');
    setModalSlotType('FULL_DAY');
    setModalSelectedDates([]);
  };

  // Toggle single date in modal sub-range
  const toggleModalDate = (dStr: string) => {
    setModalSelectedDates((prev) => {
      if (prev.includes(dStr)) {
        return prev.filter((d) => d !== dStr);
      } else {
        return [...prev, dStr].sort();
      }
    });
  };

  // Toggle desk in team pod selection mode
  const toggleBulkDesk = (desk: EmployeeDeskItem) => {
    if (desk.isReserved) return;

    setBulkSelectedDesks((prev) => {
      const exists = prev.some((d) => d.id === desk.id);
      if (exists) {
        return prev.filter((d) => d.id !== desk.id);
      } else {
        if (prev.length >= 8) {
          setErrorNotice('Bulk reservation is capped at a maximum of 8 workstations per request.');
          return prev;
        }
        return [...prev, desk];
      }
    });
  };

  // Select all available desks in a specific pod
  const selectEntirePod = (podDesks: EmployeeDeskItem[]) => {
    const availablePodDesks = podDesks.filter((d) => !d.isReserved);
    if (availablePodDesks.length === 0) return;

    setBulkSelectedDesks((prev) => {
      const allSelected = availablePodDesks.every((d) => prev.some((p) => p.id === d.id));
      if (allSelected) {
        return prev.filter((p) => !availablePodDesks.some((d) => d.id === p.id));
      } else {
        const newDesks = availablePodDesks.filter((d) => !prev.some((p) => p.id === d.id));
        const combined = [...prev, ...newDesks];
        if (combined.length > 8) {
          setErrorNotice('Bulk reservation is capped at a maximum of 8 workstations per request.');
          return combined.slice(0, 8);
        }
        return combined;
      }
    });
  };

  // Handle Bulk Pod Reservation Submission
  const handleConfirmBulkReservation = async () => {
    if (bulkSelectedDesks.length === 0) return;

    try {
      setIsSubmittingBulk(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/bulk-bookings', {
        method: 'POST',
        body: JSON.stringify({
          deskIds: bulkSelectedDesks.map((d) => d.id),
          bookingDate: startDate,
          slotType: modalSlotType,
          notes: bulkNotes.trim() || 'Team Pod Sprint Reservation',
        }),
      });

      setSuccessNotice(
        res?.message || `Successfully reserved ${bulkSelectedDesks.length} workstations for your team!`
      );
      setTimeout(() => setSuccessNotice(null), 6000);

      setBulkSelectedDesks([]);
      setIsBulkModalOpen(false);
      setIsBulkMode(false);
      setBulkNotes('');

      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to create bulk booking:', err);
      setErrorNotice(err.message || 'Failed to complete bulk pod reservation.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Handle Multi-Day Reservation Submission from Central Modal
  const handleConfirmReservation = async () => {
    if (!activeDesk || modalSelectedDates.length === 0) return;

    try {
      setIsSubmittingBooking(true);
      setErrorNotice(null);

      const payload: any = {
        deskId: activeDesk.id,
        bookingDates: modalSelectedDates,
        slotType: modalSlotType,
        notes: bookingNotes.trim() || undefined,
      };

      if (bookingForMode === 'COLLEAGUE') {
        if (!selectedColleague) {
          throw new Error('Please search and select a colleague to complete proxy reservation.');
        }
        payload.colleagueUserId = selectedColleague.id;
      }

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(
        res?.message ||
          `Workstation ${activeDesk.deskCode} reserved successfully for ${modalSelectedDates.length} day(s)!`
      );
      setTimeout(() => setSuccessNotice(null), 6000);

      setSelectedColleague(null);
      setColleagueSearch('');
      setBookingNotes('');
      setActiveDesk(null);

      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to reserve desk:', err);
      setErrorNotice(err.message || 'Failed to complete desk reservation.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Handle Cancellation / Release of My Reservation
  const handleReleaseReservation = async (bookingId: string) => {
    try {
      setIsCancellingBooking(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          reason: 'Released from workstation inspector',
        }),
      });

      setSuccessNotice(res?.message || 'Workstation reservation successfully released.');
      setTimeout(() => setSuccessNotice(null), 5000);

      setActiveDesk(null);
      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to cancel booking:', err);
      setErrorNotice(err.message || 'Failed to cancel workstation reservation.');
    } finally {
      setIsCancellingBooking(false);
    }
  };

  // Current entity lookups
  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const currentBuilding = currentBranch?.buildings.find((bld) => bld.id === selectedBuildingId) || currentBranch?.buildings[0];
  const currentFloor = currentBuilding?.floors.find((fl) => fl.id === selectedFloorId) || currentBuilding?.floors[0];
  const currentSection = currentFloor?.sections.find((sec) => sec.id === selectedSectionId) || currentFloor?.sections[0];

  const desks = currentSection?.desks || [];
  const meetingRoom = currentSection?.meetingRoom;

  // Split desks into 4-desk ergonomic clusters (2 facing 2 pods)
  const podSize = 4;
  const standardDesks = desks.filter((d) => !d.isMeetingRoom);
  const podClusters: EmployeeDeskItem[][] = [];
  for (let i = 0; i < standardDesks.length; i += podSize) {
    podClusters.push(standardDesks.slice(i, i + podSize));
  }
  const totalPods = podClusters.length;
  const numColumns = Math.max(1, Math.ceil(totalPods / 2));

  // Compute symmetrical HDMI distribution across active clusters
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
      ? 'grid grid-cols-2 gap-4 sm:gap-5'
      : numColumns === 3
      ? 'grid grid-cols-3 gap-3 sm:gap-4'
      : numColumns === 4
      ? 'grid grid-cols-4 gap-2.5 sm:gap-3'
      : numColumns >= 5
      ? 'grid grid-cols-5 gap-2'
      : 'grid grid-cols-1 gap-4';

  const deskHeightClass =
    numColumns >= 4 ? 'min-h-[72px] sm:min-h-[80px]' : 'min-h-[82px] sm:min-h-[92px]';

  const renderPod = (podIdx: number, title: string) => {
    const podDesks = podClusters[podIdx] || [];
    if (podDesks.length === 0) return null;

    const availablePodDesks = podDesks.filter((d) => !d.isReserved && (!d.bookings || d.bookings.length === 0));
    const allPodSelected =
      availablePodDesks.length > 0 &&
      availablePodDesks.every((d) => bulkSelectedDesks.some((b) => b.id === d.id));

    return (
      <div
        key={podIdx}
        className="bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between transition-all relative group"
      >
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 mb-2.5">
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{title}</span>
          </span>

          {isBulkMode ? (
            <button
              type="button"
              disabled={availablePodDesks.length === 0}
              onClick={() => selectEntirePod(podDesks)}
              className={`text-[9px] px-2 py-0.5 rounded-md font-sans font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                allPodSelected
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : availablePodDesks.length > 0
                  ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {allPodSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              <span>{allPodSelected ? 'Deselect Pod' : 'Select Pod'}</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 font-semibold">{podDesks.length}/4 DESKS</span>
          )}
        </div>

        {/* 2x2 facing desk pod */}
        <div className="grid grid-cols-2 gap-2">
          {podDesks.map((desk, slotIdx) => {
            const hasHdmi = desk.hasHdmi || isDeskHdmi(podIdx, slotIdx);
            const isSelected = isBulkMode
              ? bulkSelectedDesks.some((b) => b.id === desk.id)
              : activeDesk?.id === desk.id;
            
            // Check if desk has confirmed bookings across date range
            const bookingCount = desk.bookings ? desk.bookings.length : desk.isReserved ? 1 : 0;
            const isBookedInRange = bookingCount > 0;
            const isAvailable = !isBookedInRange;
            const isMine = desk.isMyBooking;

            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => {
                  if (isBulkMode) {
                    toggleBulkDesk({ ...desk, hasHdmi });
                  } else {
                    openDeskInspector({ ...desk, hasHdmi });
                  }
                }}
                className={`group relative rounded-xl border-2 p-2 flex flex-col justify-between transition-all cursor-pointer text-left ${deskHeightClass} ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400 shadow-sm'
                    : isMine
                    ? 'border-blue-500 bg-blue-50/80 hover:bg-blue-100 hover:border-blue-600'
                    : isAvailable
                    ? 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 hover:border-emerald-500 shadow-2xs'
                    : 'border-red-300 bg-red-50/70 hover:bg-red-100/80 hover:border-red-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono text-[11px] sm:text-xs font-black tracking-tight shrink-0 whitespace-nowrap ${
                      isSelected
                        ? 'text-purple-900'
                        : isMine
                        ? 'text-blue-900'
                        : isAvailable
                        ? 'text-emerald-900'
                        : 'text-red-900'
                    }`}
                  >
                    {desk.deskCode}
                  </span>

                  <div className="flex items-center space-x-1">
                    {hasHdmi && (
                      <span
                        title="HDMI Equipped Monitor"
                        className="p-0.5 rounded bg-white/80 border border-slate-200 text-slate-700 flex-shrink-0"
                      >
                        <Monitor className="w-3 h-3 text-emerald-600" />
                      </span>
                    )}
                    {isBulkMode && isAvailable && (
                      <span className="text-purple-600">
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 text-[10px] font-semibold">
                  {isMine ? (
                    <span className="text-blue-700 flex items-center space-x-0.5 font-bold">
                      <span>Your Desk</span>
                    </span>
                  ) : isAvailable ? (
                    <span className="text-emerald-700 flex items-center space-x-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Available</span>
                    </span>
                  ) : (
                    <span
                      className="text-red-700 flex items-center space-x-0.5 truncate max-w-[100px]"
                      title={`Booked on ${bookingCount} day(s) in selected range. Click to inspect days.`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span className="truncate">
                        {bookingCount > 1 ? `Reserved (${bookingCount}d)` : 'Reserved'}
                      </span>
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

  const rangeDatesList = getDatesInRange(startDate, endDate);

  if (loading && branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading architectural floor plan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Date Range Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              EMPLOYEE WORKSPACE RESERVATION • ARCHITECTURAL CAD ENGINE
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <span>Interactive Floor Plan</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {currentSection?.name || 'Overview'}
              </span>
            </h1>
          </div>

          {/* Date Range Selector & Legend */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Multi-Day Date Range Picker */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-1.5 px-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase">Range:</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  min={getTodayString()}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="bg-white text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-400">&rarr;</span>
                <input
                  type="date"
                  min={startDate || getTodayString()}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Visual State Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-red-100 border border-red-300 inline-block" />
                <span>Booked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-400 inline-block" />
                <span>Your Desk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 text-emerald-400 font-mono font-bold">
                  HDMI
                </span>
                <span>Display</span>
              </div>
            </div>

            {/* Team Pod Mode Button */}
            <button
              type="button"
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                if (isBulkMode) {
                  setBulkSelectedDesks([]);
                } else {
                  setActiveDesk(null);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isBulkMode
                  ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
              }`}
              title="Toggle multi-desk selection mode for team sprints"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isBulkMode ? 'Exit Team Mode' : '⚡ Team Pod Mode'}</span>
              {bulkSelectedDesks.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-purple-700 text-[10px] font-black flex items-center justify-center ml-0.5 shadow-xs">
                  {bulkSelectedDesks.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-medium animate-fade-in">
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
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-medium">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button onClick={() => setErrorNotice(null)} className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cascade Selectors: Branch -> Building -> Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Branch Dropdown */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Select Branch
            </label>
            <select
              value={currentBranch?.id}
              onChange={(e) => {
                const bId = e.target.value;
                setSelectedBranchId(bId);
                const b = branches.find((item) => item.id === bId);
                if (b && b.buildings.length > 0) {
                  setSelectedBuildingId(b.buildings[0].id);
                  if (b.buildings[0].floors.length > 0) {
                    setSelectedFloorId(b.buildings[0].floors[0].id);
                    if (b.buildings[0].floors[0].sections.length > 0) {
                      setSelectedSectionId(b.buildings[0].floors[0].sections[0].id);
                    }
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Building Dropdown */}
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

          {/* Floor Dropdown */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Select Floor
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
                  {formatFloorDisplayName(fl)} ({fl.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Quick Toggle Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-2">
            Sections:
          </span>
          {currentFloor?.sections.map((sec) => {
            const isSelected = selectedSectionId === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {sec.name} ({sec.desks.length} Desks)
              </button>
            );
          })}
        </div>
      </div>

      {/* 2D ARCHITECTURAL FLOOR PLAN CANVAS (PURE HTML & CSS DIVS - ZERO SVG) */}
      <div className="bg-white rounded-3xl border-4 border-slate-900 p-6 shadow-2xl relative overflow-hidden min-h-[580px] flex flex-col justify-between">
        
        {/* Floor Plan Header Tag & Zoom Controller */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-800 pb-3 mb-6">
          <div className="font-mono text-xs font-black tracking-widest text-slate-800 uppercase">
            LEVEL: {formatFloorDisplayName(currentFloor).toUpperCase()} • {currentSection?.name} • COMPASS: {currentSection?.direction}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-mono text-slate-500 font-bold">
              TOTAL STATIONS: {desks.length} | PODS: {totalPods} | ROOMS: {meetingRoom ? 1 : 0}
            </div>
          </div>
        </div>

        {/* Main Floor Geometry Container */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Main Open-Plan Desk Clusters Area (Column-Wise Expansion) */}
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
              <div className="space-y-4">
                {/* Top Row of Pods: Cluster 1, Cluster 2, Cluster 5, Cluster 7... */}
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

                {/* Natural Central Circulation Aisle */}
                <div className="py-1 flex items-center justify-center">
                  <span className="text-[10px] font-mono tracking-widest text-slate-400 font-bold uppercase select-none">
                    • • • CENTRAL CIRCULATION AISLE • • •
                  </span>
                </div>

                {/* Bottom Row of Pods: Cluster 3, Cluster 4, Cluster 6, Cluster 8... */}
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

          {/* Right Column: Walled Meeting Room Pod / Conference Seating */}
          <div className="lg:col-span-1 space-y-4">
            {meetingRoom ? (
              <div className="border-3 border-slate-800 bg-white rounded-2xl p-4 shadow-sm relative">
                {/* Doorway Indication */}
                <div className="absolute -left-2 top-8 w-2 h-6 bg-white border-y-2 border-l-2 border-slate-800" />

                <div className="border-b border-slate-200 pb-2 mb-3">
                  <div className="text-[9px] font-mono font-bold text-purple-700 uppercase">
                    CONFERENCE POD
                  </div>
                  <h3 className="text-xs font-black text-slate-900 truncate">
                    {meetingRoom.name}
                  </h3>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Capacity: {meetingRoom.capacity} Seats {meetingRoom.hasHdmi ? '• HDMI Enabled' : ''}
                  </div>
                </div>

                {/* Conference Table Seating (Interactive Clickable Cubicles M-01 to M-10) */}
                <div className="grid grid-cols-2 gap-2 bg-purple-50/40 p-2.5 rounded-xl border border-purple-200/80">
                  {Array.from({ length: meetingRoom.capacity }).map((_, idx) => {
                    const code = `M-${String(idx + 1).padStart(2, '0')}`;
                    const foundDesk = desks.find(
                      (d) => d.deskCode === code || (d.isMeetingRoom && d.deskNumber === 1000 + idx + 1)
                    );
                    const seatDesk: EmployeeDeskItem = foundDesk || {
                      id: `mr-seat-${currentSection?.id}-${idx + 1}`,
                      deskCode: code,
                      deskNumber: 1000 + idx + 1,
                      hasHdmi: idx < meetingRoom.hdmiCount,
                      isMeetingRoom: true,
                      status: 'AVAILABLE',
                      isReserved: false,
                      isMyBooking: false,
                      bookings: [],
                    };

                    const bookingCount = seatDesk.bookings ? seatDesk.bookings.length : seatDesk.isReserved ? 1 : 0;
                    const isBookedInRange = bookingCount > 0;
                    const isAvailable = !isBookedInRange;
                    const isSelected = activeDesk?.id === seatDesk.id;
                    const isBulkSelected = bulkSelectedDesks.some((d) => d.id === seatDesk.id);

                    return (
                      <button
                        key={seatDesk.id}
                        type="button"
                        onClick={() => {
                          if (isBulkMode) {
                            toggleBulkDesk(seatDesk);
                          } else {
                            openDeskInspector(seatDesk);
                          }
                        }}
                        className={`h-11 rounded-lg border-2 font-bold text-[10px] flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
                          isBulkSelected
                            ? 'ring-3 ring-purple-600 bg-purple-200 border-purple-600 text-purple-950 scale-105 z-10'
                            : isSelected
                            ? 'ring-3 ring-purple-500 scale-105 z-10'
                            : 'hover:scale-102 hover:shadow-sm'
                        } ${
                          isAvailable
                            ? isBulkSelected
                              ? ''
                              : 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-900'
                            : isBulkSelected
                            ? ''
                            : 'bg-red-100/90 border-red-300 text-red-800'
                        }`}
                        title={`Conference Seat ${seatDesk.deskCode} (${isAvailable ? 'Available' : 'Reserved'})`}
                      >
                        <span className="font-black">{seatDesk.deskCode}</span>
                        {seatDesk.hasHdmi ? (
                          <span className="text-[8px] text-purple-700 font-mono font-bold">HDMI</span>
                        ) : (
                          <span className="text-[8px] text-slate-400 font-mono">STD</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic">
                No conference pod configured for this section.
              </div>
            )}

            {/* Quiet Utility / Phone Booth */}
            <div className="border-2 border-slate-300 bg-slate-50 rounded-2xl p-3.5 text-center text-[10px] font-mono font-bold text-slate-500">
              SERVICE CORE &amp; UTILITIES
            </div>
          </div>
        </div>

        {/* Architectural Bottom Entry Gap */}
        <div className="mt-8 flex justify-center border-t-2 border-slate-900 relative">
          <div className="absolute -top-3.5 bg-white px-8 py-0.5 border-2 border-slate-900 rounded-md font-mono text-[10px] font-black tracking-widest text-slate-900 uppercase">
            🚪 ENTRY
          </div>
        </div>
      </div>

      {/* CENTRAL GLASSMORPHIC DESK INSPECTOR MODAL */}
      {activeDesk &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveDesk(null);
            }}
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          >
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 p-6 flex flex-col space-y-5 relative animate-scale-up max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                {activeDesk.isMeetingRoom || activeDesk.deskCode.startsWith('M-')
                  ? 'CONFERENCE POD SEAT • SCHEDULE INSPECTOR'
                  : 'WORKSTATION INSPECTOR • SCHEDULE MATRIX'}
              </span>
              <button
                onClick={() => setActiveDesk(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            {/* Station Identity Badge */}
            <div className="flex items-center space-x-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-base shadow-xs ${
                  activeDesk.isMyBooking
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : !activeDesk.isReserved && (!activeDesk.bookings || activeDesk.bookings.length === 0)
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                    : 'bg-red-100 text-red-800 border-2 border-red-300'
                }`}
              >
                {activeDesk.deskCode}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900">
                    Workstation {activeDesk.deskCode}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeDesk.isMyBooking
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : !activeDesk.isReserved && (!activeDesk.bookings || activeDesk.bookings.length === 0)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                  >
                    {activeDesk.isMyBooking
                      ? 'Your Reservation'
                      : !activeDesk.isReserved && (!activeDesk.bookings || activeDesk.bookings.length === 0)
                      ? '100% Free in Range'
                      : `Partially/Fully Booked`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentBranch?.name} &bull; {currentBuilding?.name} &bull; {formatFloorDisplayName(currentFloor)} &bull; {currentSection?.name}
                </p>
                <div className="flex items-center space-x-3 mt-1.5 text-[11px] font-semibold text-slate-600">
                  <span>Display: {activeDesk.hasHdmi ? '🖥️ HDMI Included' : 'None (Standard)'}</span>
                  <span>&bull;</span>
                  <span>Type: {activeDesk.isMeetingRoom ? 'Conference Seat' : 'Individual Workstation'}</span>
                </div>
              </div>
            </div>

            {/* View 1: If current user has confirmed bookings on this desk in the range */}
            {activeDesk.bookings &&
              activeDesk.bookings.some(
                (b) => b.user?.id === user?.id || b.bookedByUser?.id === user?.id
              ) && (
                <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs text-blue-900 space-y-3">
                  <div className="flex items-center space-x-2 font-bold text-blue-800">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>Your Confirmed Booking(s) on this Desk</span>
                  </div>
                  <div className="space-y-2">
                    {activeDesk.bookings
                      .filter((b) => b.user?.id === user?.id || b.bookedByUser?.id === user?.id)
                      .map((bk) => (
                        <div
                          key={bk.id}
                          className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-blue-200"
                        >
                          <div>
                            <span className="font-bold text-slate-800">
                              {formatDateDisplay(bk.startTime.split('T')[0]).full}
                            </span>
                            <span className="text-slate-500 ml-2">
                              ({bk.slotType.replace('_', ' ')})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReleaseReservation(bk.id)}
                            disabled={isCancellingBooking}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Release</span>
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Visual Day-by-Day Strip (Monday - Sunday / Date Range Matrix) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    Schedule &amp; Availability Matrix
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Green days are available. Red days with cross (<span className="text-red-500 font-bold">&times;</span>) are reserved.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rangeDates = getDatesInRange(startDate, endDate);
                      const availableDates = rangeDates.filter((dStr) => {
                        return !activeDesk.bookings?.some((b) => {
                          const bStart = b.startTime.split('T')[0];
                          const bEnd = b.endTime.split('T')[0];
                          return dStr >= bStart && dStr <= bEnd;
                        });
                      });
                      setModalSelectedDates(availableDates);
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Select All Free
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setModalSelectedDates([])}
                    className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Day Strip Horizontal Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {rangeDatesList.map((dStr) => {
                  const { day, date } = formatDateDisplay(dStr);
                  const conflictingBooking = activeDesk.bookings?.find((b) => {
                    const bStart = b.startTime.split('T')[0];
                    const bEnd = b.endTime.split('T')[0];
                    return dStr >= bStart && dStr <= bEnd;
                  });

                  const isBooked = !!conflictingBooking;
                  const isUserBooking =
                    conflictingBooking?.user?.id === user?.id ||
                    conflictingBooking?.bookedByUser?.id === user?.id;
                  const isDateSelected = modalSelectedDates.includes(dStr);

                  if (isBooked) {
                    return (
                      <div
                        key={dStr}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center select-none ${
                          isUserBooking
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-red-50/90 border-red-200 text-red-800'
                        }`}
                        title={
                          isUserBooking
                            ? `You have reserved this desk on ${dStr}`
                            : `Reserved by ${conflictingBooking?.user?.name || 'someone else'} on ${dStr}`
                        }
                      >
                        <span className="text-[10px] font-bold uppercase">{day}</span>
                        <span className="text-xs font-black">{date}</span>
                        <div className="mt-1 flex items-center space-x-0.5 text-[9px] font-black text-red-600">
                          <X className="w-3 h-3 text-red-600" />
                          <span>{isUserBooking ? 'Yours' : 'Booked'}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => toggleModalDate(dStr)}
                      className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-2xs ${
                        isDateSelected
                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 font-black'
                          : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                      }`}
                    >
                      <span className="text-[10px] uppercase">{day}</span>
                      <span className="text-xs">{date}</span>
                      <div className="mt-1 text-[9px] font-bold">
                        {isDateSelected ? '✓ Selected' : 'Free'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Booking Configuration: Session Dropdown & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              {/* Session Window Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Session Window</span>
                </label>
                <select
                  value={modalSlotType}
                  onChange={(e) => setModalSlotType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="FULL_DAY">Full Day (9:00 AM – 6:00 PM)</option>
                  <option value="MORNING">Morning / First Half (9:00 AM – 1:30 PM)</option>
                  <option value="AFTERNOON">Afternoon / Second Half (1:30 PM – 6:00 PM)</option>
                </select>
              </div>

              {/* Optional Purpose / Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Booking Purpose (Optional)</span>
                </label>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g. Sprint planning, Client onsite, Quiet focus"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Proxy Booking: For Myself vs For Colleague */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Reservation Beneficiary:</span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingForMode('SELF');
                      setSelectedColleague(null);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      bookingForMode === 'SELF'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    For Myself
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingForMode('COLLEAGUE')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      bookingForMode === 'COLLEAGUE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    For Colleague
                  </button>
                </div>
              </div>

              {bookingForMode === 'COLLEAGUE' && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search colleagues by name, email, or department..."
                      value={colleagueSearch}
                      onChange={(e) => setColleagueSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    {isLoadingColleagues && (
                      <Loader2 className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 animate-spin" />
                    )}
                  </div>

                  {selectedColleague ? (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                      <div>
                        <span className="font-bold">{selectedColleague.name}</span>
                        <span className="text-slate-500 ml-2">({selectedColleague.email})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedColleague(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : colleaguesList.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-1 rounded-xl border border-slate-200">
                      {colleaguesList.map((colleague) => (
                        <button
                          key={colleague.id}
                          type="button"
                          onClick={() => {
                            setSelectedColleague(colleague);
                            setColleagueSearch('');
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-emerald-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{colleague.name}</span>
                            <span className="text-slate-400 ml-2">({colleague.department})</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{colleague.email}</span>
                        </button>
                      ))}
                    </div>
                  ) : colleagueSearch ? (
                    <div className="text-center py-2 text-xs text-slate-400">
                      No matching colleagues found.
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setActiveDesk(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close Window
              </button>

              <button
                type="button"
                disabled={isSubmittingBooking || modalSelectedDates.length === 0}
                onClick={handleConfirmReservation}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center space-x-1.5"
              >
                {isSubmittingBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Reservation...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {modalSelectedDates.length === 0
                        ? 'Select at least 1 day'
                        : `Confirm Reservation (${modalSelectedDates.length} Day${modalSelectedDates.length > 1 ? 's' : ''} • ${
                            modalSlotType === 'FULL_DAY'
                              ? 'Full Day'
                              : modalSlotType === 'MORNING'
                              ? 'Morning'
                              : 'Afternoon'
                          })`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Team Pod Booking Action Bar */}
      {isBulkMode && bulkSelectedDesks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[110] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-6 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="w-7 h-7 rounded-xl bg-purple-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
              {bulkSelectedDesks.length}
            </span>
            <span className="text-xs font-bold">Workstations Selected</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Configure Team Pod ({bulkSelectedDesks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkSelectedDesks([])}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Team Pod Bulk Confirmation Modal */}
      {isBulkModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Confirm Team Pod Reservation</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                You are about to reserve <span className="font-bold text-slate-800">{bulkSelectedDesks.length} workstations</span> for your team sprint on <span className="font-bold text-slate-800">{startDate}</span>.
              </p>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                {bulkSelectedDesks.map((d) => (
                  <span
                    key={d.id}
                    className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-mono text-xs font-bold"
                  >
                    {d.deskCode}
                  </span>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Team Sprint Notes / Project
                </label>
                <input
                  type="text"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="e.g. Backend Architecture Sprint"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingBulk}
                  onClick={handleConfirmBulkReservation}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50 inline-flex items-center space-x-1.5"
                >
                  {isSubmittingBulk ? <span>Reserving...</span> : <span>Confirm Pod Booking</span>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
