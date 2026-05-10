import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Login } from './components/Login';
import { auth } from './firebase';
import { AdminDashboard } from './components/AdminDashboard';
import { BranchManagerDashboard } from './components/BranchManagerDashboard';
import { CitizenDashboard } from './components/CitizenDashboard';
import { InspectionDashboard } from './components/InspectionDashboard';
import { AuthorityDashboard } from './components/AuthorityDashboard';
import { MaintenanceDashboard } from './components/MaintenanceDashboard';
import { ContractorDashboard } from './components/ContractorDashboard';
import { CoordinatorDashboard } from './components/coordination/CoordinatorDashboard';
import { WaliDashboard } from './components/coordination/WaliDashboard';
import { Toaster, toast } from 'sonner';
import { Icons, Logo } from './constants';

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center rtl" dir="rtl">
          <div className="max-w-md glass-card p-8 rounded-3xl">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Icons.AlertTriangle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">عذراً، حدث خطأ ما</h1>
            <p className="text-slate-500 mb-8">{this.state.error?.message || "حدث خطأ غير متوقع."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full btn-primary"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const App: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check Firebase status after a short delay
    setTimeout(() => {
      if ((window as any).firebaseStatus === 'error') {
        toast.error(`خطأ في الاتصال بـ Firebase: ${(window as any).firebaseError || 'Unknown Error'}`);
      }
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Logo className="mb-8 animate-pulse" />
          <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center rtl" dir="rtl">
        <div className="max-w-md glass-card p-8 rounded-3xl animate-slide-up">
          <div className="w-20 h-20 bg-brand-danger/10 text-brand-danger rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icons.Report className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">حساب غير مكتمل</h1>
          <p className="text-slate-500 mb-2">البريد الإلكتروني: <span className="font-semibold text-slate-700">{user.email}</span></p>
          <p className="text-slate-500 mb-8">يرجى مراجعة الإدارة لتفعيل حسابك وتحديد دورك الوظيفي في النظام.</p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full btn-primary"
            >
              تحديث الصفحة
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  // Route based on role
  const renderDashboard = () => {
    switch (profile.role) {
      case 'Admin':
        return <AdminDashboard />;
      case 'BranchManager':
        return <BranchManagerDashboard />;
      case 'Citizen':
        return <CitizenDashboard />;
      case 'Inspection':
        return <InspectionDashboard />;
      case 'Authority':
        return <AuthorityDashboard />;
      case 'Maintenance':
        return <MaintenanceDashboard />;
      case 'Contractor':
        return <ContractorDashboard />;
      case 'Coordinator':
        return <CoordinatorDashboard />;
      case 'Supervisor':
        return <AdminDashboard />;
      case 'wali':
        return <WaliDashboard />;
      default:
        return <div className="p-12 text-center">دور غير معروف: {profile.role}</div>;
    }
  };

  return (
    <ErrorBoundary>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-[10px] font-bold py-1 px-4 text-center animate-pulse">
          أنت الآن تعمل في وضع الأوفلاين (لا يوجد اتصال بالإنترنت)
        </div>
      )}
      {renderDashboard()}
      <Toaster position="top-center" richColors />
    </ErrorBoundary>
  );
};

export default App;
