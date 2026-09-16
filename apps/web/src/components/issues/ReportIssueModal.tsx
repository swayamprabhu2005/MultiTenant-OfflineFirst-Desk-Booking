import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, AlertCircle, UploadCloud, Trash2, 
  Send, Loader2, ShieldAlert, Cpu,
  ChevronDown, ChevronUp, CheckCircle2, Download
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { showToast } from '../common/Toast';
import { IssuePriority } from '@deskbooking/shared';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'BOOKING', label: 'Workstation & Desk Reservation', desc: 'Booking slots, multi-day matrix, desk availability' },
  { id: 'FLOOR_PLAN', label: 'Interactive Floor Plan', desc: 'Pod clusters, 2D canvas, zoom controls, workstation map' },
  { id: 'ACCESS', label: 'Account, Auth & Permissions', desc: 'Login issues, password resets, role-based access' },
  { id: 'DATA', label: 'Workforce & Facilities Data', desc: 'Roster import, Excel generation, branch/building configuration' },
  { id: 'BUG', label: 'Technical Bug / UI Glitch', desc: 'Blank page, broken layout, runtime errors' },
  { id: 'OTHER', label: 'Other Operational Issue', desc: 'General questions or platform improvements' },
];

const PRIORITIES = [
  { id: IssuePriority.LOW, label: 'Low', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' },
  { id: IssuePriority.MEDIUM, label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100' },
  { id: IssuePriority.HIGH, label: 'High', color: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' },
  { id: IssuePriority.CRITICAL, label: 'Critical', color: 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100' },
];

// Helper to auto-detect client runtime environment
function detectClientEnvironment(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const resolution = `${window.screen.width}x${window.screen.height}`;
  const route = window.location.pathname;

  return `${os} • ${browser} • ${resolution} • Route: ${route}`;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('BOOKING');
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [clientVersion, setClientVersion] = useState('v1.0.0');
  const [deviceInfo] = useState<string>(detectClientEnvironment);
  const [systemManifest, setSystemManifest] = useState<any | null>(null);
  const [showManifestDetails, setShowManifestDetails] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch live system version manifest when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchApi<any>('/system/versions')
        .then((data) => setSystemManifest(data))
        .catch((err) => console.warn('Could not pre-fetch system versions:', err));
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clean up object URL on unmount or change
  useEffect(() => {
    return () => {
      if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  const handleDownloadDiagnosticsFile = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/system/download-report');
      if (!response.ok) throw new Error('Failed to download report');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-diagnostics-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Diagnostics file downloaded (system-diagnostics.txt)!', 'success');
    } catch {
      showToast('Could not download diagnostics report', 'error');
    }
  };

  // Support pasting image directly from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileSelect(file);
          break;
        }
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Only image files (.png, .jpg, .jpeg, .webp) are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds the 5MB limit.');
      return;
    }

    setErrorMsg(null);
    setScreenshotFile(file);
    const objectUrl = URL.createObjectURL(file);
    setScreenshotPreview(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeScreenshot = () => {
    if (screenshotPreview && screenshotPreview.startsWith('blob:')) {
      URL.revokeObjectURL(screenshotPreview);
    }
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg('Please enter a brief title for the issue.');
      return;
    }

    if (title.trim().length < 4) {
      setErrorMsg('Issue title must be at least 4 characters.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please describe the problem you encountered.');
      return;
    }

    if (description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('priority', priority);
      formData.append('clientVersion', clientVersion.trim() || 'v1.0.0');
      formData.append('deviceInfo', deviceInfo);
      formData.append('description', description.trim());

      if (systemManifest) {
        formData.append('systemDiagnostics', JSON.stringify({
          ...systemManifest,
          client: {
            version: clientVersion.trim() || 'v1.0.0',
            deviceInfo,
            userAgent: navigator.userAgent,
            screen: `${window.screen.width}x${window.screen.height}`,
          },
        }));
      }

      if (screenshotFile) {
        formData.append('screenshot', screenshotFile);
      }

      await fetchApi('/issues/report', {
        method: 'POST',
        body: formData,
      });

      showToast('Issue report filed successfully. Platform Superadmin notified.', 'success');

      // Reset form
      setTitle('');
      setCategory('BOOKING');
      setPriority(IssuePriority.MEDIUM);
      setDescription('');
      removeScreenshot();

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit issue report:', err);
      setErrorMsg(err.message || 'Failed to submit issue report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onPaste={handlePaste}
    >
      <div 
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Report an Operational Issue</h3>
              <p className="text-xs text-slate-300">Direct escalation to Platform Superadmin (`admin@deskbooking.com`)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Issue Title */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Issue Summary / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Workstation M-04 reservation fails on Tuesday morning slot"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-medium"
              maxLength={120}
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Severity Level
              </label>
              <div className="grid grid-cols-4 gap-1">
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      className={`px-2 py-2 text-[11px] font-bold rounded-lg border transition-all text-center ${
                        isSelected
                          ? `${p.color} ring-2 ring-indigo-500 shadow-xs font-extrabold`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Client Version & System Diagnostics */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>Client &amp; Environment Diagnostics</span>
              </label>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Auto-Captured</span>
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">
                  App / Client Version
                </label>
                <input
                  type="text"
                  value={clientVersion}
                  onChange={(e) => setClientVersion(e.target.value)}
                  placeholder="e.g. v1.0.0"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-mono font-bold focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-0.5">
                  OS &amp; Browser Environment
                </label>
                <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium truncate" title={deviceInfo}>
                  {deviceInfo}
                </div>
              </div>
            </div>

            {/* Live Detected System Versions (Docker, PostgreSQL, Node, Host OS) */}
            {systemManifest && (
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Infrastructure &amp; Runtime Versions
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleDownloadDiagnosticsFile}
                      className="text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md inline-flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                      title="Download clean system-diagnostics.txt file to your computer"
                    >
                      <Download className="w-3 h-3 text-indigo-600" />
                      <span>Download File (.txt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManifestDetails(!showManifestDetails)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-0.5 cursor-pointer"
                    >
                      <span>{showManifestDetails ? 'Hide Details' : 'View Full Manifest'}</span>
                      {showManifestDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 font-bold block text-[9px]">DOCKER</span>
                    <span className="font-mono font-bold text-slate-800 truncate block" title={systemManifest.runtimes?.docker}>
                      {systemManifest.runtimes?.docker?.split(',')[0] || 'Available'}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 font-bold block text-[9px]">DATABASE</span>
                    <span className="font-mono font-bold text-slate-800 truncate block" title={systemManifest.database?.version}>
                      PostgreSQL 16
                    </span>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 font-bold block text-[9px]">RUNTIME</span>
                    <span className="font-mono font-bold text-slate-800 truncate block">
                      Node {systemManifest.runtimes?.node}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-slate-400 font-bold block text-[9px]">HOST OS</span>
                    <span className="font-mono font-bold text-slate-800 truncate block" title={systemManifest.os?.humanName}>
                      {systemManifest.os?.platform} {systemManifest.os?.arch}
                    </span>
                  </div>
                </div>

                {showManifestDetails && (
                  <div className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[10px] space-y-1 overflow-x-auto">
                    <div><span className="text-indigo-400">Docker:</span> {systemManifest.runtimes?.docker} (Compose: {systemManifest.runtimes?.dockerCompose})</div>
                    <div><span className="text-indigo-400">Daemon Status:</span> {systemManifest.runtimes?.dockerDaemonActive ? 'Active / Running' : 'Offline'}</div>
                    <div><span className="text-indigo-400">Database:</span> {systemManifest.database?.version} (Latency: {systemManifest.database?.latencyMs}ms)</div>
                    <div><span className="text-indigo-400">Hardware:</span> {systemManifest.os?.cpuModel} ({systemManifest.os?.cpuCores} cores) • RAM: {systemManifest.os?.freeMemoryGB} / {systemManifest.os?.totalMemoryGB}</div>
                    <div><span className="text-indigo-400">Frameworks:</span> {systemManifest.frameworks?.backend} • {systemManifest.frameworks?.frontend} • {systemManifest.frameworks?.orm}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detailed Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-800">
                Detailed Description <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">What happened & steps to reproduce</span>
            </div>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please explain what you were doing, what went wrong, and any relevant details (e.g. error message, desk code, floor number)..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400 font-medium resize-y"
            />
          </div>

          {/* Screenshot Upload / Paste Zone */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Screenshot (Optional, max 5MB)
            </label>

            {!screenshotPreview ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 rounded-xl p-4 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 mx-auto mb-1.5 transition-colors" />
                <p className="text-xs font-semibold text-slate-700">
                  Click to browse or drag & drop screenshot
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  PNG, JPG, or WEBP. You can also paste (<kbd className="font-mono bg-slate-200 px-1 rounded">Ctrl+V</kbd>) anywhere.
                </p>
              </div>
            ) : (
              <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot Preview"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                  />
                  <div className="truncate text-xs">
                    <p className="font-bold text-slate-800 truncate">
                      {screenshotFile ? screenshotFile.name : 'Pasted Screenshot'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {screenshotFile ? `${(screenshotFile.size / 1024).toFixed(1)} KB` : 'Image attached'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Escalating Report...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit to Superadmin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
