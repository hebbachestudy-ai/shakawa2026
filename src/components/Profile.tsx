import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, cn, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, ENTITIES, ROLE_LABELS } from '../constants';
import { Report } from '../types';
import { get, keys } from 'idb-keyval';
import { toast } from 'sonner';
import { MEDEA_GEO_DATA } from '../data/geoData';

const PermissionItem: React.FC<{ icon: React.ReactNode, label: string, status: string, onRequest: () => void }> = ({ icon, label, status, onRequest }) => {
  const getStatusColor = () => {
    if (status === 'granted') return 'text-green-600 bg-green-50';
    if (status === 'denied') return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  const getStatusLabel = () => {
    if (status === 'granted') return 'مفعل';
    if (status === 'denied') return 'مرفوض';
    return 'غير مفعل';
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-600 shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">{label}</p>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", getStatusColor())}>
            {getStatusLabel()}
          </span>
        </div>
      </div>
      {status !== 'granted' && (
        <button 
          onClick={onRequest}
          className="text-xs font-bold text-brand-secondary hover:underline"
        >
          تفعيل الآن
        </button>
      )}
    </div>
  );
};

export const Profile: React.FC = () => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [offlineReports, setOfflineReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    surname: '',
    phoneNumber: '',
    district: '',
    municipality: '',
    entity: 'Municipality' as 'Municipality' | 'Sonelgaz' | 'ADE' | 'ONA',
    role: 'Citizen' as any
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        name: profile.name || '',
        surname: profile.surname || '',
        phoneNumber: profile.phoneNumber || '',
        district: profile.district || '',
        municipality: profile.municipality || '',
        entity: profile.entity || 'Municipality',
        role: profile.role || 'Citizen'
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    setLoading(true);

    // Load offline reports if citizen
    if (profile.role === 'Citizen') {
      const loadOffline = async () => {
        try {
          const allKeys = await keys();
          const offline = [];
          for (const key of allKeys) {
            const item = await get(key);
            if (item && item.type === 'offline-report') {
              offline.push({ id: key, ...item.data, status: 'Offline' });
            }
          }
          setOfflineReports(offline);
        } catch (err) {
          console.error('Failed to load offline reports', err);
        }
      };
      loadOffline();
    }

    let q;

    if (profile.role === 'Citizen') {
      q = query(
        collection(db, 'reports'),
        where('citizenUid', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
    } else if (profile.role === 'BranchManager') {
      const districts = profile.districts && profile.districts.length > 0 
        ? profile.districts 
        : [profile.region || profile.district || ''];
      q = query(
        collection(db, 'reports'),
        where('region', 'in', districts),
        orderBy('createdAt', 'desc')
      );
    } else if (profile.role === 'Inspection') {
      q = query(
        collection(db, 'reports'),
        where('inspectedBy', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
    } else if (profile.role === 'Maintenance') {
      const districts = profile.districts && profile.districts.length > 0 
        ? profile.districts 
        : [profile.region || profile.district || ''];
      q = query(
        collection(db, 'reports'),
        where('region', 'in', districts),
        orderBy('createdAt', 'desc')
      );
    } else if (profile.role === 'Authority') {
      if (profile.municipality) {
        q = query(
          collection(db, 'reports'),
          where('municipality', '==', profile.municipality),
          orderBy('createdAt', 'desc')
        );
      } else {
        const districts = profile.districts && profile.districts.length > 0 
          ? profile.districts 
          : [profile.district || ''];
        
        if (districts[0]) {
          q = query(
            collection(db, 'reports'),
            where('district', 'in', districts),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(
            collection(db, 'reports'),
            where('province', '==', profile.province || 'المدية'),
            orderBy('createdAt', 'desc')
          );
        }
      }
    }

    if (q) {
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
        setReports(docs);
        
        if (profile.role === 'BranchManager') {
          setStats({
            total: docs.length,
            active: docs.filter(r => !['Verified', 'Archived'].includes(r.status)).length,
            completed: docs.filter(r => r.status === 'Verified').length
          });
        }
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reports');
      });
      return () => unsub();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Sync region with district for roles that use regions
      const updatedData = {
        ...editForm,
        region: editForm.district, // Ensure region is updated when district changes
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'users', profile.uid), updatedData);
      toast.success('تم تحديث الملف الشخصي بنجاح');
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('كلمات المرور الجديدة غير متطابقة');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordForm.newPassword);
      
      toast.success('تم تغيير كلمة المرور بنجاح');
      setIsChangingPassword(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Password change error:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('كلمة المرور الحالية غير صحيحة');
      } else {
        toast.error('فشل تغيير كلمة المرور. يرجى المحاولة لاحقاً');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-bl-full -mr-16 -mt-16" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-brand-primary rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-brand-primary/20">
            {profile.name[0]}{profile.surname?.[0]}
          </div>
          <div className="text-center md:text-right flex-1">
            <h2 className="text-3xl font-bold text-slate-900 mb-1">{profile.name} {profile.surname}</h2>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
              <span className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-sm">
                <Icons.Briefcase className="w-4 h-4" />
                {ROLE_LABELS[profile.role] || profile.role}
              </span>
              {profile.region && (
                <span className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-sm">
                  <Icons.Location className="w-4 h-4" />
                  {profile.region}
                </span>
              )}
              <span className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1 rounded-full text-sm">
                <Icons.Calendar className="w-4 h-4" />
                عضو منذ {new Date(profile.createdAt).toLocaleDateString('ar-DZ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.User className="w-5 h-5 text-brand-primary" />
              معلومات الحساب
            </h3>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-brand-primary hover:bg-brand-primary/10 px-4 py-2 rounded-xl transition-all text-sm font-bold flex items-center gap-2"
            >
              {isEditing ? 'إلغاء' : (
                <>
                  <Icons.Edit className="w-4 h-4" />
                  تعديل
                </>
              )}
            </button>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1">الاسم</label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="input-field py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1">اللقب</label>
                    <input 
                      type="text" 
                      value={editForm.surname}
                      onChange={(e) => setEditForm({...editForm, surname: e.target.value})}
                      className="input-field py-2"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">رقم الهاتف</label>
                  <input 
                    type="tel" 
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                    className="input-field py-2 text-left"
                    dir="ltr"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1">الدائرة</label>
                    <select
                      value={editForm.district}
                      onChange={(e) => {
                        const d = e.target.value;
                        setEditForm({
                          ...editForm, 
                          district: d,
                          municipality: MEDEA_GEO_DATA.districts[d as keyof typeof MEDEA_GEO_DATA.districts]?.[0] || ''
                        });
                      }}
                      className="input-field py-2"
                    >
                      <option value="">اختر الدائرة</option>
                      {Object.keys(MEDEA_GEO_DATA.districts).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 mr-1">البلدية</label>
                    <select
                      value={editForm.municipality}
                      onChange={(e) => setEditForm({...editForm, municipality: e.target.value})}
                      className="input-field py-2"
                      disabled={!editForm.district}
                    >
                      <option value="">اختر البلدية</option>
                      {editForm.district && MEDEA_GEO_DATA.districts[editForm.district as keyof typeof MEDEA_GEO_DATA.districts]?.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">الجهة التابع لها</label>
                  <select
                    value={editForm.entity}
                    onChange={(e) => {
                      const entity = e.target.value as any;
                      setEditForm({
                        ...editForm, 
                        entity,
                        role: entity === 'Municipality' ? 'Citizen' : 'Authority'
                      });
                    }}
                    className="input-field py-2"
                  >
                    <option value="Municipality">البلدية</option>
                    <option value="Sonelgaz">سونلغاز</option>
                    <option value="ADE">الجزائرية للمياه</option>
                    <option value="ONA">مؤسسة التطهير (ONA)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">الدور الوظيفي</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value as any})}
                    className="input-field py-2"
                  >
                    {editForm.entity === 'Municipality' ? (
                      <>
                        <option value="Citizen">مواطن</option>
                        <option value="Inspection">المعاينة والرقابة</option>
                        <option value="Authority">المديرية الولائية</option>
                        <option value="BranchManager">الفرع البلدي</option>
                        <option value="Maintenance">عمال الصيانة</option>
                        <option value="Contractor">المقاول المعتمد</option>
                        <option value="Admin">المدير العام</option>
                      </>
                    ) : (
                      <>
                        <option value="Authority">المديرية الولائية</option>
                        <option value="BranchManager">الفرع البلدي</option>
                        <option value="Maintenance">عمال الصيانة</option>
                      </>
                    )}
                  </select>
                </div>
                <button 
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="w-full btn-primary py-3 mt-4"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            ) : isChangingPassword ? (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">كلمة المرور الحالية</label>
                  <input 
                    type="password" 
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="input-field py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="input-field py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">تأكيد كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="input-field py-2"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 btn-primary py-3"
                  >
                    {loading ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">البريد الإلكتروني</span>
                  <span className="font-medium">{profile.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">رقم الهاتف</span>
                  <span className="font-medium">{profile.phoneNumber || 'غير مسجل'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">الولاية</span>
                  <span className="font-medium">{profile.province || 'المدية'}</span>
                </div>
                {profile.district && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500">الدائرة</span>
                    <span className="font-medium">{profile.district}</span>
                  </div>
                )}
                {profile.municipality && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-500">البلدية</span>
                    <span className="font-medium">{profile.municipality}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">الجهة التابع لها</span>
                  <span className="font-medium">
                    {ENTITIES.find(e => e.id === profile.entity)?.label || 'البلدية'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">حالة الحساب</span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-bold",
                    profile.status === 'Active' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  )}>
                    {profile.status === 'Active' ? 'نشط' : 'مجمد'}
                  </span>
                </div>
                <button 
                  onClick={() => setIsChangingPassword(true)}
                  className="w-full mt-4 py-3 text-brand-primary border border-brand-primary/20 rounded-2xl font-bold hover:bg-brand-primary/5 transition-all flex items-center justify-center gap-2"
                >
                  <Icons.Lock className="w-4 h-4" />
                  تغيير كلمة المرور
                </button>
              </>
            )}
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-4 border-2 border-brand-primary/10">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Icons.Globe className="w-4 h-4 text-brand-primary" />
              الخرائط والملاحة (أوفلاين)
            </h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              يمكنك استخدام الخرائط والملاحة حتى بدون اتصال بالإنترنت. يتم حفظ الخرائط تلقائياً عند تصفحها.
            </p>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <span className="text-sm font-bold text-slate-700">وضع الأوفلاين نشط</span>
              </div>
              <button 
                onClick={() => {
                  toast.success('جاري تحديث ذاكرة الخرائط...');
                  window.location.reload();
                }}
                className="text-xs font-bold text-brand-primary hover:underline"
              >
                تحديث الذاكرة
              </button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-6 border-2 border-brand-secondary/10">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Icons.ShieldCheck className="w-4 h-4 text-brand-secondary" />
              إدارة الصلاحيات
            </h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              يحتاج التطبيق لبعض الصلاحيات ليعمل بشكل كامل (تلقي الإشعارات، استخدام الكاميرا، وتحديد الموقع).
            </p>
            
            <div className="space-y-3">
              <PermissionItem 
                icon={<Icons.Notification className="w-4 h-4" />}
                label="الإشعارات"
                status={typeof Notification !== 'undefined' ? Notification.permission : 'denied'}
                onRequest={() => typeof Notification !== 'undefined' && Notification.requestPermission().then(() => window.location.reload())}
              />
              <PermissionItem 
                icon={<Icons.Camera className="w-4 h-4" />}
                label="الكاميرا"
                status="prompt" // Hard to check reliably without triggering, so we show prompt
                onRequest={() => navigator.mediaDevices.getUserMedia({ video: true }).then(stream => stream.getTracks().forEach(t => t.stop()))}
              />
              <PermissionItem 
                icon={<Icons.Location className="w-4 h-4" />}
                label="الموقع الجغرافي"
                status="prompt"
                onRequest={() => navigator.geolocation.getCurrentPosition(() => {})}
              />
            </div>

            <button 
              onClick={() => {
                // Request all
                if (typeof Notification !== 'undefined') {
                  Notification.requestPermission();
                }
                navigator.geolocation.getCurrentPosition(() => {});
                navigator.mediaDevices.getUserMedia({ video: true }).then(stream => stream.getTracks().forEach(t => t.stop()));
                toast.success('تم إرسال طلبات الصلاحيات');
              }}
              className="w-full py-3 bg-brand-secondary text-white rounded-2xl font-bold hover:bg-brand-secondary/90 transition-all flex items-center justify-center gap-2"
            >
              <Icons.ShieldCheck className="w-4 h-4" />
              تفعيل جميع الصلاحيات
            </button>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-4 border-2 border-brand-primary/10">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Icons.ShieldCheck className="w-4 h-4 text-brand-primary" />
              حالة الاتصال بـ Firebase (Debug)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">حالة الاتصال:</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  (window as any).firebaseStatus === 'connected' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  {(window as any).firebaseStatus === 'connected' ? 'متصل' : 'فشل الاتصال'}
                </span>
              </div>
              {(window as any).firebaseError && (
                <div className="p-2 bg-red-50 rounded-lg text-[10px] text-red-600 font-mono break-all">
                  Error: {(window as any).firebaseError}
                </div>
              )}
              {(window as any).firebaseProtocolWarning && (
                <div className="p-2 bg-amber-50 rounded-lg text-[10px] text-amber-700 border border-amber-200">
                  ⚠️ تنبيه: التطبيق يعمل ببروتوكول file://. قد تواجه مشاكل في تسجيل الدخول. يفضل استخدام خيار "Web App" في محول الـ APK.
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-2">
                ملاحظة: إذا كان الخطأ "Failed to fetch" أو "CORS"، تأكد من إضافة نطاق التطبيق في Firebase Console.
              </p>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-colors"
              >
                مسح التخزين المؤقت وإعادة التحميل
              </button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl space-y-4 border-2 border-amber-500/10 bg-amber-50/30">
            <h4 className="font-bold text-amber-900 flex items-center gap-2">
              <Icons.AlertTriangle className="w-4 h-4 text-amber-600" />
              مشاكل الصلاحيات في تطبيق APK
            </h4>
            <div className="space-y-3 text-sm text-amber-800 leading-relaxed">
              <p>إذا كنت تستخدم نسخة الـ APK وتواجه مشكلة في تفعيل الكاميرا أو الموقع، يرجى اتباع الخطوات التالية:</p>
              <ol className="list-decimal list-inside space-y-1 mr-2">
                <li>اذهب إلى <b>إعدادات الهاتف</b>.</li>
                <li>اختر <b>التطبيقات</b> ثم ابحث عن هذا التطبيق.</li>
                <li>اختر <b>الأذونات (Permissions)</b>.</li>
                <li>قم بتفعيل <b>الكاميرا</b> و <b>الموقع الجغرافي</b> يدوياً.</li>
                <li>تأكد من تفعيل <b>بيانات الهاتف</b> أو <b>Wi-Fi</b> ومنح التطبيق صلاحية <b>استخدام البيانات في الخلفية</b>.</li>
              </ol>
              <p className="text-[10px] opacity-70 mt-2">ملاحظة: بعض محولات الويب إلى APK لا تدعم طلب الصلاحيات تلقائياً، لذا يجب منحها يدوياً من إعدادات النظام.</p>
              <div className="mt-4 p-3 bg-white/50 rounded-xl border border-amber-200 text-[10px]">
                <p className="font-bold text-amber-900 mb-1">تنبيه لمحول الـ APK:</p>
                <p>عند تحويل الموقع إلى تطبيق، تأكد من تفعيل خيارات <b>Camera</b> و <b>Location</b> و <b>Record Audio</b> في إعدادات أداة التحويل (مثل Web2APK) قبل استخراج ملف الـ APK النهائي.</p>
              </div>
            </div>
          </div>
        </div>

        {profile.role === 'Citizen' && null}

        {profile.role === 'Authority' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.Dashboard className="w-5 h-5 text-brand-primary" />
              إحصائيات السلطة ({profile.municipality || profile.district || profile.province})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-6 rounded-3xl text-center">
                <p className="text-sm text-slate-500 mb-1">إجمالي البلاغات المتابعة</p>
                <p className="text-2xl font-bold text-brand-primary">{reports.length}</p>
              </div>
              <div className="glass-card p-6 rounded-3xl text-center">
                <p className="text-sm text-slate-500 mb-1">بلاغات مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{reports.filter(r => r.status === 'Verified').length}</p>
              </div>
            </div>
          </div>
        )}

        {profile.role === 'BranchManager' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.Dashboard className="w-5 h-5 text-brand-primary" />
              إحصائيات المنطقة ({profile.region})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card p-6 rounded-3xl text-center">
                <p className="text-sm text-slate-500 mb-1">إجمالي البلاغات</p>
                <p className="text-2xl font-bold text-brand-primary">{stats.total}</p>
              </div>
              <div className="glass-card p-6 rounded-3xl text-center">
                <p className="text-sm text-slate-500 mb-1">بلاغات نشطة</p>
                <p className="text-2xl font-bold text-brand-secondary">{stats.active}</p>
              </div>
              <div className="glass-card p-6 rounded-3xl text-center">
                <p className="text-sm text-slate-500 mb-1">بلاغات مكتملة</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Icons.Alert className="w-4 h-4" />
                تنبيهات المدير
              </h4>
              <p className="text-sm text-blue-800">
                أنت مسؤول عن إدارة البلاغات في منطقة {profile.region}. يرجى متابعة سير العمل والتأكد من التزام الفرق بالمواعيد المحددة.
              </p>
            </div>
          </div>
        )}

        {['Inspection', 'Maintenance', 'Contractor'].includes(profile.role) && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icons.Reports className="w-5 h-5 text-brand-primary" />
              سجل العمليات الأخيرة
            </h3>
            <div className="space-y-4">
              {reports.slice(0, 5).map(report => (
                <div key={report.id} className="glass-card p-4 rounded-2xl flex items-center gap-4">
                  <img src={report.photoUrl} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(report.createdAt).toLocaleDateString('ar-DZ')}
                    </p>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", STATUS_COLORS[report.status as keyof typeof STATUS_COLORS])}>
                    {STATUS_LABELS[report.status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-center py-8 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                  لا توجد عمليات مسجلة حالياً
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
