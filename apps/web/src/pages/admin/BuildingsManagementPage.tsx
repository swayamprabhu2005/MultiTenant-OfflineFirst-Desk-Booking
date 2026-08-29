import React, { useState, useEffect } from 'react';
import { 
  Building, Plus, Upload, Download, Grid, Layers, 
  CheckCircle2, Trash2, LayoutGrid, Monitor, Users, Presentation,
  ChevronRight
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { db } from '../../db/indexedDB';

export const BuildingsManagementPage: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  const [buildings, setBuildings] = useState<any[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Modals state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);

  // Form states
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');

  const [buildingName, setBuildingName] = useState('');
  const [buildingCode, setBuildingCode] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');

  const [floorName, setFloorName] = useState('');
  const [floorNumber, setFloorNumber] = useState(1);

  const [sectionName, setSectionName] = useState('');
  const [sectionCode, setSectionCode] = useState('');
  const [sectionColumns, setSectionColumns] = useState(4);

  const [resName, setResName] = useState('');
  const [resCode, setResCode] = useState('');
  const [resType, setResType] = useState('CUBICLE');
  const [resCapacity, setResCapacity] = useState(1);
  const [resHasPC, setResHasPC] = useState(false);
  const [resColumnSpan, setResColumnSpan] = useState(1);
  const [resFeatures, setResFeatures] = useState('');

  const [csvContent, setCsvContent] = useState('');
  const [autoGenCount, setAutoGenCount] = useState(10);

  // Load active tenant branches
  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/branches');
      setBranches(data);
      if (data.length > 0) {
        setSelectedBranchId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  // Load buildings when branch changes
  useEffect(() => {
    if (!selectedBranchId) {
      setBuildings([]);
      return;
    }
    const loadBuildings = async () => {
      try {
        const data = await fetchApi<any[]>(`/buildings?branchId=${selectedBranchId}`);
        setBuildings(data);
        if (data.length > 0) {
          setSelectedBuildingId(data[0].id);
        } else {
          setSelectedBuildingId('');
        }
      } catch (err: any) {
        console.error('Failed to load buildings:', err);
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
        const data = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
        setSections(data);
        if (data.length > 0) {
          setSelectedSectionId(data[0].id);
        } else {
          setSelectedSectionId('');
        }
      } catch (err: any) {
        console.error('Failed to load sections:', err);
      }
    };
    loadSections();
  }, [selectedFloorId]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await fetchApi<any>('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: branchName, code: branchCode, address: branchAddress }),
      });
      setShowBranchModal(false);
      setBranchName('');
      setBranchCode('');
      setBranchAddress('');
      setStatusMsg(`Branch "${data.name}" created successfully.`);
      await loadBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to create branch');
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await fetchApi<any>('/buildings', {
        method: 'POST',
        body: JSON.stringify({ name: buildingName, code: buildingCode, address: buildingAddress, branchId: selectedBranchId }),
      });
      setShowBuildingModal(false);
      setBuildingName('');
      setBuildingCode('');
      setBuildingAddress('');
      setStatusMsg(`Building "${data.name}" created successfully.`);
      // Reload buildings
      const updated = await fetchApi<any[]>(`/buildings?branchId=${selectedBranchId}`);
      setBuildings(updated);
      setSelectedBuildingId(data.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create building');
    }
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await fetchApi<any>(`/buildings/${selectedBuildingId}/floors`, {
        method: 'POST',
        body: JSON.stringify({ name: floorName, floorNumber }),
      });
      setShowFloorModal(false);
      setFloorName('');
      setFloorNumber(floorNumber + 1);
      setStatusMsg(`Floor "${data.name}" added successfully.`);
      // Reload
      const updated = await fetchApi<any[]>(`/buildings?branchId=${selectedBranchId}`);
      setBuildings(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to add floor');
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await fetchApi<any>('/sections', {
        method: 'POST',
        body: JSON.stringify({ floorId: selectedFloorId, name: sectionName, code: sectionCode, columns: sectionColumns }),
      });
      setShowSectionModal(false);
      setSectionName('');
      setSectionCode('');
      setSectionColumns(4);
      setStatusMsg(`Section "${data.name}" created successfully.`);
      
      const secData = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
      setSections(secData);
      setSelectedSectionId(data.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create section');
    }
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const featuresArr = resFeatures ? resFeatures.split(';').map(x => x.trim()) : [];
      await fetchApi(`/buildings/sections/${selectedSectionId}/resources`, {
        method: 'POST',
        body: JSON.stringify({
          name: resName,
          code: resCode,
          type: resType,
          capacity: resCapacity,
          hasPC: resHasPC,
          columnSpan: resColumnSpan,
          features: featuresArr
        }),
      });
      setShowResourceModal(false);
      setResName('');
      setResCode('');
      setResFeatures('');
      setStatusMsg(`Space "${resCode}" added successfully.`);
      
      // Reload sections
      const secData = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
      setSections(secData);
    } catch (err: any) {
      alert(err.message || 'Failed to create resource');
    }
  };

  const handleAutoGenerateDesks = async (e: React.FormEvent) => {
    e.preventDefault();
    const section = sections.find(s => s.id === selectedSectionId);
    if (!section) return;

    try {
      const res = await fetchApi<{ message: string }>('/inventory/generate-numeric', {
        method: 'POST',
        body: JSON.stringify({
          buildingId: selectedBuildingId,
          floorNumber: floors.find(f => f.id === selectedFloorId)?.floorNumber || 1,
          resourceType: 'DESK',
          count: autoGenCount,
          prefix: section.code,
          sectionId: selectedSectionId,
        }),
      });
      setShowAutoGenerateModal(false);
      setStatusMsg(res.message);
      
      // Reload sections
      const secData = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
      setSections(secData);
    } catch (err: any) {
      alert(err.message || 'Failed to auto-generate spaces');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchApi<{ message: string }>('/inventory/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent }),
      });
      setShowCsvModal(false);
      setCsvContent('');
      setStatusMsg(res.message);
      
      // Full reload
      await loadBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to import CSV');
    }
  };

  const handleDeleteResource = async (resId: string) => {
    if (!confirm('Are you sure you want to delete this space?')) return;
    try {
      await fetchApi(`/inventory/resources/${resId}`, { method: 'DELETE' });
      setStatusMsg('Space deleted successfully.');
      
      // Reload sections
      const secData = await fetchApi<any[]>(`/sections?floorId=${selectedFloorId}`);
      setSections(secData);
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const downloadSampleCsv = () => {
    const sample = `buildingCode,buildingName,floorNumber,floorName,resourceCode,resourceName,resourceType,features
HQ,HQ Tower,1,Floor 1 - Engineering,CUB-101,Cubicle 101,CUBICLE,Dual Monitor;Quiet Zone
HQ,HQ Tower,1,Floor 1 - Engineering,CUB-102,Cubicle 102,CUBICLE,Window View;Power Outlet
HQ,HQ Tower,2,Floor 2 - Sales,DSK-201,Hot Desk 201,DESK,USB-C Dock
HQ,HQ Tower,2,Floor 2 - Sales,RM-202,Meeting Room Alpha,MEETING_ROOM,TV Screen;Video Conf`;

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_space_inventory.csv';
    a.click();
  };

  const activeBranch = branches.find(b => b.id === selectedBranchId);
  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);
  const activeFloor = floors.find(f => f.id === selectedFloorId);
  const activeSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-0">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <LayoutGrid className="w-6 h-6 text-emerald-600" />
            <span>Visual Floor Plan & Space Manager</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Map organization branches, building locations, floors, and visually configure grid layouts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>CSV Import</span>
          </button>
          
          <button
            onClick={() => setShowBranchModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Branch</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-xs text-emerald-700 font-bold underline hover:text-emerald-900">
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Step Selection Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1: Branch Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">1. Select Branch</h2>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedBranchId === b.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{b.name} ({b.code})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
            {branches.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No branches registered.</p>
            )}
          </div>
        </div>

        {/* Step 2: Building Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">2. Select Building</h2>
            {selectedBranchId && (
              <button 
                onClick={() => setShowBuildingModal(true)} 
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {buildings.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBuildingId(b.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedBuildingId === b.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{b.name} ({b.code})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
            {buildings.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No buildings in this branch.</p>
            )}
          </div>
        </div>

        {/* Step 3: Floor Selection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">3. Select Floor</h2>
            {selectedBuildingId && (
              <button 
                onClick={() => setShowFloorModal(true)} 
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {floors.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFloorId(f.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  selectedFloorId === f.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{f.name} (F{f.floorNumber})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ))}
            {floors.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No floors in this building.</p>
            )}
          </div>
        </div>
      </div>

      {/* Visual Floor Section Editor */}
      {selectedFloorId && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Section Selector Tab Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSectionId(s.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all border ${
                    selectedSectionId === s.id
                      ? 'bg-white border-slate-200 text-emerald-600 shadow-sm'
                      : 'text-slate-500 border-transparent hover:text-slate-800'
                  }`}
                >
                  {s.name} ({s.code})
                </button>
              ))}
              <button
                onClick={() => setShowSectionModal(true)}
                className="px-2.5 py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-600 transition-all text-xs font-bold flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Section</span>
              </button>
            </div>

            {selectedSectionId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAutoGenerateModal(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Generate Desks</span>
                </button>
                <button
                  onClick={() => setShowResourceModal(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Desk</span>
                </button>
              </div>
            )}
          </div>

          {/* live Visual Grid Editor */}
          <div className="p-6">
            {activeSection ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{activeSection.name} Grid Layout</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Renders in a {activeSection.columns}-column matrix layout. Double-span items occupy multiple blocks.
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Columns: {activeSection.columns}
                  </div>
                </div>

                {/* Grid Matrix Renders dynamically */}
                <div 
                  className="grid gap-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 min-h-60"
                  style={{
                    gridTemplateColumns: `repeat(${activeSection.columns || 4}, minmax(0, 1fr))`
                  }}
                >
                  {(activeSection.resources || []).map((res: any) => {
                    const isBoardroom = res.type === 'BOARD_ROOM';
                    const isMeetingRoom = res.type === 'MEETING_ROOM';
                    const isDesk = res.type === 'DESK';

                    return (
                      <div
                        key={res.id}
                        className={`group relative p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow transition-all flex flex-col justify-between`}
                        style={{
                          gridColumn: isBoardroom && res.columnSpan ? `span ${res.columnSpan} / span ${res.columnSpan}` : undefined
                        }}
                      >
                        {/* Remove Resource trigger button */}
                        <button
                          onClick={() => handleDeleteResource(res.id)}
                          className="absolute top-2 right-2 p-1 bg-rose-50 text-rose-600 rounded-md hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            {isBoardroom ? (
                              <Presentation className="w-4 h-4 text-purple-600" />
                            ) : isMeetingRoom ? (
                              <Users className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Monitor className="w-4 h-4 text-emerald-600" />
                            )}
                            <span className="font-mono font-extrabold text-xs text-slate-800">{res.code}</span>
                          </div>
                          
                          <div className="text-[11px] font-semibold text-slate-500 truncate">{res.name}</div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                            {res.type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600">
                            Cap: {res.capacity}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {(activeSection.resources || []).length === 0 && (
                    <div 
                      className="text-center py-16 flex flex-col items-center justify-center space-y-2 text-slate-400 italic text-xs"
                      style={{ gridColumn: `1 / -1` }}
                    >
                      <Layers className="w-8 h-8 text-slate-300" />
                      <span>This section is empty. Generate desks or add spaces above.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 flex flex-col items-center justify-center space-y-2 text-slate-400 italic text-xs">
                <Layers className="w-8 h-8 text-slate-300" />
                <span>Select or create a Section above to view the layout grid.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Branch */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add New Branch Office</h3>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  placeholder="San Francisco HQ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Code</label>
                <input
                  type="text"
                  required
                  value={branchCode}
                  onChange={e => setBranchCode(e.target.value.toUpperCase())}
                  placeholder="SF-HQ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={e => setBranchAddress(e.target.value)}
                  placeholder="100 Pine St, San Francisco, CA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Building */}
      {showBuildingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Building Location</h3>
            <form onSubmit={handleCreateBuilding} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Building Name</label>
                <input
                  type="text"
                  required
                  value={buildingName}
                  onChange={e => setBuildingName(e.target.value)}
                  placeholder="HQ Tower East"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Building Code</label>
                <input
                  type="text"
                  required
                  value={buildingCode}
                  onChange={e => setBuildingCode(e.target.value.toUpperCase())}
                  placeholder="HQ-EAST"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={buildingAddress}
                  onChange={e => setBuildingAddress(e.target.value)}
                  placeholder="Building Suite, Floor ranges"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBuildingModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Floor */}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Floor Level</h3>
            <form onSubmit={handleCreateFloor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Name</label>
                <input
                  type="text"
                  required
                  value={floorName}
                  onChange={e => setFloorName(e.target.value)}
                  placeholder="Engineering Floor 1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Number</label>
                <input
                  type="number"
                  required
                  value={floorNumber}
                  onChange={e => setFloorNumber(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFloorModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Add Floor Level
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Section */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Section Subdivision</h3>
            <form onSubmit={handleCreateSection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section Name</label>
                <input
                  type="text"
                  required
                  value={sectionName}
                  onChange={e => setSectionName(e.target.value)}
                  placeholder="South wing"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Section Code Prefix</label>
                <input
                  type="text"
                  required
                  value={sectionCode}
                  onChange={e => setSectionCode(e.target.value.toUpperCase())}
                  placeholder="SOUTH"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visual Matrix Columns</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={sectionColumns}
                  onChange={e => setSectionColumns(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Individual Resource */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Workspace Unit</h3>
            <form onSubmit={handleCreateResource} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Space Name</label>
                <input
                  type="text"
                  required
                  value={resName}
                  onChange={e => setResName(e.target.value)}
                  placeholder="Desk 01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Space Code Unique</label>
                <input
                  type="text"
                  required
                  value={resCode}
                  onChange={e => setResCode(e.target.value.toUpperCase())}
                  placeholder="DSK-01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={resType}
                  onChange={e => setResType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="CUBICLE">Cubicle</option>
                  <option value="DESK">Hot Desk</option>
                  <option value="MEETING_ROOM">Meeting Room</option>
                  <option value="BOARD_ROOM">Boardroom</option>
                </select>
              </div>

              {resType === 'BOARD_ROOM' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visual Grid Span (Columns)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={resColumnSpan}
                    onChange={e => setResColumnSpan(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-purple-750"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={resCapacity}
                  onChange={e => setResCapacity(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center space-x-2 py-1">
                <input
                  type="checkbox"
                  id="hasPC"
                  checked={resHasPC}
                  onChange={e => setResHasPC(e.target.checked)}
                  className="rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="hasPC" className="text-xs font-semibold text-slate-700">Equipped with PC workstation</label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Features (Semicolon separated)</label>
                <input
                  type="text"
                  value={resFeatures}
                  onChange={e => setResFeatures(e.target.value)}
                  placeholder="Dual Monitor; Ergonomic Chair; Window View"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Auto Generate Desks */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Grid className="w-5 h-5 text-amber-500" />
              <span>Auto-Generate Section Desks</span>
            </h3>
            <p className="text-xs text-slate-500">
              Generates hot desks automatically inside this section, numbered sequentially with the section prefix.
            </p>

            <form onSubmit={handleAutoGenerateDesks} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Desks to Generate</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={autoGenCount}
                  onChange={e => setAutoGenCount(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAutoGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow"
                >
                  Generate {autoGenCount} Desks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk CSV Import */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Bulk CSV Space Inventory Import</span>
              </h3>
              <button
                onClick={downloadSampleCsv}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Paste CSV Data
                </label>
                <textarea
                  rows={8}
                  required
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
                  placeholder={`HQ,HQ Tower,1,Floor 1 - Engineering,CUB-101,Cubicle 101,CUBICLE,Dual Monitor;Quiet Zone`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Import CSV Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
