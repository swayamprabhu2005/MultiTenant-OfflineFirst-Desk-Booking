import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import {
  Users,
  Search,
  Download,
  Upload,
  Building,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const WorkforcePage: React.FC = () => {
  const { tenant } = useTenant();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-2 animate-fade-in">
      {/* Top Header */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>Enterprise Workforce Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Centrally manage company staff across all branches, download dynamic formula rosters, and bulk ingest personnel.
          </p>
        </div>

        <div className="flex items-center space-x-3 sm:ml-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
            <Building className="w-4 h-4 text-indigo-600" />
            <span>Organization:</span>
            <span className="font-mono text-indigo-700 font-black">
              {tenant?.name || 'Active Enterprise'}
            </span>
          </div>
        </div>
      </div>

      {/* Notification Banners */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ingestion Hub Placeholder Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Multi-Branch Ingestion Hub
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900">
              Bulk Multi-Sheet Workforce Ingestion
            </h2>
            <p className="text-xs text-slate-500">
              Generate a multi-sheet spreadsheet pre-populated with each of your branches, fill in employee names, and upload.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Download Multi-Branch Template</span>
            </button>

            <button
              type="button"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Completed Roster</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 w-full sm:w-80">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or code..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-500">Branch:</span>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Branches</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table placeholder */}
        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <div className="py-16 text-center text-slate-400 text-xs">
            No employees registered yet. Download the multi-branch template to bulk ingest your workforce.
          </div>
        </div>
      </div>
    </div>
  );
};
