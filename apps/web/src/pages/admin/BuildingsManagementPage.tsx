import React, { useState, useEffect } from 'react';
import { Building, Plus, Upload, Download, Grid, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const BuildingsManagementPage: React.FC = () => {
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showNumericModal, setShowNumericModal] = useState(false);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form states
  const [buildingName, setBuildingName] = useState('');
  const [buildingCode, setBuildingCode] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');

  const [floorName, setFloorName] = useState('');
  const [floorNumber, setFloorNumber] = useState(1);

  // CSV content
  const [csvContent, setCsvContent] = useState('');

  // Numeric generator state
  const [numCount, setNumCount] = useState(50);
  const [numType, setNumType] = useState('CUBICLE');
  const [numPrefix, setPrefix] = useState('CUB');
  const [numFloorNum, setNumFloorNum] = useState(1);

  const loadBuildings = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/buildings');
      setBuildings(data);
      if (data.length > 0 && !selectedBuildingId) {
        setSelectedBuildingId(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load buildings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/buildings', {
        method: 'POST',
        body: JSON.stringify({ name: buildingName, code: buildingCode, address: buildingAddress }),
      });
      setShowBuildingModal(false);
      setBuildingName('');
      setBuildingCode('');
      loadBuildings();
    } catch (err: any) {
      alert(err.message || 'Failed to create building');
    }
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;
    try {
      await fetchApi(`/buildings/${selectedBuildingId}/floors`, {
        method: 'POST',
        body: JSON.stringify({ name: floorName, floorNumber }),
      });
      setShowFloorModal(false);
      setFloorName('');
      loadBuildings();
    } catch (err: any) {
      alert(err.message || 'Failed to create floor');
    }
  };

  // CSV Space Inventory Upload Parser
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetchApi<{ message: string; count: number }>('/inventory/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent }),
      });

      setStatusMsg(res.message);
      setShowCsvModal(false);
      setCsvContent('');
      loadBuildings();
    } catch (err: any) {
      alert(err.message || 'Failed to process CSV space inventory import');
    }
  };

  // Manual Numeric Counter Fallback Generator (e.g. 50 cubicles)
  const handleNumericGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;
    setStatusMsg(null);

    try {
      const res = await fetchApi<{ message: string; count: number }>('/inventory/generate-numeric', {
        method: 'POST',
        body: JSON.stringify({
          buildingId: selectedBuildingId,
          floorNumber: numFloorNum,
          resourceType: numType,
          count: numCount,
          prefix: numPrefix,
          features: ['Power Outlet', 'Ethernet', 'Ergonomic Chair'],
        }),
      });

      setStatusMsg(res.message);
      setShowNumericModal(false);
      loadBuildings();
    } catch (err: any) {
      alert(err.message || 'Failed to auto-generate spaces');
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

  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Building className="w-6 h-6 text-emerald-600" />
            <span>Buildings & Space Inventory Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure office locations, floors, and populate space inventory via CSV import or Numeric Generator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNumericModal(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Grid className="w-4 h-4" />
            <span>Numeric Counter Generator</span>
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>CSV Inventory Import</span>
          </button>

          <button
            onClick={() => setShowBuildingModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Building</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-xs text-emerald-700 font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Buildings Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        {buildings.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBuildingId(b.id)}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
              selectedBuildingId === b.id
                ? 'bg-white border-t-2 border-emerald-600 text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {b.name} ({b.code})
          </button>
        ))}
      </div>

      {/* Selected Building Details & Floor Grid */}
      {activeBuilding && (
        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{activeBuilding.name}</h2>
              <p className="text-xs text-slate-500">{activeBuilding.address || 'Enterprise Facility Address'}</p>
            </div>
            <button
              onClick={() => setShowFloorModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition-all"
            >
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Add Floor</span>
            </button>
          </div>

          {/* Floors & Resources List */}
          <div className="space-y-4">
            {(activeBuilding.floors || []).map((fl: any) => (
              <div key={fl.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center border border-emerald-200">
                      F{fl.floorNumber}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">{fl.name}</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {fl.resources?.length || 0} Space Units
                  </span>
                </div>

                {/* Resource Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
                  {(fl.resources || []).map((res: any) => (
                    <div
                      key={res.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-emerald-500 hover:bg-white transition-all text-left"
                    >
                      <div className="font-mono font-bold text-xs text-emerald-700">{res.code}</div>
                      <div className="text-[11px] font-semibold text-slate-800 truncate">{res.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">{res.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* MODAL 1: CSV Import */}
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
                  Paste CSV Data (Header: buildingCode,buildingName,floorNumber,floorName,resourceCode,resourceName,resourceType,features)
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

      {/* MODAL 2: Numeric Counter Fallback Generator */}
      {showNumericModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Grid className="w-5 h-5 text-amber-500" />
              <span>Manual Numeric Counter Generator</span>
            </h3>
            <p className="text-xs text-slate-500">
              If no CSV file is available, enter a count (e.g. 50) to auto-generate a grid of bookable space cards dynamically in DB.
            </p>

            <form onSubmit={handleNumericGenerate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Floor Number</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={numFloorNum}
                  onChange={e => setNumFloorNum(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Cubicles/Desks to Generate</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  required
                  value={numCount}
                  onChange={e => setNumCount(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resource Category</label>
                <select
                  value={numType}
                  onChange={e => setNumType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="CUBICLE">Cubicle</option>
                  <option value="DESK">Hot Desk</option>
                  <option value="MEETING_ROOM">Meeting Room</option>
                  <option value="BOARD_ROOM">Boardroom</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNumericModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow"
                >
                  Generate {numCount} Spaces
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: New Building */}
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
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
