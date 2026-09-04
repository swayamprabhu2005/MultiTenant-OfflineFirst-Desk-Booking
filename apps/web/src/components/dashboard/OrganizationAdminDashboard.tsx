import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import { Building2, Monitor, Tv, Users, ArrowRight } from 'lucide-react';

function isColorDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return false;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 145;
}

export const OrganizationAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const activeOrg = user?.organization || tenant;
  const orgColor = activeOrg?.themeColor || '#16a34a';
  const isDark = isColorDark(orgColor);

  const [stats, setStats] = useState({
    branches: 0,
    buildings: 0,
    sections: 0,
    desks: 0,
    hdmiDesks: 0,
    meetingRooms: 0,
    meetingCapacity: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHierarchyStats() {
      try {
        setLoading(true);
        const branches = await fetchApi<any[]>('/workspace/hierarchy');
        if (Array.isArray(branches) && branches.length > 0) {
          let bldCount = 0;
          let secCount = 0;
          let deskCount = 0;
          let hdmiCount = 0;
          let mrCount = 0;
          let mrCapacity = 0;

          branches.forEach(b => {
            bldCount += b.buildings?.length || 0;
            b.buildings?.forEach((bld: any) => {
              bld.floors?.forEach((fl: any) => {
                secCount += fl.sections?.length || 0;
                fl.sections?.forEach((sec: any) => {
                  deskCount += sec.desks?.length || 0;
                  sec.desks?.forEach((d: any) => {
                    if (d.hasHdmi) hdmiCount++;
                  });
                  if (sec.meetingRoom) {
                    mrCount++;
                    mrCapacity += sec.meetingRoom.capacity || 0;
                  }
                });
              });
            });
          });

          setStats({
            branches: branches.length,
            buildings: bldCount,
            sections: secCount,
            desks: deskCount,
            hdmiDesks: hdmiCount,
            meetingRooms: mrCount,
            meetingCapacity: mrCapacity,
          });
        }
      } catch (err) {
        console.error('Failed to load workspace stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHierarchyStats();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0">
      {/* Top Banner with Dynamic Theming & Automated Contrast */}
      <div
        className="rounded-2xl p-6 shadow-xl transition-all duration-300"
        style={{ backgroundColor: orgColor }}
      >
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border inline-block mb-3 ${
            isDark
              ? 'bg-white/20 text-white border-white/25'
              : 'bg-black/10 text-slate-900 border-black/15'
          }`}
        >
          Global Organization Panel • {activeOrg?.name || tenant?.name}
        </span>
        <h1
          className={`text-2xl font-extrabold tracking-tight ${
            isDark ? 'text-white' : 'text-slate-950'
          }`}
        >
          Welcome back, {user?.name}!
        </h1>
        <p
          className={`text-xs mt-1.5 max-w-2xl leading-relaxed ${
            isDark ? 'text-white/85' : 'text-slate-800'
          }`}
        >
          Manage your organization structure, workplace configuration, dynamic white-label branding, and security audit logs.
        </p>
      </div>

      {/* Facility Capacity KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Branches & Buildings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Branches &amp; Campuses
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : `${stats.branches} Branches`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {loading ? 'Loading...' : `${stats.buildings} Corporate Buildings`}
            </div>
          </div>
        </div>

        {/* Metric 2: Active Workstations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Total Workstations
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : `${stats.desks} Desks`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {loading ? 'Loading...' : `Across ${stats.sections} Sections`}
            </div>
          </div>
        </div>

        {/* Metric 3: HDMI Workstations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              HDMI Stations
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : `${stats.hdmiDesks} Display Desks`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {loading
                ? 'Loading...'
                : `${stats.desks > 0 ? Math.round((stats.hdmiDesks / stats.desks) * 100) : 0}% HDMI Coverage`}
            </div>
          </div>
        </div>

        {/* Metric 4: Meeting Rooms */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Meeting Pods
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : `${stats.meetingRooms} Rooms`}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {loading ? 'Loading...' : `${stats.meetingCapacity} Total Seats`}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Configuration Center Hub */}
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
          🏢
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
            Workspace Configuration Center
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Configure, inspect, and manage your organization workspace and architectural floor plans through the unified Excel ingestion pipeline.
          </p>
        </div>
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/admin/workspace-setup"
            className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition-all inline-flex items-center gap-2"
          >
            <span>Launch Workspace Setup</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/admin/floor-plans"
            className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm transition-all inline-flex items-center gap-2"
          >
            <span>View Floor Plans</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/admin/roster"
            className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs shadow-sm transition-all inline-flex items-center gap-2 border border-slate-200"
          >
            <span>Employee Roster</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
