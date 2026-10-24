import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Rocket,
  ShieldCheck,
  Database,
  Layers,
  Loader2,
  Wand2,
} from 'lucide-react';
import type { FormDefinition, PublishValidationResult } from '../types/schema';
import { useFormStore } from '../store/useFormStore';

interface PublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormDefinition;
  onPublished?: (data: any) => void;
}

export const PublishDialog: React.FC<PublishDialogProps> = ({
  isOpen,
  onClose,
  form,
  onPublished,
}) => {
  const { autoFixLayoutWidths } = useFormStore();
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<PublishValidationResult | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [slug, setSlug] = useState('');

  // Pre-fetch form meta & run pre-flight validation on open
  useEffect(() => {
    if (!isOpen || !form.id) return;

    setPublishResult(null);
    setQrDataUrl(null);
    setIsCopied(false);
    setIsValidating(true);

    // Fetch form metadata to get slug
    fetch(`/api/forms/${encodeURIComponent(form.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.meta?.slug) {
          setSlug(data.meta.slug);
        }
      })
      .catch(() => {});

    // Run pre-flight validation
    fetch(`/api/forms/${encodeURIComponent(form.id)}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition: form }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.validation) {
          setValidation(data.validation);
        }
      })
      .catch((err) => {
        console.error('Validation fetch error:', err);
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, [isOpen, form]);

  // Generate QR code when form is published
  useEffect(() => {
    if (publishResult?.runtimeUrl) {
      QRCode.toDataURL(publishResult.runtimeUrl, {
        width: 200,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [publishResult]);

  if (!isOpen) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition: form,
          metadata: { slug: slug || undefined },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Publishing failed.');
      }

      setPublishResult(data);
      if (onPublished) onPublished(data);
    } catch (err: any) {
      alert(err.message || 'Publishing failed. Please check validation issues.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (!publishResult?.runtimeUrl) return;
    navigator.clipboard.writeText(publishResult.runtimeUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const errors = validation?.issues.filter((i) => i.type === 'error') || [];
  const warnings = validation?.issues.filter((i) => i.type === 'warning') || [];
  const canPublish = !isValidating && errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {publishResult ? 'Form Published' : 'Publish Form'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {publishResult
                  ? 'Your form is now live at its unique public runtime URL'
                  : 'Validate and publish this form for end users'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {publishResult ? (
            /* Post-Publish Success Card */
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center ring-8 ring-emerald-500/5">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Form Successfully Published!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Published as <span className="font-semibold text-blue-600 dark:text-blue-400">Version v{publishResult.version}</span>.
                  The published version is now immutable and accessible through the runtime URL below.
                </p>
              </div>

              {/* URL Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-left space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Public Runtime URL
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publishResult.runtimeUrl}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic QR Code Card */}
              {qrDataUrl && (
                <div className="p-4 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 inline-flex flex-col items-center space-y-2">
                  <img
                    src={qrDataUrl}
                    alt="Form Runtime QR Code"
                    className="w-36 h-36 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xs"
                  />
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5" /> Scan on mobile to open form
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Pre-Publish Checklist & Configuration */
            <div className="space-y-5">
              {/* Form Identity Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Form Title</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{form.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Unique Slug</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                    {slug || 'auto-generated'}
                  </span>
                </div>
                {form.settings.primaryEntity && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Primary Entity</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                      {form.settings.primaryEntity} ({form.settings.primaryKeyColumn || 'PK'})
                    </span>
                  </div>
                )}
              </div>

              {/* Pre-Flight Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pre-Flight Validation
                </h4>

                {isValidating ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Validating form schema & Oracle database bindings...</span>
                  </div>
                ) : validation ? (
                  <div className="space-y-2 text-xs">
                    {/* Item: Structure */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>Form Structure & 12-Column Grid</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valid ({validation.summary.totalFields} fields)
                      </span>
                    </div>

                    {/* Item: Database Binding Allowlist */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span>Database Allowlist & Columns</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified ({validation.summary.databaseBindings} bound)
                      </span>
                    </div>

                    {/* Item: Oracle Health */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        <span>Oracle Connection Pool</span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          validation.summary.oracleAvailable
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-500'
                        }`}
                      >
                        {validation.summary.oracleAvailable ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" /> Degraded
                          </>
                        )}
                      </span>
                    </div>

                    {/* Validation Errors list if any */}
                    {errors.length > 0 && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl space-y-1.5 text-xs text-rose-700 dark:text-rose-300">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Cannot publish until these issues are resolved:</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-[11px]">
                          {errors.map((err, idx) => (
                            <li key={idx}>{err.message}</li>
                          ))}
                        </ul>

                        {errors.some(
                          (err) =>
                            err.message.includes('column widths total') ||
                            err.message.includes('instead of exactly 12 columns')
                        ) && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => autoFixLayoutWidths()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              <span>Auto-Fix All Column Widths (Balance to 12)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Validation Warnings list if any */}
                    {warnings.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <div className="font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Warnings:</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-[11px]">
                          {warnings.map((warn, idx) => (
                            <li key={idx}>{warn.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {publishResult ? (
            <>
              <a
                href={publishResult.runtimeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                <span>Open Live Form</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPublishing}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || isPublishing}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Publish Form</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
