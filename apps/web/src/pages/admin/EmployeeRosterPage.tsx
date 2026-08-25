import React, { useState, useEffect } from 'react';
import { Users, Upload, Plus, Download, CheckCircle2, UserCheck, Shield } from 'lucide-react';
import { fetchApi } from '../../services/api';

export const EmployeeRosterPage: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // CSV content state
  const [csvContent, setCsvContent] = useState('');

  // Single User form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Welcome123!');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('EMPLOYEE');

  const loadRoster = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<any[]>('/roster');
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetchApi<{ message: string; count: number; defaultPassword?: string }>('/roster/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, defaultPassword: 'Password123!' }),
      });

      setStatusMsg(`${res.message} Default password assigned: Password123!`);
      setShowCsvModal(false);
      setCsvContent('');
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to import employee roster CSV');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/roster', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, department, role }),
      });
      setShowUserModal(false);
      setName('');
      setEmail('');
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to add employee');
    }
  };

  const downloadSampleRosterCsv = () => {
    const sample = `Name,Email,Department,BaseOfficeBuildingCode,Role
Alice Smith,alice@acme.com,Software Engineering,HQ,EMPLOYEE
Bob Johnson,bob@acme.com,Product Design,HQ,EMPLOYEE
Charlie Davis,charlie@acme.com,Facilities Management,HQ,ORGANIZATION_ADMIN`;

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_employee_roster.csv';
    a.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Employee Roster & Onboarding</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage organization users, roles, base office assignments, and bulk CSV roster imports.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Bulk CSV Roster Import</span>
          </button>

          <button
            onClick={() => setShowUserModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </span>
          <button onClick={() => setStatusMsg(null)} className="text-xs text-emerald-700 font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Organization Employees ({employees.length})</h2>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {employees.map(emp => (
            <div key={emp.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm border">
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <span>{emp.name}</span>
                    {emp.role !== 'EMPLOYEE' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {emp.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {emp.email} • {emp.department || 'General Staff'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {emp.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                  Paste CSV Roster Data (Header: Name,Email,Department,BaseOfficeBuildingCode,Role)
                </label>
                <textarea
                  rows={8}
                  required
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
                  placeholder={`Alice Smith,alice@acme.com,Software Engineering,HQ,EMPLOYEE
Bob Johnson,bob@acme.com,Product Design,HQ,EMPLOYEE`}
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
            <h3 className="text-base font-bold text-slate-900">Add Employee</h3>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ORGANIZATION_ADMIN">Organization Admin</option>
                </select>
              </div>

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
