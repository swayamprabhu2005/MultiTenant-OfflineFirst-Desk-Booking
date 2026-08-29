import React, { useState } from 'react';
import { 
  Building, LayoutGrid, CheckCircle2, ChevronRight, Sparkles, 
  MapPin, Layers, Users, UserPlus
} from 'lucide-react';
import { fetchApi } from '../../services/api';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Branch details
  const [branchName, setBranchName] = useState('Main Office');
  const [branchCode, setBranchCode] = useState('MAIN');
  const [branchAddress, setBranchAddress] = useState('');
  const [createdBranchId, setCreatedBranchId] = useState('');

  // Step 2: Building details
  const [buildingName, setBuildingName] = useState('HQ Building');
  const [buildingCode, setBuildingCode] = useState('HQ');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [createdBuildingId, setCreatedBuildingId] = useState('');

  // Step 3: Floor & Section details
  const [floorName, setFloorName] = useState('Floor 1');
  const [floorNumber, setFloorNumber] = useState(1);
  
  const [sectionName, setSectionName] = useState('South Section');
  const [sectionCode, setSectionCode] = useState('SOUTH');
  const [sectionColumns, setSectionColumns] = useState(4);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetchApi<any>('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: branchName, code: branchCode, address: branchAddress }),
      });
      setCreatedBranchId(res.id);
      setStep(2);
    } catch (err: any) {
      alert(err.message || 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetchApi<any>('/buildings', {
        method: 'POST',
        body: JSON.stringify({ 
          name: buildingName, 
          code: buildingCode, 
          address: buildingAddress, 
          branchId: createdBranchId 
        }),
      });
      setCreatedBuildingId(res.id);
      setStep(3);
    } catch (err: any) {
      alert(err.message || 'Failed to create building');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Create floor
      const floorRes = await fetchApi<any>(`/buildings/${createdBuildingId}/floors`, {
        method: 'POST',
        body: JSON.stringify({ name: floorName, floorNumber }),
      });

      // 2. Create section
      await fetchApi<any>('/sections', {
        method: 'POST',
        body: JSON.stringify({ 
          floorId: floorRes.id, 
          name: sectionName, 
          code: sectionCode, 
          columns: sectionColumns 
        }),
      });

      setStep(4);
    } catch (err: any) {
      alert(err.message || 'Failed to save setup configuration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6">
        
        {/* Wizard Header Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Guided Onboarding Wizard</span>
            <span>Step {step} of 4</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Branch Setup */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="text-center space-y-1.5 pb-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Welcome to Workspace Booking!</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Let's configure your organization structure. First, define your primary Branch Office.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  placeholder="Main HQ Office"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Code</label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={e => setBranchCode(e.target.value.toUpperCase())}
                    placeholder="MAIN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Address (Optional)</label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={e => setBranchAddress(e.target.value)}
                    placeholder="100 Pine St, San Francisco"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center space-x-1 transition-all"
            >
              <span>{submitting ? 'Creating Branch...' : 'Next: Setup Building'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Building Setup */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="text-center space-y-1.5 pb-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Building className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Define office buildings</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Next, create the physical building location residing inside this branch.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Building Name</label>
                <input
                  type="text"
                  required
                  value={buildingName}
                  onChange={e => setBuildingName(e.target.value)}
                  placeholder="Main HQ Tower"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Building Code</label>
                  <input
                    type="text"
                    required
                    value={buildingCode}
                    onChange={e => setBuildingCode(e.target.value.toUpperCase())}
                    placeholder="HQ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Building Address (Optional)</label>
                  <input
                    type="text"
                    value={buildingAddress}
                    onChange={e => setBuildingAddress(e.target.value)}
                    placeholder="Tower Floor bounds"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center space-x-1 transition-all"
            >
              <span>{submitting ? 'Creating Building...' : 'Next: Configure Floor wing'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 3: Floor and Section Setup */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-4">
            <div className="text-center space-y-1.5 pb-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Configure Floor & Subdivision</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Set up your first floor level and subdivide it into visual desk zones/sections.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Floor Level Name</label>
                  <input
                    type="text"
                    required
                    value={floorName}
                    onChange={e => setFloorName(e.target.value)}
                    placeholder="Floor 1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Floor Number</label>
                  <input
                    type="number"
                    required
                    value={floorNumber}
                    onChange={e => setFloorNumber(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-805 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">First Section Subdivision</h3>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Section Name</label>
                      <input
                        type="text"
                        required
                        value={sectionName}
                        onChange={e => setSectionName(e.target.value)}
                        placeholder="South wing"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Section Code Prefix</label>
                      <input
                        type="text"
                        required
                        value={sectionCode}
                        onChange={e => setSectionCode(e.target.value.toUpperCase())}
                        placeholder="SOUTH"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Layout Grid Columns (Width)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      required
                      value={sectionColumns}
                      onChange={e => setSectionColumns(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-805 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center space-x-1 transition-all"
            >
              <span>{submitting ? 'Saving Configuration...' : 'Next: Launch Workspace'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 4: Success & Launch */}
        {step === 4 && (
          <div className="text-center space-y-5">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 border border-emerald-250 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-slate-900">Guided Setup Completed!</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Congratulations! Your primary branch office, building hierarchy levels, and section grids are fully initialized in the database.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2 text-xs font-medium text-slate-600">
              <div className="flex items-center justify-between">
                <span>Branch Created:</span>
                <span className="font-extrabold text-slate-900">{branchName} ({branchCode})</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Building Created:</span>
                <span className="font-extrabold text-slate-900">{buildingName} ({buildingCode})</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Floor Level:</span>
                <span className="font-extrabold text-slate-900">{floorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Section Wing:</span>
                <span className="font-extrabold text-slate-900">{sectionName} ({sectionColumns} cols)</span>
              </div>
            </div>

            <button
              onClick={onComplete}
              className="w-full py-3 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all"
            >
              Launch Admin Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
