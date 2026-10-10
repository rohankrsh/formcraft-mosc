import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, FileQuestion, Sun, Moon, ArrowLeft } from 'lucide-react';
import { fetchPublishedForm, type PublishedFormResponse } from './runtimeApi';
import { FormRuntime } from './FormRuntime';
import type { FormDefinition } from '../types/schema';

export const RuntimePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{
    type: 'not_found' | 'unavailable' | 'archived' | 'error';
    message: string;
  } | null>(null);

  const [publishedForm, setPublishedForm] = useState<{
    id: string;
    slug: string;
    title: string;
    version: number;
    definition: FormDefinition;
  } | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Sync theme with document class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    if (!slug) {
      setErrorState({
        type: 'not_found',
        message: 'No form slug was provided in the URL.',
      });
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorState(null);

    fetchPublishedForm(slug)
      .then((res: PublishedFormResponse) => {
        if (!isMounted) return;
        if (!res.success || !res.form) {
          if (res.code === 'FORM_UNAVAILABLE') {
            setErrorState({
              type: 'unavailable',
              message: res.error || 'This form is currently unavailable. Please contact the administrator.',
            });
          } else if (res.code === 'FORM_ARCHIVED') {
            setErrorState({
              type: 'archived',
              message: res.error || 'This form has been archived and is no longer active.',
            });
          } else {
            setErrorState({
              type: 'not_found',
              message: res.error || 'The requested form does not exist or has been removed.',
            });
          }
          return;
        }

        setPublishedForm(res.form);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorState({
          type: 'error',
          message: err.message || 'An unexpected error occurred while loading this form.',
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Lightweight Runtime Navigation Bar */}
      <nav className="h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 group text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">
              FormCraft
            </span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Runtime
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 flex flex-col items-center justify-start">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center animate-pulse">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Loading form configuration...
            </p>
          </div>
        )}

        {!loading && errorState && (
          <div className="max-w-md w-full mx-auto my-auto text-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center ring-8 ring-amber-500/5">
              {errorState.type === 'not_found' ? (
                <FileQuestion className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {errorState.type === 'not_found'
                  ? 'Form Not Found'
                  : errorState.type === 'unavailable'
                  ? 'Form Unavailable'
                  : 'Form Notice'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {errorState.message}
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Home</span>
              </Link>
            </div>
          </div>
        )}

        {!loading && publishedForm && (
          <FormRuntime
            slug={slug!}
            form={publishedForm.definition}
            version={publishedForm.version}
          />
        )}
      </main>
    </div>
  );
};
