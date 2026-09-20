import React, { useState, useEffect, useMemo } from 'react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Search,
  Layers,
  AlertTriangle,
  Monitor,
  CalendarRange,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';

export type CalendarViewMode = 'MONTH' | 'WEEK' | 'WORK_WEEK' | 'DAY' | 'AGENDA';
export type ResourceFilterType = 'ALL' | 'DESK' | 'MEETING_ROOM';
export type SessionFilterType = 'ALL' | 'SESSION_1' | 'SESSION_2' | 'FULL_DAY';

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
  isMyBooking: boolean;
  isProxyBooking: boolean;
  location: {
    branchId: string;
    branchName: string;
    buildingName: string;
    floorName: string;
    floorCode: string;
    sectionName: string;
  };
}

export interface AvailableDesk {
  id: string;
  deskCode: string;
  hasHdmi: boolean;
  sectionName: string;
  floorName: string;
  buildingName: string;
  branchName: string;
}

export interface AvailableMeetingRoom {
  id: string;
  name: string;
  capacity: number;
  hasHdmi: boolean;
  hdmiCount: number;
  sectionName: string;
  floorName: string;
  buildingName: string;
  branchName: string;
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

  // Current calendar anchor date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('MONTH');
  const [resourceFilter, setResourceFilter] = useState<ResourceFilterType>('ALL');
  const [sessionFilter, setSessionFilter] = useState<SessionFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Events & Loading
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Mass Cancel Mode & Selected Event IDs
  const [isMassCancelMode, setIsMassCancelMode] = useState<boolean>(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isSubmittingMassCancel, setIsSubmittingMassCancel] = useState<boolean>(false);
  const [massCancelReason, setMassCancelReason] = useState<string>('');
  const [isMassCancelConfirmModalOpen, setIsMassCancelConfirmModalOpen] = useState<boolean>(false);

  // Inspector Modal for selected event
  const [inspectedEvent, setInspectedEvent] = useState<CalendarEventItem | null>(null);
  const [isCancellingSingle, setIsCancellingSingle] = useState<boolean>(false);
  const [singleCancelReason, setSingleCancelReason] = useState<string>('');

  // Quick Slot Booking Modal
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState<boolean>(false);
  const [quickBookingDate, setQuickBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quickResourceType, setQuickResourceType] = useState<'DESK' | 'MEETING_ROOM'>('DESK');
  const [quickSessionType, setQuickSessionType] = useState<'SESSION_1' | 'SESSION_2' | 'FULL_DAY'>('SESSION_1');
  const [quickSelectedDeskId, setQuickSelectedDeskId] = useState<string>('');
  const [quickSelectedRoomId, setQuickSelectedRoomId] = useState<string>('');
  const [quickMeetingTitle, setQuickMeetingTitle] = useState<string>('');
  const [quickAttendeesCount, setQuickAttendeesCount] = useState<number>(4);
  const [quickNotes, setQuickNotes] = useState<string>('');
  const [quickBookingFor, setQuickBookingFor] = useState<'SELF' | 'COLLEAGUE'>('SELF');
  const [quickSelectedColleagueId, setQuickSelectedColleagueId] = useState<string>('');
  const [isSubmittingQuickBooking, setIsSubmittingQuickBooking] = useState<boolean>(false);

