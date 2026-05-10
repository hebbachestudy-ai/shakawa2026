import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, setDoc, where, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../AuthContext';
import { Icons, ENTITIES, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { CitizenMap } from './CitizenMap';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { MEDEA_GEO_DATA } from '../data/geoData';
import { Profile } from './Profile';
import { getNextSerialNumber } from '../utils/serial';
import { CoordinatorDashboard } from './coordination/CoordinatorDashboard';

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'registration' | 'users' | 'reports' | 'profile' | 'tools' | 'map' | 'archive' | 'coordination'>('home');
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRole, setSearchRole] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<string>('all');
  const [reportDelayedFilter, setReportDelayedFilter] = useState(false);

  const [selectedReport, setSelectedReport] = useState<any>(null);

  const generateTestData = async () => {
    setLoading(true);
    const testCitizenUid = "test-citizen-123";
    const testReports = [
      { status: 'New', targetEntity: 'Municipality', type: 'Asphalt', subType: 'حفرة عميقة', extraDetails: { size: 2, depth: 10 }, district: 'المدية', municipality: 'المدية', note: 'بلاغ تجريبي - مرحلة جديدة' },
      { status: 'Inspected', targetEntity: 'Sonelgaz', type: 'Electricity', subType: 'انقطاع الكهرباء', extraDetails: {}, district: 'وزرة', municipality: 'وزرة', note: 'بلاغ تجريبي - سونلغاز' },
      { status: 'Pricing', targetEntity: 'ADE', type: 'Distribution', subType: 'انقطاع المياه', extraDetails: {}, district: 'البرواقية', municipality: 'البرواقية', note: 'بلاغ تجريبي - الجزائرية للمياه' },
      { status: 'Negotiating', targetEntity: 'ONA', type: 'Sewage', subType: 'انسداد المجاري', extraDetails: {}, district: 'قصر البخاري', municipality: 'قصر البخاري', note: 'بلاغ تجريبي - مؤسسة التطهير' },
      { status: 'Permitted', targetEntity: 'Municipality', type: 'Asphalt', subType: 'تآكل الحواف', extraDetails: { size: 1, depth: 5 }, district: 'بني سليمان', municipality: 'بني سليمان', note: 'بلاغ تجريبي - مرحلة الترخيص' },
      { status: 'Repairing', targetEntity: 'Sonelgaz', type: 'Gas', subType: 'تسرب غاز', extraDetails: {}, district: 'تابلاط', municipality: 'تابلاط', note: 'بلاغ تجريبي - غاز' },
      { status: 'Repaired', targetEntity: 'ADE', type: 'Leaks', subType: 'كسر أنبوب', extraDetails: {}, district: 'العزيزية', municipality: 'العزيزية', note: 'بلاغ تجريبي - تسرب مياه' },
      { status: 'Verified', targetEntity: 'ONA', type: 'Environmental', subType: 'روائح كريهة', extraDetails: {}, district: 'قلب الكبير', municipality: 'قلب الكبير', note: 'بلاغ تجريبي - بيئة' },
      { status: 'Rejected', targetEntity: 'Municipality', type: 'Asphalt', subType: 'هبوط في الطريق', extraDetails: { size: 4, depth: 2 }, district: 'العمارية', municipality: 'العمارية', note: 'بلاغ تجريبي - مرفوض' },
      { status: 'Archived', targetEntity: 'Municipality', type: 'Pavement', subType: 'رصيف غير مستوٍ', extraDetails: { length: 10 }, district: 'سغوان', municipality: 'سغوان', note: 'بلاغ تجريبي - مؤرشف' },
    ];

    try {
      for (const report of testReports) {
        const serialNumber = await getNextSerialNumber();
        await addDoc(collection(db, 'reports'), {
          ...report,
          serialNumber,
          citizenUid: testCitizenUid,
          targetEntity: report.targetEntity,
          photoUrl: 'https://picsum.photos/seed/' + report.status + '/800/600',
          location: { lat: 36.2648 + (Math.random() - 0.5) * 0.1, lng: 2.7539 + (Math.random() - 0.5) * 0.1 },
          region: report.district,
          province: MEDEA_GEO_DATA.province,
          severity: 'Medium',
          urgency: 'Medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      toast.success('تم إنشاء 10 بلاغات تجريبية بنجاح تغطي جميع المراحل');
    } catch (error) {
      console.error("Error generating test data:", error);
      toast.error('فشل إنشاء البيانات التجريبية');
    } finally {
      setLoading(false);
    }
  };


  // Form states for adding users
  const [newUser, setNewUser] = useState({
    name: '',
    surname: '',
    idCardNumber: '',
    idCardPhoto: '',
    role: 'BranchManager' as UserProfile['role'],
    entity: 'Municipality' as 'Municipality' | 'Sonelgaz' | 'ADE' | 'ONA',
    region: '',
    province: MEDEA_GEO_DATA.province,
    district: '',
    districts: [] as string[],
    municipality: '',
    municipalities: [] as string[],
    authorityLevel: 'Municipality' as 'Province' | 'District' | 'Municipality',
    contractorUid: '',
    phoneNumber: '',
    email: '',
    password: ''
  });

  const [contractorSearch, setContractorSearch] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Fetch reports
    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("AdminDashboard: Error fetching reports:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    // Fetch users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("AdminDashboard: Error fetching users:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubReports();
      unsubUsers();
    };
  }, [profile]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Create a unique app name to avoid conflicts
    const appName = `Secondary_${Date.now()}`;
    let secondaryApp;
    
    try {
      // Check if user already exists in Firestore to prevent duplicate profiles
      const q = query(collection(db, 'users'), where('email', '==', newUser.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.error('هذا البريد الإلكتروني مسجل بالفعل في النظام كملف شخصي.');
        setLoading(false);
        return;
      }

      if (newUser.role === 'Maintenance' && !newUser.contractorUid) {
        toast.error('يرجى اختيار المقاول المسؤول عن فريق الصيانة.');
        setLoading(false);
        return;
      }

      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      let newUid: string;
      try {
        const result = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
        newUid = result.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // If email exists in Auth but not in Firestore, try to "claim" it by signing in
          // This works if the admin provides the correct password for the existing account
          try {
            const result = await signInWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
            newUid = result.user.uid;
            toast.info('تم العثور على حساب موجود مسبقاً، سيتم ربطه بالملف الشخصي الجديد.');
          } catch (signInError) {
            // Email exists but password doesn't match or other error
            throw authError; // Re-throw the original "email-already-in-use" error
          }
        } else {
          throw authError;
        }
      }

      // Create user document in Firestore with the UID
      const { password, ...userData } = newUser;
      await setDoc(doc(db, 'users', newUid), {
        ...userData,
        uid: newUid,
        status: 'Active',
        createdAt: new Date().toISOString()
      });
      
      await signOut(secondaryAuth);
      
      toast.success('تم إضافة المستخدم بنجاح');
      setNewUser({
        name: '',
        surname: '',
        idCardNumber: '',
        idCardPhoto: '',
        role: 'BranchManager',
        region: '',
        province: MEDEA_GEO_DATA.province,
        district: '',
        districts: [] as string[],
        municipality: '',
        municipalities: [] as string[],
        authorityLevel: 'Municipality',
        contractorUid: '',
        phoneNumber: '',
        email: '',
        password: ''
      });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('هذا البريد الإلكتروني مستخدم بالفعل. يرجى التأكد من كلمة المرور إذا كنت تحاول إعادة ربط الحساب، أو استخدم بريداً آخر.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('كلمة المرور ضعيفة جداً. يرجى استخدام 6 أحرف على الأقل.');
      } else {
        toast.error('فشل إضافة المستخدم: ' + (error.message || 'خطأ غير معروف'));
      }
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error("Error deleting secondary app:", e);
        }
      }
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: currentStatus === 'Active' ? 'Frozen' : 'Active'
      });
      toast.success('تم تحديث حالة المستخدم');
    } catch (error) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟ ملاحظة: سيتم حذف الملف الشخصي فقط، سيبقى حساب الدخول (البريد الإلكتروني) مسجلاً في النظام.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('تم حذف المستخدم');
    } catch (error) {
      toast.error('فشل حذف المستخدم');
    }
  };

  const ARCHIVED_STATUSES = ['Repaired', 'Verified', 'Completed', 'Rejected', 'False', 'Archived'];

  const isDelayed = (report: any) => {
    const updatedAt = new Date(report.updatedAt || report.createdAt).getTime();
    const now = new Date().getTime();
    const diffDays = (now - updatedAt) / (1000 * 3600 * 24);
    return diffDays > 7 && !ARCHIVED_STATUSES.includes(report.status);
  };

  const delayedReports = reports.filter(isDelayed);

  const filteredUsers = users.filter(u => {
    const matchesRole = searchRole ? u.role === searchRole : true;
    const matchesRegion = searchRegion ? (u.region?.includes(searchRegion) || u.province?.includes(searchRegion)) : true;
    return matchesRole && matchesRegion;
  });

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'Admin']}</p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
          >
            <Icons.Logout className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => setActiveTab('home')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'home' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Dashboard className="w-5 h-5" />
            الرئيسية
          </button>
          <button
            onClick={() => setActiveTab('registration')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'registration' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Add className="w-5 h-5" />
            تسجيل العمال
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'users' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Users className="w-5 h-5" />
            الحسابات
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'reports' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Reports className="w-5 h-5" />
            البلاغات النشطة
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'archive' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Archive className="w-5 h-5" />
            الأرشيف
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'tools' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Settings className="w-5 h-5" />
            أدوات الاختبار
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'map' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Location className="w-5 h-5" />
            الخريطة الشاملة
          </button>
          <button
            onClick={() => setActiveTab('coordination')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'coordination' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Briefcase className="w-5 h-5" />
            التنسيق الذكي
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'profile' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.User className="w-5 h-5" />
            الملف الشخصي
          </button>
        </div>

        {activeTab === 'home' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-8 rounded-3xl">
                <p className="text-sm text-slate-500 mb-1">إجمالي المستخدمين</p>
                <h3 className="text-3xl font-bold text-slate-900">{users.length}</h3>
              </div>
              <div 
                className="glass-card p-8 rounded-3xl cursor-pointer hover:shadow-xl transition-all"
                onClick={() => {
                  setActiveTab('reports');
                  setReportDelayedFilter(true);
                }}
              >
                <p className="text-sm text-slate-500 mb-1">البلاغات المتأخرة</p>
                <h3 className="text-3xl font-bold text-brand-danger">{delayedReports.length}</h3>
              </div>
              <div className="glass-card p-8 rounded-3xl">
                <p className="text-sm text-slate-500 mb-1">إجمالي البلاغات</p>
                <h3 className="text-3xl font-bold text-brand-primary">{reports.length}</h3>
              </div>
            </div>

            {delayedReports.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-red-100 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                  <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
                    <Icons.Clock className="w-5 h-5" />
                    بلاغات متأخرة (تحتاج تدخل)
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {delayedReports.map(report => {
                    const bm = users.find(u => u.role === 'BranchManager' && u.region === report.region);
                    return (
                      <div key={report.id} className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <img src={report.photoUrl} className="w-16 h-16 rounded-xl object-cover" />
                          <div>
                            <p className="font-bold text-gray-900">{Object.values(REPORT_TYPES).flat().find(t => t.id === report.type)?.label}</p>
                            <p className="text-sm text-gray-500">{report.location.address || 'موقع محدد'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">مدير الفرع المسؤول:</p>
                          <p className="text-sm text-blue-600">{bm?.name || 'غير محدد'}</p>
                          <p className="text-xs text-gray-400">{bm?.phoneNumber || 'لا يوجد رقم'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'tools' ? (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Icons.Settings className="w-6 h-6 text-brand-primary" />
                أدوات المطور والاختبار
              </h2>
              <p className="text-slate-500 mb-8">
                هذه الأدوات مخصصة لتجربة النظام والتأكد من عمل جميع المراحل بشكل صحيح.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-slate-900 mb-2">توليد بلاغات تجريبية</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    سيقوم هذا الخيار بإنشاء 10 بلاغات في حالات مختلفة (جديد، معاينة، تسعير، إصلاح، إلخ) لتجربة واجهات الموظفين المختلفة.
                  </p>
                  <button
                    onClick={generateTestData}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Icons.Clock className="w-5 h-5 animate-spin" /> : <Icons.Add className="w-5 h-5" />}
                    إنشاء بلاغات تجريبية
                  </button>
                </div>

              </div>
            </div>
          </div>
        ) : activeTab === 'registration' ? (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Icons.Add className="w-6 h-6 text-blue-600" />
              تسجيل عامل جديد
            </h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الاسم</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">اللقب</label>
                <input
                  type="text"
                  value={newUser.surname}
                  onChange={(e) => setNewUser({...newUser, surname: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">رقم بطاقة التعريف</label>
                <input
                  type="text"
                  value={newUser.idCardNumber}
                  onChange={(e) => setNewUser({...newUser, idCardNumber: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">المؤسسة / الجهة</label>
                <select
                  value={newUser.entity}
                  onChange={(e) => {
                    const entity = e.target.value as any;
                    let defaultRole = 'Authority';
                    if (entity === 'Municipality') defaultRole = 'BranchManager';
                    if (entity === 'ProjectsCoordination') defaultRole = 'Coordinator';
                    if (entity === 'Wilaya') defaultRole = 'wali';
                    
                    setNewUser({
                      ...newUser, 
                      entity,
                      role: defaultRole as any,
                      authorityLevel: 'Province'
                    });
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="Municipality">البلدية</option>
                  <option value="Sonelgaz">سونلغاز</option>
                  <option value="ADE">الجزائرية للمياه</option>
                  <option value="ONA">مؤسسة التطهير (ONA)</option>
                  <option value="ProjectsCoordination">مديرية تنسيق المشاريع</option>
                  <option value="Wilaya">مقر الولاية</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser({...newUser, phoneNumber: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الدور الوظيفي</label>
                <select
                  value={newUser.role === 'Authority' ? `Authority_${newUser.authorityLevel}` : newUser.role}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('Authority_')) {
                      const level = val.split('_')[1] as any;
                      setNewUser({
                        ...newUser,
                        role: 'Authority',
                        authorityLevel: level,
                        district: '',
                        municipality: '',
                        region: level === 'Province' ? MEDEA_GEO_DATA.province : ''
                      });
                    } else {
                      setNewUser({
                        ...newUser,
                        role: val as any,
                        authorityLevel: 'Municipality',
                        district: '',
                        municipality: '',
                        districts: [],
                        region: ''
                      });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {newUser.entity === 'Municipality' ? (
                    <>
                      <option value="BranchManager">مدير فرع</option>
                      <option value="Inspection">فريق مراقبة</option>
                      <option value="Maintenance">فريق صيانة</option>
                      <option value="Contractor">مقاول</option>
                      <option value="Authority_Province">سلطة الولاية</option>
                      <option value="Authority_District">سلطة الدائرة</option>
                      <option value="Authority_Municipality">سلطة البلدية</option>
                      <option value="Coordinator">منسق إداري</option>
                    </>
                  ) : newUser.entity === 'ProjectsCoordination' ? (
                    <>
                      <option value="Coordinator">منسق إداري</option>
                      <option value="Supervisor">مشرف عام</option>
                      <option value="Admin">مدير عام مساعد</option>
                    </>
                  ) : newUser.entity === 'Wilaya' ? (
                    <>
                      <option value="wali">الوالي</option>
                      <option value="Supervisor">رئيس ديوان</option>
                    </>
                  ) : (
                    <>
                      <option value="Authority_Province">المديرية الولائية</option>
                      <option value="BranchManager">الفرع البلدي</option>
                      <option value="Maintenance">عمال الصيانة</option>
                      <option value="Coordinator">منسق إداري</option>
                    </>
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">كلمة المرور المؤقتة</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">الولاية</label>
                <select
                  value={newUser.province}
                  onChange={(e) => setNewUser({...newUser, province: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value={MEDEA_GEO_DATA.province}>{MEDEA_GEO_DATA.province}</option>
                </select>
              </div>
              {(newUser.role !== 'Authority' || (newUser.role === 'Authority' && newUser.authorityLevel !== 'Province')) && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">الدائرة</label>
                  {['Inspection', 'Maintenance', 'Contractor'].includes(newUser.role) ? (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-xl">
                      {Object.keys(MEDEA_GEO_DATA.districts).map(d => (
                        <label key={d} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={newUser.districts.includes(d)}
                            onChange={(e) => {
                              const districts = e.target.checked 
                                ? [...newUser.districts, d]
                                : newUser.districts.filter(item => item !== d);
                              
                              // Filter municipalities that are no longer in selected districts
                              const validMunicipalities = newUser.municipalities.filter(m => 
                                districts.some(dist => MEDEA_GEO_DATA.districts[dist as keyof typeof MEDEA_GEO_DATA.districts]?.includes(m))
                              );

                              setNewUser({
                                ...newUser, 
                                districts, 
                                municipalities: validMunicipalities,
                                region: [...districts, ...validMunicipalities].join(', ')
                              });
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          {d}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      value={newUser.district}
                      onChange={(e) => {
                        const district = e.target.value;
                        const municipalities = MEDEA_GEO_DATA.districts[district as keyof typeof MEDEA_GEO_DATA.districts] || [];
                        setNewUser({
                          ...newUser, 
                          district, 
                          municipality: municipalities[0] || '',
                          region: district 
                        });
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      required={newUser.role !== 'Authority' || newUser.authorityLevel !== 'Province'}
                    >
                      <option value="">اختر الدائرة</option>
                      {Object.keys(MEDEA_GEO_DATA.districts).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {(['Inspection', 'Maintenance', 'Contractor'].includes(newUser.role) || (newUser.role === 'Authority' && newUser.authorityLevel === 'Municipality') || newUser.role === 'BranchManager') && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">البلدية</label>
                  {['Inspection', 'Maintenance', 'Contractor'].includes(newUser.role) ? (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-xl">
                      {(newUser.districts.length > 0 
                        ? newUser.districts.flatMap(d => MEDEA_GEO_DATA.districts[d as keyof typeof MEDEA_GEO_DATA.districts] || [])
                        : Object.values(MEDEA_GEO_DATA.districts).flat()
                      ).map(m => (
                        <label key={m} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={newUser.municipalities.includes(m)}
                            onChange={(e) => {
                              const municipalities = e.target.checked 
                                ? [...newUser.municipalities, m]
                                : newUser.municipalities.filter(item => item !== m);
                              setNewUser({
                                ...newUser, 
                                municipalities, 
                                region: [...newUser.districts, ...municipalities].join(', ')
                              });
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          {m}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      value={newUser.municipality}
                      onChange={(e) => {
                        const municipality = e.target.value;
                        setNewUser({
                          ...newUser, 
                          municipality, 
                          region: newUser.role === 'Authority' && newUser.authorityLevel === 'Municipality' ? municipality : newUser.region
                        });
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      required={newUser.role !== 'Authority' || newUser.authorityLevel === 'Municipality'}
                      disabled={newUser.role !== 'Inspection' && newUser.role !== 'Maintenance' && newUser.role !== 'Contractor' && !newUser.district}
                    >
                      <option value="">اختر البلدية</option>
                      {newUser.district && MEDEA_GEO_DATA.districts[newUser.district as keyof typeof MEDEA_GEO_DATA.districts].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {newUser.role === 'Maintenance' && (
                <div className="lg:col-span-3 space-y-4 p-6 bg-blue-50 rounded-3xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                      <Icons.Contractor className="w-5 h-5" />
                      اختيار المقاول المسؤول
                    </h3>
                  </div>
                  
                  <div className="relative">
                    <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="البحث عن مقاول بالاسم، البريد أو الهاتف..."
                      value={contractorSearch}
                      onChange={(e) => setContractorSearch(e.target.value)}
                      className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
                    {users
                      .filter(u => u.role === 'Contractor')
                      .filter(u => {
                        const search = contractorSearch.toLowerCase();
                        const matchesSearch = !search || 
                          u.email?.toLowerCase().includes(search) ||
                          u.phoneNumber?.includes(search) ||
                          u.name?.toLowerCase().includes(search) ||
                          u.surname?.toLowerCase().includes(search);
                        
                        if (!matchesSearch) return false;

                        // Filter by region overlap
                        const hasOverlap = 
                          (u.districts?.some((d: string) => newUser.districts.includes(d))) ||
                          (u.municipalities?.some((m: string) => newUser.municipalities.includes(m)));
                        
                        return hasOverlap;
                      })
                      .map(contractor => (
                        <button
                          key={contractor.id}
                          type="button"
                          onClick={() => setNewUser({ ...newUser, contractorUid: contractor.id })}
                          className={cn(
                            "flex flex-col p-4 rounded-2xl border-2 transition-all text-right",
                            newUser.contractorUid === contractor.id
                              ? "border-blue-500 bg-blue-100 shadow-md"
                              : "border-white bg-white hover:border-blue-200"
                          )}
                        >
                          <span className="font-bold text-gray-900">{contractor.name} {contractor.surname}</span>
                          <span className="text-xs text-gray-500">{contractor.email}</span>
                          <span className="text-xs text-gray-500">{contractor.phoneNumber}</span>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {contractor.municipalities?.slice(0, 2).map((m: string) => (
                              <span key={m} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600">{m}</span>
                            ))}
                            {(contractor.municipalities?.length || 0) > 2 && (
                              <span className="text-[10px] text-gray-400">+{contractor.municipalities.length - 2}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    {users.filter(u => u.role === 'Contractor').length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        لا يوجد مقاولون مسجلون في النظام حالياً.
                      </div>
                    )}
                    {users.filter(u => u.role === 'Contractor').length > 0 && 
                     users.filter(u => u.role === 'Contractor').filter(u => {
                        const hasOverlap = 
                          (u.districts?.some((d: string) => newUser.districts.includes(d))) ||
                          (u.municipalities?.some((m: string) => newUser.municipalities.includes(m)));
                        return hasOverlap;
                     }).length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        لا يوجد مقاولون يعملون في المناطق المختارة.
                      </div>
                    )}
                  </div>
                  {newUser.role === 'Maintenance' && !newUser.contractorUid && (
                    <p className="text-xs text-red-500 font-bold">يرجى اختيار المقاول المسؤول عن فريق الصيانة.</p>
                  )}
                </div>
              )}
              <div className="lg:col-span-3">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all"
                >
                  حفظ البيانات وإنشاء الحساب
                </button>
              </div>
            </form>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex gap-4">
              <div className="flex-1 relative">
                <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث بالمنطقة أو الولاية..."
                  value={searchRegion}
                  onChange={(e) => setSearchRegion(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <select
                value={searchRole}
                onChange={(e) => setSearchRole(e.target.value)}
                className="px-6 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">كل الأدوار</option>
                <option value="BranchManager">مدير فرع</option>
                <option value="Inspection">فريق مراقبة</option>
                <option value="Maintenance">فريق صيانة</option>
                <option value="Contractor">مقاول</option>
                <option value="Authority">سلطة</option>
                <option value="Citizen">مواطن</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">المستخدم</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الدور الوظيفي</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">المنطقة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{u.name} {u.surname}</p>
                        <p className="text-xs text-gray-400">{u.phoneNumber || u.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ROLE_LABELS[u.role] || u.role}
                        {u.role === 'Authority' && (
                          <span className="block text-[10px] text-gray-400">
                            {u.authorityLevel === 'Province' ? 'سلطة الولاية' :
                             u.authorityLevel === 'District' ? 'سلطة الدائرة' : 'سلطة البلدية'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {u.municipalities?.length ? u.municipalities.join(', ') : 
                         u.districts?.length ? u.districts.join(', ') : 
                         u.municipality || u.district || u.region || u.province}
                        {u.role === 'Maintenance' && u.contractorUid && (
                          <div className="text-[10px] text-blue-600 font-bold mt-1">
                            المقاول: {users.find(c => c.id === u.contractorUid)?.name || 'غير معروف'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-bold",
                          u.status === 'Active' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        )}>
                          {u.status === 'Active' ? 'نشط' : 'مجمد'}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => toggleUserStatus(u.id, u.status)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                          title={u.status === 'Active' ? 'تجميد' : 'تنشيط'}
                        >
                          {u.status === 'Active' ? <Icons.Danger className="w-5 h-5 text-red-500" /> : <Icons.Check className="w-5 h-5 text-green-500" />}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-all"
                          title="حذف"
                        >
                          <Icons.Delete className="w-5 h-5 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'reports' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث بالرقم التسلسلي أو النوع..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
                />
              </div>
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
                className="px-6 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
              >
                <option value="all">كل الحالات النشطة</option>
                {Object.entries(STATUS_LABELS)
                  .filter(([id]) => !ARCHIVED_STATUSES.includes(id))
                  .map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => setReportDelayedFilter(!reportDelayedFilter)}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border",
                  reportDelayedFilter 
                    ? "bg-red-50 border-red-200 text-red-600 shadow-sm" 
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <Icons.Clock className={cn("w-5 h-5", reportDelayedFilter ? "text-red-600" : "text-gray-400")} />
                بلاغات متأخرة
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">البلاغ</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الجهة المستهدفة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">المنطقة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports
                    .filter(r => !ARCHIVED_STATUSES.includes(r.status))
                    .filter(r => {
                      const matchesSearch = !reportSearch || 
                        r.serialNumber?.toLowerCase().includes(reportSearch.toLowerCase()) ||
                        r.type?.toLowerCase().includes(reportSearch.toLowerCase()) ||
                        r.municipality?.toLowerCase().includes(reportSearch.toLowerCase()) ||
                        r.district?.toLowerCase().includes(reportSearch.toLowerCase());
                      const matchesStatus = reportStatusFilter === 'all' || r.status === reportStatusFilter;
                      const matchesDelayed = !reportDelayedFilter || isDelayed(r);
                      return matchesSearch && matchesStatus && matchesDelayed;
                    })
                    .map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-all cursor-pointer" onClick={() => { setSelectedReport(r); setActiveTab('reports'); }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={r.photoUrl} className="w-10 h-10 rounded-lg object-cover" />
                          <div>
                            <p className="font-bold text-gray-900">{r.serialNumber || 'بدون رقم'}</p>
                            <p className="text-xs text-gray-400">
                              {Object.values(REPORT_TYPES).flat().find(t => t.id === r.type)?.label || r.type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ENTITIES.find(e => e.id === r.targetEntity)?.label || r.targetEntity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {r.municipality}, {r.district}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold",
                          STATUS_COLORS[r.status]
                        )}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(r.updatedAt || r.createdAt).toLocaleDateString('ar-DZ')}
                        {isDelayed(r) && (
                          <span className="block text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                            <Icons.AlertTriangle className="w-3 h-3" />
                            متأخر
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'archive' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث في الأرشيف (رقم، نوع، بلدية...)"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
                />
              </div>
              <select
                value={archiveStatusFilter}
                onChange={(e) => setArchiveStatusFilter(e.target.value)}
                className="px-6 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
              >
                <option value="all">كل الأرشيف</option>
                {ARCHIVED_STATUSES.map(status => (
                  <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">البلاغ المؤرشف</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الجهة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">المنطقة</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">الحالة النهائية</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">تاريخ الأرشفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports
                    .filter(r => ARCHIVED_STATUSES.includes(r.status))
                    .filter(r => {
                      const matchesSearch = !archiveSearch || 
                        r.serialNumber?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                        r.type?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                        r.municipality?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                        r.district?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                        r.note?.toLowerCase().includes(archiveSearch.toLowerCase());
                      const matchesStatus = archiveStatusFilter === 'all' || r.status === archiveStatusFilter;
                      return matchesSearch && matchesStatus;
                    })
                    .map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-all cursor-pointer" onClick={() => { setSelectedReport(r); setActiveTab('archive'); }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={r.photoUrl} className="w-10 h-10 rounded-lg object-cover grayscale opacity-60" />
                          <div>
                            <p className="font-bold text-gray-900">{r.serialNumber || 'بدون رقم'}</p>
                            <p className="text-xs text-gray-400">
                              {Object.values(REPORT_TYPES).flat().find(t => t.id === r.type)?.label || r.type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ENTITIES.find(e => e.id === r.targetEntity)?.label || r.targetEntity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {r.municipality}, {r.district}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold",
                          STATUS_COLORS[r.status]
                        )}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(r.updatedAt || r.createdAt).toLocaleDateString('ar-DZ')}
                      </td>
                    </tr>
                  ))}
                  {reports.filter(r => ARCHIVED_STATUSES.includes(r.status)).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        لا توجد بلاغات مؤرشفة حالياً
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'coordination' ? (
          <div className="animate-slide-up">
            <CoordinatorDashboard />
          </div>
        ) : activeTab === 'map' ? (
          <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Icons.Location className="w-5 h-5 text-brand-primary" />
                خريطة البلاغات الشاملة (الحرارية)
              </h3>
              <p className="text-sm text-slate-500">تحليل كثافة البلاغات وتوزيعها الجغرافي عبر الولاية</p>
            </div>
            
            <CitizenMap 
              reports={reports} 
              showHeatMap={true}
              onReportClick={(report) => {
                setSelectedReport(report);
                setActiveTab('reports');
              }}
            />
          </div>
        ) : (
          <Profile />
        )}

        {/* Report Details Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">تفاصيل البلاغ</h3>
                  <p className="text-xs font-mono text-slate-400">{selectedReport.serialNumber}</p>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-500"
                >
                  <Icons.Close className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">صورة البلاغ</p>
                        <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img 
                            src={selectedReport.photoUrl} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                      {selectedReport.landmarkPhotoUrl && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">معالم المكان</p>
                          <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img 
                              src={selectedReport.landmarkPhotoUrl} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Icons.Alert className="w-5 h-5 text-blue-600" />
                        معلومات أساسية
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">النوع</p>
                          <p className="font-bold text-slate-700">
                            {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label || selectedReport.type}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">الحالة</p>
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1",
                            STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS]
                          )}>
                            {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">الجهة</p>
                          <p className="font-bold text-slate-700">{ENTITIES.find(e => e.id === selectedReport.targetEntity)?.label || selectedReport.targetEntity}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">التاريخ</p>
                          <p className="font-bold text-slate-700">{new Date(selectedReport.createdAt).toLocaleDateString('ar-DZ')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Icons.Location className="w-5 h-5 text-red-600" />
                        الموقع الجغرافي
                      </h4>
                      <p className="text-sm text-slate-600">{selectedReport.municipality}، {selectedReport.district}، {selectedReport.province}</p>
                      <div className="aspect-square rounded-xl bg-slate-200 overflow-hidden">
                        <CitizenMap 
                          reports={[selectedReport]} 
                          center={selectedReport.location}
                          zoom={15}
                          interactive={false}
                        />
                      </div>
                    </div>

                    {selectedReport.note && (
                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-2">ملاحظات المواطن</h4>
                        <p className="text-sm text-blue-800 leading-relaxed">{selectedReport.note}</p>
                      </div>
                    )}

                    {selectedReport.status === 'False' && (
                      <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                        <h4 className="font-bold text-red-900 mb-2">سبب الرفض (بلاغ كاذب)</h4>
                        <p className="text-sm text-red-800">{selectedReport.falseReason || 'لا يوجد تبرير مسجل'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
