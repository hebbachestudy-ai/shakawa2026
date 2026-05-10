import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Icons, Logo, cn } from '../constants';
import { toast } from 'sonner';

export const Login: React.FC = () => {
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRedirectOption, setShowRedirectOption] = useState(false);

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (emailMode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        toast.success('تم تسجيل الدخول بنجاح');
      } else {
        // Sign Up - Only for Citizens
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('تم إنشاء حساب مواطن بنجاح');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('هذا البريد الإلكتروني مستخدم بالفعل.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else {
        toast.error('فشل العملية. تأكد من البيانات.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setShowRedirectOption(false);
    try {
      const provider = new GoogleAuthProvider();
      // In some mobile environments, popup is not supported at all
      if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      toast.success('تم تسجيل الدخول بنجاح عبر جوجل');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
        toast.error('النافذة المنبثقة غير مدعومة في هذا المتصفح. يرجى المحاولة باستخدام إعادة التوجيه.');
        setShowRedirectOption(true);
      } else {
        toast.error('فشل تسجيل الدخول عبر جوجل. تأكد من إعدادات النطاق المسموح به في Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error(error);
      toast.error('فشل تسجيل الدخول عبر جوجل (إعادة التوجيه).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans rtl" dir="rtl">
      <div className="max-w-md w-full glass-card rounded-3xl p-8 animate-slide-up">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 mb-2">مرحباً بك</h1>
          <p className="text-slate-500">نظام التبليغ عن الحفر والأعطال العامة</p>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
          <button
            onClick={() => setEmailMode('login')}
            className={cn(
              "flex-1 py-3 text-sm font-semibold rounded-xl transition-all",
              emailMode === 'login' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setEmailMode('signup')}
            className={cn(
              "flex-1 py-3 text-sm font-semibold rounded-xl transition-all",
              emailMode === 'signup' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            إنشاء حساب مواطن
          </button>
        </div>

        <form onSubmit={handleEmailAction} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">البريد الإلكتروني</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : (emailMode === 'login' ? 'دخول' : 'إنشاء الحساب')}
          </button>
        </form>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-bold">أو عبر</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            تسجيل الدخول بجوجل
          </button>

          {showRedirectOption && (
            <div className="space-y-3">
              <button
                onClick={handleGoogleRedirect}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-200 transition-all shadow-sm disabled:opacity-50"
              >
                المحاولة باستخدام إعادة التوجيه
              </button>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">ملاحظة لمستخدمي تطبيق APK:</p>
                <p>تسجيل الدخول بجوجل يتطلب إضافة نطاق التطبيق (Domain) إلى قائمة النطاقات المسموح بها في Firebase Console. إذا كنت تستخدم تطبيقاً محولاً، يرجى التأكد من إعدادات الـ SHA-1 في Firebase.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            بإستخدامك لهذا التطبيق، أنت توافق على شروط الخدمة وسياسة الخصوصية.
          </p>
        </div>
      </div>
    </div>
  );
};

