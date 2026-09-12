import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Download, Upload, Monitor, Sparkles, X, CheckCircle2 } from 'lucide-react';

interface DeskItem {
  id: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
  isMeetingRoom?: boolean;
  status: 'AVAILABLE' | 'BOOKED';
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
  buildings: BuildingItem[];
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

export const FloorPlansPage: React.FC = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Hierarchy Selection State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Selected Desk for Slide Drawer
  const [activeDesk, setActiveDesk] = useState<DeskItem | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // In-UI Manual Cubicle State
  const [isAddCubicleOpen, setIsAddCubicleOpen] = useState(false);
  const [cubicleType, setCubicleType] = useState<'STANDARD' | 'MEETING'>('STANDARD');
  const [cubicleHasHdmi, setCubicleHasHdmi] = useState(false);
  const [cubicleTargetSectionId, setCubicleTargetSectionId] = useState('');
  const [isSubmittingCubicle, setIsSubmittingCubicle] = useState(false);

  // Excel Floor Plan Import / Export State
  const [isExportingPlan, setIsExportingPlan] = useState(false);
  const [isImportingPlan, setIsImportingPlan] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const floorPlanInputRef = useRef<HTMLInputElement>(null);

  // Load Hierarchy
  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<BranchItem[]>('/workspace/hierarchy');
      const allBranches = data || [];
      const scopedBranches =
        user?.role === 'BRANCH_ADMIN' && user?.scopedBranchId
          ? allBranches.filter(b => b.id === user.scopedBranchId)
          : allBranches;

      setBranches(scopedBranches);

