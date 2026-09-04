import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../../context/TenantContext';
import { fetchApi } from '../../services/api';
import {
  Users,
  Shield,
  Search,
  Download,
  Upload,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Building,
  Clock,
  Mail,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface BranchAdminItem {
  branchId: string;
  branchName: string;
  branchCode?: string;
  admin: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  } | null;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const EmployeeRosterPage: React.FC = () => {
  const { tenant } = useTenant();

  // Branch Admins State
  const [branchAdmins, setBranchAdmins] = useState<BranchAdminItem[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [adminSearch, setAdminSearch] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State for Branch Admin Assign/Edit
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminModalMode, setAdminModalMode] = useState<'assign' | 'edit'>('assign');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [modalAdminName, setModalAdminName] = useState('');
  const [modalAdminEmail, setModalAdminEmail] = useState('');
  const [modalAdminPassword, setModalAdminPassword] = useState('');
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Delete Confirmation Modal State
  const [deletingAdminItem, setDeletingAdminItem] = useState<BranchAdminItem | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Status & Error Banners
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Branch Administrators
  const loadBranchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const data = await fetchApi<BranchAdminItem[]>('/roster/branch-admins');
      setBranchAdmins(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load branch admins:', err);
      setBranchAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadBranchAdmins();
  }, []);

  // 2. Download Branch Admin Excel Template (Only unassigned branches)
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setStatusMsg(null);
      setErrorMsg(null);

      const token = localStorage.getItem('token');
      const tenantSub = localStorage.getItem('activeTenantSubdomain');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantSub) headers['x-tenant-subdomain'] = tenantSub;

      const response = await fetch('/api/roster/branch-admin-template', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Branch_Admin_Roster_${tenant?.code || 'Template'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatusMsg('Branch Administrator Excel template downloaded successfully (includes unassigned branches).');
    } catch (err: any) {
      console.error('Download template error:', err);
      setErrorMsg(err.message || 'Error downloading template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 3. Upload Completed Excel Roster
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingExcel(true);
      setStatusMsg(null);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const tenantSub = localStorage.getItem('activeTenantSubdomain');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantSub) headers['x-tenant-subdomain'] = tenantSub;

      const response = await fetch('/api/roster/branch-admin-import', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to import branch administrators');
      }

      setStatusMsg(data.message || `Successfully assigned ${data.count} administrator(s).`);
      await loadBranchAdmins();
    } catch (err: any) {
      console.error('Upload branch admins error:', err);
      setErrorMsg(err.message || 'Error uploading branch admin roster.');
    } finally {
      setUploadingExcel(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 4. Open Manual Assignment Modal
  const openAssignModal = (preselectedBranch?: BranchAdminItem) => {
    setAdminModalMode('assign');
    setSelectedBranchId(preselectedBranch ? preselectedBranch.branchId : (branchAdmins[0]?.branchId || ''));
    setModalAdminName('');
    setModalAdminEmail('');
    setModalAdminPassword('');
    setEditingAdminId(null);
    setEmailValidationError(null);
    setNameValidationError(null);
    setShowPassword(false);
    setShowAdminModal(true);
  };

  // 5. Open Manual Edit Modal
  const openEditModal = (item: BranchAdminItem) => {
    if (!item.admin) return;
    setAdminModalMode('edit');
    setSelectedBranchId(item.branchId);
    setModalAdminName(item.admin.name);
    setModalAdminEmail(item.admin.email);
    setModalAdminPassword('');
    setEditingAdminId(item.admin.id);
    setEmailValidationError(null);
    setNameValidationError(null);
    setShowPassword(false);
    setShowAdminModal(true);
  };

  // 6. Submit Manual Assign or Edit
  const handleSaveAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailValidationError(null);
    setNameValidationError(null);

    const trimmedName = modalAdminName.trim();
    if (!trimmedName) {
      setNameValidationError('Administrator full name is required.');
      return;
    }

    const trimmedEmail = modalAdminEmail.trim();
    if (!trimmedEmail) {
      setEmailValidationError('Administrator email address is required.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailValidationError('Please enter a valid email address (e.g., admin@company.com).');
      return;
    }

    try {
      setSavingAdmin(true);
      setStatusMsg(null);
      setErrorMsg(null);

      if (adminModalMode === 'edit' && editingAdminId) {
        await fetchApi(`/roster/branch-admin/${editingAdminId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            branchId: selectedBranchId,
          }),
        });
        setStatusMsg(`Administrator "${trimmedName}" updated successfully.`);
      } else {
        await fetchApi('/roster/branch-admin', {
          method: 'POST',
          body: JSON.stringify({
            branchId: selectedBranchId,
            name: trimmedName,
            email: trimmedEmail,
            password: modalAdminPassword.trim() || undefined,
          }),
        });
        setStatusMsg(`Administrator "${trimmedName}" assigned successfully.`);
      }

      setShowAdminModal(false);
      await loadBranchAdmins();
    } catch (err: any) {
      console.error('Save branch admin error:', err);
      setErrorMsg(err.message || 'Failed to save branch administrator.');
    } finally {
      setSavingAdmin(false);
    }
  };

  // 7. Delete / Revoke Branch Administrator
  const handleDeleteAdmin = async () => {
    if (!deletingAdminItem?.admin?.id) return;
    try {
      setDeletingInProgress(true);
      setStatusMsg(null);
      setErrorMsg(null);

      await fetchApi(`/roster/branch-admin/${deletingAdminItem.admin.id}`, {
        method: 'DELETE',
      });

      setStatusMsg(`Administrator "${deletingAdminItem.admin.name}" removed. Branch "${deletingAdminItem.branchName}" has been reverted to Pending Assignment.`);
      setDeletingAdminItem(null);
      await loadBranchAdmins();
    } catch (err: any) {
      console.error('Delete branch admin error:', err);
      setErrorMsg(err.message || 'Failed to remove branch administrator.');
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Filter branch admins by search (branchName, admin name, admin email)
  // CRUCIAL: Branch ID is strictly NOT rendered
  const filteredBranchAdmins = branchAdmins.filter(item => {
    if (!adminSearch.trim()) return true;
    const q = adminSearch.toLowerCase();
    const branchMatch = item.branchName.toLowerCase().includes(q);
    const adminNameMatch = item.admin?.name.toLowerCase().includes(q);
    const adminEmailMatch = item.admin?.email.toLowerCase().includes(q);
    return branchMatch || adminNameMatch || adminEmailMatch;
  });

  const assignedCount = branchAdmins.filter(b => b.admin).length;
  const totalBranches = branchAdmins.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-0 py-4">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Employee Roster &amp; Branch Administration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage local branch administrators and orchestrate automated access control across your corporate network.
          </p>
        </div>

        {totalBranches > 0 && (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>Assigned:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
              assignedCount === totalBranches ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {assignedCount} / {totalBranches} Branches
            </span>
          </div>
        )}
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

      {/* PREREQUISITE GATEKEEPER: If 0 branches exist in DB */}
      {!loadingAdmins && branchAdmins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-100">
            <Building className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Workspace Configuration Required</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Please configure your workspace layout first. Once physical branches are defined through the Excel ingestion pipeline, you will be able to assign and manage branch administrators.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/workspace-setup"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Launch Workspace Setup</span>
              <span className="text-sm font-black">➔</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action Hub & Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by branch name or administrator..."
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Actions: Download Template, Upload Excel, Manual Add */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Download Template (Only unassigned branches) */}
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Download spreadsheet with unassigned branches"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>{downloadingTemplate ? 'Generating...' : 'Download Template'}</span>
              </button>

              {/* Upload Completed Excel */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingExcel}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-purple-600" />
                <span>{uploadingExcel ? 'Importing...' : 'Upload Completed Roster'}</span>
              </button>

              {/* Manual Single Administrator Assignment */}
              <button
                onClick={() => openAssignModal()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Administrator</span>
              </button>
            </div>
          </div>

          {/* Branch Admins Data Table */}
          {/* CRUCIAL: Branch ID IS HIDDEN. Only Branch Name is shown. */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-6">Branch Name</th>
                    <th className="py-3.5 px-6">Administrator</th>
                    <th className="py-3.5 px-6">Email Address</th>
                    <th className="py-3.5 px-6">Assignment Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranchAdmins.map((item) => {
                    const hasAdmin = !!item.admin;
                    return (
                      <tr key={item.branchId} className="hover:bg-slate-50/75 transition-colors">
                        {/* Branch Name (Branch ID is strictly hidden) */}
                        <td className="py-4 px-6 font-extrabold text-slate-900 flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200 flex-shrink-0">
                            <Building className="w-4 h-4" />
                          </div>
                          <span className="text-sm">{item.branchName}</span>
                        </td>

                        {/* Administrator Name */}
                        <td className="py-4 px-6">
                          {hasAdmin ? (
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center border border-purple-200">
                                {item.admin!.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800">{item.admin!.name}</span>
                                <div className="text-[10px] text-purple-600 font-semibold flex items-center space-x-1">
                                  <Shield className="w-2.5 h-2.5" />
                                  <span>Branch Admin</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs flex items-center space-x-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                              <span>Pending Assignment</span>
                            </span>
                          )}
                        </td>

                        {/* Email Address */}
                        <td className="py-4 px-6">
                          {hasAdmin ? (
                            <span className="text-slate-600 font-medium flex items-center space-x-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.admin!.email}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          {hasAdmin ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Assigned</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          {hasAdmin ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openEditModal(item)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setDeletingAdminItem(item)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                                title="Revoke Administrator"
                              >
                                <Trash2 className="w-3 h-3 text-rose-500" />
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openAssignModal(item)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Assign</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredBranchAdmins.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic text-xs">
                        No branches match the specified search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN / EDIT BRANCH ADMINISTRATOR                                 */}
      {/* ========================================================================= */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>{adminModalMode === 'edit' ? 'Edit Branch Administrator' : 'Assign Branch Administrator'}</span>
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Branch Selector: Branch ID is hidden; only Branch Name displayed */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Branch
                </label>
                <select
                  required
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  disabled={adminModalMode === 'edit'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {branchAdmins.map(b => (
                    <option key={b.branchId} value={b.branchId}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Select the physical branch this administrator will oversee.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Administrator Full Name
                </label>
                <input
                  type="text"
                  required
                  value={modalAdminName}
                  onChange={e => {
                    setModalAdminName(e.target.value);
                    if (nameValidationError) setNameValidationError(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAdmin(); }}
                  placeholder="e.g. Sarah Jenkins"
                  className={`w-full bg-slate-50 border ${
                    nameValidationError ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200'
                  } rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none`}
                />
                {nameValidationError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{nameValidationError}</span>
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Administrator Email Address
                </label>
                <input
                  type="email"
                  required
                  value={modalAdminEmail}
                  onChange={e => {
                    setModalAdminEmail(e.target.value);
                    if (emailValidationError) setEmailValidationError(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAdmin(); }}
                  placeholder="sjenkins@company.com"
                  className={`w-full bg-slate-50 border ${
                    emailValidationError ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-200'
                  } rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none`}
                />
                {emailValidationError ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{emailValidationError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Universal RFC 5322 compliant email address.
                  </p>
                )}
              </div>

              {/* Password (Only for new assignment) */}
              {adminModalMode === 'assign' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Initial Password (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="provision_access_credential"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as React.CSSProperties}
                      value={modalAdminPassword}
                      onChange={e => setModalAdminPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveAdmin(); }}
                      placeholder="Leave empty for default: DeskBook$2026#BranchOps"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    If left empty, the secure credential <code>DeskBook$2026#BranchOps</code> will be assigned.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAdmin()}
                  disabled={savingAdmin}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingAdmin ? 'Saving...' : adminModalMode === 'edit' ? 'Update Administrator' : 'Assign Administrator'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE / REVOKE BRANCH ADMINISTRATOR CONFIRMATION                  */}
      {/* ========================================================================= */}
      {deletingAdminItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Remove Branch Administrator?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove <strong>{deletingAdminItem.admin?.name}</strong> as administrator for <strong>{deletingAdminItem.branchName}</strong>?
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 text-left">
                ℹ️ The branch status will immediately revert to <strong>Pending Assignment</strong>, and you can re-assign an administrator at any time.
              </div>
            </div>

            <div className="flex justify-end space-x-2.5 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeletingAdminItem(null)}
                disabled={deletingInProgress}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={deletingInProgress}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {deletingInProgress ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
