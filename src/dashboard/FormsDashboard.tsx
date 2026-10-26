import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Sparkles,
  Plus,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Edit3,
  CopyPlus,
  Archive,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  Sun,
  Moon,
  Database,
  X,
  Layers,
  Trash2,
  Users,
  Building,
  Shield,
} from 'lucide-react';
import type { FormMetadata } from '../types/schema';

export const FormsDashboard: React.FC = () => {
  const [forms, setForms] = useState<FormMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'unpublished' | 'archived'>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // QR Code Modal State
  const [qrModalForm, setQrModalForm] = useState<FormMetadata | null>(null);
  const [qrModalDataUrl, setQrModalDataUrl] = useState<string | null>(null);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((p) => (p === 'light' ? 'dark' : 'light'));

  const fetchForms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/forms');
      const data = await res.json();
      if (data.data) {
        setForms(data.data);
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const handleCopyLink = (url: string, slug: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleOpenQr = async (form: FormMetadata) => {
    if (!form.runtimeUrl) return;
    try {
      const url = await QRCode.toDataURL(form.runtimeUrl, {
        width: 240,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrModalDataUrl(url);
      setQrModalForm(form);
    } catch (err) {
      console.error('QR code generation failed:', err);
    }
  };

  const handleDuplicate = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchForms();
      } else {
        alert(data.error || 'Failed to duplicate form.');
      }
    } catch (err: any) {
      alert(err.message || 'Duplicate request failed.');
    }
  };

  const handleUnpublish = async (formId: string) => {
    if (!window.confirm('Unpublish this form? Normal users will no longer be able to access the runtime URL.')) return;
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/unpublish`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchForms();
      }
    } catch (err) {
      console.error('Unpublish error:', err);
    }
  };

  const handleArchive = async (formId: string) => {
    if (!window.confirm('Archive this form? The form will be moved to the archive.')) return;
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/archive`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchForms();
      }
    } catch (err) {
      console.error('Archive error:', err);
    }
  };

  const handleDelete = async (formId: string, formName?: string) => {
    const displayName = formName || formId;
    if (!window.confirm(`Are you sure you want to permanently delete "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.success ?? true)) {
        await fetchForms();
      } else {
        alert(data?.error || 'Failed to delete form.');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(err.message || 'Delete request failed.');
    }
  };

  // Filter forms based on search query and status tab
  const filteredForms = forms.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (f.name || '').toLowerCase().includes(q) ||
      (f.slug || '').toLowerCase().includes(q) ||
      (f.primaryEntity || '').toLowerCase().includes(q) ||
      (f.departmentName || '').toLowerCase().includes(q) ||
      (f.departmentId || '').toLowerCase().includes(q) ||
      (f.departmentNames || []).some((dn) => dn.toLowerCase().includes(q)) ||
      (f.departmentIds || []).some((di) => di.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return f.status === statusFilter;
  });

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                FormCraft
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                Dashboard
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Form Publishing & Runtime Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin_dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
            title="Open Admin Portal & Dashboard"
            id="nav-admin-dashboard"
          >
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>Admin Portal</span>
          </Link>

          <Link
            to="/patients"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
            title="View Inpatient List & Form Launcher"
          >
            <Users className="w-4 h-4 text-blue-500" />
            <span>Patient List</span>
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/builder"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Form</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Top Control Bar: Search & Status Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            {(['all', 'published', 'draft', 'unpublished', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl font-medium capitalize transition-all ${statusFilter === tab
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search forms by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Forms Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-4">Form Name & Identity</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Department</th>
                  <th className="px-4 py-4">Version</th>
                  <th className="px-4 py-4">Database Binding</th>
                  <th className="px-4 py-4">Public Runtime URL</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      Loading forms...
                    </td>
                  </tr>
                ) : filteredForms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 space-y-2">
                      <Layers className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No forms found</p>
                      <p className="text-[11px] text-slate-500">
                        Try adjusting your filters or click "Create New Form" above.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredForms.map((f) => {
                    const isPublished = f.status === 'published' && f.publishedVersion;
                    const runtimeHref = f.runtimeUrl || `/forms/${f.slug}`;

                    return (
                      <tr
                        key={f.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-850/40 transition-colors group"
                      >
                        {/* Name & Slug */}
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <Link
                              to={`/builder/${f.id}`}
                              className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors block"
                            >
                              {f.name || 'Untitled Form'}
                            </Link>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>slug: {f.slug}</span>
                              <span>&bull;</span>
                              <span>id: {f.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {f.status === 'published' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Published
                            </span>
                          )}
                          {f.status === 'draft' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                              <Clock className="w-3.5 h-3.5" /> Draft
                            </span>
                          )}
                          {f.status === 'unpublished' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 text-[11px] font-bold">
                              <Ban className="w-3.5 h-3.5" /> Unpublished
                            </span>
                          )}
                          {f.status === 'archived' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold">
                              <Archive className="w-3.5 h-3.5" /> Archived
                            </span>
                          )}
                        </td>

                        {/* Department Badge */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {f.departmentNames &&
                          f.departmentNames.length > 0 &&
                          !f.departmentIds?.includes('ALL') &&
                          !f.departmentNames.some((n) => n.toLowerCase().includes('all departments')) ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                              {f.departmentNames.slice(0, 2).map((deptName, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold"
                                  title={deptName}
                                >
                                  <Building className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate max-w-[85px]">{deptName}</span>
                                </span>
                              ))}
                              {f.departmentNames.length > 2 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold cursor-help"
                                  title={f.departmentNames.join(', ')}
                                >
                                  +{f.departmentNames.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : f.departmentName &&
                            f.departmentId !== 'ALL' &&
                            !f.departmentName.toLowerCase().includes('all departments') ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[11px] font-semibold">
                              <Building className="w-3 h-3 shrink-0" />
                              <span>{f.departmentName}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                              <span>All Depts</span>
                            </span>
                          )}
                        </td>

                        {/* Version */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                            {f.publishedVersion ? `v${f.publishedVersion}` : `Draft v${f.currentDraftVersion || 1}`}
                          </span>
                        </td>

                        {/* Database Binding */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {f.primaryEntity ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-mono font-medium">
                              <Database className="w-3 h-3" />
                              <span>{f.primaryEntity}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">None</span>
                          )}
                        </td>

                        {/* Public URL & Copy / QR */}
                        <td className="px-4 py-4">
                          {isPublished ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={runtimeHref}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-[11px] truncate max-w-[200px] block"
                                title={runtimeHref}
                              >
                                /forms/{f.slug}
                              </a>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(f.runtimeUrl || `${window.location.origin}/forms/${f.slug}`, f.slug)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Copy Runtime Link"
                              >
                                {copiedSlug === f.slug ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQr(f)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="View QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Not published</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/builder/${f.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                              title="Open in Visual Builder"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Link>

                            {isPublished && (
                              <a
                                href={runtimeHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold transition-colors"
                                title="Open Live Runtime"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDuplicate(f.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Duplicate Form"
                            >
                              <CopyPlus className="w-4 h-4" />
                            </button>

                            {f.status === 'published' ? (
                              <button
                                type="button"
                                onClick={() => handleUnpublish(f.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title="Unpublish Form"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : null}

                            {f.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => handleArchive(f.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Archive Form"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={f.status === 'published'}
                              onClick={() => handleDelete(f.id, f.name)}
                              className={`p-1.5 rounded-lg transition-colors ${f.status === 'published'
                                ? 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                }`}
                              title={
                                f.status === 'published'
                                  ? 'Cannot delete published form. Unpublish first.'
                                  : 'Delete Form'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* QR Code Inspection Modal */}
      {qrModalForm && qrModalDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Form QR Code
              </span>
              <button
                type="button"
                onClick={() => setQrModalForm(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {qrModalForm.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              v{qrModalForm.publishedVersion} &bull; /forms/{qrModalForm.slug}
            </p>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-center">
              <img
                src={qrModalDataUrl}
                alt="QR Code"
                className="w-48 h-48 rounded-xl shadow-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <a
                href={qrModalDataUrl}
                download={`${qrModalForm.slug}-qr.png`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all"
              >
                <span>Download QR Image</span>
              </a>
              <button
                type="button"
                onClick={() => setQrModalForm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
