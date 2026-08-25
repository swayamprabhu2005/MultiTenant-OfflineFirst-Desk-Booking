import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
  Building2,
  Building,
  Calendar,
  Clock,
  User,
  Users,
  Check,
  Search,
  Filter,
  Monitor,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { syncEngine } from '../../services/syncEngine';
import { db } from '../../db/indexedDB';

export const BookingWizardPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('CUBICLE');

  // Booking Parameters
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [bookingDate, setBookingDate] = useState<string>(defaultDateStr);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [targetUserId, setTargetUserId] = useState<string>(user?.id || '');
  const [isProxyBooking, setIsProxyBooking] = useState<boolean>(false);

  // Loaded space inventory & existing bookings
  const [resources, setResources] = useState<any[]>([]);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load buildings & team users
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        if (navigator.onLine) {
          const [bList, uList] = await Promise.all([
            fetchApi<any[]>('/buildings'),
            fetchApi<any[]>('/roster'),
          ]);
          setBuildings(bList);
          setTeamUsers(uList);

          // Cache in Dexie
          await db.buildings.bulkPut(bList);
        } else {
          const cachedBuildings = await db.buildings.toArray();
          setBuildings(cachedBuildings);
        }
      } catch (err) {
        console.warn('Network error loading wizard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Auto-select user's Base Office building
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      if (user?.baseBuildingId) {
        const found = buildings.find(b => b.id === user.baseBuildingId);
        if (found) setSelectedBuildingId(found.id);
        else setSelectedBuildingId(buildings[0].id);
      } else {
        setSelectedBuildingId(buildings[0].id);
      }
    }
  }, [buildings, user]);

  // Load resources for selected building
  useEffect(() => {
    if (!selectedBuildingId) return;

    const building = buildings.find(b => b.id === selectedBuildingId);
    if (!building) return;

    const allRes: any[] = [];
    (building.floors || []).forEach((fl: any) => {
      (fl.resources || []).forEach((r: any) => {
        allRes.push({
          ...r,
          floorName: fl.name,
          floorNumber: fl.floorNumber,
          buildingName: building.name,
          buildingId: building.id,
        });
      });
    });

    setResources(allRes);
  }, [selectedBuildingId, buildings]);

  // Load existing bookings for conflict calculation
  useEffect(() => {
    if (!bookingDate) return;
    const fetchExisting = async () => {
      try {
        if (navigator.onLine) {
          const bData = await fetchApi<any[]>(`/bookings?startDate=${bookingDate}&endDate=${bookingDate}`);
          setExistingBookings(bData);
        } else {
          const local = await db.localBookings.toArray();
          setExistingBookings(local);
        }
      } catch (err) {
        console.warn('Could not fetch existing bookings:', err);
      }
    };
    fetchExisting();
  }, [bookingDate]);

  // Filter available floors
  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);
  const floors = activeBuilding?.floors || [];

  // Filter resources by floor & type
  const filteredResources = resources.filter(r => {
    if (selectedFloorId !== 'all' && r.floorId !== selectedFloorId) return false;
    if (selectedType !== 'ALL' && r.type !== selectedType) return false;
    return true;
  });

  // Calculate reservation timeframe
  const startDateTime = new Date(`${bookingDate}T${startTime}:00`);
  const endDateTime = new Date(`${bookingDate}T${endTime}:00`);

  // Check if a resource is booked during target window
  const isResourceBooked = (resourceId: string) => {
    return existingBookings.some((b: any) => {
      if (b.resourceId !== resourceId) return false;
      if (b.status === 'CANCELLED') return false;
      const bStart = new Date(b.startAt);
      const bEnd = new Date(b.endAt);
      return startDateTime < bEnd && endDateTime > bStart;
    });
  };

  // Perform Booking Reservation
  const handleReserveDesk = async (resource: any) => {
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const effectiveUser = isProxyBooking ? targetUserId : user?.id;
      const targetUserObj = teamUsers.find(u => u.id === effectiveUser) || user;

      // 1. Base Office Restriction Check
      if (targetUserObj?.baseBuildingId && targetUserObj.baseBuildingId !== resource.buildingId) {
        setErrorMsg(
          `Base Office Restriction: ${targetUserObj.name} can only book resources within their assigned base office (${resource.buildingName} mismatch)`
        );
        setSubmitting(false);
        return;
      }

      // 2. Daily Quota Ceiling Check (Max 1 reservation per employee per day)
      const existingDaily = existingBookings.find((b: any) => {
        if (b.userId !== effectiveUser) return false;
        if (b.status === 'CANCELLED') return false;
        return b.startAt.startsWith(bookingDate);
      });

      if (existingDaily) {
        setErrorMsg(
          `Daily Quota Exceeded: Employee ${targetUserObj?.name || ''} already holds a booking for ${bookingDate} (Max 1 active booking per day)`
        );
        setSubmitting(false);
        return;
      }

      const operationId = uuidv4();
      const payload = {
        operationId,
        resourceId: resource.id,
        resourceName: resource.name,
        buildingName: resource.buildingName,
        floorName: resource.floorName,
        targetUserId: effectiveUser || user!.id,
        targetUserName: targetUserObj?.name || user?.name || 'Employee',
        createdById: user!.id,
        startAt: startDateTime.toISOString(),
        endAt: endDateTime.toISOString(),
        organizationId: tenant?.id || user!.organizationId,
      };

      if (navigator.onLine) {
        try {
          await fetchApi('/bookings', {
            method: 'POST',
            body: JSON.stringify({
              resourceId: resource.id,
              targetUserId: effectiveUser,
              startAt: startDateTime.toISOString(),
              endAt: endDateTime.toISOString(),
              operationId,
            }),
          });
        } catch (apiErr: any) {
          if (apiErr.message?.includes('Conflict')) {
            throw apiErr;
          }
          await syncEngine.queueBookingOperation(payload);
        }
      } else {
        await syncEngine.queueBookingOperation(payload);
      }

      navigate('/my-bookings');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit reservation request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Reserve a Workspace
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Search available cubicles, desks, and meeting rooms with automatic offline sync.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMsg}</div>
        </div>
      )}

      {/* Wizard Step Bar */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStep(1)}
          className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
            step === 1
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="text-[10px] text-slate-400 uppercase">Step 1</div>
          <div>Date & Office Building</div>
        </button>

        <button
          onClick={() => setStep(2)}
          className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
            step === 2
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="text-[10px] text-slate-400 uppercase">Step 2</div>
          <div>Proxy & Slot Preferences</div>
        </button>

        <button
          onClick={() => setStep(3)}
          className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
            step === 3
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="text-[10px] text-slate-400 uppercase">Step 3</div>
          <div>Desk Grid & Selection</div>
        </button>
      </div>

      {/* STEP 1: Date & Office Building Selection */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Select Target Building & Date</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Building Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Assigned Base Office Building
              </label>
              <div className="space-y-3">
                {buildings.map(b => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBuildingId(b.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedBuildingId === b.id
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-800">{b.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{b.address || 'Enterprise Facility'}</div>
                      <div className="text-[11px] font-mono text-emerald-700 mt-1">
                        Code: {b.code} • {b.floors?.length || 0} Floors
                      </div>
                    </div>
                    {selectedBuildingId === b.id && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Reservation Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setBookingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Time Slot Quick Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Daily Slot Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setStartTime('09:00'); setEndTime('17:00'); }}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      startTime === '09:00' && endTime === '17:00'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Full Day (9 AM - 5 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStartTime('09:00'); setEndTime('13:00'); }}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      startTime === '09:00' && endTime === '13:00'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Morning Slot (9 AM - 1 PM)
                  </button>
                </div>
              </div>

            </div>

          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all"
            >
              Continue to Step 2 →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Proxy Team Booker & Preferences */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Proxy Booking & Resource Filters</span>
          </h2>

          <div className="space-y-5">

            {/* Proxy Booking Option */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-800">Supervisor / Proxy Reservation</div>
                  <div className="text-[11px] text-slate-500">Book space on behalf of a team member</div>
                </div>
                <input
                  type="checkbox"
                  checked={isProxyBooking}
                  onChange={e => setIsProxyBooking(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
              </div>

              {isProxyBooking && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Designated Team Member
                  </label>
                  <select
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {teamUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - {u.department || 'Team Member'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Resource Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Resource Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { type: 'CUBICLE', label: 'Cubicle', icon: Monitor },
                  { type: 'DESK', label: 'Hot Desk', icon: Building2 },
                  { type: 'MEETING_ROOM', label: 'Meeting Room', icon: Users },
                  { type: 'BOARD_ROOM', label: 'Boardroom', icon: Building },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSelectedType(item.type)}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                        selectedType === item.type
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floor Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Floor Filter
              </label>
              <select
                value={selectedFloorId}
                onChange={e => setSelectedFloorId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="all">All Floors ({floors.length} floors available)</option>
                {floors.map((fl: any) => (
                  <option key={fl.id} value={fl.id}>
                    Floor {fl.floorNumber}: {fl.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
            >
              ← Back to Step 1
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all"
            >
              View Desk Grid & Book →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Desk Grid & Interactive Selection */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Available {selectedType.replace('_', ' ')} Spaces ({filteredResources.length})
              </h2>
              <p className="text-xs text-slate-500">
                {bookingDate} • {startTime} to {endTime} • Building: {activeBuilding?.name}
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Change Filters
            </button>
          </div>

          {filteredResources.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No space resources found matching your floor/type filter. Please try adjusting your search parameters.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((res: any) => {
                const booked = isResourceBooked(res.id);

                return (
                  <div
                    key={res.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all ${
                      booked
                        ? 'border-slate-200 bg-slate-50/70 opacity-75'
                        : 'border-slate-200 hover:border-emerald-500 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {res.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          booked
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {booked ? 'RESERVED' : 'AVAILABLE'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mb-1">{res.name}</h3>
                      <p className="text-xs text-slate-500 mb-3">{res.floorName}</p>

                      {/* Features */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {(res.features || []).map((f: string, i: number) => (
                          <span key={i} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={booked || submitting}
                      onClick={() => handleReserveDesk(res)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                        booked
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-950/20'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Reserving...' : booked ? 'Occupied' : 'Confirm Instant Booking'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
