import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Shield,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
  Lock,
  Activity,
  Sparkles,
  ChevronRight,
  Database,
  Sliders,
  CheckCircle2,
  Building,
  UserCheck
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const pillars = [
    {
      icon: Database,
      title: 'Multi-Tenant Data Isolation',
      description:
        'Cryptographically segmented organization boundaries, tenant schema isolation, and autonomous administrative authority.',
      badge: 'Architecture',
      gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      borderColor: 'group-hover:border-emerald-500/40',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-100',
    },
    {
      icon: Zap,
      title: 'Offline-First Edge Synchronization',
      description:
        'Local SQLite client storage with background bidirectional replication and deterministic conflict resolution for zero-latency operations.',
      badge: 'Performance',
      gradient: 'from-teal-500/10 via-emerald-500/5 to-transparent',
      borderColor: 'group-hover:border-teal-500/40',
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50 border-teal-100',
    },
    {
      icon: Layers,
      title: 'Dynamic Floor Plan Engine',
      description:
        'Interactive spatial canvas editor for desks, cubicles, meeting hubs, and amenities with real-time occupancy telemetry.',
      badge: 'Spatial Workspace',
      gradient: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      borderColor: 'group-hover:border-indigo-500/40',
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50 border-indigo-100',
    },
    {
      icon: Shield,
      title: '3-Tier Issue Governance',
      description:
        'Structured escalation pipeline from Employee to Branch Admin, Organization Global Admin, and Platform Superadmin with bi-directional resolution threads.',
      badge: 'Operations',
      gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
      borderColor: 'group-hover:border-amber-500/40',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-100',
    },
    {
      icon: Sliders,
      title: 'Dual Governance Policy',
      description:
        'Seamless toggle between Centralized Mode (strict corporate control) and Delegated Mode (autonomous branch management).',
      badge: 'Compliance',
      gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent',
      borderColor: 'group-hover:border-blue-500/40',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 border-blue-100',
    },
    {
      icon: Calendar,
      title: 'Outlook-Grade Scheduling',
      description:
        '30-day continuous horizon desk reservations, intelligent multi-day smart skip conflict handling, and synchronized resource dispatch.',
      badge: 'Scheduling',
      gradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
      borderColor: 'group-hover:border-cyan-500/40',
      iconColor: 'text-cyan-600',
      iconBg: 'bg-cyan-50 border-cyan-100',
    },
  ];

  const metrics = [
    { value: '100%', label: 'Tenant Isolation Guarantee' },
    { value: '< 15ms', label: 'Local Offline Booking Latency' },
    { value: '3-Tier', label: 'Hierarchical Issue Escalation' },
    { value: '99.99%', label: 'Enterprise Service Availability' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Decorative Gradients & Mesh (Light Corporate Theme) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[32rem] h-[32rem] bg-emerald-600/5 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60" />
      </div>

      {/* Corporate Top Navigation Bar (Light Theme) */}
      <header className="relative z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-600/20 border border-emerald-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-slate-900">WorkSpaceOS</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Multi-Tenant Resource &amp; Desk Governance</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-4 sm:px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>Create Organization</span>
              <ChevronRight className="w-4 h-4 text-emerald-200" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="pt-20 pb-20 sm:pt-28 sm:pb-28 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center max-w-4xl mx-auto"
          >
            {/* Pill Badge */}
            <motion.div variants={itemVariants} className="mb-6">
              <span className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 backdrop-blur-md shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Next-Gen Autonomous Hybrid Workplace Architecture</span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6"
            >
              Intelligent Workspace Governance for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700">
                Global Enterprises
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10 font-normal"
            >
              Empower your multi-branch enterprise with offline-first desk booking, precision spatial floor plans,
              strict multi-tenant isolation, and automated 3-tier issue resolution.
            </motion.p>

            {/* Primary Action Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
            >
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-3 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span>Sign In to Portal</span>
                <ArrowRight className="w-5 h-5 text-emerald-200" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-base border border-slate-200/90 shadow-sm flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Building className="w-4 h-4 text-slate-500" />
                <span>Create Organization</span>
              </button>
            </motion.div>

            {/* Enterprise Credentials Direct Note */}
            <motion.div variants={itemVariants} className="mt-8 flex items-center space-x-2 text-xs text-slate-500 font-medium">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Branch admins and employees can sign in directly using organization credentials</span>
            </motion.div>
          </motion.div>
        </section>

        {/* Live Metrics Strip */}
        <section className="border-y border-slate-200/90 bg-white/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {metrics.map((m, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                    {m.value}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-500">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architectural Pillars Section */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-700 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <Activity className="w-3.5 h-3.5" />
              <span>Enterprise Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Engineered for Scalable Governance
            </h2>
            <p className="text-slate-600 text-base">
              Every layer of the platform is designed with fault-tolerance, zero-latency client synchronization, and
              hierarchical corporate control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={`group relative p-8 rounded-3xl bg-white border border-slate-200/80 ${pillar.borderColor} hover:bg-white transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between overflow-hidden`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-b ${pillar.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                  />

                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl ${pillar.iconBg} border flex items-center justify-center ${pillar.iconColor} shadow-xs`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                        {pillar.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{pillar.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{pillar.description}</p>
                  </div>

                  <div className="relative z-10 pt-6 mt-6 border-t border-slate-100 flex items-center text-xs font-semibold text-slate-500 group-hover:text-emerald-700 transition-colors">
                    <span>Learn platform architecture</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Security & Reliability Tier */}
        <section className="py-20 border-t border-slate-200/90 bg-slate-100/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/50 p-8 sm:p-12 relative overflow-hidden shadow-sm">
              <div className="max-w-2xl space-y-4 relative z-10">
                <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-800 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Enterprise Security &amp; Trust</span>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-900">
                  Zero Trust Boundary Architecture
                </h3>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Strict tenant subdomains guarantee that database transactions, offline synchronization journals, and
                  roster inventories never cross organizational boundaries. Complete audit trails record administrative
                  interventions with immutable timestamps.
                </p>
                <div className="pt-4 flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Per-Tenant Dynamic Theming</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Offline Sync Engine</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Role-Based Access Control</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  Ready to deploy WorkSpaceOS for your branches and corporate headquarters?
                </div>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <Link
                    to="/register"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all text-center"
                  >
                    Create Organization
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all text-center border border-slate-200"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Corporate Minimal Footer (Centered Copyright, Clean) */}
      <footer className="border-t border-slate-200 py-8 bg-white text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span>© 2026 WorkSpaceOS Inc. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};
