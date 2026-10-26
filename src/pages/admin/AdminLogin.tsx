import React, { useState } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowLeft, Loader2, Database } from 'lucide-react';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';

interface AdminLoginProps {
  onSuccess?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { login, isLoading, error: authError, clearError } = useAdminAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    // 1. Validation
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setValidationError('Please enter your administrator email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setValidationError('Please enter a valid email format (e.g., admin@gmail.com).');
      return;
    }

    if (!password) {
      setValidationError('Please enter your administrator password.');
      return;
    }

    // 2. Perform authentication with raw password (never modify password)
    const success = await login({
      email: cleanEmail,
      password,
    });

    if (success && onSuccess) {
      onSuccess();
    }
  };

  const activeError = validationError || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Link to Return to Forms */}
      <div className="absolute top-6 left-6 z-10">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
          id="admin-login-back-button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Forms</span>
        </a>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Main Glassmorphic Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-8 space-y-6">
          {/* Header & Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 mb-1">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white" id="admin-login-heading">
                Admin Login
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                FormCraft Clinical Administration Portal
              </p>
            </div>
          </div>

          {/* Database Info Pill */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg py-1.5 px-3">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Authenticated against Oracle</span>
            <code className="text-slate-300 font-mono text-[10px] bg-slate-800 px-1 py-0.5 rounded">ADMIN_USERS</code>
          </div>

          {/* Error Alert */}
          {activeError && (
            <div
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
              role="alert"
              id="admin-login-error-alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{activeError}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-login-email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isLoading}
                  className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-login-password"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isLoading}
                  className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 font-sans"
                  required
                />
                <button
                  type="button"
                  id="admin-login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="admin-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
            Protected area. Authorized administrative personnel only.
          </div>
        </div>
      </div>
    </div>
  );
};
