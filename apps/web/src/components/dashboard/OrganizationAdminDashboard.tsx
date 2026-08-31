import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  Building2, Users, ShieldCheck, 
  ChevronRight, ChevronDown, UserCheck, GitFork, Building, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OrganizationAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [expandedBranchIds, setExpandedBranchIds] = useState<Record<string, boolean>>({});
  const [buildings, setBuildings] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const activeOrg = user?.organization || tenant;

  const loadData = async () => {
    try {
      setLoading(true);
      const [branchList, roster] = await Promise.all([
        fetchApi<any[]>('/branches'),
        fetchApi<any>('/roster?limit=100')
      ]);
      setBranches(branchList);
      setEmployees(roster.users || []);
      if (branchList.length > 0) {
        setSelectedBranchId(branchList[0].id);
        setExpandedBranchIds({ [branchList[0].id]: true });
      }
    } catch (err: any) {
      console.error('Failed to load org dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load buildings when branch selection changes
  useEffect(() => {
    if (!selectedBranchId) {
      setBuildings([]);
      return;
    }
    const loadBuildings = async () => {
      try {
        const data = await fetchApi<any[]>(`/buildings?branchId=${selectedBranchId}`);
        setBuildings(data);
      } catch (err: any) {
        console.error('Failed to load buildings:', err);
      }
    };
    loadBuildings();
  }, [selectedBranchId]);

  const toggleBranchExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBranchIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const branchAdmins = employees.filter(emp => (emp.role === 'BRANCH_ADMIN' || emp.role === 'ORGANIZATION_ADMIN') && emp.scopedBranchId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Loading Organization Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-xl">
        <span className="px-3 py-1 bg-white/20 text-emerald-100 rounded-full text-xs font-bold border border-white/10 inline-block mb-3">
          Global Organization Panel • {activeOrg?.name || tenant?.name}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-emerald-100 text-xs mt-1.5 max-w-2xl leading-relaxed">
          Manage your organization structure. View office branch overview, assigned branch administrators, and explore your workspace branching strategy tree.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{branches.length}</div>
            <div className="text-xs font-medium text-slate-500">Registered Branches</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{branchAdmins.length}</div>
            <div className="text-xs font-medium text-slate-500">Branch Administrators</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{employees.length}</div>
            <div className="text-xs font-medium text-slate-500">Total Employees</div>
          </div>
        </div>
      </div>

      {/* Main Content Layout (2 Columns: Left Branch Overview, Right Workspace Tree) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Branch Overview (Without + New button as requested) */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase border border-emerald-100 rounded-full">
              BRANCH OVERVIEW
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {branches.length} Branch{branches.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {branches.map(b => {
              const isSelected = selectedBranchId === b.id;
              const isExpanded = !!expandedBranchIds[b.id];
              const admin = employees.find(u => (u.role === 'BRANCH_ADMIN' || u.role === 'ORGANIZATION_ADMIN') && u.scopedBranchId === b.id);

              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isSelected
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div
                    onClick={() => setSelectedBranchId(b.id)}
                    className="p-3.5 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        🏢
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-extrabold text-slate-900 truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {b.code}</div>
                      </div>
                    </div>

                    <button
                      onClick={e => toggleBranchExpand(b.id, e)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Collapsible Assigned Administrator */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 bg-white/80 space-y-1.5">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Assigned Administrator
                      </div>
                      {admin ? (
                        <div className="flex items-center space-x-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center justify-center">
                            {admin.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <div className="text-[11px] font-bold text-slate-800 truncate">{admin.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{admin.email}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-600 italic bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                          Unassigned
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {branches.length === 0 && (
              <div className="text-xs text-slate-400 italic text-center py-6">
                No branches registered yet.
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Columns: WORKSPACE TREE (Root-to-Leaf Top-Down Hierarchy with Zoom Controls) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            
            {/* Header + Zoom Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <GitFork className="w-5 h-5 text-emerald-600" />
                  <span>WORKSPACE TREE</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Top-down root-to-leaf branching strategy map for <span className="font-bold text-slate-800">{activeOrg?.name}</span>
                </p>
              </div>

              {/* Zoom & View Controls */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                  title="Zoom Out"
                  className="p-1.5 text-slate-600 hover:bg-white rounded-lg transition-all"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] font-mono font-bold px-2 text-slate-700">
                  {Math.round(zoomLevel * 100)}%
                </span>

                <button
                  onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                  title="Zoom In"
                  className="p-1.5 text-slate-600 hover:bg-white rounded-lg transition-all"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setZoomLevel(1)}
                  title="Reset Zoom"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Top-to-Bottom Tree Canvas */}
            <div className="overflow-x-auto min-h-[420px] p-6 bg-slate-50/70 rounded-2xl border border-slate-200 flex flex-col items-center">
              
              <div 
                className="transition-transform duration-200 flex flex-col items-center space-y-6 min-w-max"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center'
                }}
              >
                {/* 1. ROOT NODE (Organization HQ) */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center space-x-3 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-lg border border-slate-800 z-10">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base text-white shadow-inner"
                      style={{ backgroundColor: activeOrg?.themeColor || '#16a34a' }}
                    >
                      {activeOrg?.name?.charAt(0) || 'O'}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-emerald-400">ROOT ORGANIZATION</div>
                      <div className="text-sm font-extrabold">{activeOrg?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {activeOrg?.subdomain ? `${activeOrg.subdomain}.deskbooking.com` : 'subdomain'}
                      </div>
                    </div>
                  </div>

                  {/* Vertical Trunk Line down from Root */}
                  {branches.length > 0 && (
                    <div className="w-0.5 h-8 bg-emerald-500" />
                  )}
                </div>

                {/* 2. CHILD BRANCH NODES ROW */}
                {branches.length > 0 ? (
                  <div className="flex items-start justify-center space-x-8 relative">
                    
                    {/* Horizontal Connector Line spanning branches */}
                    {branches.length > 1 && (
                      <div className="absolute top-0 left-12 right-12 h-0.5 bg-emerald-300" />
                    )}

                    {branches.map((b) => {
                      const admin = employees.find(u => (u.role === 'BRANCH_ADMIN' || u.role === 'ORGANIZATION_ADMIN') && u.scopedBranchId === b.id);
                      const isSelected = selectedBranchId === b.id;

                      return (
                        <div key={b.id} className="flex flex-col items-center space-y-3 relative">
                          
                          {/* Vertical Connector Line from horizontal bar down to branch node */}
                          <div className="w-0.5 h-4 bg-emerald-300 -mt-3" />

                          {/* Branch Node Card */}
                          <div 
                            onClick={() => setSelectedBranchId(b.id)}
                            className={`w-56 p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${
                              isSelected
                                ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md scale-105'
                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:scale-102'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                                🏢
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-black text-slate-900 truncate">{b.name}</div>
                                <div className="text-[9px] font-mono text-emerald-700 font-extrabold">{b.code}</div>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {b.address || 'Address unassigned'}
                            </div>
                          </div>

                          {/* Vertical Connector down to Child Administrator Node */}
                          <div className="w-0.5 h-4 bg-purple-300" />

                          {/* 3. CHILD ADMINISTRATOR NODE */}
                          <div className="w-52 p-3 bg-white border border-purple-200 rounded-xl shadow-xs space-y-1">
                            <div className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider flex items-center space-x-1">
                              <UserCheck className="w-3 h-3 text-purple-500" />
                              <span>Branch Admin</span>
                            </div>
                            {admin ? (
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate">{admin.name}</div>
                                <div className="text-[9px] text-slate-400 font-mono truncate">{admin.email}</div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-600 italic">Unassigned</div>
                            )}
                          </div>

                          {/* Vertical Connector down to Infrastructure Node */}
                          <div className="w-0.5 h-3 bg-blue-300" />

                          {/* 4. CHILD INFRASTRUCTURE NODE */}
                          <div className="w-48 p-2.5 bg-slate-50 border border-blue-200 rounded-xl text-center space-y-0.5">
                            <div className="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider flex items-center justify-center space-x-1">
                              <Building className="w-3 h-3 text-blue-500" />
                              <span>Infrastructure</span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-700">
                              {isSelected ? `${buildings.length} Building(s)` : 'Click branch to view'}
                            </div>
                          </div>

                        </div>
                      );
                    })}

                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic bg-white rounded-2xl border border-slate-200">
                    No branch nodes available. Create a branch to visualize your workspace tree.
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
