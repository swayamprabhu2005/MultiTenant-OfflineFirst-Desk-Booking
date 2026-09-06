import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import { Building2, Monitor, Tv, Users, ArrowRight, MapPin, Layers } from 'lucide-react';

function isColorDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 145;
}

export const BranchAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';
  const isDark = isColorDark(orgColor);

  const [branchDetails, setBranchDetails] = useState<{
    name: string;
    code: string;
  } | null>(null);

  const [stats, setStats] = useState({
    buildings: 0,
    floors: 0,
    sections: 0,
    desks: 0,
    hdmiDesks: 0,
    meetingRooms: 0,
    meetingCapacity: 0,
    employeeCount: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBranchData() {
      try {
        setLoading(true);
        const branches = await fetchApi<any[]>('/workspace/hierarchy');
        
        let targetBranch: any = null;
        if (Array.isArray(branches) && branches.length > 0) {
          if (user?.scopedBranchId) {
            targetBranch = branches.find(b => b.id === user.scopedBranchId);
          }
          if (!targetBranch) {
            targetBranch = branches[0];
          }
        }

        if (targetBranch) {
          setBranchDetails({
            name: targetBranch.name,
            code: targetBranch.code,
          });

          let bldCount = targetBranch.buildings?.length || 0;
          let flCount = 0;
          let secCount = 0;
          let deskCount = 0;
          let hdmiCount = 0;
          let mrCount = 0;
          let mrCap = 0;

          targetBranch.buildings?.forEach((bld: any) => {
            flCount += bld.floors?.length || 0;
            bld.floors?.forEach((fl: any) => {
              secCount += fl.sections?.length || 0;
              fl.sections?.forEach((sec: any) => {
                deskCount += sec.desks?.length || 0;
                sec.desks?.forEach((d: any) => {
                  if (d.hasHdmi) hdmiCount++;
                });
                if (sec.meetingRoom) {
                  mrCount++;
                  mrCap += sec.meetingRoom.capacity || 0;
                }
              });
            });
          });

          let empCount = 0;
          try {
            const res = await fetchApi<any>('/branch-roster/employees');
            if (res && typeof res.total === 'number') {
              empCount = res.total;
            } else if (res && Array.isArray(res.employees)) {
              empCount = res.employees.length;
            } else if (Array.isArray(res)) {
              empCount = res.length;
            }
          } catch (e) {
            console.warn('Could not load branch employee count:', e);
          }

          setStats({
            buildings: bldCount,
            floors: flCount,
            sections: secCount,
            desks: deskCount,
            hdmiDesks: hdmiCount,
            meetingRooms: mrCount,
            meetingCapacity: mrCap,
            employeeCount: empCount,
          });
        }
      } catch (err) {
        console.error('Failed to load branch admin dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBranchData();
  }, [user?.scopedBranchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 font-bold text-xs">
        Loading Branch Console...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-4 animate-fade-in">
      {/* Dynamic Brand Banner Scoped to Branch */}
      <div
        className="rounded-3xl p-6 sm:p-8 shadow-xl transition-all duration-300 relative overflow-hidden"
        style={{ backgroundColor: orgColor }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                  isDark
                    ? 'bg-white/20 text-white border-white/25'
                    : 'bg-black/10 text-slate-900 border-black/15'
                }`}
              >
                Branch Operations Console
              </span>
              <span
                className={`text-xs font-bold ${
                  isDark ? 'text-white/80' : 'text-slate-800'
                }`}
              >
                • {activeOrg?.name || 'Organization'}
              </span>
            </div>

            <h1
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {branchDetails?.name || 'Assigned Branch Office'}
            </h1>

            <p
              className={`text-xs sm:text-sm max-w-2xl leading-relaxed ${
                isDark ? 'text-white/80' : 'text-slate-800'
              }`}
            >
              Welcome back, <span className="font-bold">{user?.name}</span>. You have administrative authority over this facility's physical floor layouts, desk allocations, and employee accounts.
            </p>
          </div>

          {/* Direct Link to Floor Plans */}
          <Link
            to="/admin/floor-plans"
            className={`px-5 py-3 rounded-2xl text-xs font-extrabold flex items-center space-x-2 shadow-lg transition-transform transform active:scale-95 flex-shrink-0 cursor-pointer ${
              isDark
                ? 'bg-white text-slate-900 hover:bg-slate-100'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <span>Launch Floor Plan Explorer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Scoped Facility Key Performance Indicators (6 Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Buildings */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.buildings}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Buildings
            </div>
          </div>
        </div>

        {/* Floors */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.floors}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Active Floors
            </div>
          </div>
        </div>

        {/* Desks */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.desks}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Workstations
            </div>
          </div>
        </div>

        {/* HDMI Desks */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.hdmiDesks}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              HDMI Enabled
            </div>
          </div>
        </div>

        {/* Meeting Rooms */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.meetingRooms}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Meeting Pods ({stats.meetingCapacity} Seats)
            </div>
          </div>
        </div>

        {/* Branch Employees */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{stats.employeeCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Staff Members
            </div>
          </div>
        </div>
      </div>

      {/* Two Focused Administrative Portals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Interactive Floor Plans */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Interactive 2D Floor Plan
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore curved 4-desk pod clusters, check real-time workstation availability, reserve workstations for team members, or inspect meeting conference pods.
            </p>
          </div>

          <Link
            to="/admin/floor-plans"
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>View Branch Floor Plan</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 2: Branch Employee Directory */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Branch Employee Directory
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Manage your branch roster with formula-assisted Excel batch ingestion, corporate email domain auto-wiring, one-click account deactivation/reactivation, and manual onboarding.
            </p>
          </div>

          <Link
            to="/branch/employees"
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm"
          >
            <span>Manage Employee Roster</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </div>
  );
};
