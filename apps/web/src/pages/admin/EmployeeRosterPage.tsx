import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, Upload, Plus, Download, CheckCircle2,
  Shield, Search, ChevronLeft, ChevronRight, UserPlus, Building,
  AlertCircle, Clock, Edit2, Mail, AlertTriangle, X
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { useTenant } from '../../context/TenantContext';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface BranchAdminItem {
  branchId: string;
  branchCode: string;
  branchName: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  } | null;
}

export const EmployeeRosterPage: React.FC = () => {
  const { tenant } = useTenant();

  // Active Tab: 'branch-admins' | 'directory'
  const [activeTab, setActiveTab] = useState<'branch-admins' | 'directory'>('branch-admins');

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
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Status & Error Banners
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // General Employee Roster State
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<any>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // Bulk CSV Roster State
  const [csvContent, setCsvContent] = useState('');

  // Single User State (Directory)
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newRole, setNewRole] = useState('EMPLOYEE');
  const [newScopedBranchId, setNewScopedBranchId] = useState('');

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

  // 2. Fetch Employees (Directory)
  const loadRoster = async () => {
    try {
      setLoadingEmployees(true);
      const query = `page=${currentPage}&limit=25${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetchApi<any>(`/roster?${query}`);
      setEmployees(res.users || []);
      setPaginationInfo(res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
    } catch (err: any) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // 3. Fetch Branches for Reference
  const loadReferenceData = async () => {
    try {
      const branchList = await fetchApi<any[]>('/branches');
      setBranches(Array.isArray(branchList) ? branchList : []);
      if (branchList.length > 0 && !newScopedBranchId) {
        setNewScopedBranchId(branchList[0].id);
      }
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  useEffect(() => {
    loadBranchAdmins();
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (activeTab === 'directory') {
      loadRoster();
    }
  }, [activeTab, currentPage, searchQuery]);

  // 4. Download Branch Admin Excel Template
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
      setStatusMsg('Branch Administrator Excel template downloaded successfully.');
    } catch (err: any) {
      console.error('Download template error:', err);
      setErrorMsg('Error downloading template: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 5. Upload Completed Excel Roster
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to import branch administrators');
      }

      setStatusMsg(data.message || `Successfully assigned ${data.count} branch administrator(s).`);
      if (data.errors && data.errors.length > 0) {
        setErrorMsg('Some warnings occurred: ' + data.errors.join(' | '));
      }
      await loadBranchAdmins();
    } catch (err: any) {
      console.error('Upload branch admin error:', err);
      setErrorMsg(err.message || 'Error uploading Excel roster.');
    } finally {
      setUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Open Modal for Assigning / Editing
  const openAssignModal = (item?: BranchAdminItem) => {
    setAdminModalMode('assign');
    setEditingAdminId(null);
    setSelectedBranchId(item ? item.branchId : (branchAdmins[0]?.branchId || ''));
    setModalAdminName('');
    setModalAdminEmail('');
    setModalAdminPassword('');
    setEmailValidationError(null);
    setShowAdminModal(true);
  };

  const openEditModal = (item: BranchAdminItem) => {
    if (!item.admin) return;
    setAdminModalMode('edit');
    setEditingAdminId(item.admin.id);
    setSelectedBranchId(item.branchId);
    setModalAdminName(item.admin.name);
    setModalAdminEmail(item.admin.email);
    setModalAdminPassword('');
    setEmailValidationError(null);
    setShowAdminModal(true);
  };

  // 7. Save Single Branch Admin (POST or PUT)
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailValidationError(null);

    const trimmedEmail = modalAdminEmail.trim();
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
            name: modalAdminName.trim(),
            email: trimmedEmail,
            branchId: selectedBranchId,
          }),
        });
        setStatusMsg(`Administrator "${modalAdminName}" updated successfully.`);
      } else {
        await fetchApi('/roster/branch-admin', {
          method: 'POST',
          body: JSON.stringify({
            branchId: selectedBranchId,
            name: modalAdminName.trim(),
            email: trimmedEmail,
            password: modalAdminPassword.trim() || undefined,
          }),
        });
        setStatusMsg(`Administrator "${modalAdminName}" assigned successfully.`);
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

  // 8. Bulk CSV Import (Directory)
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetchApi<{ message: string; count: number; defaultPassword?: string }>('/roster/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, defaultPassword: 'Password123!' }),
      });

      setStatusMsg(`${res.message} Default credentials configured: Password123!`);
      setShowCsvModal(false);
      setCsvContent('');
      setCurrentPage(1);
      loadRoster();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import employee roster CSV');
    }
  };

  // 9. Single User Create (Directory)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: any = {
        name: newName,
        email: newEmail,
        password: newPassword,
        department: newDepartment,
        role: newRole,
        scopedBranchId: newScopedBranchId || null,
        baseBranchId: newScopedBranchId || null,
      };

      await fetchApi('/roster', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowUserModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewDepartment('');
      setNewRole('EMPLOYEE');
      setNewScopedBranchId(branches.length > 0 ? branches[0].id : '');
      setStatusMsg(`User "${newName}" registered successfully.`);
      loadRoster();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add employee');
    }
  };

  const downloadSampleRosterCsv = () => {
    const sample = `Name,Email,Department,Role,BaseBranchCode
Alice Smith,alice@acme.com,Operations,BRANCH_ADMIN,HQ
Bob Johnson,bob@acme.com,Product Design,EMPLOYEE,HQ
Charlie Davis,charlie@acme.com,Engineering,EMPLOYEE,HQ`;

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_employee_roster.csv';
    a.click();
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
            Manage organization-wide personnel, assign local branch administrators, and orchestrate automated access control.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('branch-admins')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'branch-admins'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span>Branch Administrators</span>
            {totalBranches > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                assignedCount === totalBranches ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {assignedCount}/{totalBranches}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'directory'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>All Employees Directory</span>
          </button>
        </div>
      </div>

      {/* Notifications Banners */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3">
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
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BRANCH ADMINISTRATORS MANAGEMENT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'branch-admins' && (
        <>
          {/* PREREQUISITE GATEKEEPER: If 0 branches exist in DB */}
          {!loadingAdmins && branchAdmins.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-4 my-8">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-100">
                <Building className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Workspace Configuration Required</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Please configure your workspace layout first. Once physical branches are defined through the Excel ingestion pipeline, you will be able to assign branch administrators and manage the employee roster.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin/workspace-setup"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
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
                  {/* Download Template */}
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50"
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
                    className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-600" />
                    <span>{uploadingExcel ? 'Importing...' : 'Upload Completed Roster'}</span>
                  </button>

                  {/* Manual Single Administrator Assignment */}
                  <button
                    onClick={() => openAssignModal()}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
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
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors inline-flex items-center space-x-1"
                                >
                                  <Edit2 className="w-3 h-3 text-slate-500" />
                                  <span>Edit</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openAssignModal(item)}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors inline-flex items-center space-x-1"
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
                            No branches match the specified filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ALL EMPLOYEES DIRECTORY                                            */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees by name, email, department..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCsvModal(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Bulk CSV Import</span>
              </button>

              <button
                onClick={() => {
                  loadReferenceData();
                  setShowUserModal(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {employees.map(emp => (
              <div key={emp.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-sm border border-slate-200">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                      <span>{emp.name}</span>
                      {emp.role === 'ORGANIZATION_ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold text-[9px] border border-emerald-200 uppercase flex items-center space-x-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Org Admin</span>
                        </span>
                      )}
                      {emp.role === 'BRANCH_ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[9px] border border-purple-200 uppercase flex items-center space-x-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Branch Admin</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {emp.email} &bull; {emp.department || 'General'}
                      {emp.scopedBranch && (
                        <span className="ml-2 text-purple-600 font-semibold font-mono">
                          [{emp.scopedBranch.name}]
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {emp.status}
                  </span>
                </div>
              </div>
            ))}

            {employees.length === 0 && !loadingEmployees && (
              <div className="text-center py-20 flex flex-col items-center justify-center space-y-2 text-slate-400 italic text-xs">
                <Users className="w-8 h-8 text-slate-300" />
                <span>No employees match the search criteria.</span>
              </div>
            )}
          </div>

          {/* Pagination */}
          {paginationInfo.totalPages > 1 && (
            <div className="px-6 py-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page <strong>{paginationInfo.page}</strong> of <strong>{paginationInfo.totalPages}</strong> ({paginationInfo.total} total)
              </span>
              
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <button
                  disabled={currentPage === paginationInfo.totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, paginationInfo.totalPages))}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="space-y-4">
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
                  onChange={e => setModalAdminName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
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
                  <input
                    type="password"
                    value={modalAdminPassword}
                    onChange={e => setModalAdminPassword(e.target.value)}
                    placeholder="Leave empty for default: DeskBook$2026#BranchOps"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    If left empty, the secure credential <code>DeskBook$2026#BranchOps</code> will be assigned.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-50"
                >
                  {savingAdmin ? 'Saving...' : adminModalMode === 'edit' ? 'Update Administrator' : 'Assign Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BULK CSV ROSTER IMPORT                                             */}
      {/* ========================================================================= */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Bulk CSV Employee Roster Upload</span>
              </h3>
              <button
                onClick={downloadSampleRosterCsv}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV Template</span>
              </button>
            </div>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Paste CSV Roster Data (Header: Name,Email,Department,Role,BaseBranchCode)
                </label>
                <textarea
                  rows={8}
                  required
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
                  placeholder={`Alice Smith,alice@acme.com,Operations,BRANCH_ADMIN,HQ\nBob Johnson,bob@acme.com,Product Design,EMPLOYEE,HQ`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Import Employee Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SINGLE EMPLOYEE                                                */}
      {/* ========================================================================= */}
      {showUserModal && (
        <div className="fixed top-0 left-0 w-full h-full z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              <span>Add Employee</span>
            </h3>
            
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="john@acme.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  placeholder="Operations, IT, Engineering..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="EMPLOYEE">Regular Employee</option>
                  <option value="TECH_LEAD">Tech Lead</option>
                  <option value="BRANCH_ADMIN">Branch Administrator</option>
                </select>
              </div>

              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch</label>
                  <select
                    value={newScopedBranchId}
                    onChange={e => setNewScopedBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    <option value="">-- None / General --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
