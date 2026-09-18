import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTenant } from "../../context/TenantContext";
import { fetchApi } from "../../services/api";
import { OfficePresenceModal } from "../OfficePresenceModal";
import {
  Monitor,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Building2,
  Users,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface ActiveBookingDesk {
  id: string;
  deskCode: string;
  hasHdmi: boolean;
  isMeetingRoom: boolean;
  sectionName: string;
  floorCode: string;
  floorName: string;
  buildingName: string;
  branchName: string;
}

interface ActiveBooking {
  id: string;
  slotType: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  desk: ActiveBookingDesk;
  bookedByColleague?: { id: string; name: string; email: string } | null;
}

interface UpcomingBooking {
  id: string;
  slotType: string;
  startTime: string;
  endTime: string;
  status: string;
  deskCode: string;
  sectionName: string;
  floorName: string;
  buildingName: string;
}

interface DashboardSummaryData {
  user: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    role: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
  activeBooking: ActiveBooking | null;
  upcomingBookings: UpcomingBooking[];
  stats: {
    totalDesks: number;
    availableDesks: number;
    reservedDesks: number;
    hdmiDesks: number;
    meetingRoomsCount: number;
    myBookingsCount: number;
  };
}

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const orgColor = tenant?.themeColor || "#16a34a";

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<DashboardSummaryData>("/employee/dashboard-summary");
      setData(res);
    } catch (err: any) {
      console.error("Failed to load employee dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleReleaseActiveBooking = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to release this workstation reservation?")) {
      return;
    }

    try {
      setReleasing(true);
      await fetchApi("/employee/cancel-booking", {
        method: "POST",
        body: JSON.stringify({ bookingId, reason: "Released from dashboard" }),
      });
      setActionNotice({ type: "success", text: "Workstation released successfully." });
      await loadSummary();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to release desk." });
    } finally {
      setReleasing(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatSlotLabel = (slotType: string) => {
    switch (slotType) {
      case "MORNING":
        return "Morning (9:00 AM - 1:30 PM)";
      case "AFTERNOON":
        return "Afternoon (1:30 PM - 6:00 PM)";
      case "FULL_DAY":
      default:
        return "Full Day (9:00 AM - 6:00 PM)";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28 text-slate-500 font-bold text-xs">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Loading Workplace Console...
      </div>
    );
  }

  const activeBooking = data?.activeBooking;
  const stats = data?.stats;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-0 py-4">
      {/* Notice Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{actionNotice.text}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Welcome Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>{data?.branch?.name || "Assigned Facility"}</span>
            <span>•</span>
            <span>{data?.branch?.code || "HQ"}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            {getGreeting()}, {user?.name?.split(" ")[0] || "Team Member"} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-lg">
            Reserve your ergonomic workstation, collaborate in high-density pods, or book on behalf of colleagues.
          </p>
        </div>

        {/* Quick CTA Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <OfficePresenceModal branchId={data?.branch?.id} triggerVariant="button" />
          <Link
            to="/employee/floor-plan"
            style={{ backgroundColor: orgColor }}
            className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-95 transition-all inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Reserve a Workstation</span>
          </Link>
          <Link
            to="/employee/my-bookings"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Bookings</span>
          </Link>
        </div>
      </div>

      {/* Hero Section: Active Booking vs Empty State */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Booking Card (2 cols) */}
        <div className="lg:col-span-2">
          {activeBooking ? (
            <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[280px]">
              {/* Glow Accent */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-mono font-black tracking-widest text-emerald-400 uppercase">
                      ACTIVE RESERVATION TODAY
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/10 text-slate-200 backdrop-blur-xs">
                    {formatSlotLabel(activeBooking.slotType)}
                  </span>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                      <span>Desk {activeBooking.desk.deskCode}</span>
                      {activeBooking.desk.hasHdmi && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-400/30">
                          HDMI MONITORS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-semibold mt-1 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {activeBooking.desk.floorName} • {activeBooking.desk.sectionName} ({activeBooking.desk.buildingName})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Proxy attribution banner if booked on behalf */}
                {activeBooking.bookedByColleague && (
                  <div className="mt-4 p-2.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-slate-200 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-300" />
                    <span>
                      Reserved on your behalf by <strong className="text-white">{activeBooking.bookedByColleague.name}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons at bottom of active card */}
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Check-in guaranteed. Ready for immediate use.</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/employee/floor-plan"
                    className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View on Floor Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleReleaseActiveBooking(activeBooking.id)}
                    disabled={releasing}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{releasing ? "Releasing..." : "Release Desk"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center flex flex-col items-center justify-center min-h-[280px] space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-black text-slate-900">
                  No Active Reservation Right Now
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You do not currently have a desk booked for today. Reserve an open desk in seconds or coordinate a 4-desk collaborative pod.
                </p>
              </div>
              <div>
                <Link
                  to="/employee/floor-plan"
                  style={{ backgroundColor: orgColor }}
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md hover:opacity-95 transition-all inline-flex items-center gap-2"
                >
                  <span>Select Workstation on Floor Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Facility Live Status Card (1 col) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                FACILITY OCCUPANCY
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                LIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* Available Desks */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">
                  Available
                </div>
                <div className="text-2xl font-black text-emerald-900 mt-0.5">
                  {stats?.availableDesks ?? 0}
                </div>
                <div className="text-[9px] text-emerald-700 font-semibold mt-0.5">
                  Ready to reserve
                </div>
              </div>

              {/* Reserved Desks */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Occupied
                </div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {stats?.reservedDesks ?? 0}
                </div>
                <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                  Of {stats?.totalDesks ?? 0} desks
                </div>
              </div>

              {/* HDMI Dual Displays */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
                <div className="text-[10px] font-bold text-blue-800 uppercase flex items-center gap-1">
                  <Monitor className="w-3 h-3" />
                  <span>HDMI</span>
                </div>
                <div className="text-2xl font-black text-blue-900 mt-0.5">
                  {stats?.hdmiDesks ?? 0}
                </div>
                <div className="text-[9px] text-blue-700 font-semibold mt-0.5">
                  Display stations
                </div>
              </div>

              {/* Meeting Rooms */}
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200">
                <div className="text-[10px] font-bold text-purple-800 uppercase flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Rooms</span>
                </div>
                <div className="text-2xl font-black text-purple-900 mt-0.5">
                  {stats?.meetingRoomsCount ?? 0}
                </div>
                <div className="text-[9px] text-purple-700 font-semibold mt-0.5">
                  Conference pods
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>My Completed Bookings</span>
            <span className="font-mono font-black text-slate-900">
              {stats?.myBookingsCount ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Upcoming Schedule Preview */}
      {data?.upcomingBookings && data.upcomingBookings.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Upcoming Reservations This Week</span>
            </h3>
            <Link
              to="/employee/my-bookings"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              View Full History →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.upcomingBookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">
                    Desk {b.deskCode}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {b.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {new Date(b.startTime).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {b.floorName} • {b.sectionName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
