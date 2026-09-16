import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Cpu, Server, Database, Box, Terminal, 
  Download, Copy, Check, RefreshCw, 
  ShieldAlert, Globe
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { showToast } from '../common/Toast';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReportIssue?: () => void;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  onOpenReportIssue,
}) => {
  const [manifest, setManifest] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-detected browser environment
  const clientEnv = (() => {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome')) browser = 'Google Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return {
      browser,
      os,
      screen: `${window.screen.width}x${window.screen.height}`,
      route: window.location.pathname,
      userAgent: ua,
    };
  })();

  const loadManifest = async (force = false) => {
    try {
      setLoading(true);
      const data = await fetchApi<any>(`/system/versions${force ? '?refresh=true' : ''}`);
      setManifest(data);
    } catch (err: any) {
      console.error('Failed to load system manifest:', err);
      showToast('Could not load system manifest.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadManifest();
    }
  }, [isOpen]);

  // Handle download of diagnostic text file
  const handleDownloadFile = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/system/download-report');
      if (!response.ok) throw new Error('Failed to generate diagnostic file');
      
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
      // Fallback: generate client-side blob if API fails
      if (!manifest) return;
      const text = `
================================================================================
🏢 MULTI-TENANT DESKBOOKING PLATFORM - SYSTEM DIAGNOSTICS MANIFEST
================================================================================
Generated At: ${new Date().toISOString()}

=== 1. HOST OPERATING SYSTEM & HARDWARE ===
Operating System : ${manifest.os?.humanName}
Architecture     : ${manifest.os?.arch} (${manifest.os?.platform})
CPU Model        : ${manifest.os?.cpuModel}
Logical Cores    : ${manifest.os?.cpuCores} cores
RAM (Total/Free) : ${manifest.os?.freeMemoryGB} free / ${manifest.os?.totalMemoryGB} total
Uptime           : ${manifest.os?.uptimeHours}

=== 2. CONTAINERIZATION & DOCKER ENGINE ===
Docker CLI       : ${manifest.runtimes?.docker}
Docker Compose   : ${manifest.runtimes?.dockerCompose}
Docker Daemon    : ${manifest.runtimes?.dockerDaemonActive ? 'ACTIVE / RUNNING' : 'STOPPED / OFFLINE'}

=== 3. DATABASE INFRASTRUCTURE ===
Database Engine  : ${manifest.database?.version}
Host & Port      : ${manifest.database?.host}:${manifest.database?.port}
Database Health  : ${manifest.database?.status} (Latency: ${manifest.database?.latencyMs}ms)

=== 4. RUNTIMES & PACKAGE MANAGERS ===
Node.js Runtime  : ${manifest.runtimes?.node}
pnpm Manager     : ${manifest.runtimes?.pnpm}
TypeScript       : ${manifest.frameworks?.language}

=== 5. REPORTER CLIENT RUNTIME ===
Browser          : ${clientEnv.browser}
Screen           : ${clientEnv.screen}
Current Route    : ${clientEnv.route}
User Agent       : ${clientEnv.userAgent}
================================================================================
`.trim();

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'system-diagnostics.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Diagnostics file downloaded (system-diagnostics.txt)!', 'success');
    }
  };

  const handleCopyText = () => {
    if (!manifest) return;
    const text = `Multi-Tenant DeskBooking Platform - System Environment Manifest
OS: ${manifest.os?.humanName} (RAM: ${manifest.os?.freeMemoryGB} free / ${manifest.os?.totalMemoryGB})
Docker: ${manifest.runtimes?.docker} (Daemon: ${manifest.runtimes?.dockerDaemonActive ? 'Active' : 'Offline'})
Database: ${manifest.database?.version} (Status: ${manifest.database?.status})
Node: ${manifest.runtimes?.node} | pnpm: ${manifest.runtimes?.pnpm}
Browser: ${clientEnv.browser} (${clientEnv.screen})
Generated: ${new Date().toLocaleString()}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('System info copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold tracking-tight">System &amp; Environment Diagnostics</h3>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>LIVE</span>
                </span>
              </div>
              <p className="text-xs text-slate-300">Complete software stack, runtimes, and host versions</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => loadManifest(true)}
              title="Refresh System Manifest"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          
          {/* Screenshot Tip Banner */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-indigo-900">
            <div className="flex items-center space-x-2">
              <span className="text-sm">📸</span>
              <div>
                <p className="font-bold text-xs">Need to share your system versions with your instructor or admin?</p>
                <p className="text-[11px] text-indigo-700">
                  You can take a screenshot of this window (<kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 shadow-2xs font-bold text-slate-800">Win+Shift+S</kbd>) or download the diagnostic text file below.
                </p>
              </div>
            </div>
          </div>

          {manifest ? (
            <div className="space-y-3">
              {/* Grid of System Components */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* 1. Host Operating System */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1.5">
                      <Server className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Host Operating System</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      {manifest.os?.arch}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{manifest.os?.humanName}</p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {manifest.os?.cpuModel} ({manifest.os?.cpuCores} Cores)
                  </p>
                  <div className="pt-1 text-[10px] text-slate-500 flex items-center space-x-2">
                    <span>RAM: <strong>{manifest.os?.freeMemoryGB}</strong> free / {manifest.os?.totalMemoryGB}</span>
                    <span>•</span>
                    <span>Uptime: {manifest.os?.uptimeHours}</span>
                  </div>
                </div>

                {/* 2. Containerization & Docker Engine */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1.5">
                      <Box className="w-3.5 h-3.5 text-blue-600" />
                      <span>Docker &amp; Containers</span>
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      manifest.runtimes?.dockerDaemonActive 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {manifest.runtimes?.dockerDaemonActive ? 'DAEMON ACTIVE' : 'DAEMON OFFLINE'}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900">{manifest.runtimes?.docker}</p>
                  <p className="text-[11px] font-mono text-slate-600">{manifest.runtimes?.dockerCompose}</p>
                  <p className="pt-1 text-[10px] text-slate-500">Container: multitenant_postgres (Port 5432)</p>
                </div>

                {/* 3. Database Engine */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5 text-purple-600" />
                      <span>Database Engine</span>
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {manifest.database?.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900 truncate" title={manifest.database?.version}>
                    {manifest.database?.version || 'PostgreSQL 16.15'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    Host: localhost:{manifest.database?.port || 5432} • DB: multitenant_db
                  </p>
                  <p className="pt-1 text-[10px] text-slate-500">
                    Query Latency: {manifest.database?.latencyMs ?? 0}ms • Driver: Prisma 5.22
                  </p>
                </div>

                {/* 4. Runtimes & Package Managers */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Runtimes &amp; Compiler</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      Node {manifest.runtimes?.node}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900">
                    Node.js {manifest.runtimes?.node} • pnpm {manifest.runtimes?.pnpm}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    TypeScript {manifest.frameworks?.language}
                  </p>
                  <p className="pt-1 text-[10px] text-slate-500">
                    Express 4.22 • React 18.3 • Vite 5.4 • Tailwind 3.4
                  </p>
                </div>

                {/* 5. Client Browser Environment */}
                <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5 text-teal-600" />
                      <span>Client Browser &amp; Display Environment</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      {clientEnv.screen}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-900">
                    {clientEnv.browser} on {clientEnv.os} (Resolution: {clientEnv.screen})
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 truncate" title={clientEnv.userAgent}>
                    {clientEnv.userAgent}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <p>Inspecting system and runtime versions...</p>
            </div>
          )}

          {/* Quick Info Box */}
          <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">💡 Single-Command Terminal Verification</p>
            <p>You can also run <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono font-bold text-indigo-600">pnpm versions</code> or double-click <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono font-bold text-indigo-600">get-versions.bat</code> in the workspace to print this entire manifest in the console.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadFile}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition-all inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download File (.txt)</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition-all inline-flex items-center space-x-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenReportIssue && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReportIssue();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md shadow-indigo-600/20 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Report Issue with this Info</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
