import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Search, Building2, MapPin, Clock, X, Loader2 } from 'lucide-react';
import { fetchApi } from '../services/api';
import { isAppOnline } from '../services/offlineStore';

export interface OfficePresenceColleague {
  bookingId: string;
  user: {
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    isCurrentUser: boolean;
  };
  bookedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  desk: {
    id: string;
    deskCode: string;
    hasHdmi: boolean;
    isMeetingRoom: boolean;
  };
  location: {
    buildingId: string;
    buildingName: string;
    floorId: string;
    floorCode: string;
    floorName: string;
    sectionId: string;
    sectionName: string;
    direction: string;
  };
  slotType: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

export interface OfficePresenceResponse {
  success: boolean;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  date: string;
  totalPresent: number;
  departmentCounts: Record<string, number>;
  floorCounts: Record<string, number>;
  presence: OfficePresenceColleague[];
}

interface OfficePresenceModalProps {
  branchId?: string;
  className?: string;
  triggerVariant?: 'button' | 'compact' | 'pill';
}

export const OfficePresenceModal: React.FC<OfficePresenceModalProps> = ({
  branchId,
  className = '',
  triggerVariant = 'button',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<OfficePresenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  const loadPresence = async () => {
    if (!isAppOnline()) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchId) params.append('branchId', branchId);
      const res = await fetchApi<OfficePresenceResponse>(`/employee/office-presence?${params.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load office presence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresence();
    const handleOnline = () => loadPresence();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [branchId]);

  const handleOpen = () => {
    setIsOpen(true);
    loadPresence();
  };

  const colleagues = data?.presence || [];
  const departments = ['ALL', ...Object.keys(data?.departmentCounts || {})];

  const filteredColleagues = colleagues.filter((c) => {
    const matchesDept = selectedDept === 'ALL' || c.user.department === selectedDept;
    if (!matchesDept) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.user.name.toLowerCase().includes(q) ||
      c.user.email.toLowerCase().includes(q) ||
      c.user.department.toLowerCase().includes(q) ||
      c.desk.deskCode.toLowerCase().includes(q) ||
      c.location.sectionName.toLowerCase().includes(q) ||
      c.location.floorName.toLowerCase().includes(q)
    );
  });

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatSlot = (slotType: string) => {
    switch (slotType) {
      case 'FULL_DAY':
        return 'Full Day (9 AM – 6 PM)';
      case 'MORNING':
        return 'Morning (9 AM – 1:30 PM)';
      case 'AFTERNOON':
        return 'Afternoon (1:30 PM – 6 PM)';
      default:
        return slotType.replace('_', ' ');
    }
  };

  return (
    <>
      {/* Trigger Button Variants */}
      {triggerVariant === 'pill' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold transition-all cursor-pointer shadow-2xs ${className}`}
          title="Click to view who is in the office today"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="w-3.5 h-3.5 text-emerald-700" />
          <span>{data ? `${data.totalPresent} in Office` : 'In Office'}</span>
        </button>
      ) : triggerVariant === 'compact' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer relative ${className}`}
          title="Who's in office today"
        >
          <Users className="w-4 h-4" />
          {data && data.totalPresent > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-xs">
              {data.totalPresent}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-xs hover:border-emerald-300 ${className}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Who's in Office</span>
          {data !== null && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black">
              {data.totalPresent}
            </span>
          )}
        </button>
      )}

      {/* Central Modal Dialog */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-black text-slate-900 tracking-tight">
                        Who's in Office Today
                      </h2>
                      {data && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black font-mono">
                          {data.totalPresent} Present
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {data?.branch.name || 'Branch'} &bull; Today ({data?.date || 'Current Session'})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Search & Department Filter Bar */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by colleague name, email, department, or desk code..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Department Filter Pills */}
                {departments.length > 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {departments.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setSelectedDept(dept)}
                        className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer text-[11px] ${
                          selectedDept === dept
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {dept === 'ALL' ? 'All Departments' : dept}
                        {dept !== 'ALL' && data?.departmentCounts[dept] ? ` (${data.departmentCounts[dept]})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Colleague Presence List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
                {loading && !data ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    <span className="text-xs font-semibold">Loading in-office attendance...</span>
                  </div>
                ) : filteredColleagues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Users className="w-8 h-8 text-slate-300" />
                    <div className="text-xs font-bold text-slate-600">
                      {searchQuery ? 'No matching colleagues found.' : 'No colleagues currently reserved for today.'}
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      {searchQuery
                        ? 'Try clearing the search query or selecting another department filter.'
                        : 'Workstations reserved by colleagues in this facility will automatically appear here in real-time.'}
                    </p>
                  </div>
                ) : (
                  filteredColleagues.map((colleague) => (
                    <div
                      key={colleague.bookingId}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        colleague.user.isCurrentUser
                          ? 'bg-blue-50/70 border-blue-200'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200/90'
                      }`}
                    >
                      {/* Left: Avatar & Identity */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-2xs ${
                              colleague.user.isCurrentUser
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {getInitials(colleague.user.name)}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {colleague.user.name}
                            </span>
                            {colleague.user.isCurrentUser && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-800 font-mono font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {colleague.user.email} &bull; <span className="font-semibold text-slate-700">{colleague.user.department}</span>
                          </div>
                          {colleague.bookedBy && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Proxy by: {colleague.bookedBy.name}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Desk & Location Tag */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="flex items-center justify-end space-x-1.5">
                          <span className="text-xs font-black font-mono px-2 py-0.5 rounded-lg bg-slate-900 text-white shadow-2xs">
                            {colleague.desk.deskCode}
                          </span>
                          {colleague.desk.hasHdmi && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              HDMI
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-end space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{colleague.location.floorName || colleague.location.floorCode} &bull; {colleague.location.sectionName}</span>
                        </div>
                        <div className="text-[9.5px] text-emerald-700 font-semibold flex items-center justify-end space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatSlot(colleague.slotType)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Real-time presence based on confirmed workstation reservations.</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}
    </>
  );
};
