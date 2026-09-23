import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Building, Users, Layers, 
  CheckCircle2, AlertTriangle, Save, Loader2, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import { showToast } from '../../components/common/Toast';

export const PermissionsPage: React.FC = () => {
  const { user } = useAuth();
  const { refreshTenant } = useTenant();
  const orgId = user?.organizationId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Governance settings state
  const [operatingMode, setOperatingMode] = useState<'DELEGATED' | 'CENTRALIZED'>('DELEGATED');
  const [allowBranchFloorPlanEdit, setAllowBranchFloorPlanEdit] = useState(true);
  const [allowBranchRosterManagement, setAllowBranchRosterManagement] = useState(true);
  const [allowBranchProxyBooking, setAllowBranchProxyBooking] = useState(true);
  const [allowBranchIssueResolution, setAllowBranchIssueResolution] = useState(true);

  const loadGovernance = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await fetchApi<{
        operatingMode: 'DELEGATED' | 'CENTRALIZED';
        allowBranchFloorPlanEdit: boolean;
        allowBranchRosterManagement: boolean;
        allowBranchProxyBooking: boolean;
        allowBranchIssueResolution: boolean;
      }>(`/organizations/${orgId}/governance`);

      setOperatingMode(data.operatingMode || 'DELEGATED');
      setAllowBranchFloorPlanEdit(data.allowBranchFloorPlanEdit ?? true);
      setAllowBranchRosterManagement(data.allowBranchRosterManagement ?? true);
      setAllowBranchProxyBooking(data.allowBranchProxyBooking ?? true);
      setAllowBranchIssueResolution(data.allowBranchIssueResolution ?? true);
    } catch (err: any) {
      console.error('Failed to load governance permissions:', err);
      showToast(err.message || 'Failed to fetch governance permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGovernance();
  }, [orgId]);

  const handleModeChange = (mode: 'DELEGATED' | 'CENTRALIZED') => {
    setOperatingMode(mode);
    if (mode === 'CENTRALIZED') {
      // Auto-lock floor plan editing and roster management in Centralized Mode
      setAllowBranchFloorPlanEdit(false);
      setAllowBranchRosterManagement(false);
    } else {
      // Restore standard operational defaults in Delegated Mode
      setAllowBranchFloorPlanEdit(true);
      setAllowBranchRosterManagement(true);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    try {
      setSaving(true);
      await fetchApi(`/organizations/${orgId}/governance`, {
        method: 'PATCH',
        body: JSON.stringify({
          operatingMode,
          allowBranchFloorPlanEdit,
          allowBranchRosterManagement,
          allowBranchProxyBooking,
          allowBranchIssueResolution,
        }),
      });

      await refreshTenant();
      showToast('Governance and branch permissions updated successfully.', 'success');
    } catch (err: any) {
      console.error('Failed to update governance policy:', err);
      showToast(err.message || 'Failed to update governance policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-500 font-semibold">Loading governance policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white shadow-xl shadow-slate-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight">Governance &amp; Permissions</h1>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Tenant HQ Policy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configure organizational operating autonomy. Decide whether branch administrators manage local workstations and rosters autonomously or follow strict centralized HQ governance.
              </p>
            </div>
          </div>

          <button
            onClick={loadGovernance}
            disabled={loading}
            className="self-start md:self-auto flex items-center space-x-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-colors cursor-pointer text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Operating Model Selector */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <span>Tenant Operating Architecture</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the primary operating model governing how your branches interact with the central organization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delegated / Enterprise Mode */}
            <div
              onClick={() => handleModeChange('DELEGATED')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                operatingMode === 'DELEGATED'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="operatingMode"
                  checked={operatingMode === 'DELEGATED'}
                  onChange={() => handleModeChange('DELEGATED')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Delegated Mode</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Autonomous branch administration. Branch administrators can customize local floor plans, manage branch rosters, resolve local tickets, and perform proxy bookings.
              </p>
              <div className="mt-4 flex items-center space-x-1.5 text-xs text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Enforces branch operational autonomy</span>
              </div>
            </div>

            {/* Centralized Mode */}
            <div
              onClick={() => handleModeChange('CENTRALIZED')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                operatingMode === 'CENTRALIZED'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="operatingMode"
                  checked={operatingMode === 'CENTRALIZED'}
                  onChange={() => handleModeChange('CENTRALIZED')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Centralized Mode</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Strict corporate headquarters governance. Workstations, floor layouts, and employee rosters are locked down at the branch level. All modifications require central Global Org Admin authority.
              </p>
              <div className="mt-4 flex items-center space-x-1.5 text-xs text-amber-700 font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Enforces centralized headquarters compliance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Granular Branch Admin Permissions Matrix */}
        <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 transition-all ${
          operatingMode === 'CENTRALIZED' ? 'bg-slate-50/50' : ''
        }`}>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Granular Branch Administration Privileges</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize specific capabilities granted to local branch administrators within your organization.
            </p>
          </div>

          {operatingMode === 'CENTRALIZED' && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start space-x-2.5 animate-fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Privileges Inapplicable in Centralized Mode</p>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  Branch administrator roles are deactivated under Centralized Mode. Workstations and employee rosters are managed directly by the Global Organization Admin. These toggles will activate when Delegated Mode is enabled.
                </p>
              </div>
            </div>
          )}

          <div className={`divide-y divide-slate-100 ${operatingMode === 'CENTRALIZED' ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            {/* 1. Floor Plan Editing */}
            <div className="py-4 flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-bold text-slate-900">Interactive Floor Plan Editing</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allows branch administrators to add, move, or configure cubicles, pod clusters, and desks in the 2D floor editor.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={allowBranchFloorPlanEdit}
                  onChange={(e) => setAllowBranchFloorPlanEdit(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 2. Employee Roster Management */}
            <div className="py-4 flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-bold text-slate-900">Workforce &amp; Employee Roster Management</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allows branch administrators to create employee accounts, assign team leads, and modify branch staff profiles.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={allowBranchRosterManagement}
                  onChange={(e) => setAllowBranchRosterManagement(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 3. Proxy Desk Reservation */}
            <div className="py-4 flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-bold text-slate-900">Staff Proxy Booking (Reserve on Behalf)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allows branch administrators to reserve workstations and meeting rooms on behalf of team members or guests.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={allowBranchProxyBooking}
                  onChange={(e) => setAllowBranchProxyBooking(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 4. Local Issue Resolution */}
            <div className="py-4 flex items-center justify-between">
              <div className="pr-4">
                <p className="text-xs font-bold text-slate-900">Local Operational Issue Resolution</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allows branch administrators to investigate, resolve, and attach appreciation commendations to local workstation issues.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={allowBranchIssueResolution}
                  onChange={(e) => setAllowBranchIssueResolution(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Policy Button */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying Policy...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Governance Policy</span>
              </>
            )}
          </button>
        </div>
      </form>

    </div>
  );
};
