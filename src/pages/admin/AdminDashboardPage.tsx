import React, { useEffect } from 'react';
import { useAdminAuthStore } from '../../store/useAdminAuthStore';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { Shield, Loader2 } from 'lucide-react';

interface AdminDashboardPageProps {
  defaultView?: 'login' | 'dashboard';
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAdminAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Loading state while checking session token/cookie with Oracle backend
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>Verifying Admin Session...</span>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, render the Admin Login screen
  if (!isAuthenticated) {
    return <AdminLogin onSuccess={() => checkAuth()} />;
  }

  // If authenticated, render the Protected Admin Dashboard
  return <AdminDashboard />;
};

export default AdminDashboardPage;
