import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, Upload, Plus, Download, CheckCircle2, UserCheck, 
  Shield, Search, ChevronLeft, ChevronRight, UserPlus, Building
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const EmployeeRosterPage: React.FC = () => {
  const { user } = useAuth();
  const isGlobalOrgAdmin = user?.role === 'ORGANIZATION_ADMIN' && !user.scopedBranchId;
  const isBranchAdmin = user?.role === 'ORGANIZATION_ADMIN' && !!user.scopedBranchId;

  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [techLeads, setTechLeads] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<any>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // CSV content state
  const [csvContent, setCsvContent] = useState('');

  // Single User form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Welcome123!');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [baseBranchId, setBaseBranchId] = useState('');
  const [scopedBranchId, setScopedBranchId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');

  const loadRoster = async () => {
    try {
      setLoading(true);
      const query = `page=${currentPage}&limit=25${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetchApi<any>(`/roster?${query}`);
      setEmployees(res.users || []);
      setPaginationInfo(res.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
    } catch (err: any) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      // Load branches
      const branchList = await fetchApi<any[]>('/branches');
      setBranches(branchList);
      if (branchList.length > 0) {
        setBaseBranchId(branchList[0].id);
      }

      // Load all organization users to filter as potential team leads
      const allUsersRes = await fetchApi<any>('/roster?limit=100');
      const leads = (allUsersRes.users || []).filter((u: any) => u.role === 'TECH_LEAD' || u.role === 'ORGANIZATION_ADMIN');
      setTechLeads(leads);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [currentPage, searchQuery]);

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (isGlobalOrgAdmin) {
      setRole('ORGANIZATION_ADMIN');
    } else {
      setRole('EMPLOYEE');
    }
  }, [user, isGlobalOrgAdmin]);

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetchApi<{ message: string; count: number; defaultPassword?: string }>('/roster/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, defaultPassword: 'Password123!' }),
      });

      setStatusMsg(`${res.message} default credentials configured: Password123!`);
      setShowCsvModal(false);
      setCsvContent('');
      setCurrentPage(1);
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to import employee roster CSV');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: any = {
        name,
        email,
        password,
        department,
      };

      if (isGlobalOrgAdmin) {
        body.role = 'ORGANIZATION_ADMIN';
        body.scopedBranchId = scopedBranchId || null;
      } else {
        body.role = role;
        body.baseBranchId = user?.scopedBranchId || baseBranchId || null;
        body.teamLeadId = role === 'EMPLOYEE' ? (teamLeadId || null) : null;
      }

      await fetchApi('/roster', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowUserModal(false);
      setName('');
      setEmail('');
      setPassword('Welcome123!');
      setDepartment('');
      setRole(isGlobalOrgAdmin ? 'ORGANIZATION_ADMIN' : 'EMPLOYEE');
      setBaseBranchId('');
      setScopedBranchId('');
      setTeamLeadId('');
      setStatusMsg(`User "${name}" registered successfully.`);
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to add employee');
    }
  };

  const downloadSampleRosterCsv = () => {
    const sample = `Name,Email,Department,BaseOfficeBuildingCode,Role,BaseBranchCode,TeamLeadEmail
Alice Smith,alice@acme.com,Software Engineering,HQ,TECH_LEAD,MAIN,
Bob Johnson,bob@acme.com,Product Design,HQ,EMPLOYEE,MAIN,alice@acme.com
Charlie Davis,charlie@acme.com,Facilities Management,HQ,ORGANIZATION_ADMIN,MAIN,`;

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_employee_roster.csv';
    a.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-0">

      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Employee Roster & Onboarding</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage employee access roles, organizational hierarchy base settings, and bulk CSV integrations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isGlobalOrgAdmin && (
            <button
              onClick={() => setShowCsvModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>CSV Roster Import</span>
            </button>
          )}

          {(!isGlobalOrgAdmin || branches.length > 0) && (
            <button
              onClick={() => {
                loadReferenceData();
                setShowUserModal(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-sm">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-xs text-emerald-700 font-bold underline hover:text-emerald-900">
            Dismiss
          </button>
        </div>
      )}

      {isGlobalOrgAdmin && branches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
            <Building className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-slate-900">No Branches Registered Yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Please register at least one branch location on your dashboard before setting up branch administrators.
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        /* search and Table block */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          {/* Search bar header */}
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-800">Organization Employees ({paginationInfo.total})</h2>
            
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, dept..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {employees.map(emp => (
              <div key={emp.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/55 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-sm border border-slate-200">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                      <span>{emp.name}</span>
                      {emp.role === 'ORGANIZATION_ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-extrabold text-[9px] border border-purple-150 uppercase flex items-center space-x-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Admin</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">{emp.email} &bull; {emp.department || 'General'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-250/50">
                    {emp.status}
                  </span>
                </div>
              </div>
            ))}

            {employees.length === 0 && !loading && (
              <div className="text-center py-20 flex flex-col items-center justify-center space-y-2 text-slate-400 italic text-xs">
                <Users className="w-8 h-8 text-slate-300" />
                <span>No employees match the criteria.</span>
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {paginationInfo.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
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

      {/* MODAL 1: CSV Roster Import */}
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
                  Paste CSV Roster Data (Header: Name,Email,Department,BaseOfficeBuildingCode,Role,BaseBranchCode,TeamLeadEmail)
                </label>
                <textarea
                  rows={8}
                  required
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
                  placeholder={`Alice Smith,alice@acme.com,Software Engineering,HQ,TECH_LEAD,MAIN,\nBob Johnson,bob@acme.com,Product Design,HQ,EMPLOYEE,MAIN,alice@acme.com`}
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

      {/* MODAL 2: Add Single Employee */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              <span>Add Employee Account</span>
            </h3>
            
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john@acme.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>              {isGlobalOrgAdmin ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Managed Scoped Branch (Required)</label>
                  <select
                    required
                    value={scopedBranchId}
                    onChange={e => setScopedBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                  >
                    <option value="">-- Select Managed Branch --</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role / Permissions</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                    >
                      <option value="EMPLOYEE">Regular Employee</option>
                      <option value="TECH_LEAD">Tech Lead (Manager)</option>
                    </select>
                  </div>

                  {role === 'EMPLOYEE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Team Lead (Optional)</label>
                      <select
                        value={teamLeadId}
                        onChange={e => setTeamLeadId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-850"
                      >
                        <option value="">No manager assigned</option>
                        {techLeads.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
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
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
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
