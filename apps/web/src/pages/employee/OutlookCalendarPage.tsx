import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { enqueueOutboxItem, isAppOnline } from '../../services/offlineStore';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Search,
  Monitor,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export type ResourceFilterType = 'ALL' | 'DESK' | 'MEETING_ROOM';

export interface CalendarEventItem {
  id: string;
  resourceType: 'DESK' | 'MEETING_ROOM';
  resourceId: string;
  resourceCode: string;
  resourceName: string;
  sessionType: 'SESSION_1' | 'SESSION_2' | 'FULL_DAY';
  slotType: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number | null;
  status: 'CONFIRMED' | 'CANCELLED';
  title?: string | null;
  attendeesCount?: number | null;
  notes?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
  };
  bookedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  isMine: boolean;
  location: {
    branchId: string;
    branchName: string;
    buildingId?: string;
    buildingName: string;
    floorId?: string;
    floorName: string;
    floorCode?: string;
    sectionId?: string;
    sectionName: string;
  };
}

export interface DeskItem {
  id: string;
  deskCode: string;
  hasHdmi: boolean;
  isMeetingRoom?: boolean;
  status?: string;
  bookings?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
}

export interface MeetingRoomItem {
  id: string;
  name: string;
  capacity: number;
  hasHdmi: boolean;
  hdmiCount?: number;
  bookings?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
}

export interface SectionItem {
  id: string;
  name: string;
  direction?: string;
  desks: DeskItem[];
  meetingRoom?: MeetingRoomItem | null;
}

export interface FloorItem {
  id: string;
  name: string;
  code?: string;
  sections: SectionItem[];
}

export interface BuildingItem {
  id: string;
  name: string;
  code?: string;
  floors: FloorItem[];
}

export interface BranchItem {
  id: string;
  name: string;
  code: string;
  buildings: BuildingItem[];
}

