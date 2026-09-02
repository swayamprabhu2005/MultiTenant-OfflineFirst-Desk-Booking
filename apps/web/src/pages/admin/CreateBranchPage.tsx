import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../services/api';
import { Building2, Plus, Check } from 'lucide-react';

export const CreateBranchPage: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Branch Form
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const branchList = await fetchApi<any[]>('/branches');
      setBranches(branchList);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
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
      loadBranches();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create branch.');
    } finally {
      setSubmittingBranch(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
          <Building2 className="w-6 h-6 text-emerald-600" />
          <span>Create Branch Offices</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Register new office branch locations within your organization and manage existing branches.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Branch Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <Plus className="w-4.5 h-4.5 text-emerald-600" />
              <span>Create New Branch Office</span>
            </h3>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-1.5">
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
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
              >
                {submittingBranch ? 'Creating...' : 'Create Branch'}
              </button>
            </div>
          </form>
        </div>

        {/* Branches Summary List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-slate-800">Registered Branches ({branches.length})</h3>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[350px]">
            {branches.map(b => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-xs text-slate-900 flex items-center space-x-1.5">
                    <span>{b.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                      {b.code}
                    </span>
                  </div>
                  {b.address && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{b.address}</div>}
                </div>
              </div>
            ))}

            {branches.length === 0 && !loading && (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                No branches registered yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
