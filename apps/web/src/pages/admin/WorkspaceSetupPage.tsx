import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, 
  ArrowRight, RefreshCw, FileText, Clock, Lock
} from 'lucide-react';
import { fetchApi } from '../../services/api';

export const WorkspaceSetupPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingCurrentConfig, setDownloadingCurrentConfig] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{
    hasSetup: boolean;
    workspaceSetupAt: string | null;
    isLocked: boolean;
    remainingMs: number;
    hoursLeft: number;
    hasConfigurationFile: boolean;
  } | null>(null);

  const [errorResult, setErrorResult] = useState<{
    errorCount: number;
    errorsSummary: string[];
    errorWorkbookBase64: string | null;
  } | null>(null);

  const [successStats, setSuccessStats] = useState<{
    branches: number;
    buildings: number;
    floors: number;
    sections: number;
    desks: number;
    meetingRooms: number;
  } | null>(null);

  const activeOrg = user?.organization || tenant;

  const loadSetupStatus = async () => {
    try {
      const data = await fetchApi<any>('/workspace/setup-status');
      setSetupStatus(data);
    } catch (err) {
      console.error('Failed to load setup status:', err);
    }
  };

  useEffect(() => {
    loadSetupStatus();
  }, []);

  // 1. Download Customized Excel Template
  const handleDownloadTemplate = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspace/template', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Workspace_FloorPlan_${activeOrg?.code || 'Template'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      alert('Error downloading template: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  // Download Current Populated Configuration (during 72h window)
  const handleDownloadCurrentConfig = async () => {
    try {
      setDownloadingCurrentConfig(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspace/current-configuration', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download current configuration');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Workspace_Current_Config_${activeOrg?.code || 'Active'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download current config error:', err);
      alert('Error downloading configuration: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingCurrentConfig(false);
    }
  };

  // 2. Upload and Ingest Excel File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setErrorResult(null);
      setSuccessStats(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/workspace/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorResult({
          errorCount: data.errorCount || 1,
          errorsSummary: data.errorsSummary || [data.error || 'Validation failed.'],
          errorWorkbookBase64: data.errorWorkbookBase64 || null,
        });
      } else {
        setSuccessStats(data.stats);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorResult({
        errorCount: 1,
        errorsSummary: [err.message || 'Network error occurred while uploading.'],
        errorWorkbookBase64: null,
      });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  // 3. Download Error-Annotated Workbook
  const handleDownloadErrorFile = () => {
    if (!errorResult?.errorWorkbookBase64) return;
    try {
      const byteCharacters = atob(errorResult.errorWorkbookBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Workspace_Errors_${activeOrg?.code || 'Review'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error file download error:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-0 py-4">
      {/* 72-HOUR GRACE PERIOD MODIFICATION STATUS BANNER */}
      {setupStatus?.hasSetup && (
        setupStatus.isLocked ? (
          <div className="bg-slate-100 border-2 border-slate-300 rounded-2xl p-5 shadow-xs flex items-start space-x-4 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  Configuration Permanent
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  Workspace Setup Window Locked (72-Hour Grace Period Expired)
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Initial physical layout was finalized on{' '}
                <span className="font-semibold text-slate-800">
                  {setupStatus.workspaceSetupAt ? new Date(setupStatus.workspaceSetupAt).toLocaleString() : 'N/A'}
                </span>
                . To safeguard existing branch administrator assignments, staff accounts, and desk allocations, the workspace architecture is permanently locked against further spreadsheet re-uploads.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                    Grace Period Active
                  </span>
                  <span className="text-xs font-black text-amber-950">
                    ~{setupStatus.hoursLeft} Hours Remaining to Re-Edit Layout
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
                  You can update branches, buildings, floors, or desk counts. Download your current populated workbook below, make any corrections, and re-upload before the 72-hour window closes.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadCurrentConfig}
              disabled={downloadingCurrentConfig}
              className="py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex-shrink-0"
            >
              {downloadingCurrentConfig ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing File...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Current Populated Configuration (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        )
      )}

      {/* ERROR BANNER & DOWNLOAD (If Validation Failed - Top Position) */}
      {errorResult && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-red-900">
                Spreadsheet Validation Failed ({errorResult.errorCount} Error{errorResult.errorCount !== 1 ? 's' : ''} Found)
              </h3>
              <p className="text-xs text-red-700 mt-1">
                Zero database changes were made. Please review the issues below or download the annotated file where errors are highlighted in red.
              </p>

              {/* Error list */}
              <div className="mt-3 bg-white border border-red-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1 text-xs text-red-800 font-medium">
                {errorResult.errorsSummary.map((err, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>

              {/* Download error file button */}
              {errorResult.errorWorkbookBase64 && (
                <div className="mt-4">
                  <button
                    onClick={handleDownloadErrorFile}
                    className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Annotated File with "ERRORS" Column</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS BANNER & STATS (If Validation Passed - Top Position) */}
      {successStats && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-5 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-950">
                Workspace Successfully Ingested!
              </h3>
              <p className="text-xs text-emerald-800">
                All 5 sheets passed validation. Physical workspace database and 2D floor plans have been created.
              </p>
            </div>
          </div>

          {/* Stats summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-slate-900">{successStats.branches}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Branches</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-slate-900">{successStats.buildings}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Buildings</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-slate-900">{successStats.floors}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Floors</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-slate-900">{successStats.sections}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Sections</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-emerald-600">{successStats.desks}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Desks</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center">
              <div className="text-xl font-black text-purple-600">{successStats.meetingRooms}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Meeting Rooms</div>
            </div>
          </div>

          {/* Call to action button to view floor plans */}
          <div className="pt-2">
            <button
              onClick={() => navigate('/admin/floor-plans')}
              className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center space-x-2 shadow-md transition-all cursor-pointer"
            >
              <span>Explore Interactive 2D Floor Plans</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* If workspace layout is finalized and locked (72h grace expired), replace the upload/download cards with the permanent configuration card */}
      {setupStatus?.isLocked && setupStatus?.hasSetup ? (
        <div className="bg-amber-50/70 border-2 border-amber-200/90 rounded-3xl p-8 space-y-6 shadow-sm animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                <span>Configuration Permanent &bull; Layout Locked</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">
                Workspace Architecture Finalized
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Initial physical layout was finalized on{' '}
                <span className="font-bold text-slate-900 font-mono">
                  {setupStatus?.workspaceSetupAt
                    ? new Date(setupStatus.workspaceSetupAt).toLocaleString()
                    : 'Finalized Date'}
                </span>
                . Ingestion of spreadsheets is permanently disabled to safeguard existing branch administrator assignments, staff accounts, and desk allocations. You may download your finalized configuration below for future offline referral or administrative audits.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleDownloadCurrentConfig}
                disabled={downloadingCurrentConfig}
                className="px-5 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingCurrentConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Excel File...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Current Workspace Configuration (.xlsx)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/floor-plans')}
                className="px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-black border border-slate-300 shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Explore 2D Floor Plans</span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Action Hub: 2 Columns (Download on Left, Upload on Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Step 1: Download Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Step 1: Download Workspace Template
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your workbook includes automated cascading formulas, dynamic meeting room lockout, and in-sheet HDMI constraints.
                </p>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div>• 🔒 Grey cells: Auto-generated formula IDs (Do not edit)</div>
                  <div>• ✍️ Yellow cells: Required user input counts &amp; names</div>
                  <div>• 🔽 Dropdowns: Restricted choices (Yes / No)</div>
                </div>
              </div>

              <button
                onClick={handleDownloadTemplate}
                disabled={downloading}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Spreadsheet...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Workspace_FloorPlan_Template.xlsx</span>
                  </>
                )}
              </button>
            </div>

            {/* Step 2: Upload Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Step 2: Upload Completed Spreadsheet
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Once you have filled out your sheets, drop your completed file here. The parser will verify all counts and generate your database records atomically.
                </p>
              </div>

              <div>
                {setupStatus?.isLocked ? (
                  <div className="border-2 border-dashed border-slate-300 bg-slate-100/70 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-2 select-none cursor-not-allowed">
                    <Lock className="w-8 h-8 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      Spreadsheet Ingestion Locked
                    </span>
                    <span className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                      The 72-hour grace period for layout modifications has expired. Existing buildings, floors, and desk counts are permanently locked.
                    </span>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all">
                    <input
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center space-y-2">
                        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-700">Verifying and Ingesting 5 Sheets...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1.5 text-center">
                        <FileText className="w-8 h-8 text-slate-400" />
                        <span className="text-xs font-bold text-slate-800">
                          Click to select or drag &amp; drop .xlsx file
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Supports Microsoft Excel &amp; Google Sheets (.xlsx)
                        </span>
                      </div>
                    )}
                  </label>
                )}
              </div>
            </div>

          </div>

          {/* 4-Step Interactive Guided Stepper (Placed Below Action Hub) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">
              Ingestion Lifecycle Walkthrough
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                  1
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Download Template</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Get your customized 5-sheet workbook pre-filled with your tenant ID and organization name.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Fill Yellow Fields</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter branch names, building names, floor counts, and cubicles with HDMI specifications.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                  3
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Upload &amp; Validate</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Our parser validates data types and constraints. Errors are annotated in red for easy rectification.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                  4
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Explore Floor Plan</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Instantly view your generated 2D architectural map with curved cubicles and meeting rooms.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
