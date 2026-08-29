import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  Building2, Building, Calendar, Clock, User, Users, Check,
  Search, Filter, Monitor, ShieldAlert, Zap, Presentation, AlertCircle, ChevronRight
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';
import { db } from '../../db/indexedDB';

export const BookingWizardPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  // Navigation Steps: 1 = Location & Date Range, 2 = Grid Selection
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reference lists
  const [branches, setBranches] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);

  // Selection states
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Date and Weekday params (Task 3.3)
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(todayStr);
  
  // Default to today + 6 days
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 6);
  const [endDate, setEndDate] = useState<string>(defaultEnd.toISOString().split('T')[0]);

  // Mon-Sun Weekdays states (Task 3.3)
  // Each day key maps to whether the user wants to book on that weekday
  const [selectedWeekdays, setSelectedWeekdays] = useState<{ [key: number]: boolean }>({
    1: true, // Monday
    2: true, // Tuesday
    3: true, // Wednesday
    4: true, // Thursday
    5: true, // Friday
    6: false, // Saturday
    0: false, // Sunday
  });

  // Enabled weekdays inside date range
  const [enabledWeekdays, setEnabledWeekdays] = useState<{ [key: number]: boolean }>({});

  // Session Type bounds (Task 3.5)
  const [sessionType, setSessionType] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');

  // Proxy / Lead options
  const [isProxyBooking, setIsProxyBooking] = useState(false);
  const [selectedSubordinateIds, setSelectedSubordinateIds] = useState<string[]>([]);
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');
  const [bulkResults, setBulkResults] = useState<any[] | null>(null);

  // Comment (Task 3.6)
  const [comment, setComment] = useState('');

  // Mon-Sun Occurrence Overlay active resource
  const [overlayResourceId, setOverlayResourceId] = useState<string | null>(null);

  // Warning check banner (Task 3.4)
  const [hasSelfConflictWarning, setHasSelfConflictWarning] = useState(false);

  // Load initial branches and team roster
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        if (navigator.onLine) {
          const [branchList, rosterList] = await Promise.all([
            fetchApi<any[]>('/branches'),
            fetchApi<any>('/roster'),
          ]);
          setBranches(branchList);
          setTeamUsers(rosterList.users || []);
          if (branchList.length > 0) {
            setSelectedBranchId(user?.baseBranchId || branchList[0].id);
          }
        } else {
          const cachedBranches = await db.branches.toArray();
          setBranches(cachedBranches);
          if (cachedBranches.length > 0) {
            setSelectedBranchId(user?.baseBranchId || cachedBranches[0].id);
          }
        }
      } catch (err) {
        console.warn('Initial load error:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [user]);

  // Load buildings when branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    const loadBuildings = async () => {
      try {
        if (navigator.onLine) {
          const data = await fetchApi<any[]>(`/buildings?branchId=${selectedBranchId}`);
          setBuildings(data);
          if (data.length > 0) {
            setSelectedBuildingId(user?.baseBuildingId || data[0].id);
          } else {
            setSelectedBuildingId('');
          }
        } else {
          const cached = await db.buildings.where('branchId').equals(selectedBranchId).toArray();
          setBuildings(cached);
          if (cached.length > 0) {
            setSelectedBuildingId(cached[0].id);
          } else {
            setSelectedBuildingId('');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadBuildings();
  }, [selectedBranchId]);

  // Load floors when building changes
  useEffect(() => {
    if (!selectedBuildingId) {
      setFloors([]);
      return;
    }
    const b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
      setFloors(b.floors || []);
      if (b.floors && b.floors.length > 0) {
        setSelectedFloorId(b.floors[0].id);
      } else {
        setSelectedFloorId('');
      }
    }
  }, [selectedBuildingId, buildings]);

  // Load sections when floor changes
  useEffect(() => {
    if (!selectedFloorId) {
      setSections([]);
      return;
    }
    const loadSections = async () => {
      try {
        if (navigator.onLine) {
          const data = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
          setSections(data);
          if (data.length > 0) {
            setSelectedSectionId(data[0].id);
          } else {
            setSelectedSectionId('');
          }
        } else {
          const cached = await db.sections.where('floorId').equals(selectedFloorId).toArray();
          setSections(cached);
          if (cached.length > 0) {
            setSelectedSectionId(cached[0].id);
          } else {
            setSelectedSectionId('');
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadSections();
  }, [selectedFloorId]);

  // Load resources and bookings when section or date range changes
  useEffect(() => {
    if (!selectedSectionId || !startDate || !endDate) {
      setResources([]);
      return;
    }
    const loadResourcesAndBookings = async () => {
      try {
        if (navigator.onLine) {
          const [secData, bookList] = await Promise.all([
            fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`),
            fetchApi<any[]>(`/bookings?startDate=${startDate}&endDate=${endDate}`),
          ]);
          const currentSec = secData.find(s => s.id === selectedSectionId);
          setResources(currentSec?.resources || []);
          setExistingBookings(bookList);
        } else {
          const cachedRes = await db.resources.where('sectionId').equals(selectedSectionId).toArray();
          setResources(cachedRes);
          const cachedBookings = await db.localBookings.toArray();
          setExistingBookings(cachedBookings);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadResourcesAndBookings();
  }, [selectedSectionId, startDate, endDate, selectedFloorId]);

  // Update enabled weekdays based on selected date range (Task 3.3)
  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const enabled: { [key: number]: boolean } = {};
    const current = new Date(start);

    // Scan date range (limit to 30 days max to prevent infinite loops)
    let limit = 0;
    while (current <= end && limit < 30) {
      enabled[current.getDay()] = true;
      current.setDate(current.getDate() + 1);
      limit++;
    }

    setEnabledWeekdays(enabled);

    // Disable un-matching selected weekdays
    setSelectedWeekdays(prev => {
      const next = { ...prev };
      [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        if (!enabled[day]) next[day] = false;
      });
      return next;
    });
  }, [startDate, endDate]);

  // Pre-flight warning check (Task 3.4)
  useEffect(() => {
    const targetUsers = isProxyBooking ? selectedSubordinateIds : [user?.id];
    if (targetUsers.length === 0 || !startDate || !endDate) {
      setHasSelfConflictWarning(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const hasConflict = existingBookings.some(b => {
      if (!targetUsers.includes(b.userId)) return false;
      if (b.status === 'CANCELLED') return false;

      const bStart = new Date(b.startAt);
      const bEnd = new Date(b.endAt);

      // Overlaps inside selected range
      if (bStart <= end && bEnd >= start) {
        const day = bStart.getDay();
        return selectedWeekdays[day]; // if booking falls on one of the chosen weekdays
      }
      return false;
    });

    setHasSelfConflictWarning(hasConflict);
  }, [existingBookings, selectedWeekdays, startDate, endDate, isProxyBooking, selectedSubordinateIds, user]);

  // Get active target user details
  const activeTargetUser = isProxyBooking
    ? teamUsers.find(u => selectedSubordinateIds.includes(u.id)) || { name: 'Subordinates' }
    : user;

  // Calculate selected date occurrences
  const getSelectedDatesList = (): Date[] => {
    const list: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    let limit = 0;
    while (current <= end && limit < 30) {
      const day = current.getDay();
      if (selectedWeekdays[day]) {
        list.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
      limit++;
    }
    return list;
  };

  // Check if a resource has conflicts on at least one day (Task 3.2)
  const getResourceBookingsMap = (resourceId: string) => {
    const dates = getSelectedDatesList();
    const map: { [dateStr: string]: any } = {};

    dates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      
      const conflict = existingBookings.find(b => {
        if (b.resourceId !== resourceId) return false;
        if (b.status === 'CANCELLED') return false;

        const bStartStr = new Date(b.startAt).toISOString().split('T')[0];
        if (bStartStr !== dateStr) return false;

        // Session overlaps check (Task 3.5)
        if (sessionType === 'FULL_DAY') return true;
        if (b.sessionType === 'FULL_DAY') return true;
        return b.sessionType === sessionType; // Conflict if same half day
      });

      if (conflict) {
        map[dateStr] = conflict;
      }
    });

    return map;
  };

  // Perform bulk booking submit (Task 3.3, 3.5, 3.6, 4.4)
  const handleSubmitBooking = async (resItem: any) => {
    setErrorMsg(null);
    const dates = getSelectedDatesList();
    if (dates.length === 0) {
      setErrorMsg('Please select at least one weekday that falls in the date range.');
      return;
    }

    // Task 3.6 Comment validation
    const isBoardroom = resItem.type === 'BOARD_ROOM';
    const isMultiDeskSameDay = dates.length > 1; // multi-desk booking on same series
    
    if ((isBoardroom || isMultiDeskSameDay) && !comment.trim()) {
      setErrorMsg(`Booking comment is required for ${isBoardroom ? 'boardroom reserves' : 'multiple dates bookings'}.`);
      return;
    }

    // 30 days advance limit hardcoded verification
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + 30);
    const exceedsLimit = dates.some(d => d > maxBookingDate);
    if (exceedsLimit) {
      setErrorMsg('Advance booking limit exceeded: Reservations are restricted to 30 days in advance.');
      return;
    }

    const usersToBook = isProxyBooking
      ? teamUsers.filter(u => selectedSubordinateIds.includes(u.id))
      : [user];

    if (isProxyBooking && usersToBook.length === 0) {
      setErrorMsg('Please select at least one team subordinate.');
      return;
    }

    setSubmitting(true);
    const results: { userName: string; dateStr: string; status: 'SUCCESS' | 'ERROR'; message: string }[] = [];

    try {
      for (const u of usersToBook) {
        const recurringGroupId = uuidv4();
        for (const date of dates) {
          const dateStr = date.toISOString().split('T')[0];
          
          let startAt = `${dateStr}T09:00:00`;
          let endAt = `${dateStr}T17:00:00`;
          if (sessionType === 'FIRST_HALF') {
            startAt = `${dateStr}T09:00:00`;
            endAt = `${dateStr}T13:00:00`;
          } else if (sessionType === 'SECOND_HALF') {
            startAt = `${dateStr}T13:00:00`;
            endAt = `${dateStr}T17:00:00`;
          }

          const operationId = uuidv4();
          const payload = {
            operationId,
            resourceId: resItem.id,
            resourceName: resItem.name,
            buildingName: buildings.find(b => b.id === selectedBuildingId)?.name || 'HQ Office',
            floorName: floors.find(f => f.id === selectedFloorId)?.name || 'Floor 1',
            targetUserId: u.id,
            targetUserName: u.name,
            createdById: user!.id,
            startAt,
            endAt,
            sessionType,
            recurringGroupId,
            comment,
            organizationId: tenant?.id || user!.organizationId,
          };

          if (navigator.onLine) {
            try {
              await fetchApi('/bookings', {
                method: 'POST',
                body: JSON.stringify({
                  resourceId: payload.resourceId,
                  targetUserId: payload.targetUserId,
                  startAt: payload.startAt,
                  endAt: payload.endAt,
                  sessionType: payload.sessionType,
                  recurringGroupId: payload.recurringGroupId,
                  comment: payload.comment,
                  operationId: payload.operationId,
                }),
              });
              results.push({ userName: u.name, dateStr, status: 'SUCCESS', message: 'Confirmed.' });
            } catch (apiErr: any) {
              if (apiErr.message?.includes('Conflict') || apiErr.message?.includes('already')) {
                results.push({ userName: u.name, dateStr, status: 'ERROR', message: apiErr.message || 'Conflict detected.' });
              } else {
                await syncEngine.queueBookingOperation(payload as any);
                results.push({ userName: u.name, dateStr, status: 'SUCCESS', message: 'Queued offline.' });
              }
            }
          } else {
            await syncEngine.queueBookingOperation(payload as any);
            results.push({ userName: u.name, dateStr, status: 'SUCCESS', message: 'Queued offline.' });
          }
        }
      }

      setBulkResults(results);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit booking reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeBranch = branches.find(b => b.id === selectedBranchId);
  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);
  const activeFloor = floors.find(f => f.id === selectedFloorId);
  const activeSection = sections.find(s => s.id === selectedSectionId);

  const filteredSubordinates = teamUsers.filter(u =>
    u.name.toLowerCase().includes(rosterSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(rosterSearchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-0">
      
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <Building className="w-6 h-6 text-emerald-600" />
          <span>Visual Workplace Booking Map</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Explore office floor maps, select available desk sections, and book single or recurring workspaces.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3 shadow-sm font-semibold">
          <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div className="flex-1">{errorMsg}</div>
        </div>
      )}

      {/* Pre-flight Conflict Warning Banner (Task 3.4) */}
      {hasSelfConflictWarning && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3 shadow-sm font-semibold">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            Pre-flight Warning: You already hold active reservations on some of the selected dates. Completing this request will overlap your schedule.
          </div>
        </div>
      )}

      {/* Navigation flow tabs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setStep(1)}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition-all ${
            step === 1
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Location & Schedule Settings
        </button>
        <button
          disabled={!selectedSectionId}
          onClick={() => setStep(2)}
          className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            step === 2
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Interactive Grid Selection
        </button>
      </div>

      {/* STEP 1: Route Location Selection & Date Ranges */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Map route selection (Task 3.1) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 pb-2 border-b">
              <Building2 className="w-4.5 h-4.5 text-emerald-600" />
              <span>Select Location Map Route</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Branch Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Branch Office</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="">Choose Branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              {/* Building Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Building Location</label>
                <select
                  disabled={!selectedBranchId}
                  value={selectedBuildingId}
                  onChange={e => setSelectedBuildingId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850"
                >
                  <option value="">Choose Building</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              {/* Floor Level Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Floor Level</label>
                <select
                  disabled={!selectedBuildingId}
                  value={selectedFloorId}
                  onChange={e => setSelectedFloorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850"
                >
                  <option value="">Choose Floor</option>
                  {floors.map(f => (
                    <option key={f.id} value={f.id}>{f.name} (F{f.floorNumber})</option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Floor Section Subdivision</label>
                <select
                  disabled={!selectedFloorId}
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850"
                >
                  <option value="">Choose Section</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tech Lead Proxy booking option */}
            {(user?.role === 'TECH_LEAD' || user?.role === 'ORGANIZATION_ADMIN') && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Book on behalf of subordinate</h3>
                    <p className="text-[10px] text-slate-400">Reserve desk slots for team subordinates</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isProxyBooking}
                    onChange={e => setIsProxyBooking(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </div>

                {isProxyBooking && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Search subordinates by name..."
                      value={rosterSearchQuery}
                      onChange={e => setRosterSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                    />
                    <div className="border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100">
                      {filteredSubordinates.map(u => {
                        const isChecked = selectedSubordinateIds.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedSubordinateIds(selectedSubordinateIds.filter(id => id !== u.id));
                                } else {
                                  setSelectedSubordinateIds([...selectedSubordinateIds, u.id]);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-700 truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email} • {u.department || 'Staff'}</p>
                            </div>
                          </label>
                        );
                      })}
                      {filteredSubordinates.length === 0 && (
                        <p className="text-center text-[11px] text-slate-400 py-3">No subordinates found</p>
                      )}
                    </div>
                    {selectedSubordinateIds.length > 0 && (
                      <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex items-center justify-between">
                        <span>{selectedSubordinateIds.length} subordinates selected</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSubordinateIds([])}
                          className="text-[10px] font-black text-emerald-700 hover:text-emerald-950 underline"
                        >
                          Clear Selection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Column 2: Date Picker Range and Weekdays (Task 3.3) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 pb-2 border-b">
              <Calendar className="w-4.5 h-4.5 text-emerald-600" />
              <span>Schedule Calendar Range</span>
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    min={todayStr}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Weekday occurrences selection (Task 3.3) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Selected Weekdays</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { val: 1, label: 'Mon' },
                    { val: 2, label: 'Tue' },
                    { val: 3, label: 'Wed' },
                    { val: 4, label: 'Thu' },
                    { val: 5, label: 'Fri' },
                    { val: 6, label: 'Sat' },
                    { val: 0, label: 'Sun' },
                  ].map(day => {
                    const isEnabled = enabledWeekdays[day.val];
                    const isSelected = selectedWeekdays[day.val];

                    return (
                      <button
                        key={day.val}
                        type="button"
                        disabled={!isEnabled}
                        onClick={() => setSelectedWeekdays(prev => ({ ...prev, [day.val]: !prev[day.val] }))}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : isEnabled
                            ? 'bg-slate-50 text-slate-650 hover:bg-slate-100 border-slate-200'
                            : 'bg-slate-100 text-slate-350 border-slate-200 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Type Select (Task 3.5) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Daily Session slot</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { type: 'FULL_DAY', label: 'Full Day' },
                    { type: 'FIRST_HALF', label: 'Morning' },
                    { type: 'SECOND_HALF', label: 'Afternoon' },
                  ].map(item => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSessionType(item.type as any)}
                      className={`py-2 text-[11px] font-extrabold rounded-xl border text-center transition-all ${
                        sessionType === item.type
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Forward button */}
            <button
              disabled={!selectedSectionId}
              onClick={() => setStep(2)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl shadow flex items-center justify-center space-x-1.5 transition-all"
            >
              <span>Continue to Map Grid</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Interactive grid map section */}
      {step === 2 && activeSection && (
        <div className="space-y-6">
          
          {/* Layout grid settings display info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900">{activeSection.name} Map Layout</h2>
              <div className="text-xs text-slate-500 space-y-0.5 mt-0.5">
                <div>Date range: <strong className="text-slate-800">{startDate}</strong> to <strong className="text-slate-800">{endDate}</strong></div>
                <div>Session slot: <strong className="text-slate-800">{sessionType.replace('_', ' ')}</strong></div>
                {isProxyBooking && activeTargetUser && (
                  <div>Booking for: <strong className="text-purple-750">{activeTargetUser.name}</strong></div>
                )}
              </div>
            </div>

            {/* Comment Form input (Task 3.6) */}
            <div className="flex-1 max-w-sm">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Booking Comment (Required for multi-dates/boardrooms)
              </label>
              <textarea
                rows={1}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Meeting details or project code..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:bg-white"
              />
            </div>

            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all"
            >
              Adjust Settings
            </button>
          </div>

          {/* Interactive live layout grid */}
          <div className="space-y-4">
            
            {/* Legend indicators */}
            <div className="flex items-center space-x-4 text-xs font-bold text-slate-500">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded"></span>
                <span>Available all dates</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-rose-500 border border-rose-500 rounded"></span>
                <span>Booked on at least one date</span>
              </div>
            </div>

            <div 
              className="grid gap-4 bg-slate-100 p-6 rounded-3xl border border-slate-250 min-h-60"
              style={{
                gridTemplateColumns: `repeat(${activeSection.columns || 4}, minmax(0, 1fr))`
              }}
            >
              {resources.map(res => {
                const isBoardroom = res.type === 'BOARD_ROOM';
                const isMeetingRoom = res.type === 'MEETING_ROOM';
                
                // Fetch conflicts details across selected occurrences (Task 3.2)
                const conflictsMap = getResourceBookingsMap(res.id);
                const conflictsCount = Object.keys(conflictsMap).length;
                const isBooked = conflictsCount > 0;

                const hasPCWorkstation = !!res.hasPC;

                // Color mappings (Task 3.2: Gray if fully free, Red if conflict exists)
                const borderStyles = isBooked 
                  ? 'border-rose-450 bg-rose-100 text-rose-900'
                  : 'border-slate-200 bg-white hover:border-emerald-500';

                return (
                  <div
                    key={res.id}
                    className={`relative p-4 rounded-xl border flex flex-col justify-between shadow-sm min-h-36 ${borderStyles}`}
                    style={{
                      gridColumn: isBoardroom && res.columnSpan ? `span ${res.columnSpan} / span ${res.columnSpan}` : undefined
                    }}
                  >
                    
                    {/* Occurrences overlay trigger */}
                    {isBooked && (
                      <button
                        onClick={() => {
                          setOverlayResourceId(overlayResourceId === res.id ? null : res.id);
                        }}
                        className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-rose-500 text-white font-extrabold text-[9px] uppercase tracking-wide hover:bg-rose-600 transition-all cursor-pointer shadow-sm"
                      >
                        Booked Info
                      </button>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5">
                        {isBoardroom ? (
                          <Presentation className="w-4.5 h-4.5 text-purple-700" />
                        ) : isMeetingRoom ? (
                          <Users className="w-4.5 h-4.5 text-blue-700" />
                        ) : (
                          <Monitor className="w-4.5 h-4.5 text-emerald-700" />
                        )}
                        <span className="font-mono font-extrabold text-sm text-slate-800">{res.code}</span>
                      </div>
                      
                      <div className="text-xs font-bold text-slate-900">{res.name}</div>
                      
                      {hasPCWorkstation && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Workstation PC</div>
                      )}
                    </div>

                    {/* Weekday status occurrence visual display (Task 3.2: mon-sun list overlay) */}
                    {overlayResourceId === res.id && isBooked && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl p-3 flex flex-col justify-between z-10 border border-rose-350 shadow-lg">
                        <div className="space-y-1.5">
                          <h4 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Booked Occurrences:</h4>
                          <div className="max-h-20 overflow-y-auto space-y-1 pr-1 text-[10px] font-semibold text-slate-700">
                            {Object.entries(conflictsMap).map(([dateStr, booking]: any) => (
                              <div key={dateStr} className="flex justify-between items-center bg-slate-50 px-2 py-0.5 rounded">
                                <span>{dateStr}</span>
                                <span className="text-rose-600">{booking.sessionType || 'Full Day'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setOverlayResourceId(null)}
                          className="w-full py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg mt-1"
                        >
                          Close Detail
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Cap: {res.capacity}
                      </span>

                      <button
                        disabled={submitting}
                        onClick={() => handleSubmitBooking(res)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center space-x-1 transition-all ${
                          isBooked
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-950/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-950/20'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{submitting ? 'Booking...' : isBooked ? 'Book Anyway' : 'Book Grid'}</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {bulkResults && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full max-h-[85vh] flex flex-col">
            <h3 className="text-base font-black text-slate-800 mb-2">Booking Execution Summary</h3>
            <p className="text-xs text-slate-500 mb-4">
              Here are the execution results for the bulk hot desk reservations request.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-1">
              {bulkResults.map((res: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-xl border flex items-start justify-between text-xs ${
                  res.status === 'SUCCESS'
                    ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                    : 'bg-rose-50/50 border-rose-100 text-rose-800'
                }`}>
                  <div>
                    <span className="font-bold">{res.userName}</span>
                    <span className="text-slate-500 block text-[10px] mt-0.5">{res.dateStr}</span>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      res.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {res.status}
                    </span>
                    <span className="text-slate-500 block text-[10px] mt-0.5">{res.message}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setBulkResults(null);
                navigate('/my-bookings');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-950 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
            >
              Done & View Bookings
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