  // Mass Multi-Day Booking Modal (Max 30 Days)
  const [isMassBookingModalOpen, setIsMassBookingModalOpen] = useState<boolean>(false);
  const [massStartDate, setMassStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [massEndDate, setMassEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [massWeekdaysOnly, setMassWeekdaysOnly] = useState<boolean>(true);
  const [massResourceType, setMassResourceType] = useState<'DESK' | 'MEETING_ROOM'>('DESK');
  const [massSessionType, setMassSessionType] = useState<'SESSION_1' | 'SESSION_2' | 'FULL_DAY'>('FULL_DAY');
  const [massSelectedDeskIds, setMassSelectedDeskIds] = useState<string[]>([]);
  const [massSelectedRoomId, setMassSelectedRoomId] = useState<string>('');
  const [massMeetingTitle, setMassMeetingTitle] = useState<string>('');
  const [massAttendeesCount, setMassAttendeesCount] = useState<number>(4);
  const [massNotes, setMassNotes] = useState<string>('');
  const [isSubmittingMassBooking, setIsSubmittingMassBooking] = useState<boolean>(false);

  // Resources lookup for modal pickers
  const [availableDesks, setAvailableDesks] = useState<AvailableDesk[]>([]);
  const [availableRooms, setAvailableRooms] = useState<AvailableMeetingRoom[]>([]);
  const [colleaguesList, setColleaguesList] = useState<ColleagueItem[]>([]);

  // Calculate Date Range based on Current View
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'MONTH') {
      // Month view: Start from first day of month - padded to start of week, end padded to end of week
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const start = new Date(firstDay);
      const dayOffset = start.getDay(); // 0 is Sun
      start.setDate(start.getDate() - dayOffset);

      const end = new Date(lastDay);
      const endOffset = 6 - end.getDay();
      end.setDate(end.getDate() + endOffset);

      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else if (viewMode === 'WEEK' || viewMode === 'WORK_WEEK') {
      const curr = new Date(currentDate);
      const day = curr.getDay();
      const diffToSunday = curr.getDate() - day;

      const start = new Date(curr);
      start.setDate(diffToSunday);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else {
      // Day or Agenda view (30 days window)
      const start = new Date(currentDate);
      start.setDate(start.getDate() - 7);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 30);

      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
  }, [currentDate, viewMode]);

  // Fetch Calendar Events
  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        resourceType: resourceFilter,
        sessionType: sessionFilter,
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

  // Fetch Available Desks, Meeting Rooms, and Colleagues for Modals
  const loadModalResources = async () => {
    try {
      // Floor plans for desks
      const floorRes = await fetchApi<{ branches: any[] }>('/employee/floor-plans');
      const deskList: AvailableDesk[] = [];
      const roomList: AvailableMeetingRoom[] = [];

      if (floorRes?.branches) {
        for (const b of floorRes.branches) {
          for (const bld of b.buildings || []) {
            for (const fl of bld.floors || []) {
              for (const sec of fl.sections || []) {
                if (sec.meetingRoom) {
                  roomList.push({
                    id: sec.meetingRoom.id,
                    name: sec.meetingRoom.name,
                    capacity: sec.meetingRoom.capacity,
                    hasHdmi: sec.meetingRoom.hasHdmi,
                    hdmiCount: sec.meetingRoom.hdmiCount,
                    sectionName: sec.name,
                    floorName: fl.name,
                    buildingName: bld.name,
                    branchName: b.name,
                  });
                }
                for (const d of sec.desks || []) {
                  if (!d.isMeetingRoom) {
                    deskList.push({
                      id: d.id,
                      deskCode: d.deskCode,
                      hasHdmi: d.hasHdmi,
                      sectionName: sec.name,
                      floorName: fl.name,
                      buildingName: bld.name,
                      branchName: b.name,
                    });
                  }
                }
              }
            }
          }
        }
      }
      setAvailableDesks(deskList);
      setAvailableRooms(roomList);
      if (deskList.length > 0 && !quickSelectedDeskId) {
        setQuickSelectedDeskId(deskList[0].id);
      }
      if (roomList.length > 0 && !quickSelectedRoomId) {
        setQuickSelectedRoomId(roomList[0].id);
        setMassSelectedRoomId(roomList[0].id);
      }

      // Load colleagues
      const colRes = await fetchApi<{ colleagues: ColleagueItem[] }>('/employee/colleagues');
      setColleaguesList(colRes?.colleagues || []);
    } catch (err) {
      console.error('Failed to load auxiliary resources for modal:', err);
    }
  };

  useEffect(() => {
    loadCalendarEvents();
  }, [dateRange.startDate, dateRange.endDate, resourceFilter, sessionFilter]);

  useEffect(() => {
    loadModalResources();
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
        e.location.buildingName.toLowerCase().includes(q) ||
        e.location.sectionName.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  // Date Navigation Handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'WEEK' || viewMode === 'WORK_WEEK') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'WEEK' || viewMode === 'WORK_WEEK') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title Formatter
  const headerTitle = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    return currentDate.toLocaleDateString('en-US', options);
  }, [currentDate]);

  // Quick Open New Booking on Empty Slot Click
  const handleOpenSlotBooking = (dateStr: string, session: 'SESSION_1' | 'SESSION_2' | 'FULL_DAY' = 'SESSION_1') => {
    setQuickBookingDate(dateStr);
    setQuickSessionType(session);
    setIsQuickBookingOpen(true);
  };

  // Submit Quick Slot Booking
  const handleConfirmQuickBooking = async () => {
    try {
      setIsSubmittingQuickBooking(true);
      setErrorNotice(null);

      const payload: any = {
        bookingDate: quickBookingDate,
        sessionType: quickSessionType,
        resourceType: quickResourceType,
        notes: quickNotes.trim() || undefined,
      };

      if (quickResourceType === 'DESK') {
        if (!quickSelectedDeskId) throw new Error('Please select a cubicle desk.');
        payload.deskId = quickSelectedDeskId;
      } else {
        if (!quickSelectedRoomId) throw new Error('Please select a meeting room.');
        payload.meetingRoomId = quickSelectedRoomId;
        payload.title = quickMeetingTitle.trim() || 'Meeting Room Reservation';
        payload.attendeesCount = quickAttendeesCount || 4;
      }

      if (quickBookingFor === 'COLLEAGUE') {
        if (!quickSelectedColleagueId) throw new Error('Please select a colleague to book for.');
        payload.colleagueUserId = quickSelectedColleagueId;
      }

      const res = await fetchApi<{ success: boolean; message: string }>('/employee/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(res?.message || 'Reservation created successfully!');
      setTimeout(() => setSuccessNotice(null), 5000);

      setIsQuickBookingOpen(false);
      setQuickNotes('');
      setQuickMeetingTitle('');
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Failed to create reservation:', err);
      setErrorNotice(err.message || 'Failed to complete reservation.');
    } finally {
      setIsSubmittingQuickBooking(false);
    }
  };

  // Calculate Mass Booking Days Count
  const calculatedMassDays = useMemo(() => {
    if (!massStartDate || !massEndDate) return 0;
    const start = new Date(massStartDate);
    const end = new Date(massEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

    let count = 0;
    const curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (!massWeekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }, [massStartDate, massEndDate, massWeekdaysOnly]);

  // Submit Mass Booking (Max 30 Days)
  const handleConfirmMassBooking = async () => {
    try {
      if (calculatedMassDays <= 0) {
        throw new Error('Please select a valid date range.');
      }
      if (calculatedMassDays > 30) {
        throw new Error(`Maximum booking duration is 30 days. Your selection has ${calculatedMassDays} days.`);
      }

      setIsSubmittingMassBooking(true);
      setErrorNotice(null);

      const payload: any = {
        startDate: massStartDate,
        endDate: massEndDate,
        weekdaysOnly: massWeekdaysOnly,
        sessionType: massSessionType,
        resourceType: massResourceType,
        notes: massNotes.trim() || undefined,
      };

      if (massResourceType === 'DESK') {
        if (massSelectedDeskIds.length === 0) {
          throw new Error('Please select at least one workstation cubicle.');
        }
        payload.deskIds = massSelectedDeskIds;
      } else {
        if (!massSelectedRoomId) {
          throw new Error('Please select a meeting room.');
        }
        payload.meetingRoomId = massSelectedRoomId;
        payload.title = massMeetingTitle.trim() || 'Meeting Room Reservation';
        payload.attendeesCount = massAttendeesCount || 4;
      }

      const res = await fetchApi<{ success: boolean; message: string; count: number }>('/employee/mass-booking', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessNotice(
        res?.message || `Successfully created mass reservation for ${calculatedMassDays} days!`
      );
      setTimeout(() => setSuccessNotice(null), 6000);

      setIsMassBookingModalOpen(false);
      setMassSelectedDeskIds([]);
      setMassNotes('');
      setMassMeetingTitle('');
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Failed to create mass booking:', err);
      setErrorNotice(err.message || 'Failed to complete mass booking.');
    } finally {
      setIsSubmittingMassBooking(false);
    }
  };

  // Toggle Selection in Mass Cancel Mode
  const toggleSelectEvent = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSelectAllMyEvents = () => {
    const myIds = filteredEvents.filter((e) => e.isMyBooking || e.isProxyBooking).map((e) => e.id);
    setSelectedEventIds(myIds);
  };

  const handleDeselectAll = () => {
    setSelectedEventIds([]);
  };

  // Submit Mass Cancel
  const handleConfirmMassCancel = async () => {
    if (selectedEventIds.length === 0) return;

    try {
      setIsSubmittingMassCancel(true);
      setErrorNotice(null);

      const res = await fetchApi<{ success: boolean; message: string; count: number }>('/employee/bulk-cancel', {
        method: 'POST',
        body: JSON.stringify({
          bookingIds: selectedEventIds,
          reason: massCancelReason.trim() || 'Cancelled via Outlook Calendar Mass Action',
        }),
      });

      setSuccessNotice(res?.message || `Successfully cancelled ${selectedEventIds.length} reservation(s).`);
      setTimeout(() => setSuccessNotice(null), 5000);

      setSelectedEventIds([]);
      setIsMassCancelMode(false);
      setIsMassCancelConfirmModalOpen(false);
      setMassCancelReason('');
      await loadCalendarEvents();
    } catch (err: any) {
      console.error('Failed to mass cancel:', err);
      setErrorNotice(err.message || 'Failed to mass cancel reservations.');
    } finally {
      setIsSubmittingMassCancel(false);
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
          reason: singleCancelReason.trim() || 'Cancelled from Calendar Event Inspector',
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

  // Calendar Days Computation for Month View
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

    // Starting day of the week (0 = Sun, 1 = Mon, etc.)
    const startDay = firstDayOfMonth.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Previous month padding days
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

    // Current month days
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

    // Next month padding days to complete 35 or 42 grid cells
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

  // Days for Week & Work-Week Views
  const weekViewDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diffToSunday = curr.getDate() - day;

    const days: Array<{
      date: Date;
      dateStr: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      session1Events: CalendarEventItem[];
      session2Events: CalendarEventItem[];
      fullDayEvents: CalendarEventItem[];
    }> = [];

    const totalDays = viewMode === 'WORK_WEEK' ? 5 : 7;
    const startIndex = viewMode === 'WORK_WEEK' ? 1 : 0; // Mon=1 if work week

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(curr);
      d.setDate(diffToSunday + startIndex + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayEvents = filteredEvents.filter((e) => e.bookingDate === dateStr);

      days.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isToday: dateStr === new Date().toISOString().split('T')[0],
        session1Events: dayEvents.filter((e) => e.sessionType === 'SESSION_1' || e.sessionType === 'FULL_DAY'),
        session2Events: dayEvents.filter((e) => e.sessionType === 'SESSION_2' || e.sessionType === 'FULL_DAY'),
        fullDayEvents: dayEvents.filter((e) => e.sessionType === 'FULL_DAY'),
      });
    }

    return days;
  }, [currentDate, viewMode, filteredEvents]);

  // Session Badge Pill Helper
  const getSessionBadge = (sessionType: string) => {
    switch (sessionType) {
      case 'SESSION_1':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            Session 1 (Morning)
          </span>
        );
      case 'SESSION_2':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
            Session 2 (Afternoon)
          </span>
        );
      case 'FULL_DAY':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
            Full Day (Sessions 1 &amp; 2)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Outlook Ribbon Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Branding & Date Nav */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Outlook Workspace Calendar
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Session Grid
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Interactive multi-tenant reservations with mass booking &amp; 30-day duration limits
                </p>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>

            {/* Date Navigation */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:shadow-xs rounded-lg transition-all"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrev}
                title="Previous"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs rounded-lg transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-black text-slate-900 px-2 min-w-[140px] text-center">
                {headerTitle}
              </span>
              <button
                type="button"
                onClick={handleNext}
                title="Next"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-xs rounded-lg transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: View Modes & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['MONTH', 'WEEK', 'WORK_WEEK', 'DAY', 'AGENDA'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewMode === mode
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {mode === 'WORK_WEEK' ? 'Work Week' : mode.charAt(0) + mode.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Action: Mass Cancel Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsMassCancelMode(!isMassCancelMode);
                if (isMassCancelMode) setSelectedEventIds([]);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                isMassCancelMode
                  ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-400/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isMassCancelMode ? 'Exit Mass Cancel' : 'Mass Cancel Mode'}</span>
            </button>

            {/* Action: Mass Multi-Day Booking */}
            <button
              type="button"
              onClick={() => setIsMassBookingModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <CalendarRange className="w-4 h-4" />
              <span>Mass Book (Max 30d)</span>
            </button>

            {/* Action: New Single Booking */}
            <button
              type="button"
              onClick={() => {
                setQuickBookingDate(currentDate.toISOString().split('T')[0]);
                setIsQuickBookingOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Booking</span>
            </button>
          </div>
        </div>

        {/* Second Row: Filters and Search */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Resource Type Filter */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Resource:
              </span>
              <button
                type="button"
                onClick={() => setResourceFilter('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  resourceFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setResourceFilter('DESK')}
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  resourceFilter === 'DESK' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cubicles
              </button>
              <button
                type="button"
                onClick={() => setResourceFilter('MEETING_ROOM')}
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  resourceFilter === 'MEETING_ROOM'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Meeting Rooms
              </button>
            </div>

            {/* Session Filter */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Session:
              </span>
              <button
                type="button"
                onClick={() => setSessionFilter('ALL')}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  sessionFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Sessions
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('SESSION_1')}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  sessionFilter === 'SESSION_1' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Session 1 (09:00 - 13:30)
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('SESSION_2')}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  sessionFilter === 'SESSION_2' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Session 2 (13:30 - 18:00)
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reservations, rooms, desks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </header>

      {/* Floating Notices */}
      {successNotice && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button type="button" onClick={() => setSuccessNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-bold rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button type="button" onClick={() => setErrorNotice(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mass Cancel Active Banner */}
      {isMassCancelMode && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold">
            <Trash2 className="w-4 h-4 text-amber-600" />
            <span>Mass Cancel Mode Enabled:</span>
            <span className="font-normal text-amber-800">
              Click checkboxes on your reservation blocks to select them for simultaneous release.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllMyEvents}
              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded text-xs font-bold text-amber-900"
            >
              Select All My Bookings
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded text-xs font-bold text-amber-900"
            >
              Deselect All
            </button>
            <button
              type="button"
              disabled={selectedEventIds.length === 0}
              onClick={() => setIsMassCancelConfirmModalOpen(true)}
              className="px-3.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded font-black text-xs shadow-xs"
            >
              Cancel Selected ({selectedEventIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Main Calendar Content Body */}
      <main className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Synchronizing Outlook Calendar reservations...</p>
          </div>
        ) : (
          <>
            {/* 1. MONTH VIEW */}
            {viewMode === 'MONTH' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                {/* Weekday Header */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-xs font-extrabold text-slate-600 py-3 uppercase tracking-wider">
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
                      className={`min-h-[140px] p-2 flex flex-col justify-between transition-colors ${
                        cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/50 text-slate-400'
                      }`}
                    >
                      {/* Cell Day Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                            cell.isToday
                              ? 'bg-blue-600 text-white shadow-xs font-black'
                              : cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenSlotBooking(cell.dateStr, 'SESSION_1')}
                          title="Quick Book on this date"
                          className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Event Chips List */}
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-24 pr-0.5">
                        {cell.events.map((ev) => {
                          const isSelected = selectedEventIds.includes(ev.id);
                          const isMeeting = ev.resourceType === 'MEETING_ROOM';

                          let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                          if (ev.isMyBooking) {
                            badgeColor = isMeeting
                              ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 font-bold'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 font-bold';
                          } else if (ev.isProxyBooking) {
                            badgeColor = 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 font-bold';
                          }

                          return (
                            <div
                              key={ev.id}
                              onClick={() => {
                                if (isMassCancelMode) {
                                  if (ev.isMyBooking || ev.isProxyBooking) toggleSelectEvent(ev.id);
                                } else {
                                  setInspectedEvent(ev);
                                }
                              }}
                              className={`text-[11px] p-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all shadow-2xs ${badgeColor} ${
                                isSelected ? 'ring-2 ring-red-500 bg-red-100 border-red-300' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                {isMassCancelMode && (ev.isMyBooking || ev.isProxyBooking) ? (
                                  <div className="mr-1">
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                  </div>
                                ) : isMeeting ? (
                                  <Users className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                ) : (
                                  <Monitor className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                )}

                                <span className="font-extrabold truncate">
                                  {isMeeting ? ev.title || ev.resourceName : ev.resourceCode}
                                </span>
                              </div>

                              <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-white/70">
                                {ev.sessionType === 'SESSION_1' ? 'S1' : ev.sessionType === 'SESSION_2' ? 'S2' : 'Full'}
                              </span>
                            </div>
                          );
                        })}

                        {cell.events.length === 0 && (
                          <div
                            onClick={() => handleOpenSlotBooking(cell.dateStr, 'SESSION_1')}
                            className="h-full flex items-center justify-center text-[10px] text-slate-300 hover:text-blue-500 font-bold cursor-pointer transition-colors py-2"
                          >
                            + Reserve
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. WEEK & WORK-WEEK VIEWS */}
            {(viewMode === 'WEEK' || viewMode === 'WORK_WEEK') && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                {/* Weekday Columns Header */}
                <div
                  className={`grid ${
                    viewMode === 'WORK_WEEK' ? 'grid-cols-5' : 'grid-cols-7'
                  } bg-slate-50 border-b border-slate-200 text-center py-3 divide-x divide-slate-200`}
                >
                  {weekViewDays.map((d, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-[11px] font-extrabold text-slate-500 uppercase">{d.dayName}</span>
                      <span
                        className={`text-sm font-black w-7 h-7 flex items-center justify-center rounded-full mt-1 ${
                          d.isToday ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-800'
                        }`}
                      >
                        {d.dayNumber}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Session 1 Row */}
                <div className="border-b border-slate-200">
                  <div className="bg-amber-50/70 border-b border-amber-200/50 px-4 py-1.5 flex items-center justify-between text-xs font-black text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Session 1 (Morning &bull; 09:00 - 13:30)
                    </span>
                  </div>
                  <div
                    className={`grid ${
                      viewMode === 'WORK_WEEK' ? 'grid-cols-5' : 'grid-cols-7'
                    } divide-x divide-slate-200 min-h-[160px]`}
                  >
                    {weekViewDays.map((d, i) => (
                      <div key={i} className="p-2 space-y-1.5 bg-white hover:bg-slate-50/50 transition-colors">
                        {d.session1Events.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (isMassCancelMode) {
                                if (ev.isMyBooking || ev.isProxyBooking) toggleSelectEvent(ev.id);
                              } else {
                                setInspectedEvent(ev);
                              }
                            }}
                            className={`p-2 rounded-xl border text-xs cursor-pointer shadow-xs transition-all ${
                              ev.isMyBooking
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                : ev.resourceType === 'MEETING_ROOM'
                                ? 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black flex items-center justify-between">
                              <span className="truncate">{ev.title || ev.resourceName}</span>
                              <span className="text-[9px] px-1 rounded bg-white/80 font-extrabold">S1</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                              Host: {ev.user.name} {ev.isMyBooking && '(You)'}
                            </div>
                          </div>
                        ))}

                        {d.session1Events.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenSlotBooking(d.dateStr, 'SESSION_1')}
                            className="w-full h-24 border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl flex items-center justify-center text-xs font-bold text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                          >
                            + Book S1
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session 2 Row */}
                <div>
                  <div className="bg-indigo-50/70 border-b border-indigo-200/50 px-4 py-1.5 flex items-center justify-between text-xs font-black text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Session 2 (Afternoon &bull; 13:30 - 18:00)
                    </span>
                  </div>
                  <div
                    className={`grid ${
                      viewMode === 'WORK_WEEK' ? 'grid-cols-5' : 'grid-cols-7'
                    } divide-x divide-slate-200 min-h-[160px]`}
                  >
                    {weekViewDays.map((d, i) => (
                      <div key={i} className="p-2 space-y-1.5 bg-white hover:bg-slate-50/50 transition-colors">
                        {d.session2Events.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => {
                              if (isMassCancelMode) {
                                if (ev.isMyBooking || ev.isProxyBooking) toggleSelectEvent(ev.id);
                              } else {
                                setInspectedEvent(ev);
                              }
                            }}
                            className={`p-2 rounded-xl border text-xs cursor-pointer shadow-xs transition-all ${
                              ev.isMyBooking
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                : ev.resourceType === 'MEETING_ROOM'
                                ? 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black flex items-center justify-between">
                              <span className="truncate">{ev.title || ev.resourceName}</span>
                              <span className="text-[9px] px-1 rounded bg-white/80 font-extrabold">S2</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                              Host: {ev.user.name} {ev.isMyBooking && '(You)'}
                            </div>
                          </div>
                        ))}

                        {d.session2Events.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenSlotBooking(d.dateStr, 'SESSION_2')}
                            className="w-full h-24 border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl flex items-center justify-center text-xs font-bold text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                          >
                            + Book S2
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. DAY VIEW */}
            {viewMode === 'DAY' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Day Schedule: {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Detailed session breakdown for cubicle workstations and meeting rooms
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenSlotBooking(currentDate.toISOString().split('T')[0], 'SESSION_1')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    + Book for Today
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Session 1 Box */}
                  <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-black text-amber-950">Session 1 (09:00 - 13:30)</h3>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Morning Slot
                      </span>
                    </div>

                    <div className="space-y-2">
                      {filteredEvents
                        .filter(
                          (e) =>
                            e.bookingDate === currentDate.toISOString().split('T')[0] &&
                            (e.sessionType === 'SESSION_1' || e.sessionType === 'FULL_DAY')
                        )
                        .map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => setInspectedEvent(ev)}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:shadow-xs cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                                  ev.resourceType === 'MEETING_ROOM' ? 'bg-purple-600' : 'bg-emerald-600'
                                }`}
                              >
                                {ev.resourceType === 'MEETING_ROOM' ? (
                                  <Users className="w-4 h-4" />
                                ) : (
                                  <Monitor className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900">
                                  {ev.title || ev.resourceName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  Host: {ev.user.name} &bull; {ev.location.floorName} ({ev.location.sectionName})
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-blue-600 hover:underline">View</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Session 2 Box */}
                  <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-black text-indigo-950">Session 2 (13:30 - 18:00)</h3>
                      </div>
                      <span className="text-xs font-bold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                        Afternoon Slot
                      </span>
                    </div>

                    <div className="space-y-2">
                      {filteredEvents
                        .filter(
                          (e) =>
                            e.bookingDate === currentDate.toISOString().split('T')[0] &&
                            (e.sessionType === 'SESSION_2' || e.sessionType === 'FULL_DAY')
                        )
                        .map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => setInspectedEvent(ev)}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:shadow-xs cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                                  ev.resourceType === 'MEETING_ROOM' ? 'bg-purple-600' : 'bg-emerald-600'
                                }`}
                              >
                                {ev.resourceType === 'MEETING_ROOM' ? (
                                  <Users className="w-4 h-4" />
                                ) : (
                                  <Monitor className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900">
                                  {ev.title || ev.resourceName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  Host: {ev.user.name} &bull; {ev.location.floorName} ({ev.location.sectionName})
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-blue-600 hover:underline">View</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. AGENDA / LIST VIEW */}
            {viewMode === 'AGENDA' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Chronological Reservation Feed ({filteredEvents.length} Total)
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredEvents.map((ev) => {
                    const isSelected = selectedEventIds.includes(ev.id);
                    const isMeeting = ev.resourceType === 'MEETING_ROOM';

                    return (
                      <div
                        key={ev.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          isSelected ? 'bg-red-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-start sm:items-center space-x-3">
                          {isMassCancelMode && (ev.isMyBooking || ev.isProxyBooking) && (
                            <button
                              type="button"
                              onClick={() => toggleSelectEvent(ev.id)}
                              className="mt-0.5 sm:mt-0 p-1 text-slate-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-red-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          )}

                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                              isMeeting ? 'bg-purple-600' : 'bg-emerald-600'
                            }`}
                          >
                            {isMeeting ? <Users className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">
                                {ev.title || ev.resourceName}
                              </span>
                              {getSessionBadge(ev.sessionType)}
                              {ev.isMyBooking && (
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                  My Booking
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                              <span className="font-semibold text-slate-700">{ev.bookingDate}</span>
                              <span>&bull;</span>
                              <span>
                                {ev.location.buildingName} &bull; {ev.location.floorName} ({ev.location.sectionName})
                              </span>
                              <span>&bull;</span>
                              <span>Host: {ev.user.name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setInspectedEvent(ev)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredEvents.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                      <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-600">No reservations found for this view</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your date range, resource filters, or search terms.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL 1: Quick Slot Booking Modal */}
      {isQuickBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-black">
                  +
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">New Reservation</h3>
                  <p className="text-xs text-slate-500">Book workstation cubicle or meeting room</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickBookingOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Resource Type Selection */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Resource Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickResourceType('DESK')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 ${
                      quickResourceType === 'DESK'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    Cubicle Desk
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickResourceType('MEETING_ROOM')}
                    className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-2 ${
                      quickResourceType === 'MEETING_ROOM'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 ring-2 ring-purple-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Meeting Room
                  </button>
                </div>
              </div>

              {/* Date & Session */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reservation Date</label>
                  <input
                    type="date"
                    value={quickBookingDate}
                    onChange={(e) => setQuickBookingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Session Slot</label>
                  <select
                    value={quickSessionType}
                    onChange={(e: any) => setQuickSessionType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SESSION_1">Session 1 (09:00 - 13:30)</option>
                    <option value="SESSION_2">Session 2 (13:30 - 18:00)</option>
                    <option value="FULL_DAY">Full Day (All Sessions)</option>
                  </select>
                </div>
              </div>

              {/* Resource Select */}
              {quickResourceType === 'DESK' ? (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Workstation Cubicle</label>
                  <select
                    value={quickSelectedDeskId}
                    onChange={(e) => setQuickSelectedDeskId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableDesks.map((d) => (
                      <option key={d.id} value={d.id}>
                        Desk {d.deskCode} &bull; {d.floorName} ({d.sectionName}) {d.hasHdmi ? '• [HDMI]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Select Meeting Room</label>
                    <select
                      value={quickSelectedRoomId}
                      onChange={(e) => setQuickSelectedRoomId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} &bull; Capacity: {r.capacity} {r.hasHdmi ? `• (${r.hdmiCount} HDMI)` : ''} &bull;{' '}
                          {r.floorName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Meeting Title / Topic</label>
                      <input
                        type="text"
                        placeholder="e.g. Q3 Sprint Planning"
                        value={quickMeetingTitle}
                        onChange={(e) => setQuickMeetingTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Expected Attendees</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={quickAttendeesCount}
                        onChange={(e) => setQuickAttendeesCount(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Mode: Self vs Proxy Colleague */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Reservation Recipient</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickBookingFor('SELF')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold ${
                      quickBookingFor === 'SELF'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Myself ({user?.name})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickBookingFor('COLLEAGUE')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold ${
                      quickBookingFor === 'COLLEAGUE'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    On Behalf of Colleague
                  </button>
                </div>

                {quickBookingFor === 'COLLEAGUE' && (
                  <div className="mt-2">
                    <select
                      value={quickSelectedColleagueId}
                      onChange={(e) => setQuickSelectedColleagueId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose Colleague --</option>
                      {colleaguesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email}) - {c.department}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Agenda (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or agenda items..."
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsQuickBookingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingQuickBooking}
                onClick={handleConfirmQuickBooking}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md shadow-blue-500/20"
              >
                {isSubmittingQuickBooking ? 'Reserving...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Mass Multi-Day Booking Modal (Max 30 Days) */}
      {isMassBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-black">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Mass Multi-Day Booking</h3>
                  <p className="text-xs text-slate-500">
                    Reserve for up to a maximum duration of 30 days
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMassBookingModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Date Range Selection with 30-day banner */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-900">Date Range Configuration</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      calculatedMassDays > 30
                        ? 'bg-red-100 text-red-800'
                        : calculatedMassDays > 0
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Duration: {calculatedMassDays} Days {calculatedMassDays > 30 && '(Exceeds 30d Limit!)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Start Date</label>
                    <input
                      type="date"
                      value={massStartDate}
                      onChange={(e) => setMassStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">End Date</label>
                    <input
                      type="date"
                      value={massEndDate}
                      onChange={(e) => setMassEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="weekdaysOnly"
                    checked={massWeekdaysOnly}
                    onChange={(e) => setMassWeekdaysOnly(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <label htmlFor="weekdaysOnly" className="text-slate-700 font-bold cursor-pointer">
                    Weekdays Only (Skip Saturdays and Sundays)
                  </label>
                </div>
              </div>

              {/* Resource Type & Session */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Resource Type</label>
                  <select
                    value={massResourceType}
                    onChange={(e: any) => setMassResourceType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="DESK">Cubicle Workstation(s)</option>
                    <option value="MEETING_ROOM">Meeting Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Session</label>
                  <select
                    value={massSessionType}
                    onChange={(e: any) => setMassSessionType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="SESSION_1">Session 1 (09:00 - 13:30)</option>
                    <option value="SESSION_2">Session 2 (13:30 - 18:00)</option>
                    <option value="FULL_DAY">Full Day (All Sessions)</option>
                  </select>
                </div>
              </div>

              {/* Target Resource Picker */}
              {massResourceType === 'DESK' ? (
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Select Cubicles to Reserve ({massSelectedDeskIds.length} selected &bull; Max 8)
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100">
                    {availableDesks.map((d) => {
                      const isSelected = massSelectedDeskIds.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            setMassSelectedDeskIds((prev) =>
                              prev.includes(d.id)
                                ? prev.filter((id) => id !== d.id)
                                : prev.length < 8
                                ? [...prev, d.id]
                                : prev
                            );
                          }}
                          className={`p-2 flex items-center justify-between text-xs cursor-pointer rounded-lg transition-colors ${
                            isSelected ? 'bg-purple-100 text-purple-900 font-black' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Monitor className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              Desk {d.deskCode} &bull; {d.floorName} ({d.sectionName})
                            </span>
                          </div>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Select Meeting Room</label>
                    <select
                      value={massSelectedRoomId}
                      onChange={(e) => setMassSelectedRoomId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} &bull; Capacity: {r.capacity} ({r.hdmiCount} HDMI)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Meeting Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Daily Standup / Sprint Sync"
                        value={massMeetingTitle}
                        onChange={(e) => setMassMeetingTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Expected Attendees</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={massAttendeesCount}
                        onChange={(e) => setMassAttendeesCount(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Mass Reservation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes for the multi-day booking series..."
                  value={massNotes}
                  onChange={(e) => setMassNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-semibold">
                Will create up to {calculatedMassDays * (massResourceType === 'DESK' ? Math.max(1, massSelectedDeskIds.length) : 1)} reservations
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsMassBookingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingMassBooking || calculatedMassDays <= 0 || calculatedMassDays > 30}
                  onClick={handleConfirmMassBooking}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-md shadow-purple-500/20"
                >
                  {isSubmittingMassBooking ? 'Creating Mass Booking...' : 'Confirm Mass Reservation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Event Inspector & Single Cancel Modal */}
      {inspectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                    inspectedEvent.resourceType === 'MEETING_ROOM' ? 'bg-purple-600' : 'bg-emerald-600'
                  }`}
                >
                  {inspectedEvent.resourceType === 'MEETING_ROOM' ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <Monitor className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {inspectedEvent.title || inspectedEvent.resourceName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Reservation Inspector</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Date &bull; Session:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-800">{inspectedEvent.bookingDate}</span>
                    {getSessionBadge(inspectedEvent.sessionType)}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Location:</span>
                  <span className="font-extrabold text-slate-800">
                    {inspectedEvent.location.buildingName} &bull; {inspectedEvent.location.floorName} (
                    {inspectedEvent.location.sectionName})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Reserved By / Host:</span>
                  <span className="font-extrabold text-slate-800">
                    {inspectedEvent.user.name} ({inspectedEvent.user.email})
                  </span>
                </div>

                {inspectedEvent.isProxyBooking && inspectedEvent.bookedByUser && (
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="font-bold">Proxy Booked By:</span>
                    <span className="font-extrabold">{inspectedEvent.bookedByUser.name}</span>
                  </div>
                )}

                {inspectedEvent.resourceType === 'MEETING_ROOM' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Attendees:</span>
                    <span className="font-extrabold text-slate-800">
                      Up to {inspectedEvent.attendeesCount || 4} Participants
                    </span>
                  </div>
                )}

                {inspectedEvent.notes && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-bold block mb-0.5">Notes:</span>
                    <p className="text-slate-700 italic">{inspectedEvent.notes}</p>
                  </div>
                )}
              </div>

              {(inspectedEvent.isMyBooking || inspectedEvent.isProxyBooking) && (
                <div className="space-y-2 pt-2">
                  <label className="block text-slate-700 font-bold">Cancellation Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="Reason for releasing reservation..."
                    value={singleCancelReason}
                    onChange={(e) => setSingleCancelReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>

              {(inspectedEvent.isMyBooking || inspectedEvent.isProxyBooking) ? (
                <button
                  type="button"
                  disabled={isCancellingSingle}
                  onClick={handleConfirmSingleCancel}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-md shadow-red-500/20"
                >
                  {isCancellingSingle ? 'Cancelling...' : 'Cancel Reservation'}
                </button>
              ) : (
                <span className="text-[11px] text-slate-400 italic">View Only (Reserved by Colleague)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Mass Cancel Confirmation Modal */}
      {isMassCancelConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-black text-slate-900">
                Confirm Mass Cancellation ({selectedEventIds.length} Items)
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel and release all <span className="font-bold text-slate-900">{selectedEventIds.length}</span> selected reservations? This action is atomic and will immediately free up these workstations/rooms for other team members.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cancellation Reason</label>
              <input
                type="text"
                placeholder="e.g. Sprint schedule adjusted / remote week"
                value={massCancelReason}
                onChange={(e) => setMassCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMassCancelConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSubmittingMassCancel}
                onClick={handleConfirmMassCancel}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-md shadow-red-500/20"
              >
                {isSubmittingMassCancel ? 'Releasing...' : 'Confirm Release All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
