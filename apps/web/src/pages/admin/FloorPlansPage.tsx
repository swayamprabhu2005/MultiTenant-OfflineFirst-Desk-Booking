import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';

interface DeskItem {
  id: string;
  deskCode: string;
  deskNumber: number;
  hasHdmi: boolean;
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

export const FloorPlansPage: React.FC = () => {

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

  // Load Hierarchy
  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<BranchItem[]>('/workspace/hierarchy');
      setBranches(data || []);

      if (data && data.length > 0) {
        const firstBranch = data[0];
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
  }, []);

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

  // Split desks into ergonomic pod clusters (pods of 8: 2 rows of 4 facing each other)
  const podChunks: DeskItem[][] = [];
  const chunkSize = 8;
  for (let i = 0; i < desks.length; i += chunkSize) {
    podChunks.push(desks.slice(i, i + chunkSize));
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-4">
      {/* Top Header & Cascade Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
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

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-400 inline-block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-red-100 border border-red-300 inline-block" />
              <span>Reserved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-emerald-400 font-mono font-bold">
                HDMI
              </span>
              <span>Display Setup</span>
            </div>
          </div>
        </div>

        {/* Cascade Selectors: Branch -> Building -> Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Branch Dropdown */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
              Select Branch
            </label>
            <select
              value={currentBranch?.id}
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {branches.map(b => (
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
                  {fl.code} • {fl.name}
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
            LEVEL: {currentFloor?.code} • {currentSection?.name} • COMPASS: {currentSection?.direction}
          </div>
          <div className="text-[10px] font-mono text-slate-500 font-bold">
            TOTAL STATIONS: {desks.length} | MEETING ROOMS: {meetingRoom ? 1 : 0}
          </div>
        </div>

        {/* Main Floor Geometry Container */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Main Open-Plan Desk Clusters Area (3 Columns) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Upper Quadrant Pods */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {podChunks.slice(0, 2).map((pod, pIdx) => (
                <div key={pIdx} className="bg-slate-50/70 p-4 rounded-2xl border-2 border-slate-300">
                  <div className="text-[10px] font-mono font-bold text-slate-400 mb-2">
                    POD CLUSTER #{pIdx + 1}
                  </div>
                  {/* Pod Grid: 2 rows of 4 desks facing each other */}
                  <div className="grid grid-cols-4 gap-2.5">
                    {pod.map(desk => {
                      const isAvailable = desk.status === 'AVAILABLE';
                      const isSelected = activeDesk?.id === desk.id;
                      return (
                        <button
                          key={desk.id}
                          onClick={() => setActiveDesk(desk)}
                          className={`h-16 rounded-xl border-2 font-bold p-1.5 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
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
                          {desk.hasHdmi ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                              HDMI
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-mono">STD</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Central Corridor Divider */}
            <div className="w-full py-2.5 bg-slate-100 border-y-2 border-dashed border-slate-400 flex items-center justify-center">
              <span className="font-mono text-xs font-black tracking-widest text-slate-500 uppercase">
                ═ ═ ═ ═ ═ ═   CENTRAL CORRIDOR WALKWAY   ═ ═ ═ ═ ═ ═
              </span>
            </div>

            {/* Lower Quadrant Pods */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {podChunks.slice(2, 4).map((pod, pIdx) => (
                <div key={pIdx} className="bg-slate-50/70 p-4 rounded-2xl border-2 border-slate-300">
                  <div className="text-[10px] font-mono font-bold text-slate-400 mb-2">
                    POD CLUSTER #{pIdx + 3}
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    {pod.map(desk => {
                      const isAvailable = desk.status === 'AVAILABLE';
                      const isSelected = activeDesk?.id === desk.id;
                      return (
                        <button
                          key={desk.id}
                          onClick={() => setActiveDesk(desk)}
                          className={`h-16 rounded-xl border-2 font-bold p-1.5 flex flex-col items-center justify-between transition-all duration-150 cursor-pointer shadow-xs ${
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
                          {desk.hasHdmi ? (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                              HDMI
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-mono">STD</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

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
            🚪 MAIN SECTION ENTRY
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
              {activeDesk.status === 'AVAILABLE' ? (
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

    </div>
  );
};