      if (scopedBranches && scopedBranches.length > 0) {
        const firstBranch = scopedBranches[0];
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
    } catch (err) {
      console.error('Failed to load workspace hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, [user?.role, user?.scopedBranchId]);

  const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0];
  const currentBuilding = currentBranch?.buildings.find(bld => bld.id === selectedBuildingId) || currentBranch?.buildings[0];
  const currentFloor = currentBuilding?.floors.find(fl => fl.id === selectedFloorId) || currentBuilding?.floors[0];
  const currentSection = currentFloor?.sections.find(sec => sec.id === selectedSectionId) || currentFloor?.sections[0];

  // Book Desk Action
  const handleBookDesk = async (deskId: string) => {
    try {
      setBookingLoading(true);
      await fetchApi('/workspace/book-desk', {
        method: 'POST',
        body: JSON.stringify({ deskId }),
      });
      // Refresh hierarchy
      await loadHierarchy();
      if (activeDesk && activeDesk.id === deskId) {
        setActiveDesk({ ...activeDesk, status: 'BOOKED' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reserve desk');
    } finally {
      setBookingLoading(false);
    }
  };

  // Cancel Booking Action
  const handleCancelBooking = async (deskId: string) => {
    try {
      setBookingLoading(true);
      await fetchApi('/workspace/cancel-booking', {
        method: 'POST',
        body: JSON.stringify({ deskId }),
      });
      await loadHierarchy();
      if (activeDesk && activeDesk.id === deskId) {
        setActiveDesk({ ...activeDesk, status: 'AVAILABLE' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel reservation');
    } finally {
      setBookingLoading(false);
    }
  };

  // Open Add Cubicle modal
  const handleOpenAddCubicle = () => {
    setCubicleTargetSectionId(selectedSectionId || currentSection?.id || '');
    setCubicleType('STANDARD');
    setCubicleHasHdmi(false);
    setIsAddCubicleOpen(true);
  };

  // Submit Add Cubicle
  const handleCreateCubicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSecId = cubicleTargetSectionId || currentSection?.id;
    if (!targetSecId) {
      setActionNotice({ type: 'error', text: 'Please select a valid floor section.' });
      return;
    }

    try {
      setIsSubmittingCubicle(true);
      const res = await fetchApi<{ success: boolean; desk: DeskItem; message: string }>('/branch-roster/cubicle', {
        method: 'POST',
        body: JSON.stringify({
          sectionId: targetSecId,
          hasHdmi: cubicleHasHdmi,
          isMeetingRoom: cubicleType === 'MEETING',
        }),
      });

      await loadHierarchy();
      setIsAddCubicleOpen(false);
      setActionNotice({
        type: 'success',
        text: res.message || 'Workstation added successfully!',
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Failed to add cubicle.',
      });
    } finally {
      setIsSubmittingCubicle(false);
    }
  };

  // Download Floor Plan Template (.xlsx)
  const handleDownloadBranchTemplate = async () => {
    try {
      setIsExportingPlan(true);
      const token = localStorage.getItem('token');
      const activeTenant = localStorage.getItem('activeTenantSubdomain');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (activeTenant) headers['x-tenant-subdomain'] = activeTenant;

      const res = await fetch(`/api/branch-roster/floor-plan-template?branchId=${selectedBranchId}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate floor plan template.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Floor_Plan_Template_${currentBranch?.code || 'Branch'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setActionNotice({ type: 'success', text: 'Floor plan template downloaded successfully.' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to download template.' });
    } finally {
      setIsExportingPlan(false);
    }
  };

  // Upload Floor Plan Spreadsheet (.xlsx)
  const handleUploadFloorPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImportingPlan(true);
      const formData = new FormData();
      formData.append('file', file);
      if (selectedBranchId) formData.append('branchId', selectedBranchId);

      const token = localStorage.getItem('token');
      const activeTenant = localStorage.getItem('activeTenantSubdomain');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (activeTenant) headers['x-tenant-subdomain'] = activeTenant;

      const res = await fetch('/api/branch-roster/floor-plan-import', {
        method: 'POST',
        headers,
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import floor plan spreadsheet.');
      }

      await loadHierarchy();
      setActionNotice({
        type: 'success',
        text: data.message || 'Floor plan layout successfully updated from spreadsheet!',
      });
      setTimeout(() => setActionNotice(null), 6000);
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'Failed to import floor plan.' });
    } finally {
      setIsImportingPlan(false);
      if (floorPlanInputRef.current) {
        floorPlanInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 font-bold text-xs">
        Loading Architectural Floor Plans...
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center space-y-4 bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
        <div className="text-3xl">🏢</div>
        <h2 className="text-lg font-black text-slate-900">No Floor Plans Found</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your organization does not have an ingested workspace yet. Please visit the Workspace Setup page to upload your configuration spreadsheet.
        </p>
        <div>
          <a
            href="/admin/workspace-setup"
            className="inline-flex items-center py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
          >
            Go to Workspace Setup
          </a>
        </div>
      </div>
    );
  }

  const desks = currentSection?.desks || [];
  const meetingRoom = currentSection?.meetingRoom;

  // Split desks into 4-desk ergonomic clusters (2 facing 2 setup)
  const podSize = 4;
  const podClusters: DeskItem[][] = [];
  for (let i = 0; i < desks.length; i += podSize) {
    podClusters.push(desks.slice(i, i + podSize));
  }
  const totalPods = podClusters.length;

  // Compute number of columns (each column holds 2 pods: Top & Bottom)
  const numColumns = Math.max(1, Math.ceil(totalPods / 2));

  // Compute Symmetrical HDMI Allocation across active clusters
  const totalHdmiCount = desks.filter(d => d.hasHdmi).length;
  const baseHdmiPerPod = totalPods > 0 ? Math.floor(totalHdmiCount / totalPods) : 0;
  const remainderHdmi = totalPods > 0 ? totalHdmiCount % totalPods : 0;

  // Determine if a desk inside pod pIdx at slot slotIdx gets HDMI
  const isDeskHdmi = (pIdx: number, slotIdx: number): boolean => {
    const alloc = baseHdmiPerPod + (pIdx < remainderHdmi ? 1 : 0);
    if (alloc === 1) return slotIdx === 0;
    if (alloc === 2) return slotIdx === 0 || slotIdx === 3; // Symmetrical diagonal facing
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

        {/* 2x2 facing desk grid */}
        <div className="grid grid-cols-2 gap-2">
          {podDesks.map((desk, slotIdx) => {
            const hasHdmi = isDeskHdmi(podIdx, slotIdx);
            const isAvailable = desk.status === 'AVAILABLE';
            const isSelected = activeDesk?.id === desk.id;
            return (
              <button
                key={desk.id}
                onClick={() => setActiveDesk({ ...desk, hasHdmi })}
                className={`${
                  numColumns >= 3 ? 'h-13 sm:h-14' : 'h-15 sm:h-16'
                } rounded-xl border-2 font-bold p-1 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
                  isSelected
                    ? 'ring-3 ring-blue-500 scale-105 z-10'
                    : 'hover:scale-102 hover:shadow-sm'
                } ${
                  isAvailable
                    ? 'bg-emerald-100/90 border-emerald-400 text-emerald-900 hover:bg-emerald-200'
                    : 'bg-red-100/90 border-red-300 text-red-800'
                }`}
              >
                <span className="text-[11px] font-black">{desk.deskCode}</span>
                {hasHdmi ? (
                  <span className="text-[8.5px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                    HDMI
                  </span>
                ) : (
                  <span className="text-[8.5px] text-slate-400 font-mono">STD</span>
                )}
              </button>
            );
          })}

          {/* Placeholders for partial pods to keep rectangular balance */}
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

  return (
    <div className="space-y-6 max-w-[1600px] w-full mx-auto px-4 sm:px-0 py-4">
      {/* Notice Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Cascade Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              FACILITY EXPLORER • STRICT NO-SVG ENGINE
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <span>Architectural Floor Plan</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {currentSection?.name || 'Overview'}
              </span>
            </h1>
          </div>

          {/* Action Buttons & Legend */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-red-100 border border-red-300 inline-block" />
                <span>Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 text-emerald-400 font-mono font-bold">
                  HDMI
                </span>
                <span>Display</span>
              </div>
            </div>

            {/* Action Buttons for Admins */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddCubicle}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Cubicle</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBranchTemplate}
                disabled={isExportingPlan}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="Download branch floor plan Excel configuration template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPlan ? 'Exporting...' : 'Export Plan'}</span>
              </button>

              <button
                type="button"
                onClick={() => floorPlanInputRef.current?.click()}
                disabled={isImportingPlan}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="Upload and apply branch floor plan layout (.xlsx)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isImportingPlan ? 'Applying...' : 'Import Plan'}</span>
              </button>
              <input
                type="file"
                ref={floorPlanInputRef}
                accept=".xlsx"
                onChange={handleUploadFloorPlan}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Cascade Selectors: Branch -> Building -> Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Branch Dropdown */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              {user?.role === 'BRANCH_ADMIN' ? 'Assigned Branch' : 'Select Branch'}
            </label>
            <select
              value={currentBranch?.id}
              disabled={user?.role === 'BRANCH_ADMIN' && branches.length <= 1}
              onChange={e => {
                const bId = e.target.value;
                setSelectedBranchId(bId);
                const b = branches.find(item => item.id === bId);
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
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
              onChange={e => {
                const bldId = e.target.value;
                setSelectedBuildingId(bldId);
                const bld = currentBranch?.buildings.find(item => item.id === bldId);
                if (bld && bld.floors.length > 0) {
                  setSelectedFloorId(bld.floors[0].id);
                  if (bld.floors[0].sections.length > 0) {
                    setSelectedSectionId(bld.floors[0].sections[0].id);
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBranch?.buildings.map(bld => (
                <option key={bld.id} value={bld.id}>
                  {bld.name}
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
              onChange={e => {
                const flId = e.target.value;
                setSelectedFloorId(flId);
                const fl = currentBuilding?.floors.find(item => item.id === flId);
                if (fl && fl.sections.length > 0) {
                  setSelectedSectionId(fl.sections[0].id);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {currentBuilding?.floors.map(fl => (
                <option key={fl.id} value={fl.id}>
                  {formatFloorDisplayName(fl)}
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
          {currentFloor?.sections.map(sec => {
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
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-6">
          <div className="font-mono text-xs font-black tracking-widest text-slate-800 uppercase">
            LEVEL: {formatFloorDisplayName(currentFloor).toUpperCase()} • {currentSection?.name} • COMPASS: {currentSection?.direction}
          </div>
          <div className="text-[10px] font-mono text-slate-500 font-bold">
            TOTAL STATIONS: {desks.length} | PODS: {totalPods} | MEETING ROOMS: {meetingRoom ? 1 : 0}
          </div>
        </div>

        {/* Main Floor Geometry Container */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Main Open-Plan Desk Clusters Area (Column-Wise Expansion) */}
          <div className="lg:col-span-3">
            {numColumns === 1 ? (
              /* Centered layout when <= 8 desks (1 or 2 pods) */
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
              /* Multi-Column Quadrant Matrix (> 8 desks) */
              <div className="space-y-6">
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

          {/* Right Column: Walled Meeting Room Pod / Dedicated Rooms */}
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

                {/* Conference Table Seating (Curved Buttons) */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {Array.from({ length: meetingRoom.capacity }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-11 rounded-lg border border-purple-300 bg-purple-50 text-purple-900 font-bold text-[10px] flex flex-col items-center justify-center shadow-xs"
                    >
                      <span>M-{String(idx + 1).padStart(2, '0')}</span>
                      {idx < meetingRoom.hdmiCount && (
                        <span className="text-[8px] text-purple-700 font-mono">HDMI</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs italic">
                No meeting room configured for this section.
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

      {/* Interactive Desk Booking Drawer / Modal */}
      {activeDesk && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                  WORKSTATION INSPECTOR
                </span>
                <button
                  onClick={() => setActiveDesk(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Station Badge */}
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${
                  activeDesk.status === 'AVAILABLE'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  {activeDesk.deskCode}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">
                    Desk {activeDesk.deskCode}
                  </div>
                  <div className={`text-[10px] font-bold ${
                    activeDesk.status === 'AVAILABLE' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {activeDesk.status === 'AVAILABLE' ? '● Ready for Reservation' : '● Currently Reserved'}
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
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">HDMI Display:</span>
                  <span className="font-bold text-slate-800">
                    {activeDesk.hasHdmi ? '🖥️ Yes (Display Included)' : 'None (BYOD)'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Ergonomics:</span>
                  <span className="font-bold text-slate-800">Standard Height Adjustable</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {user?.role === 'ORGANIZATION_ADMIN' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-center">
                  <div className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                    Administrative Oversight Mode
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Global Organization Administrators have read-only architectural oversight across all branches. Desk booking is managed directly by branch personnel and branch administrators.
                  </p>
                </div>
              ) : activeDesk.status === 'AVAILABLE' ? (
                <button
                  onClick={() => handleBookDesk(activeDesk.id)}
                  disabled={bookingLoading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {bookingLoading ? 'Reserving Desk...' : 'Confirm Desk Booking (8 Hours)'}
                </button>
              ) : (
                <button
                  onClick={() => handleCancelBooking(activeDesk.id)}
                  disabled={bookingLoading}
                  className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {bookingLoading ? 'Updating Status...' : 'Cancel Reservation (Release Desk)'}
                </button>
              )}
              <button
                onClick={() => setActiveDesk(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Glassmorphic Add Cubicle Modal */}
      {isAddCubicleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl border border-white/60 shadow-2xl rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Add Workstation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Assign a new cubicle with dynamic cluster allocation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCubicleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCubicle} className="space-y-4">
              {/* Target Section Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Target Section
                </label>
                <select
                  value={cubicleTargetSectionId}
                  onChange={(e) => setCubicleTargetSectionId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {currentFloor?.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.desks.length} Current Desks)
                    </option>
                  ))}
                </select>
              </div>

              {/* Workstation Type Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                  Workstation Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCubicleType('STANDARD')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      cubicleType === 'STANDARD'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>Standard Desk</span>
                      {cubicleType === 'STANDARD' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      4-Desk Pod Cluster (C-XX)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCubicleType('MEETING')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      cubicleType === 'MEETING'
                        ? 'border-purple-500 bg-purple-50/50 shadow-xs ring-2 ring-purple-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>Meeting Room Seat</span>
                      {cubicleType === 'MEETING' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Conference Pod Seating (M-XX)
                    </div>
                  </button>
                </div>
              </div>

              {/* HDMI Display Hardware Toggle */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl ${cubicleHasHdmi ? 'bg-slate-900 text-emerald-400' : 'bg-slate-200 text-slate-500'}`}>
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">HDMI Display Station</div>
                    <div className="text-[10px] text-slate-500">Equip workstation with external HDMI monitor</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cubicleHasHdmi}
                    onChange={(e) => setCubicleHasHdmi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Allocation Preview Tag */}
              <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between font-mono">
                <span>PROJECTED IDENTIFIER:</span>
                <span className="font-bold text-slate-900">
                  {cubicleType === 'STANDARD'
                    ? `C-${String((currentSection?.desks?.filter(d => !d.isMeetingRoom).length || 0) + 1).padStart(2, '0')}`
                    : `M-${String((currentSection?.desks?.filter(d => d.isMeetingRoom).length || 0) + 1).padStart(2, '0')}`}
                </span>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCubicleOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCubicle}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSubmittingCubicle ? (
                    <span>Creating Workstation...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Confirm &amp; Add</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
