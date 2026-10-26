import React, { useState, useEffect } from 'react';
import {
  Shield,
  LogOut,
  Database,
  FileText,
  Users,
  CheckCircle2,
  Layers,
  ExternalLink,
  Plus,
  RefreshCw,
  Server,
  KeyRound,
  ChevronRight,
  ClipboardList,
  Activity,
  History,
} from 'lucide-react';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { getAdminDashboardStats, type AdminStatsResponse } from '../../services/adminApi';
import type { FormMetadata } from '../../types/schema';
import { AdminSubmissionsTab } from './AdminSubmissionsTab';
import { AdminLogsTab } from './AdminLogsTab';

export const AdminDashboard: React.FC = () => {
  const { admin, logout, isLoading: isAuthLoading } = useAdminAuthStore();

  const [forms, setForms] = useState<FormMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'forms' | 'submissions' | 'logs' | 'database' | 'account'>('overview');
  const [statsData, setStatsData] = useState<AdminStatsResponse['stats'] | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Deep-linking from activity logs or overview to submissions tab
  const [deepLinkSubId, setDeepLinkSubId] = useState<number | null>(null);

  const fetchStats = async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const res = await getAdminDashboardStats();
      if (res.success && res.stats) {
        setStatsData(res.stats);
      } else {
        setStatsError(res.error || 'Failed to load dashboard metrics.');
      }
    } catch {
      setStatsError('Network error loading administrative statistics.');
    } finally {
      setIsStatsLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch('/api/forms');
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setForms(data.data);
      }
    } catch (e) {
      console.error('Failed to load forms in admin dashboard:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchForms();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const totalFormsCount = statsData?.totalForms ?? (forms?.length || 0);
  const publishedFormsCount = statsData?.publishedForms ?? (forms?.filter((f) => f.publishedAt || f.isPublished).length || 0);
  const draftFormsCount = statsData?.draftForms ?? Math.max(0, totalFormsCount - publishedFormsCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white" id="admin-dashboard-logo-title">
                  FormCraft
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  Admin Portal
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                MOSC Medical College Hospital — Clinical Administration
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Section: Navigation, Profile & Logout */}
        <div className="flex items-center gap-3">
          {/* Quick Shortcuts */}
          <div className="hidden md:flex items-center gap-2 border-r border-slate-800 pr-3">
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              id="admin-nav-forms-dashboard"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Forms</span>
            </a>
            <a
              href="/patients"
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              id="admin-nav-patient-list"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Inpatients</span>
            </a>
            <a
              href="/builder"
              className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
              id="admin-nav-form-builder"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Form</span>
            </a>
          </div>

          {/* Admin User Profile Chip */}
          <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-full py-1 px-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white uppercase">
              {admin?.name?.charAt(0) || 'A'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 leading-none" id="admin-profile-name">
                {admin?.name || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono leading-tight" id="admin-profile-email">
                {admin?.email || ''}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isAuthLoading}
            className="text-xs font-medium text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            id="admin-dashboard-logout-button"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6">
        {/* Left Navigation Sidebar */}
        <aside className="w-60 shrink-0 hidden md:block space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navigation
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-overview"
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4" />
              <span>Overview</span>
            </div>
            {activeTab === 'overview' && <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setActiveTab('forms')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'forms'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-forms"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>Forms Management</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
              {forms?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-submissions"
          >
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-4 h-4" />
              <span>Form Submissions</span>
            </div>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-mono font-medium">
              {statsData?.totalSubmissions ?? '...'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-logs"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              <span>Activity Logs</span>
            </div>
            {statsData?.recentActivities && statsData.recentActivities.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'database'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-database"
          >
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4" />
              <span>Database & Health</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'account'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            id="admin-tab-account"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4" />
              <span>Admin Account</span>
            </div>
            {activeTab === 'account' && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5" id="admin-dashboard-welcome-heading">
                <span>Welcome, {admin?.name || 'Administrator'}</span>
                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Authenticated
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Oracle Account ID <span className="font-mono text-slate-300">#{admin?.admin_id || 21}</span> • Logged in as <span className="font-mono text-slate-300">{admin?.email}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={fetchStats}
                disabled={isStatsLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                id="admin-refresh-stats-button"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isStatsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <a
                href="/builder"
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Form</span>
              </a>
            </div>
          </div>

          {/* Error Banner */}
          {statsError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
              <span>{statsError}</span>
              <button
                onClick={fetchStats}
                className="underline hover:text-rose-300 font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Metric Cards Grid - Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Forms */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Forms</span>
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono" id="admin-stat-total-forms">
                    {totalFormsCount}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-emerald-400 font-semibold">{publishedFormsCount} live</span>
                    <span>•</span>
                    <span>{draftFormsCount} drafts</span>
                  </div>
                </div>

                {/* Published Forms */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Production Forms</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono" id="admin-stat-published-forms">
                    {publishedFormsCount}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Deployed to clinical runtime
                  </div>
                </div>

                {/* Total Form Submissions */}
                <div
                  onClick={() => setActiveTab('submissions')}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-blue-500/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                      Submissions
                    </span>
                    <ClipboardList className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {statsData?.totalSubmissions ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-emerald-400 font-semibold">{statsData?.submissionsToday ?? 0} today</span>
                    <span>•</span>
                    <span>{statsData?.submissionsThisMonth ?? 0} this month</span>
                  </div>
                </div>

                {/* Database Health */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Oracle Database</span>
                    <Server className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Healthy</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    User: {statsData?.database.schema || 'moscmar18'}
                  </div>
                </div>
              </div>

              {/* Metric Cards Grid - Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Submitting Users */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Submitting Clinicians</span>
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {statsData?.distinctSubmittersCount ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400">Distinct hospital users with submitted forms</p>
                </div>

                {/* Administrative Amendments */}
                <div
                  onClick={() => setActiveTab('submissions')}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5 hover:border-purple-500/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-purple-400 transition-colors">
                      Admin Amendments
                    </span>
                    <History className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-purple-400 font-mono">
                    {statsData?.totalAdminEdits ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-400">Audited clinical amendments with justifications</p>
                </div>

                {/* Allowlisted Tables */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-semibold uppercase tracking-wider">Allowlisted Tables</span>
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {statsData?.allowlistedTablesCount || 2}
                  </div>
                  <p className="text-[11px] text-slate-400">PATIENT, ADMISSION runtime bindings</p>
                </div>
              </div>

              {/* Two Column Grid: Recent System Activity Feed & Quick Forms Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent System Activity Timeline */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        <span>Recent System Activities</span>
                      </h3>
                      <p className="text-xs text-slate-400">Audited clinical events across users and administrators</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('logs')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>View all logs</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80 space-y-2">
                    {(!statsData?.recentActivities || statsData.recentActivities.length === 0) && (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No system activity recorded yet.
                      </div>
                    )}
                    {(statsData?.recentActivities || []).slice(0, 6).map((act) => (
                      <div key={act.logId} className="pt-2.5 pb-1 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                              {act.eventType}
                            </span>
                            <span className="text-slate-400 text-[10px]">by</span>
                            <span className="text-slate-200 font-medium text-[11px]">{act.actorName || 'System'}</span>
                          </div>
                          <p className="text-slate-300 text-xs truncate max-w-sm" title={act.description}>
                            {act.description}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Forms Overview Table */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>Registered Clinical Forms</span>
                      </h3>
                      <p className="text-xs text-slate-400">Forms persisted in authoritative database</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('forms')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage forms</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800 overflow-x-auto">
                    {(forms || []).slice(0, 5).map((f) => {
                      const isPub = Boolean(f.publishedAt || f.isPublished);
                      return (
                        <div key={f.id} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isPub ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-200 truncate">
                                {f.title || f.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                /{f.slug} • v{f.publishedVersion || 1}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isPub ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {isPub ? 'Live' : 'Draft'}
                            </span>
                            <a
                              href={`/builder/${f.id}`}
                              className="text-xs text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded"
                              title="Edit in builder"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FORMS MANAGEMENT */}
          {activeTab === 'forms' && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Forms Catalog & Deployment</h3>
                  <p className="text-xs text-slate-400">Manage all clinical templates, versions, and publication status</p>
                </div>
                <a
                  href="/builder"
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Form</span>
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Form Name</th>
                      <th className="py-3 px-3">Identifier Slug</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Primary Entity</th>
                      <th className="py-3 px-3">Versions</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {(forms || []).map((f) => {
                      const isPub = Boolean(f.publishedAt || f.isPublished);
                      return (
                        <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-200">
                            {f.title || f.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                            {f.slug}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isPub ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {isPub ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            {f.primaryEntity || f.settings?.primaryEntity || 'PATIENT'}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono">
                            v{f.publishedVersion || 1}
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5">
                            <a
                              href={`/builder/${f.id}`}
                              className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px]"
                            >
                              Edit
                            </a>
                            {isPub && (
                              <a
                                href={`/forms/${f.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-[11px]"
                              >
                                <span>Preview</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FORM SUBMISSIONS MANAGEMENT (MODULE 1) */}
          {activeTab === 'submissions' && (
            <AdminSubmissionsTab
              forms={forms}
              initialSubmissionIdToOpen={deepLinkSubId}
              onClearInitialSubmissionId={() => setDeepLinkSubId(null)}
            />
          )}

          {/* TAB 4: SYSTEM ACTIVITY LOGS (MODULE 2) */}
          {activeTab === 'logs' && (
            <AdminLogsTab
              onNavigateToSubmission={(subId) => {
                setDeepLinkSubId(subId);
                setActiveTab('submissions');
              }}
            />
          )}

          {/* TAB 5: DATABASE & HEALTH */}
          {activeTab === 'database' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Oracle Database Connectivity</h3>
                    <p className="text-xs text-slate-400">Native Thin connection pool and schema details</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active Connection Pool</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database Driver</div>
                    <div className="text-sm font-semibold text-slate-200">Oracle Database 19c (Thin Pure JS Mode)</div>
                    <p className="text-[11px] text-slate-500">Node-oracledb pure javascript connection</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database Schema / User</div>
                    <div className="text-sm font-semibold text-slate-200 font-mono">MOSCMAR18 @ lifetest</div>
                    <p className="text-[11px] text-slate-500">Malankara Orthodox Syrian Church Medical College</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Credentials Table</div>
                    <div className="text-sm font-semibold text-slate-200 font-mono">ADMIN_USERS</div>
                    <p className="text-[11px] text-slate-500">Columns: ADMIN_ID, NAME, EMAIL, PASSWORD, CREATED_AT</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password Storage Security</div>
                    <div className="text-sm font-semibold text-slate-200">Bcrypt (Cost Factor 12)</div>
                    <p className="text-[11px] text-slate-500">Salted one-way cryptographic hash with timing-safe comparison</p>
                  </div>
                </div>
              </div>

              {/* Allowlisted Tables Card */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Protected Allowlisted Clinical Entities</h3>
                <p className="text-xs text-slate-400">Strictly allowlisted tables accessible for runtime data binding</p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span>PATIENT (PATIENT_ID, MRNO, FIRSTNAME, GENDER, DOB)</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span>ADMISSION (ADMISSION_ID, IPNO, ADMIT_DATE, BED_NO, WARD)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ADMIN ACCOUNT */}
          {activeTab === 'account' && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-white">Administrator Account Details</h3>
                <p className="text-xs text-slate-400">Verified record from Oracle <code className="text-slate-300">ADMIN_USERS</code> table</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Administrator ID</span>
                  <div className="text-sm font-mono font-semibold text-slate-200">
                    #{admin?.admin_id || 21}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Administrator Name</span>
                  <div className="text-sm font-semibold text-slate-200">
                    {admin?.name}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
                  <div className="text-sm font-mono font-semibold text-slate-200">
                    {admin?.email}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Account Created At</span>
                  <div className="text-sm font-mono text-slate-300">
                    {admin?.created_at ? new Date(admin.created_at).toLocaleString() : 'Registered in Oracle DB'}
                  </div>
                </div>
              </div>

              {/* Security Policy Information */}
              <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Session Security Architecture</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                  <li>Authenticated via cryptographically signed HMAC-SHA256 tokens.</li>
                  <li>Stored in a secure, <code className="text-slate-300">HttpOnly</code>, <code className="text-slate-300">SameSite=Lax</code> cookie to prevent XSS credential exfiltration.</li>
                  <li>Server-side session invalidation on logout.</li>
                  <li>Rate-limited authentication endpoint prevents brute-force attempts.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Administrator Session</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
