import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import {
  Users, Download, Upload, Plus, Edit2, Search,
  RefreshCw, CheckCircle2, AlertTriangle, Globe,
  UserX, UserCheck, FileSpreadsheet, Key
} from 'lucide-react';

interface EmployeeItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  status: string;
  createdAt: string;
}

export const BranchEmployeeRosterPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const activeOrg = user?.organization || tenant;

  const defaultDomain = activeOrg?.subdomain ? `${activeOrg.subdomain}.com` : 'acme.com';
  const defaultFallbackPassword = (activeOrg?.name || 'acme').toLowerCase().replace(/[^a-z0-9]/g, '');
  const [domain, setDomain] = useState(defaultDomain);

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exportingDirectory, setExportingDirectory] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Status/Alert Feedback
  const [alertMessage, setAlertMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Default Password State (Inline Editing)
  const [defaultPassword, setDefaultPassword] = useState(defaultFallbackPassword);
  const [savingConfig, setSavingConfig] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [confirmToggleUser, setConfirmToggleUser] = useState<EmployeeItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [branchInfo, setBranchInfo] = useState<{ name: string; code: string } | null>(null);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<any>('/branch-roster/employees');
      if (res) {
        if (res.branch) {
          setBranchInfo({ name: res.branch.name, code: res.branch.code });
          if (res.branch.defaultEmployeePassword) {
            setDefaultPassword(res.branch.defaultEmployeePassword);
          }
        }
        if (res.defaultPassword) {
          setDefaultPassword(res.defaultPassword);
        }
        if (res.corporateDomain) {
          setDomain(res.corporateDomain);
        }
        if (Array.isArray(res.employees)) {
          setEmployees(res.employees);
        } else if (Array.isArray(res)) {
          setEmployees(res);
        } else {
          setEmployees([]);
        }
      } else {
        setEmployees([]);
      }
    } catch (err: any) {
      console.error('Failed to load branch employees:', err);
      setAlertMessage({
        type: 'error',
        text: err.message || 'Failed to load employee directory.',
      });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // 1. Download Dynamic Formula-Assisted Template
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const token = localStorage.getItem('token');
      const cleanDomain = domain.trim() || defaultDomain;
      const passParam = defaultPassword ? `&defaultPassword=${encodeURIComponent(defaultPassword)}` : '';
      const res = await fetch(`/api/branch-roster/template?domain=${encodeURIComponent(cleanDomain)}${passParam}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to generate template workbook');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Branch_Employees_Template_${cleanDomain}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Template download error:', err);
      alert('Error generating template: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 2. Export Entire Branch Directory
  const handleExportDirectory = async () => {
    try {
      setExportingDirectory(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/branch-roster/export', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to export directory');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Branch_Employee_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Directory export error:', err);
      alert('Error exporting directory: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingDirectory(false);
    }
  };

  // 3. Batch Upload Excel File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setAlertMessage(null);
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/branch-roster/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import employee roster');
      }

      setAlertMessage({
        type: 'success',
        text: data.message || `Successfully processed ${data.totalProcessed} employee records.`,
      });
      await loadEmployees();
    } catch (err: any) {
      console.error('Roster upload error:', err);
      setAlertMessage({
        type: 'error',
        text: err.message || 'An error occurred during roster ingestion.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleOpenAddModal = () => {
    setAddName('');
    setAddEmail('');
    setEmailManuallyEdited(false);
    setAddPassword(defaultPassword || defaultFallbackPassword);
    setShowAddModal(true);
  };

  const handleNameChange = (val: string) => {
    setAddName(val);
    if (!emailManuallyEdited) {
      const cleanName = val.trim().toLowerCase().replace(/\s+/g, '.');
      const targetDomain = domain.trim() || defaultDomain;
      setAddEmail(cleanName ? `${cleanName}@${targetDomain}` : '');
    }
  };

  const handleEmailChange = (val: string) => {
    setAddEmail(val);
    setEmailManuallyEdited(true);
  };

  // 4. Create Single Employee Manually
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      let targetEmail = addEmail.trim().toLowerCase();
      if (!targetEmail.includes('@')) {
        targetEmail = `${targetEmail}@${domain.trim() || defaultDomain}`;
      }

      const targetPassword = addPassword.trim() || defaultPassword || defaultFallbackPassword;

      await fetchApi('/branch-roster/employee', {
        method: 'POST',
        body: JSON.stringify({
          name: addName.trim(),
          email: targetEmail,
          password: targetPassword,
        }),
      });

      setAlertMessage({
        type: 'success',
        text: `Employee account provisioned successfully for ${targetEmail}.`,
      });
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      setEmailManuallyEdited(false);
      await loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to add employee');
    } finally {
      setAddLoading(false);
    }
  };

  // 5. Update Existing Employee Details
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      setEditLoading(true);
      await fetchApi(`/branch-roster/employee/${editingEmployee.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
        }),
      });

      setAlertMessage({
        type: 'success',
        text: `Employee details updated successfully.`,
      });
      setEditingEmployee(null);
      await loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to update employee');
    } finally {
      setEditLoading(false);
    }
  };

  // 6. Toggle Active / Deactivated Status
  const handleToggleStatus = async () => {
    if (!confirmToggleUser) return;
    try {
      setToggleLoading(true);
      await fetchApi(`/branch-roster/employee/${confirmToggleUser.id}/toggle-status`, {
        method: 'PATCH',
      });

      const nextStatus = !confirmToggleUser.isActive;
      setAlertMessage({
        type: 'success',
        text: `Account for ${confirmToggleUser.name} has been ${nextStatus ? 'reactivated' : 'deactivated'}.`,
      });
      setConfirmToggleUser(null);
      await loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle account status');
    } finally {
      setToggleLoading(false);
    }
  };

  // 7. Save Default Employee Temporary Password Inline (No Popup)
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPass = defaultPassword.trim();
    if (!cleanPass || cleanPass.length < 4) {
      alert('Default temporary password must be at least 4 characters long.');
      return;
    }
    try {
      setSavingConfig(true);
      const res = await fetchApi<any>('/branch-roster/default-password', {
        method: 'PATCH',
        body: JSON.stringify({ defaultPassword: cleanPass }),
      });
      if (res.defaultPassword) {
        setDefaultPassword(res.defaultPassword);
      }
      setAlertMessage({
        type: 'success',
        text: 'Corporate email domain and default temporary password configured successfully.',
      });
    } catch (err: any) {
      console.error('Failed to update configuration:', err);
      alert(err.message || 'Failed to update configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const filteredEmployees = safeEmployees.filter(emp =>
    (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-4 animate-fade-in">
      
      {/* Top Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            FACILITY DIRECTORY CONSOLE
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
            <span>Branch Employee Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
              {branchInfo?.name ? `${branchInfo.name} • ${safeEmployees.length} Members` : `${safeEmployees.length} Members`}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your facility's personnel with formula-assisted batch Excel ingestion or single additions. Passwords and branch codes are protected.
          </p>
        </div>

        {/* Quick Add Button */}
        <button
          onClick={handleOpenAddModal}
          className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Alert Feedback Banner */}
      {alertMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in ${
          alertMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center space-x-2">
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            onClick={() => setAlertMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Option A Dynamic Formula Ingestion Hub */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-black text-slate-900">
              Automated Dynamic Formula Excel Ingestion
            </h2>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
            Zero Manual Email / Password Entry
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          
          {/* Corporate Domain Input */}
          <div className="lg:col-span-3 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Corporate Email Domain
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="acme.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Injected into Excel formula so typing "Mohit Kumar" auto-generates "mohit.kumar@{domain || defaultDomain}".
            </p>
          </div>

          {/* Default Temporary Password (Inline Direct Editing) */}
          <div className="lg:col-span-3 space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Default Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={e => setDefaultPassword(e.target.value)}
                  placeholder={defaultFallbackPassword}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSaveConfig()}
                disabled={savingConfig}
                className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center space-x-1"
                title="Save Configuration"
              >
                {savingConfig ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Configure</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Initial fallback is organization name. Auto-fills in column C upon entering employee name.
            </p>
          </div>

          {/* Action Hub Buttons: Two-Row Layout */}
          <div className="lg:col-span-6 flex flex-col items-start lg:items-end justify-center gap-2.5">
            {/* Top Row: Download on left, Upload to its right */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Download Template Button */}
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {downloadingTemplate ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Preparing Template...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Ingestion Template</span>
                  </>
                )}
              </button>

              {/* Upload Completed Roster Button */}
              <label className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-2 shadow-xs transition-all cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Upserting Roster...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Completed Roster (.xlsx)</span>
                  </>
                )}
              </label>
            </div>

            {/* Bottom Row: Export Complete Directory Button placed underneath */}
            <button
              onClick={handleExportDirectory}
              disabled={exportingDirectory}
              className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-2 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {exportingDirectory ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Directory (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table Console */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or corporate email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            Showing {filteredEmployees.length} of {employees.length} employees
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-slate-400">
            Loading Branch Employee Directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Employees Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No staff members match your search criteria.'
                : 'Your branch roster is currently empty. Use the template download above or add staff manually.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Employee Full Name</th>
                  <th className="py-3.5 px-6">Corporate Email</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                        {(emp.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span>{emp.name}</span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">
                      {emp.email}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        ● {emp.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingEmployee(emp);
                            setEditName(emp.name);
                            setEditEmail(emp.email);
                          }}
                          title="Edit Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Deactivate / Reactivate Toggle */}
                        <button
                          onClick={() => setConfirmToggleUser(emp)}
                          title={emp.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            emp.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {emp.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* PORTAL MODAL 1: ADD SINGLE EMPLOYEE */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/60 max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Add Branch Employee
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Mohit Kumar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="text"
                  required
                  value={addEmail}
                  onChange={e => handleEmailChange(e.target.value)}
                  placeholder={`e.g. mohit.kumar@${domain || defaultDomain}`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-generated from employee name. You can adjust it if needed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Temporary Password
                </label>
                <input
                  type="text"
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder={defaultPassword || defaultFallbackPassword}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pre-filled with branch default ({defaultPassword || defaultFallbackPassword}). Employees reset this upon first login.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PORTAL MODAL 2: EDIT EMPLOYEE */}
      {editingEmployee && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/60 max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Edit Employee Details
              </h3>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PORTAL MODAL 3: CONFIRM STATUS TOGGLE */}
      {confirmToggleUser && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-white/60 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                confirmToggleUser.isActive
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              }`}>
                {confirmToggleUser.isActive ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  {confirmToggleUser.isActive ? 'Deactivate Employee Account?' : 'Reactivate Employee Account?'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {confirmToggleUser.isActive
                    ? `Deactivating ${confirmToggleUser.name} (${confirmToggleUser.email}) will immediately revoke active sessions and reject future logins. Existing historical logs are preserved.`
                    : `Reactivating ${confirmToggleUser.name} will restore their login access and allow them to make desk reservations.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmToggleUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggleLoading}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
                  confirmToggleUser.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggleLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>{confirmToggleUser.isActive ? 'Confirm Deactivation' : 'Confirm Reactivation'}</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
