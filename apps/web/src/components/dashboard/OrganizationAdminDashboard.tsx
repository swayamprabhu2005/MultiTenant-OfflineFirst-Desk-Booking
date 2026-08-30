import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Building2, Plus, Users, ShieldAlert, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const OrganizationAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Branch Form
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [branchList, roster] = await Promise.all([
        fetchApi<any[]>('/branches'),
        fetchApi<any>('/roster?limit=100')
      ]);
      setBranches(branchList);
      setEmployees(roster.users || []);
    } catch (err: any) {
      console.error('Failed to load org dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmittingBranch(true);

    try {
      await fetchApi('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: branchName, code: branchCode.toUpperCase(), address: branchAddress }),
      });
      setFormSuccess(`Branch "${branchName}" created successfully.`);
      setBranchName('');
      setBranchCode('');
      setBranchAddress('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create branch.');
    } finally {
      setSubmittingBranch(false);
    }
  };

  const branchAdmins = employees.filter(emp => emp.role === 'ORGANIZATION_ADMIN' && emp.scopedBranchId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 font-semibold text-xs animate-pulse">
        Loading Organization Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white shadow-xl">
        <span className="px-3 py-1 bg-white/20 text-emerald-100 rounded-full text-xs font-bold border border-white/10 inline-block mb-3">
          Global Organization Panel • {tenant?.name}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-emerald-100 text-xs mt-1.5 max-w-2xl leading-relaxed">
          Manage your organization structure. You are the global administrator. You can register branches, manage buildings, and onboard Branch Office Administrators below.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Branches list & Branch Creator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Create Branch Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-850 flex items-center space-x-2">
                <Plus className="w-4.5 h-4.5 text-emerald-600" />
                <span>Create New Branch Office</span>
              </h3>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-250 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    required
                    value={branchName}
                    onChange={e => setBranchName(e.target.value)}
                    placeholder="Headquarters Office"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Code</label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={e => setBranchCode(e.target.value)}
                    placeholder="HQ-LOC"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Office Address (Optional)</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={e => setBranchAddress(e.target.value)}
                  placeholder="100 Pine St, San Francisco, CA"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingBranch}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all"
                >
                  {submittingBranch ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>

          {/* Branches List Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800">Organization Branches</h2>
              <Link to="/admin/buildings" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                Manage Spaces →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {branches.map(b => (
                <div key={b.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                      <span>{b.name}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                        {b.code}
                      </span>
                    </div>
                    {b.address && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{b.address}</div>}
                  </div>
                  <div className="text-right text-xs text-slate-400 font-bold">
                    {b.buildings?.length || 0} Buildings
                  </div>
                </div>
              ))}

              {branches.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No branches created yet. Use the form above to add your first branch!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Admin Quick Portal Panel */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-800">Admin Quick Access</h3>
            <p className="text-xs text-slate-500">
              As the Organization Owner, you can seed branch admins and set up branch locations.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => navigate('/admin/roster')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-black text-slate-850">Branch Admins Roster</div>
                  <div className="text-slate-450 text-[10px] mt-0.5">Manage administrators & scoped permissions</div>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/admin/buildings')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-black text-slate-850">Buildings & Branches Directory</div>
                  <div className="text-slate-450 text-[10px] mt-0.5">Configure branch structures & sections tree</div>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-400" />
              </button>

              <button
                onClick={() => navigate('/admin/audit')}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left flex items-center justify-between text-xs transition-all"
              >
                <div>
                  <div className="font-black text-slate-850">Security Audit Logs</div>
                  <div className="text-slate-450 text-[10px] mt-0.5">Inspect system history events</div>
                </div>
                <ArrowRight className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Active Branch Admins list widget */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
            <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              <span>Registered Branch Admins</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[220px]">
              {branchAdmins.map((adm: any) => (
                <div key={adm.id} className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{adm.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{adm.email}</div>
                  </div>
                  {adm.baseBranch?.name && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-750 font-black text-[10px] border border-emerald-100 rounded-lg">
                      {adm.baseBranch.name}
                    </span>
                  )}
                </div>
              ))}

              {branchAdmins.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-6 italic">
                  No branch admins registered yet.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
