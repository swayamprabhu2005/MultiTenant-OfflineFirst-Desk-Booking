import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  Monitor,
  Users,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Layers,
} from 'lucide-react';

export interface DeskBookingInfo {
  id: string;
  slotType: string;
  startTime: string;
  endTime: string;
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

export interface FloorPlanResponse {
  branches: BranchItem[];
  slotInfo: {
    bookingDate: string;
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

export const EmployeeFloorPlanPage: React.FC = () => {
  // Hierarchy Data
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Time & Slot Selection
  const todayStr = new Date().toISOString().split('T')[0];
  const [bookingDate, setBookingDate] = useState<string>(todayStr);
  const [slotType, setSlotType] = useState<'FULL_DAY' | 'MORNING' | 'AFTERNOON'>('FULL_DAY');

  // Active Branch / Building / Floor / Section navigation
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Workstation selection & drawer
  const [activeDesk, setActiveDesk] = useState<EmployeeDeskItem | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Load floor plan layout with date & slot availability
  const loadFloorPlans = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);

      const params = new URLSearchParams({
        bookingDate,
        slotType,
      });
      if (selectedBranchId) {
        params.append('branchId', selectedBranchId);
      }

      const res = await fetchApi<FloorPlanResponse>(`/employee/floor-plans?${params.toString()}`);
      const branchList = res?.branches || [];
      setBranches(branchList);

      if (branchList.length > 0) {
        // Retain or select first branch
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
  }, [bookingDate, slotType]);

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
      ? 'h-11 sm:h-12'
      : numColumns >= 3
      ? 'h-13 sm:h-14'
      : 'h-15 sm:h-16';

  // Format floor display name
  const formatFloorDisplayName = (fl?: FloorItem | null): string => {
    if (!fl) return 'Floor 1';
    if (fl.name && fl.name.trim()) {
      const match = fl.name.match(/^FL0*(\d+)$/i);
      if (match) return `Floor ${match[1]}`;
      return fl.name;
    }
    return `Floor ${fl.floorNumber || 1}`;
  };

