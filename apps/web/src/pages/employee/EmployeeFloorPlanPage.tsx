import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { OfficePresenceModal } from '../../components/OfficePresenceModal';
import { 
  enqueueOutboxItem, 
  isAppOnline, 
  cacheFloorPlanData, 
  getCachedFloorPlanData,
  getPendingOutboxItems,
} from '../../services/offlineStore';
import {
  Calendar,
  Clock,
  Monitor,
  Sparkles,
  CheckCircle2,
  XCircle,
  X,
  Search,
  UserCheck,
  Loader2,
  Trash2,
  Square,
  CheckSquare,
  Lock,
  Zap,
  Users,
  AlertTriangle,
  Check,
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

export function getDatesInRange(startStr: string, endStr: string): string[] {
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

export function get7DaysWindow(baseDateStr: string, weekOffset: number = 0): string[] {
  const base = parseLocalDate(baseDateStr);
  base.setDate(base.getDate() + weekOffset * 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(formatLocalDate(d));
  }
  return days;
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
  const [modalWeekOffset, setModalWeekOffset] = useState<number>(0);

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

  // Workstation Multi-Day Range Reservation (Up to 30 Days)
  const [deskScheduleMode, setDeskScheduleMode] = useState<'MATRIX' | 'RANGE'>('MATRIX');
  const [rangeStartDate, setRangeStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rangeEndDate, setRangeEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [rangeWeekdaysOnly, setRangeWeekdaysOnly] = useState<boolean>(true);
  const [rangeSmartSkip, setRangeSmartSkip] = useState<boolean>(false);
  const [showSmartSkipPrompt, setShowSmartSkipPrompt] = useState<boolean>(false);

  // Computed Date Range Array (Capped at 30 Days)
  const computedRangeDates = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    const start = new Date(rangeStartDate + 'T00:00:00');
    const end = new Date(rangeEndDate + 'T00:00:00');
    if (end < start) return [];

    // Enforce 30-day limit
    const maxEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const effectiveEnd = end > maxEnd ? maxEnd : end;

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= effectiveEnd) {
      const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
      if (!rangeWeekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        dates.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [rangeStartDate, rangeEndDate, rangeWeekdaysOnly]);

  // Dynamic Range Conflict Evaluation for activeDesk
  const { availableRangeDates, conflictedRangeDates } = useMemo(() => {
    if (!activeDesk || computedRangeDates.length === 0) {
      return { availableRangeDates: [], conflictedRangeDates: [] };
    }
    const available: string[] = [];
    const conflicted: { date: string; reason: string }[] = [];

    for (const dStr of computedRangeDates) {
      // 1. Check desk booking collisions
      const deskConflict = activeDesk.bookings?.find((b) => {
        if (b.status === 'CANCELLED') return false;
        const bStart = b.startTime?.split('T')[0];
        const bEnd = b.endTime?.split('T')[0];
        return dStr >= bStart && dStr <= bEnd;
      });

      if (deskConflict) {
        conflicted.push({
          date: dStr,
          reason: `Desk ${activeDesk.deskCode} is reserved by ${deskConflict.user?.name || 'another colleague'}`,
        });
        continue;
      }

      available.push(dStr);
    }

    return { availableRangeDates: available, conflictedRangeDates: conflicted };
  }, [activeDesk, computedRangeDates]);

  // Bulk Selection / Team Pod Mode
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkSelectedDesks, setBulkSelectedDesks] = useState<EmployeeDeskItem[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState<boolean>(false);
  const [massWeekOffset, setMassWeekOffset] = useState<number>(0);
  const [selectedMassDate, setSelectedMassDate] = useState<string>('');
  const [massSlotType, setMassSlotType] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');
  const [massDeskAllocations, setMassDeskAllocations] = useState<
    Record<string, { mode: 'SELF' | 'COLLEAGUE'; colleagueId?: string; colleagueName?: string; colleagueEmail?: string; colleagueDepartment?: string }>
  >({});
  const [activeDeskSearchId, setActiveDeskSearchId] = useState<string | null>(null);
  const [deskColleagueQueries, setDeskColleagueQueries] = useState<Record<string, string>>({});

  // Whole Meeting Room Reservation State
  const [isWholeRoomModalOpen, setIsWholeRoomModalOpen] = useState<boolean>(false);
  const [selectedMeetingRoomForBooking, setSelectedMeetingRoomForBooking] = useState<MeetingRoomItem | null>(null);
  const [wholeRoomDate, setWholeRoomDate] = useState<string>(getTodayString());
  const [wholeRoomStartHour, setWholeRoomStartHour] = useState<number>(10);
  const [wholeRoomStartMinute, setWholeRoomStartMinute] = useState<number>(0);
  const [wholeRoomDurationHours, setWholeRoomDurationHours] = useState<number>(1);
  const [wholeRoomDurationMinutes, setWholeRoomDurationMinutes] = useState<number>(0);
  const [wholeRoomTitle, setWholeRoomTitle] = useState<string>('');
  const [wholeRoomAttendeesCount, setWholeRoomAttendeesCount] = useState<number>(4);
  const [wholeRoomNotes, setWholeRoomNotes] = useState<string>('');
  const [wholeRoomForMode, setWholeRoomForMode] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [wholeRoomColleagueId, setWholeRoomColleagueId] = useState<string>('');
  const [isSubmittingWholeRoom, setIsSubmittingWholeRoom] = useState<boolean>(false);
  const [wholeRoomError, setWholeRoomError] = useState<string | null>(null);

  const handleOpenWholeRoomModal = (room: MeetingRoomItem) => {
    setSelectedMeetingRoomForBooking(room);
    setWholeRoomDate(startDate || getTodayString());
    setWholeRoomStartHour(10);
    setWholeRoomStartMinute(0);
    setWholeRoomDurationHours(1);
    setWholeRoomDurationMinutes(0);
    setWholeRoomTitle(`${room.name} Session`);
    setWholeRoomAttendeesCount(room.capacity || 4);
    setWholeRoomNotes('');
    setWholeRoomForMode('SELF');
    setWholeRoomColleagueId('');
    setWholeRoomError(null);
    setIsWholeRoomModalOpen(true);
  };

  const handleConfirmWholeRoomBooking = async () => {
    if (!selectedMeetingRoomForBooking) return;
    try {
      setIsSubmittingWholeRoom(true);
      setWholeRoomError(null);

      const totalMins = wholeRoomDurationHours * 60 + wholeRoomDurationMinutes;
      if (totalMins < 15) {
        throw new Error(`Meeting room reservation duration must be at least 15 minutes. Selected: ${totalMins} minutes.`);
      }

      const payload: any = {
        meetingRoomId: selectedMeetingRoomForBooking.id,
        bookingDate: wholeRoomDate,
        startHour: wholeRoomStartHour,
        startMinute: wholeRoomStartMinute,
        durationHours: wholeRoomDurationHours,
        durationMinutes: wholeRoomDurationMinutes,
        title: wholeRoomTitle.trim() || `${selectedMeetingRoomForBooking.name} Reservation`,
        attendeesCount: wholeRoomAttendeesCount || selectedMeetingRoomForBooking.capacity,
        notes: wholeRoomNotes.trim() || undefined,
      };

      if (wholeRoomForMode === 'COLLEAGUE' && wholeRoomColleagueId) {
        payload.colleagueUserId = wholeRoomColleagueId;
      }

      const res = await fetchApi<{ success: boolean; message: string; booking: any }>('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(res?.message || `Successfully reserved ${selectedMeetingRoomForBooking.name}!`);
      setTimeout(() => setSuccessNotice(null), 5000);
      setIsWholeRoomModalOpen(false);
      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to reserve meeting room:', err);
      setWholeRoomError(err.message || 'Failed to complete whole-room reservation.');
    } finally {
      setIsSubmittingWholeRoom(false);
    }
  };

  // Pending sync workstation IDs from offline outbox
  const [pendingDeskIds, setPendingDeskIds] = useState<string[]>([]);

  const loadPendingDeskIds = async () => {
    try {
      const items = await getPendingOutboxItems();
      const ids: string[] = [];
      for (const item of items) {
        if (item.action === 'CREATE_BOOKING' && item.payload?.deskId) {
          ids.push(item.payload.deskId);
        } else if (item.action === 'BULK_BOOKING' && Array.isArray(item.payload?.deskIds)) {
          ids.push(...item.payload.deskIds);
        }
      }
      setPendingDeskIds(ids);
    } catch {
      setPendingDeskIds([]);
    }
  };

  const initHierarchySelection = (branchList: BranchItem[]) => {
    if (branchList.length === 0) return;
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
  };

  // Load floor plan layout with date range availability
  const loadFloorPlans = async () => {
    await loadPendingDeskIds();
    const cacheKey = `employee_floorplans_${selectedBranchId || 'all'}`;

    if (!isAppOnline()) {
      const cached = await getCachedFloorPlanData(cacheKey);
      if (cached && cached.length > 0) {
        setBranches(cached);
        initHierarchySelection(cached);
        setErrorNotice(null);
        setLoading(false);
        return;
      }
    }

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

      // Cache for offline usage
      if (branchList.length > 0) {
        cacheFloorPlanData(cacheKey, branchList);
      }

      initHierarchySelection(branchList);
    } catch (err: any) {
      console.error('Failed to load floor plans:', err);
      // Fallback to cache on network failure
      const cached = await getCachedFloorPlanData(cacheKey);
      if (cached && cached.length > 0) {
        setBranches(cached);
        initHierarchySelection(cached);
        setErrorNotice(null);
      } else {
        setErrorNotice(err.message || 'Unable to retrieve floor plan layout.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloorPlans();
  }, [startDate, endDate]);

  useEffect(() => {
    const handleSyncEvent = () => {
      loadPendingDeskIds();
      loadFloorPlans();
    };
    window.addEventListener('offline-outbox-updated', handleSyncEvent);
    window.addEventListener('offline-sync-completed', handleSyncEvent);
    return () => {
      window.removeEventListener('offline-outbox-updated', handleSyncEvent);
      window.removeEventListener('offline-sync-completed', handleSyncEvent);
    };
  }, []);

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
    setModalWeekOffset(0);
    setDeskScheduleMode('MATRIX');
    const todayStr = new Date().toISOString().split('T')[0];
    setRangeStartDate(todayStr);
    const d14 = new Date();
    d14.setDate(d14.getDate() + 14);
    setRangeEndDate(d14.toISOString().split('T')[0]);
    setRangeWeekdaysOnly(true);
    setRangeSmartSkip(false);
    setShowSmartSkipPrompt(false);
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

  // Load colleagues for pod allocation when bulk modal opens
  useEffect(() => {
    if (isBulkModalOpen && colleaguesList.length === 0) {
      const loadColleagues = async () => {
        try {
          const params = new URLSearchParams();
          if (selectedBranchId) params.append('branchId', selectedBranchId);
          const res = await fetchApi<{ colleagues: ColleagueItem[] }>(`/employee/colleagues?${params.toString()}`);
          if (res?.colleagues) {
            setColleaguesList(res.colleagues);
          }
        } catch (err) {
          console.error('Failed to load colleagues for pod allocation:', err);
        }
      };
      loadColleagues();
    }
  }, [isBulkModalOpen, selectedBranchId, colleaguesList.length]);

  // Handle Bulk Pod Reservation Submission
  const handleConfirmBulkReservation = async () => {
    if (bulkSelectedDesks.length === 0 || !selectedMassDate) return;

    // Validate colleague assignments
    for (const desk of bulkSelectedDesks) {
      const alloc = massDeskAllocations[desk.id];
      if (alloc?.mode === 'COLLEAGUE' && !alloc.colleagueId) {
        setErrorNotice(`Please assign a teammate for workstation ${desk.deskCode} or switch it to Myself.`);
        return;
      }
    }

    const allocationsPayload = bulkSelectedDesks.map((d, idx) => {
      const alloc = massDeskAllocations[d.id] || (idx === 0 ? { mode: 'SELF' } : { mode: 'COLLEAGUE' });
      const isColleague = alloc.mode === 'COLLEAGUE' && alloc.colleagueId;
      return {
        deskId: d.id,
        colleagueUserId: isColleague ? alloc.colleagueId! : (user?.id || ''),
      };
    });

    const payload = {
      deskIds: bulkSelectedDesks.map((d) => d.id),
      bookingDate: selectedMassDate,
      slotType: massSlotType,
      notes: bulkNotes.trim() || 'Team Pod Sprint Reservation',
      allocations: allocationsPayload,
    };

    if (!isAppOnline()) {
      await enqueueOutboxItem('BULK_BOOKING', '/employee/bulk-bookings', payload);
      setSuccessNotice(
        `Offline Mode: Bulk reservation for ${bulkSelectedDesks.length} workstations queued locally in Outbox. Will sync once online.`
      );
      setTimeout(() => setSuccessNotice(null), 7000);
      setBulkSelectedDesks([]);
      setIsBulkModalOpen(false);
      setIsBulkMode(false);
      setBulkNotes('');
      setMassDeskAllocations({});
      return;
    }

    try {
      setIsSubmittingBulk(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/bulk-bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(
        res?.message || `Successfully reserved ${bulkSelectedDesks.length} workstations for your team on ${selectedMassDate}!`
      );
      setTimeout(() => setSuccessNotice(null), 6000);

      setBulkSelectedDesks([]);
      setIsBulkModalOpen(false);
      setIsBulkMode(false);
      setBulkNotes('');
      setMassDeskAllocations({});

      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to create bulk booking:', err);
      setErrorNotice(err.message || 'Failed to complete bulk pod reservation.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Handle Multi-Day Reservation Submission from Central Modal (Matrix or Range)
  const handleConfirmReservation = async (forceSmartSkip?: boolean) => {
    if (!activeDesk) return;

    let targetDates: string[] = [];
    const isSmartSkipActive = forceSmartSkip !== undefined ? forceSmartSkip : rangeSmartSkip;

    if (deskScheduleMode === 'RANGE') {
      if (computedRangeDates.length === 0) {
        setErrorNotice('Please select a valid date range.');
        return;
      }

      // Check if conflicts exist and user hasn't explicitly enabled smart skip
      if (conflictedRangeDates.length > 0 && !isSmartSkipActive) {
        setShowSmartSkipPrompt(true);
        return;
      }

      targetDates = isSmartSkipActive ? availableRangeDates : computedRangeDates;
      if (targetDates.length === 0) {
        setErrorNotice('All selected dates in the range have conflicts and cannot be reserved.');
        return;
      }
    } else {
      if (modalSelectedDates.length === 0) {
        setErrorNotice('Please select at least 1 day in the availability matrix.');
        return;
      }
      targetDates = modalSelectedDates;
    }

    const payload: any = {
      deskId: activeDesk.id,
      bookingDates: targetDates,
      slotType: modalSlotType,
      notes: bookingNotes.trim() || undefined,
      skipConflicts: isSmartSkipActive,
    };

    if (bookingForMode === 'COLLEAGUE') {
      if (!selectedColleague) {
        setErrorNotice('Please search and select a colleague to complete proxy reservation.');
        return;
      }
      payload.colleagueUserId = selectedColleague.id;
    }

    if (!isAppOnline()) {
      await enqueueOutboxItem('CREATE_BOOKING', '/employee/bookings', payload);
      setSuccessNotice(
        `Offline Mode: Workstation ${activeDesk.deskCode} reservation queued locally in Outbox (${targetDates.length} day(s)). It will automatically synchronize once reconnected.`
      );
      setTimeout(() => setSuccessNotice(null), 7000);
      setSelectedColleague(null);
      setColleagueSearch('');
      setBookingNotes('');
      setActiveDesk(null);
      return;
    }

    try {
      setIsSubmittingBooking(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string; skippedDates?: any[] }>('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(
        res?.message ||
          `Workstation ${activeDesk.deskCode} reserved successfully for ${targetDates.length} day(s)!`
      );
      setTimeout(() => setSuccessNotice(null), 6000);

      setSelectedColleague(null);
      setColleagueSearch('');
      setBookingNotes('');
      setActiveDesk(null);

      await loadFloorPlans();
    } catch (err: any) {
      console.error('Failed to reserve desk:', err);
      // If network failed during submit, fallback to outbox
      if (!isAppOnline() || (err?.message && err.message.toLowerCase().includes('failed to fetch'))) {
        await enqueueOutboxItem('CREATE_BOOKING', '/employee/bookings', payload);
        setSuccessNotice(
          `Connection interrupted: Workstation ${activeDesk.deskCode} reservation saved to Outbox for automatic synchronization.`
        );
        setTimeout(() => setSuccessNotice(null), 7000);
        setSelectedColleague(null);
        setColleagueSearch('');
        setBookingNotes('');
        setActiveDesk(null);
      } else {
        setErrorNotice(err.message || 'Failed to complete desk reservation.');
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Handle Cancellation / Release of My Reservation
  const handleReleaseReservation = async (bookingId: string) => {
    if (!isAppOnline()) {
      await enqueueOutboxItem('CANCEL_BOOKING', '/employee/cancel-booking', {
        bookingId,
        reason: 'Released offline from workstation inspector',
      });
      setSuccessNotice('Offline Mode: Workstation release queued locally in Outbox. Will sync once online.');
      setTimeout(() => setSuccessNotice(null), 6000);
      setActiveDesk(null);
      return;
    }

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
      if (!isAppOnline() || (err?.message && err.message.toLowerCase().includes('failed to fetch'))) {
        await enqueueOutboxItem('CANCEL_BOOKING', '/employee/cancel-booking', {
          bookingId,
          reason: 'Released offline from workstation inspector',
        });
        setSuccessNotice('Connection interrupted: Release request saved to Outbox for automatic sync.');
        setTimeout(() => setSuccessNotice(null), 6000);
        setActiveDesk(null);
      } else {
        setErrorNotice(err.message || 'Failed to cancel workstation reservation.');
      }
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
    numColumns >= 5
      ? 'min-h-[58px] sm:min-h-[64px]'
      : numColumns >= 3
      ? 'min-h-[64px] sm:min-h-[70px]'
      : 'min-h-[70px] sm:min-h-[76px]';

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
            
            // Check if desk has confirmed bookings across date range or pending offline sync
            const dedicatedBooking = desk.bookings?.find(b => b.slotType === 'DEDICATED');
            const isDedicated = !!dedicatedBooking;
            const isPendingSync = pendingDeskIds.includes(desk.id);
            const bookingCount = desk.bookings ? desk.bookings.length : desk.isReserved ? 1 : 0;
            const isBookedInRange = bookingCount > 0 || isDedicated;
            const isAvailable = !isBookedInRange && !isPendingSync;
            const isMine = desk.isMyBooking && !isPendingSync;

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
                className={`group relative rounded-xl border-2 p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer text-center overflow-hidden min-w-0 ${deskHeightClass} ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400 shadow-sm'
                    : isDedicated
                    ? 'border-amber-500 bg-amber-50/90 text-amber-950'
                    : isPendingSync
                    ? 'border-amber-400 bg-amber-100/90 text-amber-900 hover:bg-amber-200'
                    : isMine
                    ? 'border-blue-500 bg-blue-50/80 hover:bg-blue-100 hover:border-blue-600 text-blue-900'
                    : isAvailable
                    ? 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 hover:border-emerald-500 text-emerald-900 shadow-2xs'
                    : 'border-red-300 bg-red-50/70 hover:bg-red-100/80 hover:border-red-400 text-red-900'
                }`}
              >
                {/* Line 1: Cubicle Code */}
                <div className="w-full flex items-center justify-center">
                  <span className="font-mono text-[11px] font-black tracking-tight text-center truncate">
                    {desk.deskCode}
                  </span>
                </div>

                {/* Line 2: PC Station Icon / Bulk Selection Indicator / Sync Pending / Lock */}
                <div className="flex items-center justify-center space-x-1 h-4 my-0.5">
                  {isDedicated ? (
                    <span title={`Fixed Dedicated Executive Station: ${dedicatedBooking?.user?.name || 'Executive'}`} className="text-amber-700 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  ) : isPendingSync ? (
                    <span title="Offline Booking Pending Sync" className="text-amber-600 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                    </span>
                  ) : (
                    <>
                      {hasHdmi && (
                        <span title="PC Station (HDMI Equipped Monitor)" className="text-emerald-600 flex items-center justify-center">
                          <Monitor className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {isBulkMode && isAvailable && (
                        <span className="text-purple-600 flex items-center justify-center">
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                        </span>
                      )}
                      {!hasHdmi && (!isBulkMode || !isAvailable) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                    </>
                  )}
                </div>

                {/* Line 3: Standardized Status Label */}
                <div className="w-full flex items-center justify-center">
                  <span
                    className={`text-[9px] font-bold tracking-tight uppercase truncate text-center ${
                      isDedicated
                        ? 'text-amber-900 font-extrabold'
                        : isPendingSync
                        ? 'text-amber-800 font-extrabold'
                        : isMine
                        ? 'text-blue-700'
                        : isAvailable
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}
                  >
                    {isDedicated
                      ? `Fixed ${dedicatedBooking?.user?.name?.split(' ')[0] || 'Exec'}`
                      : isPendingSync
                      ? 'Sync Pending'
                      : isMine
                      ? 'Your Desk'
                      : isAvailable
                      ? 'Free'
                      : 'Booked'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
            </h1>
          </div>

          {/* Right Section: 3-Tier Stacked Hierarchy */}
          <div className="flex flex-col items-start lg:items-end gap-2.5">
            {/* Row 1 (Top): Multi-Day Date Range Picker */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
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

            {/* Row 2 (Middle): Visual State Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
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
                <span className="w-3 h-3 rounded-md bg-amber-100 border border-amber-400 inline-block" />
                <span>Sync Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="p-0.5 rounded bg-white border border-slate-200 text-slate-700 inline-flex items-center justify-center">
                  <Monitor className="w-3 h-3 text-emerald-600" />
                </span>
                <span>PC Station</span>
              </div>
            </div>

            {/* Row 3 (Bottom): Actions - Mass Booking Mode first, Who's in Office second */}
            <div className="flex items-center gap-3">
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  isBulkMode
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
                }`}
                title="Toggle multi-cubicle selection mode for mass bookings"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isBulkMode ? 'Exit Mass Mode' : '⚡ Mass Booking Mode'}</span>
                {bulkSelectedDesks.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white text-purple-700 text-[10px] font-black flex items-center justify-center ml-0.5 shadow-xs">
                    {bulkSelectedDesks.length}
                  </span>
                )}
              </button>

              <OfficePresenceModal branchId={selectedBranchId} triggerVariant="button" />
            </div>
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
        
        {/* Floor Plan Header Tag */}
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

                {/* Book Entire Meeting Room Option */}
                <div className="mt-3 pt-3 border-t border-purple-200/60">
                  <button
                    type="button"
                    onClick={() => handleOpenWholeRoomModal(meetingRoom)}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Reserve Entire Meeting Room</span>
                  </button>
                  <p className="text-[10px] text-slate-500 text-center font-medium mt-1">
                    Custom time slot (Hours &amp; Mins) • 30-day forward horizon
                  </p>
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

            {/* Booking Mode Switcher: 7-Day Matrix vs Date Range (Up to 30 Days) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  Booking Schedule Mode
                </span>
                <span className="text-[11px] text-slate-500">
                  Select single/multiple days via the 7-day strip, or book a custom range up to 30 days.
                </span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setDeskScheduleMode('MATRIX')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    deskScheduleMode === 'MATRIX'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7-Day Strip
                </button>
                <button
                  type="button"
                  onClick={() => setDeskScheduleMode('RANGE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    deskScheduleMode === 'RANGE'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Date Range (Up to 30 Days)</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Visual Day-by-Day Strip (7-Day Matrix with Week Navigation) */}
            {deskScheduleMode === 'MATRIX' &&
              (() => {
                const modal7Days = get7DaysWindow(startDate, modalWeekOffset);
                return (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                          Schedule &amp; Availability Matrix
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Green days are available. Red days with cross (<span className="text-red-500 font-bold">&times;</span>) are reserved.
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* 7-Day Sliding Window Week Navigator */}
                        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setModalWeekOffset((prev) => Math.max(0, prev - 1))}
                            disabled={modalWeekOffset <= 0}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center justify-center shadow-2xs disabled:opacity-30 cursor-pointer"
                            title="Previous 7 Days"
                          >
                            &larr;
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-700 px-1 select-none">
                            {formatDateDisplay(modal7Days[0]).date} – {formatDateDisplay(modal7Days[6]).date}
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalWeekOffset((prev) => prev + 1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Next 7 Days"
                          >
                            &rarr;
                          </button>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const availableDates = modal7Days.filter((dStr) => {
                                return !activeDesk.bookings?.some((b) => {
                                  const bStart = b.startTime.split('T')[0];
                                  const bEnd = b.endTime.split('T')[0];
                                  return dStr >= bStart && dStr <= bEnd;
                                });
                              });
                              setModalSelectedDates((prev) => Array.from(new Set([...prev, ...availableDates])));
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Select Free
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
                    </div>

                    {/* Day Strip Horizontal Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {modal7Days.map((dStr) => {
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
                );
              })()}

            {/* Mode 2: Multi-Day Date Range Booking (Up to 30 Days) */}
            {deskScheduleMode === 'RANGE' && (
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>Reserve Workstation for Multi-Day Range</span>
                    </h4>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      Reserve this desk for an assigned colleague or yourself across an extended duration (up to 30 days).
                    </p>
                  </div>

                  {/* Range Quick Preset Chips */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const s = new Date(rangeStartDate + 'T00:00:00');
                        const e = new Date(s);
                        e.setDate(e.getDate() + 7);
                        setRangeEndDate(e.toISOString().split('T')[0]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      +7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const s = new Date(rangeStartDate + 'T00:00:00');
                        const e = new Date(s);
                        e.setDate(e.getDate() + 14);
                        setRangeEndDate(e.toISOString().split('T')[0]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      +14 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const s = new Date(rangeStartDate + 'T00:00:00');
                        const e = new Date(s);
                        e.setDate(e.getDate() + 30);
                        setRangeEndDate(e.toISOString().split('T')[0]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      +30 Days (Max)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={rangeStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        setRangeStartDate(e.target.value);
                        if (e.target.value > rangeEndDate) {
                          setRangeEndDate(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      End Date (Max 30 Days)
                    </label>
                    <input
                      type="date"
                      value={rangeEndDate}
                      min={rangeStartDate}
                      max={(() => {
                        const s = new Date(rangeStartDate + 'T00:00:00');
                        s.setDate(s.getDate() + 30);
                        return s.toISOString().split('T')[0];
                      })()}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center pb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rangeWeekdaysOnly}
                        onChange={(e) => setRangeWeekdaysOnly(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Weekdays Only (Mon – Fri)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Range Availability Live Breakdown */}
                <div className="p-3 bg-white/95 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-700">
                      Total Days: <span className="font-black text-indigo-800">{computedRangeDates.length}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{availableRangeDates.length} Available</span>
                    </span>
                    {conflictedRangeDates.length > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>{conflictedRangeDates.length} Conflicted</span>
                        </span>
                      </>
                    )}
                  </div>

                  {conflictedRangeDates.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300">
                      <input
                        type="checkbox"
                        checked={rangeSmartSkip}
                        onChange={(e) => setRangeSmartSkip(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[11px] font-black text-amber-900">
                        Smart Skip: Book {availableRangeDates.length} Free Days
                      </span>
                    </label>
                  )}
                </div>

                {/* Conflicted Days Details Banner if any */}
                {conflictedRangeDates.length > 0 && (
                  <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Conflicts detected on {conflictedRangeDates.length} day(s) in this range:</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-amber-900 font-medium pl-5">
                      {conflictedRangeDates.map((c) => (
                        <div key={c.date} className="flex items-center justify-between border-b border-amber-200/50 pb-0.5">
                          <span className="font-mono font-bold">{c.date}</span>
                          <span className="text-amber-700">{c.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                disabled={
                  isSubmittingBooking ||
                  (deskScheduleMode === 'MATRIX' && modalSelectedDates.length === 0) ||
                  (deskScheduleMode === 'RANGE' && availableRangeDates.length === 0)
                }
                onClick={() => handleConfirmReservation()}
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
                      {deskScheduleMode === 'RANGE'
                        ? availableRangeDates.length === 0
                          ? 'No Available Days in Range'
                          : rangeSmartSkip || conflictedRangeDates.length === 0
                          ? `Confirm Reservation (${availableRangeDates.length} Day${availableRangeDates.length > 1 ? 's' : ''}${
                              rangeSmartSkip && conflictedRangeDates.length > 0 ? ' • Smart Skip' : ''
                            })`
                          : `Confirm (${availableRangeDates.length} Free Days • Conflicts Exist)`
                        : modalSelectedDates.length === 0
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

          {/* Smart Skip Confirmation Modal */}
          {showSmartSkipPrompt && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Conflicts Detected in Range</h4>
                    <p className="text-xs text-slate-500">{conflictedRangeDates.length} day(s) already booked</p>
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1.5 p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
                  {conflictedRangeDates.map((c) => (
                    <div key={c.date} className="flex items-center justify-between text-amber-900">
                      <span className="font-mono font-bold">{c.date}</span>
                      <span className="text-[11px] text-amber-700">{c.reason}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Would you like to use <strong>Smart Skip</strong> to bypass these {conflictedRangeDates.length} conflicting day(s) and reserve the remaining <strong>{availableRangeDates.length} available day(s)</strong> for {bookingForMode === 'COLLEAGUE' && selectedColleague ? selectedColleague.name : 'this reservation'}?
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSmartSkipPrompt(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel / Adjust Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSmartSkipPrompt(false);
                      setRangeSmartSkip(true);
                      handleConfirmReservation(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, Smart Skip & Book ({availableRangeDates.length} Days)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
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
              onClick={() => {
                setIsBulkModalOpen(true);
                setMassWeekOffset(0);
                setSelectedMassDate(startDate);
                setMassSlotType('FULL_DAY');
                setBulkNotes('');
              }}
              className="py-2.5 px-5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Proceed to Book ({bulkSelectedDesks.length})</span>
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

      {/* Interactive Mass Booking Modal for Employee */}
      {isBulkModalOpen &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsBulkModalOpen(false);
            }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-mono text-xs font-black tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>MASS WORKSTATION BOOKING • POD ALLOCATION</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Selected Workstation Badges */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Selected Workstations ({bulkSelectedDesks.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkSelectedDesks([]);
                      setIsBulkModalOpen(false);
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  {bulkSelectedDesks.map((desk) => (
                    <span
                      key={desk.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 font-mono text-xs font-bold border border-purple-200 shadow-2xs"
                    >
                      <span>{desk.deskCode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextDesks = bulkSelectedDesks.filter((d) => d.id !== desk.id);
                          setBulkSelectedDesks(nextDesks);
                          if (nextDesks.length === 0) setIsBulkModalOpen(false);
                        }}
                        className="w-3.5 h-3.5 rounded-full hover:bg-purple-200 text-purple-700 flex items-center justify-center cursor-pointer text-[10px]"
                        title={`Remove ${desk.deskCode}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Schedule & Availability Matrix for Mass Booking */}
              {(() => {
                const mass7Days = get7DaysWindow(startDate, massWeekOffset);
                const allFloorDesks = currentFloor?.sections.flatMap((s) => s.desks) || [];
                const massDesks = bulkSelectedDesks.map(
                  (bd) => allFloorDesks.find((d) => d.id === bd.id) || bd
                );

                return (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                          Availability Matrix &amp; Batch Date Selection
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Pick <span className="font-bold text-emerald-700">1 free day</span> for all {bulkSelectedDesks.length} workstations. Red days indicate conflicts.
                        </p>
                      </div>

                      {/* Strict 7-Day Sliding Window Navigator */}
                      <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setMassWeekOffset((prev) => Math.max(0, prev - 1))}
                          disabled={massWeekOffset <= 0}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center justify-center shadow-2xs disabled:opacity-30 cursor-pointer"
                          title="Previous 7 Days"
                        >
                          &larr;
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-700 px-1 select-none">
                          {formatDateDisplay(mass7Days[0]).date} – {formatDateDisplay(mass7Days[6]).date}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMassWeekOffset((prev) => prev + 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center justify-center shadow-2xs cursor-pointer"
                          title="Next 7 Days"
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>

                    {/* Day Strip 7-Day Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {mass7Days.map((dStr) => {
                        const { day, date } = formatDateDisplay(dStr);
                        const conflictingDesks = massDesks.filter((d) =>
                          d.bookings?.some((b) => {
                            const bStart = b.startTime.split('T')[0];
                            const bEnd = b.endTime.split('T')[0];
                            return dStr >= bStart && dStr <= bEnd;
                          })
                        );

                        const hasConflict = conflictingDesks.length > 0;
                        const isSelected = selectedMassDate === dStr;

                        if (hasConflict) {
                          return (
                            <div
                              key={dStr}
                              className="p-2 rounded-xl border flex flex-col items-center justify-center text-center select-none bg-red-50/90 border-red-200 text-red-800"
                              title={`Conflict: ${conflictingDesks.map((d) => d.deskCode).join(', ')} already reserved on ${dStr}`}
                            >
                              <span className="text-[10px] font-bold uppercase">{day}</span>
                              <span className="text-xs font-black">{date}</span>
                              <div className="mt-1 flex items-center space-x-0.5 text-[9px] font-black text-red-600 truncate max-w-full">
                                <X className="w-3 h-3 text-red-600 shrink-0" />
                                <span className="truncate">✕ Conflict</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={dStr}
                            type="button"
                            onClick={() => setSelectedMassDate(dStr)}
                            className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer shadow-2xs ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400 font-black'
                                : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                            }`}
                          >
                            <span className="text-[10px] uppercase">{day}</span>
                            <span className="text-xs">{date}</span>
                            <div className="mt-1 text-[9px] font-bold">
                              {isSelected ? '✓ Selected' : 'Available'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Workstation Pod Assignee Allocation */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-600" />
                      <span>Pod Workstation Allocations ({bulkSelectedDesks.length})</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Designate each workstation for yourself or allocate to specific colleagues in your agile team.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {bulkSelectedDesks.map((desk, idx) => {
                    const alloc = massDeskAllocations[desk.id] || (idx === 0 ? { mode: 'SELF' } : { mode: 'COLLEAGUE' });
                    const isSelf = alloc.mode === 'SELF';
                    const isSearchOpen = activeDeskSearchId === desk.id;
                    const deskQuery = (deskColleagueQueries[desk.id] || '').toLowerCase();
                    const filteredColleagues = colleaguesList.filter((c) =>
                      c.name.toLowerCase().includes(deskQuery) ||
                      c.email.toLowerCase().includes(deskQuery) ||
                      (c.department && c.department.toLowerCase().includes(deskQuery))
                    );

                    return (
                      <div
                        key={desk.id}
                        className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/90 transition-all hover:border-purple-200 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-200">
                              {desk.deskCode}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {desk.hasHdmi ? 'HDMI Display' : 'Standard Workstation'}
                            </span>
                          </div>

                          {/* Toggle: Myself vs Colleague */}
                          <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setMassDeskAllocations((prev) => ({
                                  ...prev,
                                  [desk.id]: { mode: 'SELF' },
                                }));
                                if (activeDeskSearchId === desk.id) setActiveDeskSearchId(null);
                              }}
                              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                isSelf
                                  ? 'bg-purple-600 text-white shadow-2xs font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Myself
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMassDeskAllocations((prev) => ({
                                  ...prev,
                                  [desk.id]: {
                                    mode: 'COLLEAGUE',
                                    colleagueId: prev[desk.id]?.colleagueId,
                                    colleagueName: prev[desk.id]?.colleagueName,
                                    colleagueEmail: prev[desk.id]?.colleagueEmail,
                                    colleagueDepartment: prev[desk.id]?.colleagueDepartment,
                                  },
                                }));
                              }}
                              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                !isSelf
                                  ? 'bg-purple-600 text-white shadow-2xs font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Colleague
                            </button>
                          </div>
                        </div>

                        {/* Allocation Details */}
                        {isSelf ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-200/60">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Assigned to you: <strong className="text-emerald-900">{user?.name}</strong> ({user?.email})</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {alloc.colleagueId ? (
                              <div className="flex items-center justify-between p-2 bg-purple-50/70 border border-purple-200/70 rounded-xl text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-purple-200 text-purple-800 font-black flex items-center justify-center text-[10px]">
                                    {alloc.colleagueName?.charAt(0) || 'C'}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-800">{alloc.colleagueName}</span>
                                    <span className="text-slate-500 text-[11px] ml-1.5">({alloc.colleagueDepartment || 'Team Member'})</span>
                                    <div className="text-[10px] font-mono text-slate-400">{alloc.colleagueEmail}</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDeskSearchId(isSearchOpen ? null : desk.id);
                                  }}
                                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between p-2 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800">
                                <span>No teammate assigned yet</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveDeskSearchId(isSearchOpen ? null : desk.id)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 cursor-pointer text-[11px]"
                                >
                                  Select Colleague
                                </button>
                              </div>
                            )}

                            {/* Inline Search Dropdown for Colleague */}
                            {isSearchOpen && (
                              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-md space-y-1.5 animate-fade-in">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                                  <input
                                    type="text"
                                    placeholder="Search colleagues by name, email, department..."
                                    value={deskColleagueQueries[desk.id] || ''}
                                    onChange={(e) =>
                                      setDeskColleagueQueries((prev) => ({ ...prev, [desk.id]: e.target.value }))
                                    }
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                  />
                                </div>

                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {filteredColleagues.length > 0 ? (
                                    filteredColleagues.map((colleague) => (
                                      <button
                                        key={colleague.id}
                                        type="button"
                                        onClick={() => {
                                          setMassDeskAllocations((prev) => ({
                                            ...prev,
                                            [desk.id]: {
                                              mode: 'COLLEAGUE',
                                              colleagueId: colleague.id,
                                              colleagueName: colleague.name,
                                              colleagueEmail: colleague.email,
                                              colleagueDepartment: colleague.department,
                                            },
                                          }));
                                          setActiveDeskSearchId(null);
                                        }}
                                        className="w-full text-left p-1.5 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                                      >
                                        <div>
                                          <span className="font-bold text-slate-800">{colleague.name}</span>
                                          <span className="text-slate-400 text-[10px] ml-1.5">({colleague.department})</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-500">{colleague.email}</span>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="text-center py-2 text-[11px] text-slate-400">
                                      {colleaguesList.length === 0 ? 'Loading colleagues...' : 'No matching colleagues found.'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Booking Configuration: Session Dropdown & Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    <span>Session Window</span>
                  </label>
                  <select
                    value={massSlotType}
                    onChange={(e) => setMassSlotType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="FULL_DAY">Full Day (9:00 AM – 6:00 PM)</option>
                    <option value="MORNING">Morning / First Half (9:00 AM – 1:30 PM)</option>
                    <option value="AFTERNOON">Afternoon / Second Half (1:30 PM – 6:00 PM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Team Project / Purpose (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    placeholder="e.g. Cross-Functional Architecture Workshop"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkReservation}
                  disabled={!selectedMassDate || bulkSelectedDesks.length === 0 || isSubmittingBulk}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {isSubmittingBulk ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reserving Workstations...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>
                        Confirm Mass Booking ({bulkSelectedDesks.length} Desks
                        {selectedMassDate ? ` on ${formatDateDisplay(selectedMassDate).date}` : ''})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* WHOLE MEETING ROOM RESERVATION MODAL */}
      {isWholeRoomModalOpen && selectedMeetingRoomForBooking &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsWholeRoomModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          >
            <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col space-y-4 max-h-[92vh] overflow-y-auto animate-scale-up">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-purple-700 uppercase tracking-wider block">
                      Whole Meeting Room Reservation
                    </span>
                    <h3 className="text-sm font-black text-slate-900">
                      {selectedMeetingRoomForBooking.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWholeRoomModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Room Specifications Banner */}
              <div className="flex items-center justify-between bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3 text-xs">
                <div>
                  <span className="font-bold text-purple-900 block">Entire Conference Room</span>
                  <span className="text-[11px] text-purple-700">
                    Capacity: {selectedMeetingRoomForBooking.capacity} Seats {selectedMeetingRoomForBooking.hasHdmi ? '• HDMI Enabled' : ''}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-200 text-purple-800">
                  Full Pod Access
                </span>
              </div>

              {/* Error Notice */}
              {wholeRoomError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start space-x-2">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">{wholeRoomError}</div>
                </div>
              )}

              {/* Date Selection (Strict 30-Day Forward Horizon) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reservation Date (Today to Today + 30 Days)
                </label>
                <input
                  type="date"
                  min={getTodayString()}
                  max={getFutureDateString(30)}
                  value={wholeRoomDate}
                  onChange={(e) => setWholeRoomDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Single-day meeting room reservation strictly within the next 30 days.
                </span>
              </div>

              {/* Time Slot & Custom Duration Controls */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  TIME SLOT &amp; DURATION CONTROLS
                </div>

                {/* Start Time Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Start Hour
                    </label>
                    <select
                      value={wholeRoomStartHour}
                      onChange={(e) => setWholeRoomStartHour(parseInt(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      {Array.from({ length: 14 }).map((_, i) => {
                        const h = 8 + i; // 8 AM to 9 PM
                        const display = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;
                        return (
                          <option key={h} value={h}>
                            {display} ({String(h).padStart(2, '0')}:00)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Start Minute
                    </label>
                    <select
                      value={wholeRoomStartMinute}
                      onChange={(e) => setWholeRoomStartMinute(parseInt(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value={0}>:00</option>
                      <option value={15}>:15</option>
                      <option value={30}>:30</option>
                      <option value={45}>:45</option>
                    </select>
                  </div>
                </div>

                {/* Duration Pickers: Hours and Minutes */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={wholeRoomDurationHours}
                      onChange={(e) => setWholeRoomDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      step={5}
                      value={wholeRoomDurationMinutes}
                      onChange={(e) => setWholeRoomDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Duration Summary Pill */}
                {(() => {
                  const totalM = wholeRoomDurationHours * 60 + wholeRoomDurationMinutes;
                  const isDurationValid = totalM >= 15;
                  const endD = new Date(2000, 0, 1, wholeRoomStartHour, wholeRoomStartMinute + totalM);
                  const endStr = endD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      isDurationValid
                        ? 'bg-purple-100/60 border-purple-200 text-purple-900 font-medium'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <div>
                        <span className="font-bold">Total Duration: </span>
                        <span>{wholeRoomDurationHours}h {wholeRoomDurationMinutes}m ({totalM} mins)</span>
                        <span className="block text-[10px] text-slate-500">
                          Ends approximately at {endStr}
                        </span>
                      </div>
                      {!isDurationValid && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          Min 15 mins required
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Title & Attendees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Meeting Title / Subject
                  </label>
                  <input
                    type="text"
                    value={wholeRoomTitle}
                    onChange={(e) => setWholeRoomTitle(e.target.value)}
                    placeholder="e.g. Sprint Planning Session"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Expected Attendees (Max {selectedMeetingRoomForBooking.capacity})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedMeetingRoomForBooking.capacity}
                    value={wholeRoomAttendeesCount}
                    onChange={(e) => setWholeRoomAttendeesCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Booking For Toggle */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reserving For
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setWholeRoomForMode('SELF')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      wholeRoomForMode === 'SELF'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Myself ({user?.name})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWholeRoomForMode('COLLEAGUE')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      wholeRoomForMode === 'COLLEAGUE'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Team Colleague
                  </button>
                </div>
                {wholeRoomForMode === 'COLLEAGUE' && (
                  <div className="mt-2">
                    <select
                      value={wholeRoomColleagueId}
                      onChange={(e) => setWholeRoomColleagueId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">Select a colleague...</option>
                      {colleaguesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email}) - {c.department}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes / Agenda (Optional)
                </label>
                <textarea
                  value={wholeRoomNotes}
                  onChange={(e) => setWholeRoomNotes(e.target.value)}
                  placeholder="e.g. HDMI presentation setup, whiteboard required"
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
              </div>

              {/* Single Active Reservation Rule Badge */}
              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-200">
                <span className="font-bold text-slate-800 block">Single Active Reservation Rule:</span>
                Each employee can hold only <strong>1 active future meeting room reservation</strong> across the 30-day window at any given time. Once your meeting completes or is released, you can schedule another.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWholeRoomModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWholeRoomBooking}
                  disabled={
                    isSubmittingWholeRoom ||
                    wholeRoomDurationHours * 60 + wholeRoomDurationMinutes < 15
                  }
                  className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  {isSubmittingWholeRoom ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reserving Entire Room...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Whole-Room Reservation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