export interface ColleagueItem {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

export const OutlookCalendarPage: React.FC = () => {
  const { user } = useAuth();

  // Current calendar anchor date (controls Month/Year navigation)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [resourceFilter, setResourceFilter] = useState<ResourceFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Events & Loading states
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Hierarchy Data for Horizontal Cascade
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Colleague List for Proxy Booking
  const [colleaguesList, setColleaguesList] = useState<ColleagueItem[]>([]);
  const [colleagueSearch, setColleagueSearch] = useState<string>('');

  // Date-Click Single-Day Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingModalDate, setBookingModalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookingResourceType, setBookingResourceType] = useState<'DESK' | 'MEETING_ROOM'>('DESK');
  const [selectedDeskId, setSelectedDeskId] = useState<string>('');
  const [deskSlotType, setDeskSlotType] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [roomStartHour, setRoomStartHour] = useState<number>(9);
  const [roomStartMinute, setRoomStartMinute] = useState<number>(0);
  const [roomDurationHours, setRoomDurationHours] = useState<number>(1);
  const [roomDurationMinutes, setRoomDurationMinutes] = useState<number>(0);
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [attendeesCount, setAttendeesCount] = useState<number>(4);
  const [bookingForMode, setBookingForMode] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [selectedColleague, setSelectedColleague] = useState<ColleagueItem | null>(null);
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [modalErrorNotice, setModalErrorNotice] = useState<string | null>(null);

  // Multi-Day Range Reservation State (Up to 30 Days)
  const [bookingDurationMode, setBookingDurationMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [rangeStartDate, setRangeStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [rangeEndDate, setRangeEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [rangeWeekdaysOnly, setRangeWeekdaysOnly] = useState<boolean>(true);
  const [rangeSmartSkip, setRangeSmartSkip] = useState<boolean>(false);
  const [showCalendarSmartSkipPrompt, setShowCalendarSmartSkipPrompt] = useState<boolean>(false);

  // Inspected Event Modal (Click on event chip)
  const [inspectedEvent, setInspectedEvent] = useState<CalendarEventItem | null>(null);
  const [isCancellingSingle, setIsCancellingSingle] = useState<boolean>(false);
  const [singleCancelReason, setSingleCancelReason] = useState<string>('');

  // Month Date Range Computation
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());

    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - end.getDay()));

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentDate]);

  // Load Calendar Events
  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        resourceType: resourceFilter,
      });

      const res = await fetchApi<{ events: CalendarEventItem[] }>(`/employee/calendar-bookings?${params.toString()}`);
      setEvents(res?.events || []);
    } catch (err: any) {
      console.error('Failed to load calendar events:', err);
      setErrorNotice(err.message || 'Unable to load calendar reservations.');
    } finally {
      setLoading(false);
    }
  };

  // Load Hierarchy & Colleagues for Horizontal Cascade
  const loadHierarchyAndColleagues = async () => {
    try {
      const [floorRes, colRes] = await Promise.all([
        fetchApi<{ branches: BranchItem[] }>('/employee/floor-plans'),
        fetchApi<{ colleagues: ColleagueItem[] }>('/employee/colleagues'),
      ]);

      const branchList = floorRes?.branches || [];
      setBranches(branchList);
      setColleaguesList(colRes?.colleagues || []);

      if (branchList.length > 0) {
        const firstBranch = branchList[0];
        setSelectedBranchId(firstBranch.id);

        if (firstBranch.buildings && firstBranch.buildings.length > 0) {
          const firstBld = firstBranch.buildings[0];
          setSelectedBuildingId(firstBld.id);

          if (firstBld.floors && firstBld.floors.length > 0) {
            const firstFl = firstBld.floors[0];
            setSelectedFloorId(firstFl.id);

            if (firstFl.sections && firstFl.sections.length > 0) {
              setSelectedSectionId(firstFl.sections[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspace hierarchy or colleagues:', err);
    }
  };

  useEffect(() => {
    loadCalendarEvents();
  }, [dateRange.startDate, dateRange.endDate, resourceFilter]);

  useEffect(() => {
    loadHierarchyAndColleagues();
  }, []);

  // Filtered Events with Search Query
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.resourceCode.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.user.name.toLowerCase().includes(q) ||
        e.location.buildingName?.toLowerCase().includes(q) ||
        e.location.sectionName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  // Month Navigation
  const handlePrev = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const headerTitle = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Month Grid Days
  const monthCalendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEventItem[];
    }> = [];

    const startDay = firstDayOfMonth.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === new Date().toISOString().split('T')[0],
        events: filteredEvents.filter((e) => e.bookingDate === dateStr),
      });
    }

    // Current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === new Date().toISOString().split('T')[0],
        events: filteredEvents.filter((e) => e.bookingDate === dateStr),
      });
    }

    // Next month padding (to reach full 35 or 42 cells)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === new Date().toISOString().split('T')[0],
        events: filteredEvents.filter((e) => e.bookingDate === dateStr),
      });
    }

    return days;
  }, [currentDate, filteredEvents]);

  // Current Hierarchy Selectors
  const currentBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const currentBuilding = useMemo(() => {
    return currentBranch?.buildings?.find((bld) => bld.id === selectedBuildingId) || currentBranch?.buildings?.[0];
  }, [currentBranch, selectedBuildingId]);

  const currentFloor = useMemo(() => {
    return currentBuilding?.floors?.find((fl) => fl.id === selectedFloorId) || currentBuilding?.floors?.[0];
  }, [currentBuilding, selectedFloorId]);

  const currentSection = useMemo(() => {
    return currentFloor?.sections?.find((sec) => sec.id === selectedSectionId) || currentFloor?.sections?.[0];
  }, [currentFloor, selectedSectionId]);

  // Cascade Change Handlers
  const handleBuildingChange = (bldId: string) => {
    setSelectedBuildingId(bldId);
    const bld = currentBranch?.buildings?.find((b) => b.id === bldId);
    if (bld && bld.floors?.length > 0) {
      setSelectedFloorId(bld.floors[0].id);
      if (bld.floors[0].sections?.length > 0) {
        setSelectedSectionId(bld.floors[0].sections[0].id);
      }
    }
  };

  const handleFloorChange = (floorId: string) => {
    setSelectedFloorId(floorId);
    const fl = currentBuilding?.floors?.find((f) => f.id === floorId);
    if (fl && fl.sections?.length > 0) {
      setSelectedSectionId(fl.sections[0].id);
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
  };

  // Dynamic Available Cubicles in Current Section on Selected Date
  const availableCubicles = useMemo(() => {
    if (!currentSection) return [];
    const sectionDesks = currentSection.desks || [];
    const cubicles = sectionDesks.filter((d) => !d.isMeetingRoom && !d.deskCode?.startsWith('M-'));

    // Check confirmed bookings on that date from events & desk bookings
    const bookedDeskIdsOnDate = new Set<string>();
    for (const ev of events) {
      if (ev.resourceType === 'DESK' && ev.bookingDate === bookingModalDate && ev.status === 'CONFIRMED') {
        bookedDeskIdsOnDate.add(ev.resourceId);
      }
    }
    for (const d of cubicles) {
      if (
        d.bookings &&
        d.bookings.some((b) => {
          const bDate = b.startTime?.split('T')[0];
          return bDate === bookingModalDate && b.status !== 'CANCELLED';
        })
      ) {
        bookedDeskIdsOnDate.add(d.id);
      }
    }

    return cubicles.filter((d) => !bookedDeskIdsOnDate.has(d.id));
  }, [currentSection, events, bookingModalDate]);

  // All Section Cubicles (for range selection)
  const allSectionCubicles = useMemo(() => {
    if (!currentSection) return [];
    return (currentSection.desks || []).filter((d) => !d.isMeetingRoom && !d.deskCode?.startsWith('M-'));
  }, [currentSection]);

  // Dynamic Range Dates Array (Capped at 30 Days)
  const calendarRangeDates = useMemo(() => {
    if (!rangeStartDate || !rangeEndDate) return [];
    const start = new Date(rangeStartDate + 'T00:00:00');
    const end = new Date(rangeEndDate + 'T00:00:00');
    if (end < start) return [];

    const maxEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const effectiveEnd = end > maxEnd ? maxEnd : end;

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= effectiveEnd) {
      const dayOfWeek = cur.getDay();
      if (!rangeWeekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        dates.push(cur.toISOString().split('T')[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [rangeStartDate, rangeEndDate, rangeWeekdaysOnly]);

  // Dynamic Conflict Detection for selectedDeskId across calendarRangeDates
  const { availableCalendarDates, conflictedCalendarDates } = useMemo(() => {
    if (!selectedDeskId || calendarRangeDates.length === 0) {
      return { availableCalendarDates: [], conflictedCalendarDates: [] };
    }
    const available: string[] = [];
    const conflicted: { date: string; reason: string }[] = [];

    const targetDesk = currentSection?.desks?.find((d) => d.id === selectedDeskId);

    for (const dStr of calendarRangeDates) {
      const eventConflict = events.find(
        (ev) => ev.resourceType === 'DESK' && ev.resourceId === selectedDeskId && ev.bookingDate === dStr && ev.status === 'CONFIRMED'
      );
      if (eventConflict) {
        conflicted.push({
          date: dStr,
          reason: `Reserved by ${eventConflict.user?.name || 'another colleague'}`,
        });
        continue;
      }

      const deskBookingConflict = targetDesk?.bookings?.find((b) => {
        if (b.status === 'CANCELLED') return false;
        const bStart = b.startTime?.split('T')[0];
        const bEnd = b.endTime?.split('T')[0];
        return dStr >= bStart && dStr <= bEnd;
      });

      if (deskBookingConflict) {
        conflicted.push({
          date: dStr,
          reason: `Reserved by ${(deskBookingConflict as any)?.user?.name || 'another colleague'}`,
        });
        continue;
      }

      available.push(dStr);
    }

    return { availableCalendarDates: available, conflictedCalendarDates: conflicted };
  }, [selectedDeskId, calendarRangeDates, events, currentSection]);

  // Dynamic Meeting Room Availability in Current Section on Selected Date
  const sectionMeetingRoom = currentSection?.meetingRoom || null;
  const isMeetingRoomBookedOnDate = useMemo(() => {
    if (!sectionMeetingRoom) return false;
    const isBookedInEvents = events.some(
      (ev) =>
        ev.resourceType === 'MEETING_ROOM' &&
        ev.resourceId === sectionMeetingRoom.id &&
        ev.bookingDate === bookingModalDate &&
        ev.status === 'CONFIRMED'
    );
    if (isBookedInEvents) return true;

    if (
      sectionMeetingRoom.bookings &&
      sectionMeetingRoom.bookings.some((b) => {
        const bDate = b.startTime?.split('T')[0];
        return bDate === bookingModalDate && b.status !== 'CANCELLED';
      })
    ) {
      return true;
    }
    return false;
  }, [sectionMeetingRoom, events, bookingModalDate]);

  // Auto-sync selected desk ID
  useEffect(() => {
    if (bookingResourceType === 'DESK') {
      if (bookingDurationMode === 'RANGE') {
        if (allSectionCubicles.length > 0) {
          if (!selectedDeskId || !allSectionCubicles.some((d) => d.id === selectedDeskId)) {
            setSelectedDeskId(allSectionCubicles[0].id);
          }
        } else {
          setSelectedDeskId('');
        }
      } else {
        if (availableCubicles.length > 0) {
          if (!selectedDeskId || !availableCubicles.some((d) => d.id === selectedDeskId)) {
            setSelectedDeskId(availableCubicles[0].id);
          }
        } else {
          setSelectedDeskId('');
        }
      }
    }
  }, [availableCubicles, allSectionCubicles, bookingDurationMode, bookingResourceType, selectedDeskId]);

  // Auto-sync selected meeting room ID
  useEffect(() => {
    if (bookingResourceType === 'MEETING_ROOM') {
      if (sectionMeetingRoom && !isMeetingRoomBookedOnDate) {
        setSelectedRoomId(sectionMeetingRoom.id);
        if (!meetingTitle) {
          setMeetingTitle(`${sectionMeetingRoom.name} Meeting`);
        }
      } else {
        setSelectedRoomId('');
      }
    }
  }, [sectionMeetingRoom, isMeetingRoomBookedOnDate, bookingResourceType]);

  // Open Date-Click Single-Day Booking Modal
  const handleOpenDateBooking = (dateStr: string) => {
    setBookingModalDate(dateStr);
    setBookingDurationMode('SINGLE');
    setRangeStartDate(dateStr);
    const d14 = new Date(dateStr + 'T00:00:00');
    d14.setDate(d14.getDate() + 14);
    setRangeEndDate(d14.toISOString().split('T')[0]);
    setRangeWeekdaysOnly(true);
    setRangeSmartSkip(false);
    setShowCalendarSmartSkipPrompt(false);
    setBookingResourceType('DESK');
    setDeskSlotType('FULL_DAY');
    setRoomStartHour(9);
    setRoomStartMinute(0);
    setRoomDurationHours(1);
    setRoomDurationMinutes(0);
    setBookingForMode('SELF');
    setSelectedColleague(null);
    setColleagueSearch('');
    setBookingNotes('');
    setModalErrorNotice(null);
    setIsBookingModalOpen(true);
  };

  // Submit Reservation
  const handleConfirmReservation = async (forceSmartSkip?: boolean) => {
    try {
      setIsSubmittingBooking(true);
      setModalErrorNotice(null);

      const isSmartSkipActive = forceSmartSkip !== undefined ? forceSmartSkip : rangeSmartSkip;

      const payload: any = {
        notes: bookingNotes.trim() || undefined,
      };

      if (bookingResourceType === 'DESK') {
        if (!selectedDeskId) {
          throw new Error('Please select a cubicle.');
        }
        payload.deskId = selectedDeskId;
        payload.slotType = deskSlotType;

        if (bookingDurationMode === 'RANGE') {
          if (calendarRangeDates.length === 0) {
            throw new Error('Please select a valid date range.');
          }

          if (conflictedCalendarDates.length > 0 && !isSmartSkipActive) {
            setShowCalendarSmartSkipPrompt(true);
            setIsSubmittingBooking(false);
            return;
          }

          const targetDates = isSmartSkipActive ? availableCalendarDates : calendarRangeDates;
          if (targetDates.length === 0) {
            throw new Error('All dates in the selected range have conflicts and cannot be reserved.');
          }

          payload.bookingDates = targetDates;
          payload.skipConflicts = isSmartSkipActive;
        } else {
          payload.bookingDate = bookingModalDate;
        }
      } else {
        payload.bookingDate = bookingModalDate;
        if (!sectionMeetingRoom) {
          throw new Error('No meeting room configured in this section.');
        }
        if (isMeetingRoomBookedOnDate) {
          throw new Error(`Meeting room "${sectionMeetingRoom.name}" is already booked on ${bookingModalDate}.`);
        }
        const totalDurationMins = roomDurationHours * 60 + roomDurationMinutes;
        if (totalDurationMins < 15) {
          throw new Error(`Meeting room reservation duration must be at least 15 minutes. Selected: ${totalDurationMins} minutes.`);
        }
        payload.meetingRoomId = selectedRoomId || sectionMeetingRoom.id;
        payload.startHour = roomStartHour;
        payload.startMinute = roomStartMinute;
        payload.durationHours = roomDurationHours;
        payload.durationMinutes = roomDurationMinutes;
        payload.title = meetingTitle.trim() || `${sectionMeetingRoom.name} Meeting`;
        payload.attendeesCount = attendeesCount || sectionMeetingRoom.capacity || 4;
      }

      if (bookingForMode === 'COLLEAGUE') {
        if (!selectedColleague) {
          throw new Error('Please select a colleague to complete proxy reservation.');
        }
        payload.colleagueUserId = selectedColleague.id;
      }

      // Offline Outbox Handling
      if (!isAppOnline()) {
        await enqueueOutboxItem('CREATE_BOOKING', '/employee/bookings', payload);
        setSuccessNotice(`Offline Mode: Reservation queued in Outbox. Will sync automatically once online.`);
        setTimeout(() => setSuccessNotice(null), 6000);
        setIsBookingModalOpen(false);
        return;
      }

      const res = await fetchApi<{ success: boolean; message: string; skippedDates?: any[] }>('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(res?.message || 'Reservation created successfully!');
      setTimeout(() => setSuccessNotice(null), 5000);
      setIsBookingModalOpen(false);
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Failed to create reservation:', err);
      if (!isAppOnline() || (err?.message && err.message.toLowerCase().includes('failed to fetch'))) {
        try {
          const fallbackPayload = {
            bookingDate: bookingModalDate,
            deskId: bookingResourceType === 'DESK' ? selectedDeskId : undefined,
            slotType: bookingResourceType === 'DESK' ? deskSlotType : undefined,
            meetingRoomId: bookingResourceType === 'MEETING_ROOM' ? sectionMeetingRoom?.id : undefined,
            notes: bookingNotes.trim() || undefined,
            colleagueUserId: bookingForMode === 'COLLEAGUE' && selectedColleague ? selectedColleague.id : undefined,
          };
          await enqueueOutboxItem('CREATE_BOOKING', '/employee/bookings', fallbackPayload);
          setSuccessNotice(`Connection lost: Reservation saved in Outbox for automatic synchronization.`);
          setTimeout(() => setSuccessNotice(null), 6000);
          setIsBookingModalOpen(false);
          return;
        } catch {
          setModalErrorNotice(err.message || 'Failed to complete reservation.');
        }
      } else {
        setModalErrorNotice(err.message || 'Failed to complete reservation.');
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Cancel Single Inspected Event
  const handleConfirmSingleCancel = async () => {
    if (!inspectedEvent) return;
    try {
      setIsCancellingSingle(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: inspectedEvent.id,
          reason: singleCancelReason.trim() || 'Cancelled from Calendar Inspector',
        }),
      });

      setSuccessNotice(res?.message || 'Reservation successfully released.');
      setTimeout(() => setSuccessNotice(null), 5000);
      setInspectedEvent(null);
      setSingleCancelReason('');
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Failed to cancel reservation:', err);
      setErrorNotice(err.message || 'Failed to cancel reservation.');
    } finally {
      setIsCancellingSingle(false);
    }
  };

  // Filter colleagues by search text
  const filteredColleagues = useMemo(() => {
    if (!colleagueSearch.trim()) return colleaguesList.slice(0, 8);
    const q = colleagueSearch.toLowerCase();
    return colleaguesList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  }, [colleaguesList, colleagueSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Outlook Ribbon Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Branding & Month Navigation */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Outlook Workspace Calendar</span>
                {loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
              </h1>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Date Navigation: < Month Year > */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handlePrev}
                title="Previous Month"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs rounded-lg transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-black text-slate-900 px-3 min-w-[130px] text-center select-none">
                {headerTitle}
              </span>
              <button
                type="button"
                onClick={handleNext}
                title="Next Month"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs rounded-lg transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Resource Filter & Live Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Resource Type Filter: All | Cubicles | Meeting Rooms */}
            <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setResourceFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  resourceFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setResourceFilter('DESK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  resourceFilter === 'DESK'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Cubicles
              </button>
              <button
                type="button"
                onClick={() => setResourceFilter('MEETING_ROOM')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  resourceFilter === 'MEETING_ROOM'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Meeting Rooms
              </button>
            </div>

            {/* Live Search Bar */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search bookings, rooms, colleagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorNotice && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-500 hover:text-emerald-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Central Month Calendar View */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Days of the Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-600 py-3 uppercase tracking-wider select-none">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200">
          {monthCalendarDays.map((cell, idx) => (
            <div
              key={idx}
              onClick={() => handleOpenDateBooking(cell.dateStr)}
              className={`min-h-[135px] p-2 flex flex-col justify-between transition-colors cursor-pointer group select-none ${
                cell.isCurrentMonth
                  ? 'bg-white hover:bg-blue-50/40'
                  : 'bg-slate-50/50 text-slate-400 hover:bg-slate-100/50'
              }`}
              title={`Click to reserve workstation or meeting room on ${cell.dateStr}`}
            >
              {/* Cell Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                    cell.isToday
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 group-hover:text-blue-600 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  + Book
                </span>
              </div>

              {/* Event Chips List */}
              <div className="flex-1 space-y-1 overflow-y-auto max-h-24 pr-0.5">
                {cell.events.map((ev) => {
                  const isMeeting = ev.resourceType === 'MEETING_ROOM';
                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                  if (ev.isMine) {
                    badgeColor = isMeeting
                      ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 font-bold'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 font-bold';
                  } else {
                    badgeColor = isMeeting
                      ? 'bg-purple-50/80 text-purple-800 border-purple-200'
                      : 'bg-emerald-50/80 text-emerald-800 border-emerald-200';
                  }

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedEvent(ev);
                      }}
                      className={`text-[11px] p-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all shadow-2xs ${badgeColor}`}
                      title={`${isMeeting ? ev.title || ev.resourceName : ev.resourceCode} (${ev.user.name})`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        {isMeeting ? (
                          <Users className="w-3 h-3 text-purple-600 shrink-0" />
                        ) : (
                          <Monitor className="w-3 h-3 text-emerald-600 shrink-0" />
                        )}
                        <span className="font-bold truncate">
                          {isMeeting ? ev.title || ev.resourceName : ev.resourceCode}
                        </span>
                      </div>
                      <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded bg-white/80 shrink-0 ml-1">
                        {ev.sessionType === 'SESSION_1' ? 'Morn' : ev.sessionType === 'SESSION_2' ? 'Eve' : 'Full'}
                      </span>
                    </div>
                  );
                })}

                {cell.events.length === 0 && (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-300 group-hover:text-blue-500 font-bold py-2 transition-colors">
                    Click to Reserve
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Date-Click Single-Day Booking Modal (Horizontal Cascade + Availability) */}
      {/* ========================================================================= */}
      {isBookingModalOpen &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsBookingModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Reserve Workspace</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                      {bookingModalDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your preferred facility location and resource. Only unbooked items on this date are displayed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Error Notice */}
              {modalErrorNotice && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{modalErrorNotice}</span>
                </div>
              )}

              {/* Horizontal Left-to-Right Cascade Bar: [ Building ▾ ] [ Floor ▾ ] [ Section ▾ ] */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Facility Location Hierarchy</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  {/* Building Dropdown */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Building
                    </label>
                    <select
                      value={selectedBuildingId}
                      onChange={(e) => handleBuildingChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      {currentBranch?.buildings?.map((bld) => (
                        <option key={bld.id} value={bld.id}>
                          {bld.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Floor Dropdown */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Floor
                    </label>
                    <select
                      value={selectedFloorId}
                      onChange={(e) => handleFloorChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      {currentBuilding?.floors?.map((fl) => (
                        <option key={fl.id} value={fl.id}>
                          {fl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Section Dropdown */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedSectionId}
                      onChange={(e) => handleSectionChange(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      {currentFloor?.sections?.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Resource Type Selector: Cubicle Workstation vs Meeting Room */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Resource Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingResourceType('DESK')}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      bookingResourceType === 'DESK'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Cubicle Workstation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingResourceType('MEETING_ROOM')}
                    className={`p-3 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      bookingResourceType === 'MEETING_ROOM'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Meeting Room</span>
                  </button>
                </div>
              </div>

              {/* Resource Configuration Form */}
              {bookingResourceType === 'DESK' ? (
                <div className="space-y-3.5 p-4 bg-slate-50/70 border border-slate-200 rounded-2xl">
                  {/* Duration Mode Switcher: Single Day vs Date Range (Up to 30 Days) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 block">
                        Reservation Horizon
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Select single date or multi-day range up to 30 days.
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={() => setBookingDurationMode('SINGLE')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          bookingDurationMode === 'SINGLE'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Single Day
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingDurationMode('RANGE')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          bookingDurationMode === 'RANGE'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Date Range (Up to 30d)</span>
                      </button>
                    </div>
                  </div>

                  {/* Range Mode Configuration */}
                  {bookingDurationMode === 'RANGE' ? (
                    <div className="space-y-3 p-3.5 bg-indigo-50/70 border border-indigo-200/70 rounded-xl animate-fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                          Date Range Parameters
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const s = new Date(rangeStartDate + 'T00:00:00');
                              const e = new Date(s);
                              e.setDate(e.getDate() + 7);
                              setRangeEndDate(e.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            +7d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const s = new Date(rangeStartDate + 'T00:00:00');
                              const e = new Date(s);
                              e.setDate(e.getDate() + 14);
                              setRangeEndDate(e.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            +14d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const s = new Date(rangeStartDate + 'T00:00:00');
                              const e = new Date(s);
                              e.setDate(e.getDate() + 30);
                              setRangeEndDate(e.toISOString().split('T')[0]);
                            }}
                            className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            +30d (Max)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Start Date</label>
                          <input
                            type="date"
                            value={rangeStartDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                              setRangeStartDate(e.target.value);
                              if (e.target.value > rangeEndDate) setRangeEndDate(e.target.value);
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">End Date (Max 30d)</label>
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
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="pb-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={rangeWeekdaysOnly}
                              onChange={(e) => setRangeWeekdaysOnly(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-bold text-slate-700">Weekdays Only (Mon – Fri)</span>
                          </label>
                        </div>
                      </div>

                      {/* Cubicle Selector in Section */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Select Cubicle in {currentSection?.name || 'Section'}
                        </label>
                        {allSectionCubicles.length > 0 ? (
                          <select
                            value={selectedDeskId}
                            onChange={(e) => setSelectedDeskId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                          >
                            {allSectionCubicles.map((d) => (
                              <option key={d.id} value={d.id}>
                                Workstation {d.deskCode} {d.hasHdmi ? '• [HDMI Included]' : '• [Standard]'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
                            No cubicles configured in this section.
                          </div>
                        )}
                      </div>

                      {/* Conflict and Availability Live Pill */}
                      <div className="p-2.5 bg-white rounded-lg border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700">Total Days: {calendarRangeDates.length}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{availableCalendarDates.length} Available</span>
                          </span>
                          {conflictedCalendarDates.length > 0 && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-rose-700 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>{conflictedCalendarDates.length} Conflicted</span>
                              </span>
                            </>
                          )}
                        </div>

                        {conflictedCalendarDates.length > 0 && (
                          <label className="flex items-center gap-1.5 cursor-pointer select-none bg-amber-50 px-2.5 py-1 rounded border border-amber-300">
                            <input
                              type="checkbox"
                              checked={rangeSmartSkip}
                              onChange={(e) => setRangeSmartSkip(e.target.checked)}
                              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[10px] font-black text-amber-900">
                              Smart Skip ({availableCalendarDates.length} Free Days)
                            </span>
                          </label>
                        )}
                      </div>

                      {/* Conflict details banner */}
                      {conflictedCalendarDates.length > 0 && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 max-h-24 overflow-y-auto space-y-1">
                          <div className="font-bold flex items-center gap-1 text-amber-950">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Conflicts on {conflictedCalendarDates.length} date(s):</span>
                          </div>
                          {conflictedCalendarDates.map((c) => (
                            <div key={c.date} className="flex items-center justify-between border-b border-amber-200/50 pb-0.5">
                              <span className="font-mono font-bold">{c.date}</span>
                              <span className="text-amber-700">{c.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Single Day Cubicles Dropdown (Shows ONLY unbooked cubicles) */
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Available Cubicles on {bookingModalDate}
                      </label>
                      {availableCubicles.length > 0 ? (
                        <select
                          value={selectedDeskId}
                          onChange={(e) => setSelectedDeskId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                        >
                          {availableCubicles.map((d) => (
                            <option key={d.id} value={d.id}>
                              Workstation {d.deskCode} {d.hasHdmi ? '• [HDMI Included]' : '• [Standard]'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>No cubicles available in this section on {bookingModalDate}.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shift Slots */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Shift Slot</span>
                    </label>
                    <select
                      value={deskSlotType}
                      onChange={(e) => setDeskSlotType(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="FULL_DAY">Full Day (09:00 - 18:00)</option>
                      <option value="MORNING">Morning Half (09:00 - 13:30)</option>
                      <option value="AFTERNOON">Evening Half (13:30 - 18:00)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-purple-50/40 border border-purple-200 rounded-2xl">
                  {/* Meeting Room Dropdown & Status */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Section Meeting Room
                    </label>
                    {!sectionMeetingRoom ? (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold">
                        No meeting room configured in this section.
                      </div>
                    ) : isMeetingRoomBookedOnDate ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Meeting room "{sectionMeetingRoom.name}" is already booked on {bookingModalDate}.</span>
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-purple-200 rounded-xl text-xs font-bold text-purple-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span>{sectionMeetingRoom.name}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono">
                          Capacity: {sectionMeetingRoom.capacity} seats {sectionMeetingRoom.hasHdmi ? '• HDMI' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Start Time & Duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        <span>Start Time</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={roomStartHour}
                          onChange={(e) => setRoomStartHour(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {[9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                            <option key={h} value={h}>
                              {h > 12 ? `${h - 12}:00 PM` : h === 12 ? '12:00 PM' : `${h}:00 AM`}
                            </option>
                          ))}
                        </select>
                        <select
                          value={roomStartMinute}
                          onChange={(e) => setRoomStartMinute(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value={0}>:00</option>
                          <option value={15}>:15</option>
                          <option value={30}>:30</option>
                          <option value={45}>:45</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Duration (Min 15m)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            min="0"
                            max="8"
                            value={roomDurationHours}
                            onChange={(e) => setRoomDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-xs text-slate-500 font-bold">hrs</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <select
                            value={roomDurationMinutes}
                            onChange={(e) => setRoomDurationMinutes(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value={0}>0 min</option>
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title & Attendees Count */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Meeting Title / Topic
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sprint Planning, Project Kickoff"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Attendees Count
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={sectionMeetingRoom?.capacity || 20}
                        value={attendeesCount}
                        onChange={(e) => setAttendeesCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Beneficiary: Myself vs On Behalf of Colleague */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-600" />
                  <span>Reservation Beneficiary</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingForMode('SELF');
                      setSelectedColleague(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      bookingForMode === 'SELF'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Myself ({user?.name})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingForMode('COLLEAGUE')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      bookingForMode === 'COLLEAGUE'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    On Behalf of Colleague
                  </button>
                </div>

                {bookingForMode === 'COLLEAGUE' && (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search colleague by name, email, or department..."
                        value={colleagueSearch}
                        onChange={(e) => setColleagueSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {selectedColleague ? (
                      <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                        <div>
                          <span className="font-bold">{selectedColleague.name}</span>
                          <span className="text-slate-500 ml-1.5">({selectedColleague.email})</span>
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                            {selectedColleague.department}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedColleague(null)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : filteredColleagues.length > 0 ? (
                      <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-1 rounded-xl border border-slate-200">
                        {filteredColleagues.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedColleague(c)}
                            className="w-full text-left p-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-slate-800">{c.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {c.email} &bull; {c.department}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-2 text-xs text-slate-400">
                        No matching colleagues found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes / Purpose */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes / Agenda (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Onsite client sprint, standard daily shift"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmReservation()}
                  disabled={
                    isSubmittingBooking ||
                    (bookingResourceType === 'DESK' &&
                      bookingDurationMode === 'SINGLE' &&
                      (!selectedDeskId || availableCubicles.length === 0)) ||
                    (bookingResourceType === 'DESK' &&
                      bookingDurationMode === 'RANGE' &&
                      (!selectedDeskId || availableCalendarDates.length === 0)) ||
                    (bookingResourceType === 'MEETING_ROOM' && (!sectionMeetingRoom || isMeetingRoomBookedOnDate)) ||
                    (bookingForMode === 'COLLEAGUE' && !selectedColleague)
                  }
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isSubmittingBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reserving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {bookingResourceType === 'DESK' && bookingDurationMode === 'RANGE'
                          ? availableCalendarDates.length === 0
                            ? 'No Free Days in Range'
                            : rangeSmartSkip || conflictedCalendarDates.length === 0
                            ? `Confirm Reservation (${availableCalendarDates.length} Days${
                                rangeSmartSkip && conflictedCalendarDates.length > 0 ? ' • Smart Skip' : ''
                              })`
                            : `Confirm (${availableCalendarDates.length} Free Days • Conflicts Exist)`
                          : 'Confirm Reservation'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Smart Skip Confirmation Modal for Calendar */}
            {showCalendarSmartSkipPrompt && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Conflicts Detected in Range</h4>
                      <p className="text-xs text-slate-500">{conflictedCalendarDates.length} day(s) already booked</p>
                    </div>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-1.5 p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
                    {conflictedCalendarDates.map((c) => (
                      <div key={c.date} className="flex items-center justify-between text-amber-900">
                        <span className="font-mono font-bold">{c.date}</span>
                        <span className="text-[11px] text-amber-700">{c.reason}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Would you like to use <strong>Smart Skip</strong> to bypass these {conflictedCalendarDates.length} conflicting day(s) and reserve the remaining <strong>{availableCalendarDates.length} available day(s)</strong> for {bookingForMode === 'COLLEAGUE' && selectedColleague ? selectedColleague.name : 'this reservation'}?
                  </p>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCalendarSmartSkipPrompt(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel / Adjust Dates
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCalendarSmartSkipPrompt(false);
                        setRangeSmartSkip(true);
                        handleConfirmReservation(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Yes, Smart Skip & Book ({availableCalendarDates.length} Days)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODAL 2: Event Inspector Modal (Click on event chip) */}
      {/* ========================================================================= */}
      {inspectedEvent &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setInspectedEvent(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      inspectedEvent.resourceType === 'MEETING_ROOM'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {inspectedEvent.resourceType === 'MEETING_ROOM' ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {inspectedEvent.resourceType === 'MEETING_ROOM'
                        ? inspectedEvent.title || inspectedEvent.resourceName
                        : `Workstation ${inspectedEvent.resourceCode}`}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {inspectedEvent.location.buildingName} &bull; {inspectedEvent.location.floorName} &bull;{' '}
                      {inspectedEvent.location.sectionName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedEvent(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Event Details Grid */}
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-bold text-slate-500">Date:</span>
                  <span className="font-bold text-slate-900">{inspectedEvent.bookingDate}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-bold text-slate-500">Session Window:</span>
                  <span className="font-bold text-slate-900">
                    {inspectedEvent.slotType?.replace('_', ' ')} (
                    {new Date(inspectedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(inspectedEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-bold text-slate-500">Reserved For:</span>
                  <span className="font-bold text-slate-900">
                    {inspectedEvent.user.name} ({inspectedEvent.user.email})
                  </span>
                </div>
                {inspectedEvent.bookedByUser && inspectedEvent.bookedByUser.id !== inspectedEvent.user.id && (
                  <div className="flex justify-between p-2.5 bg-amber-50 rounded-xl text-amber-900">
                    <span className="font-bold">Booked By Proxy:</span>
                    <span className="font-semibold">{inspectedEvent.bookedByUser.name}</span>
                  </div>
                )}
                {inspectedEvent.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500 block mb-1">Notes:</span>
                    <p className="italic text-slate-700 font-medium">"{inspectedEvent.notes}"</p>
                  </div>
                )}
              </div>

              {/* Cancellation form if mine or proxy */}
              {(inspectedEvent.isMine || user?.role === 'BRANCH_ADMIN') && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <input
                    type="text"
                    placeholder="Optional cancellation reason..."
                    value={singleCancelReason}
                    onChange={(e) => setSingleCancelReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectedEvent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                {(inspectedEvent.isMine || user?.role === 'BRANCH_ADMIN') ? (
                  <button
                    type="button"
                    disabled={isCancellingSingle}
                    onClick={handleConfirmSingleCancel}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isCancellingSingle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Releasing...</span>
                      </>
                    ) : (
                      <span>Release Reservation</span>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">View Only (Reserved by Colleague)</span>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default OutlookCalendarPage;