  const renderPod = (podIdx: number, title: string) => {
    const podDesks = podClusters[podIdx] || [];
    if (podDesks.length === 0) return null;

    return (
      <div
        key={podIdx}
        className="bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between transition-all"
      >
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 mb-2.5">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{title}</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">{podDesks.length}/4 DESKS</span>
        </div>

        {/* 2x2 facing desk pod */}
        <div className="grid grid-cols-2 gap-2">
          {podDesks.map((desk, slotIdx) => {
            const hasHdmi = desk.hasHdmi || isDeskHdmi(podIdx, slotIdx);
            const isSelected = activeDesk?.id === desk.id;
            const isAvailable = !desk.isReserved;
            const isMine = desk.isMyBooking;

            return (
              <button
                key={desk.id}
                type="button"
                onClick={() => setActiveDesk({ ...desk, hasHdmi })}
                className={`group relative rounded-xl border-2 p-2 flex flex-col justify-between transition-all cursor-pointer text-left ${deskHeightClass} ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400 shadow-sm'
                    : isMine
                    ? 'border-blue-500 bg-blue-50/80 hover:bg-blue-100 hover:border-blue-600'
                    : isAvailable
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 shadow-2xs'
                    : 'border-rose-200 bg-rose-50/60 opacity-80 hover:opacity-100 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono text-xs font-extrabold truncate ${
                      isSelected
                        ? 'text-purple-900'
                        : isMine
                        ? 'text-blue-900'
                        : isAvailable
                        ? 'text-emerald-900'
                        : 'text-rose-900'
                    }`}
                  >
                    {desk.deskCode}
                  </span>
                  {hasHdmi && (
                    <span
                      title="HDMI Equipped Monitor"
                      className="p-0.5 rounded bg-white/80 border border-slate-200 text-slate-700 flex-shrink-0"
                    >
                      <Monitor className="w-3 h-3 text-emerald-600" />
                    </span>
                  )}
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
                    <span className="text-rose-700 flex items-center space-x-0.5 truncate max-w-[90px]" title={desk.activeBooking?.user?.name || 'Reserved'}>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span className="truncate">{desk.activeBooking?.user?.name ? desk.activeBooking.user.name.split(' ')[0] : 'Booked'}</span>
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Interactive Floor Plan Explorer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Reserve Your Workspace
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
            Select your preferred branch, floor, and workstation. Choose between full-day or half-day reservation slots with real-time occupancy.
          </p>
        </div>

        {/* Date & Slot Selector Controls */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-100 mb-1">
              Reservation Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-emerald-200 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                min={todayStr}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="bg-white text-slate-800 font-bold text-xs pl-9 pr-3 py-2 rounded-xl shadow-xs border border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-100 mb-1">
              Time Window Slot
            </label>
            <div className="flex bg-white/20 p-1 rounded-xl border border-white/20 space-x-1">
              <button
                type="button"
                onClick={() => setSlotType('FULL_DAY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  slotType === 'FULL_DAY'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Full Day
              </button>
              <button
                type="button"
                onClick={() => setSlotType('MORNING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  slotType === 'MORNING'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => setSlotType('AFTERNOON')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  slotType === 'AFTERNOON'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Afternoon
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error / Feedback Alert */}
      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Filter Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Branch Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Branch Location</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                const br = branches.find((b) => b.id === e.target.value);
                if (br?.buildings[0]) {
                  setSelectedBuildingId(br.buildings[0].id);
                  if (br.buildings[0].floors[0]) {
                    setSelectedFloorId(br.buildings[0].floors[0].id);
                    if (br.buildings[0].floors[0].sections[0]) {
                      setSelectedSectionId(br.buildings[0].floors[0].sections[0].id);
                    }
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Building Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Building</span>
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                const bld = currentBranch?.buildings.find((b) => b.id === e.target.value);
                if (bld?.floors[0]) {
                  setSelectedFloorId(bld.floors[0].id);
                  if (bld.floors[0].sections[0]) {
                    setSelectedSectionId(bld.floors[0].sections[0].id);
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBranch?.buildings.map((bld) => (
                <option key={bld.id} value={bld.id}>
                  {bld.name} ({bld.code})
                </option>
              ))}
            </select>
          </div>

          {/* Floor Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Floor Level</span>
            </label>
            <select
              value={selectedFloorId}
              onChange={(e) => {
                setSelectedFloorId(e.target.value);
                const fl = currentBuilding?.floors.find((f) => f.id === e.target.value);
                if (fl?.sections[0]) {
                  setSelectedSectionId(fl.sections[0].id);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBuilding?.floors.map((fl) => (
                <option key={fl.id} value={fl.id}>
                  {formatFloorDisplayName(fl)} ({fl.code})
                </option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Section / Wing</span>
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentFloor?.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.direction})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Floor Pill Badges */}
        {currentBuilding && currentBuilding.floors.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
              Floors:
            </span>
            {currentBuilding.floors.map((fl) => (
              <button
                key={fl.id}
                type="button"
                onClick={() => {
                  setSelectedFloorId(fl.id);
                  if (fl.sections[0]) setSelectedSectionId(fl.sections[0].id);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  selectedFloorId === fl.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {formatFloorDisplayName(fl)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Floor Plan Grid Explorer & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Architectural 2D Canvas */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          {/* Canvas Toolbar & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <span>{currentSection?.name || 'Workspace Section'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                  {currentSection?.direction || 'Standard Layout'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentBuilding?.name} &bull; {formatFloorDisplayName(currentFloor)} &bull; {slotType.replace('_', ' ')}
              </p>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                title="Zoom Out"
                onClick={() => setZoomLevel((prev) => Math.max(70, prev - 10))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-700 px-2">
                {zoomLevel}%
              </span>
              <button
                type="button"
                title="Zoom In"
                onClick={() => setZoomLevel((prev) => Math.min(140, prev + 10))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Reset Zoom"
                onClick={() => setZoomLevel(100)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Color Legend Bar */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Legend:</span>
            <div className="flex items-center space-x-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600"></span>
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600"></span>
              <span>Reserved</span>
            </div>
            <div className="flex items-center space-x-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600"></span>
              <span>Your Desk</span>
            </div>
            <div className="flex items-center space-x-1.5 font-medium">
              <span className="w-3 h-3 rounded-full bg-purple-600 border border-purple-700"></span>
              <span>Selected</span>
            </div>
            <div className="flex items-center space-x-1.5 font-medium">
              <Monitor className="w-3.5 h-3.5 text-emerald-600" />
              <span>HDMI Monitor</span>
            </div>
          </div>

          {/* 2D Grid Canvas Container with Zoom Transform */}
          <div className="overflow-auto border border-slate-100 rounded-2xl p-4 bg-slate-50/50 min-h-[420px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate-500">Loading Floor Plan Layout...</span>
              </div>
            ) : standardDesks.length === 0 && !meetingRoom ? (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No workstations configured in this section.</p>
                <p className="text-[11px] text-slate-400">Select another section or floor level from the controls above.</p>
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top left',
                  transition: 'transform 0.15s ease-out',
                }}
                className="space-y-6"
              >
                {/* Meeting Room Hero Banner if present */}
                {meetingRoom && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full bg-teal-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                          Conference Suite
                        </span>
                        <h3 className="text-sm font-black text-slate-800">{meetingRoom.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Accommodates up to <span className="font-bold text-slate-700">{meetingRoom.capacity} attendees</span> &bull;{' '}
                        <span className="font-bold text-emerald-700">{meetingRoom.hdmiCount} HDMI displays</span>
                      </p>
                    </div>

                    {/* Meeting room seats */}
                    <div className="flex flex-wrap gap-1.5">
                      {desks
                        .filter((d) => d.isMeetingRoom)
                        .map((seat) => {
                          const isSelected = activeDesk?.id === seat.id;
                          const isAvailable = !seat.isReserved;
                          const isMine = seat.isMyBooking;

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              onClick={() => setActiveDesk(seat)}
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-100 text-purple-900 ring-2 ring-purple-400'
                                  : isMine
                                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                                  : isAvailable
                                  ? 'border-teal-300 bg-white hover:bg-teal-50 text-teal-800'
                                  : 'border-rose-200 bg-rose-50 text-rose-800 opacity-80'
                              }`}
                            >
                              {seat.deskCode}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Top Pod Row */}
                {totalPods > 0 && (
                  <div className={colGridClass}>
                    {Array.from({ length: numColumns }).map((_, cIdx) => {
                      const podIndex = cIdx * 2;
                      return podIndex < totalPods ? renderPod(podIndex, `POD ${String(podIndex + 1).padStart(2, '0')}`) : null;
                    })}
                  </div>
                )}

                {/* Central Corridor Aisle */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200"></div>
                  </div>
                  <span className="relative px-4 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-400">
                    CENTRAL CORRIDOR AISLE
                  </span>
                </div>

                {/* Bottom Pod Row */}
                {totalPods > 0 && (
                  <div className={colGridClass}>
                    {Array.from({ length: numColumns }).map((_, cIdx) => {
                      const podIndex = cIdx * 2 + 1;
                      return podIndex < totalPods ? renderPod(podIndex, `POD ${String(podIndex + 1).padStart(2, '0')}`) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workstation Inspector Slide Panel */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Workstation Inspector</span>
            </h3>
            {activeDesk && (
              <button
                type="button"
                onClick={() => setActiveDesk(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!activeDesk ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">No Workstation Selected</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click any workstation on the floor plan canvas to inspect specifications, reservation status, and book for yourself or a colleague.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Desk Identity Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black font-mono text-slate-900">{activeDesk.deskCode}</span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeDesk.isMyBooking
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : !activeDesk.isReserved
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {activeDesk.isMyBooking ? 'Your Desk' : !activeDesk.isReserved ? 'Available' : 'Reserved'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase">Type</span>
                    <span className="font-extrabold text-slate-700">
                      {activeDesk.isMeetingRoom ? 'Conference Seat' : 'Individual Pod'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200/80">
                    <span className="text-slate-400 font-bold block text-[9px] uppercase">HDMI Display</span>
                    <span className="font-extrabold text-slate-700 flex items-center space-x-1">
                      {activeDesk.hasHdmi ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Equipped</span>
                        </>
                      ) : (
                        <span>Standard Desk</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-200/60">
                  <div className="flex justify-between">
                    <span>Floor:</span>
                    <span className="font-bold text-slate-700">{formatFloorDisplayName(currentFloor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Section:</span>
                    <span className="font-bold text-slate-700">{currentSection?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Building:</span>
                    <span className="font-bold text-slate-700">{currentBuilding?.name}</span>
                  </div>
                </div>
              </div>

              {/* Existing Reservation Detail if booked */}
              {activeDesk.isReserved && activeDesk.activeBooking && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Active Reservation</span>
                  </div>
                  <p className="text-[11px] leading-tight">
                    Reserved for <span className="font-bold">{activeDesk.activeBooking.user?.name || 'A Colleague'}</span> (
                    {activeDesk.activeBooking.user?.department || 'Staff'})
                  </p>
                  <p className="text-[10px] text-amber-700">
                    Slot: {activeDesk.activeBooking.slotType.replace('_', ' ')}
                  </p>
                </div>
              )}

              {/* Reservation Prompt Info */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reservation Window:</span>
                </div>
                <p className="text-[11px]">
                  Date: <span className="font-bold text-slate-700">{bookingDate}</span> &bull; Slot:{' '}
                  <span className="font-bold text-slate-700">{slotType.replace('_', ' ')}</span>
                </p>
              </div>

              {/* Action notice for Step 20 inspector integration */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={activeDesk.isReserved && !activeDesk.isMyBooking}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-black shadow-sm flex items-center justify-center space-x-2 transition-all ${
                    !activeDesk.isReserved
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : activeDesk.isMyBooking
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {activeDesk.isMyBooking
                      ? 'Your Confirmed Desk'
                      : !activeDesk.isReserved
                      ? 'Select for Reservation'
                      : 'Workstation Unavailable'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeFloorPlanPage;
