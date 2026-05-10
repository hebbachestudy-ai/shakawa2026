import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { getNextSerialNumber } from '../utils/serial';
import { calculateDistance } from '../utils/geo';
import { toast } from 'sonner';
import { Profile } from './Profile';
import { CitizenMap } from './CitizenMap';
import { CoordinatorDashboard } from './coordination/CoordinatorDashboard';

export const AuthorityDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'archive' | 'monthly' | 'profile' | 'tools' | 'map' | 'coordination'>('overview');
  const [reports, setReports] = useState<any[]>([]);
  const [reportSubTab, setReportSubTab] = useState<'new' | 'inspected' | 'repairing' | 'repaired' | 'false'>('new');
  const [monthlyReports, setMonthlyReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [contractors, setContractors] = useState<any[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<string>('');
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [uploadingPermit, setUploadingPermit] = useState(false);
  const detailsRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedReport && contractors.length > 0) {
      // Find contractor that covers this report's municipality or district
      const autoContractor = contractors.find(c => 
        (selectedReport.municipality && c.municipalities?.includes(selectedReport.municipality)) ||
        (selectedReport.district && c.districts?.includes(selectedReport.district))
      );
      
      if (autoContractor) {
        setSelectedContractor(autoContractor.id);
        toast.info(`تم تحديد المقاول ${autoContractor.name} تلقائياً لهذه المنطقة`);
      } else {
        setSelectedContractor('');
      }
      
      // Also set initial finalPrice from inspection if available
      if (selectedReport.inspectionDetails?.price) {
        setFinalPrice(selectedReport.inspectionDetails.price);
      }
    }
  }, [selectedReport, contractors]);

  useEffect(() => {
    if (selectedReport && window.innerWidth < 1024) {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedReport]);

  const generateTestData = async () => {
    setLoading(true);
    const testCitizenUid = "test-citizen-123";
    const testReports = [
      { status: 'New', type: 'Asphalt', subType: 'حفرة عميقة', extraDetails: { size: 2, depth: 10 }, note: 'بلاغ تجريبي - مرحلة جديدة' },
      { status: 'Inspected', type: 'Pavement', subType: 'بلاط مكسور', extraDetails: { length: 5 }, note: 'بلاغ تجريبي - تمت المعاينة' },
      { status: 'Pricing', type: 'Lighting', subType: 'مصباح محروق', extraDetails: { poleNumber: 'A-123' }, note: 'بلاغ تجريبي - مرحلة التسعير' },
      { status: 'Negotiating', type: 'General Hazard', subType: 'أسلاك مكشوفة', extraDetails: { hazardLevel: 'عالي' }, note: 'بلاغ تجريبي - مرحلة التفاوض' },
      { status: 'Permitted', type: 'Asphalt', subType: 'تآكل الحواف', extraDetails: { size: 1, depth: 5 }, note: 'بلاغ تجريبي - مرحلة الترخيص' },
      { status: 'Repairing', type: 'Pavement', subType: 'حواف مفقودة', extraDetails: { length: 3 }, note: 'بلاغ تجريبي - قيد الإصلاح' },
      { status: 'Repaired', type: 'Lighting', subType: 'عمود مائل', extraDetails: { poleNumber: 'B-456' }, note: 'بلاغ تجريبي - تم الإصلاح' },
      { status: 'Verified', type: 'General Hazard', subType: 'سقوط ركام', extraDetails: { hazardLevel: 'متوسط' }, note: 'بلاغ تجريبي - تم التأكيد' },
      { status: 'Rejected', type: 'Asphalt', subType: 'هبوط في الطريق', extraDetails: { size: 4, depth: 2 }, note: 'بلاغ تجريبي - مرفوض' },
      { status: 'Archived', type: 'Pavement', subType: 'رصيف غير مستوٍ', extraDetails: { length: 10 }, note: 'بلاغ تجريبي - مؤرشف' },
    ];

    try {
      const region = profile?.municipality || profile?.district || profile?.province || 'المدية';
      const district = profile?.district || 'المدية';
      const municipality = profile?.municipality || 'المدية';
      const province = profile?.province || 'المدية';

      for (const report of testReports) {
        const serialNumber = await getNextSerialNumber();
        await addDoc(collection(db, 'reports'), {
          ...report,
          citizenUid: testCitizenUid,
          serialNumber,
          targetEntity: profile?.entity || 'Municipality',
          photoUrl: 'https://picsum.photos/seed/' + report.status + '/800/600',
          location: { lat: 36.2648 + (Math.random() - 0.5) * 0.1, lng: 2.7539 + (Math.random() - 0.5) * 0.1 },
          region: region,
          district: district,
          municipality: municipality,
          province: province,
          severity: 'Medium',
          urgency: 'Medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      toast.success('تم إنشاء 10 بلاغات تجريبية بنجاح تغطي جميع المراحل');
    } catch (error) {
      console.error("AuthorityDashboard: Error generating test data:", error);
      toast.error('فشل إنشاء البيانات التجريبية');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!profile) return;

    // Fetch reports based on authority level and status
    let q;
    const entityFilter = profile.entity || 'Municipality';
    
    // Fetch all reports for the entity/region to handle active and archived locally
    if (profile.municipality) {
      q = query(
        collection(db, 'reports'),
        where('targetEntity', '==', entityFilter),
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
          where('targetEntity', '==', entityFilter),
          where('district', 'in', districts),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'reports'),
          where('targetEntity', '==', entityFilter),
          where('province', '==', profile.province || 'المدية'),
          orderBy('createdAt', 'desc')
        );
      }
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort: Urgent first, then oldest by date
      const sortedReports = fetchedReports.sort((a: any, b: any) => {
        if (a.urgency === 'Urgent' && b.urgency !== 'Urgent') return -1;
        if (a.urgency !== 'Urgent' && b.urgency === 'Urgent') return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
      setReports(sortedReports);
      setLoading(false);
    }, (error) => {
      console.error("AuthorityDashboard: Error fetching reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    // Fetch monthly reports
    let mq = query(collection(db, 'monthly_reports'), orderBy('sentAt', 'desc'));
    if (profile.district) {
      mq = query(mq, where('region', '==', profile.district));
    } else if (profile.municipality) {
      mq = query(mq, where('region', '==', profile.district || '')); // Usually district manager sends to district authority
    }
    const unsubMonthly = onSnapshot(mq, (snapshot) => {
      setMonthlyReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("AuthorityDashboard: Error fetching monthly reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'monthly_reports');
    });

    // Fetch contractors
    const qContractors = query(collection(db, 'users'), where('role', '==', 'Contractor'));
    const unsubContractors = onSnapshot(qContractors, (snapshot) => {
      setContractors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("AuthorityDashboard: Error fetching contractors snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsub();
      unsubMonthly();
      unsubContractors();
    };
  }, [profile]);

  const handleSetPrice = async () => {
    if (!selectedReport || !selectedContractor) return;
    try {
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'Negotiating',
        finalPrice,
        contractorUid: selectedContractor,
        authorityUid: auth.currentUser?.uid,
        contractorResponse: null,
        updatedAt: new Date().toISOString()
      });
      toast.success('تم إرسال السعر للمقاول');
      setSelectedReport(null);
    } catch (error) {
      toast.error('فشل العملية');
    }
  };

  const ARCHIVED_STATUSES = ['Repaired', 'Verified', 'Completed', 'Rejected', 'False', 'Archived'];
  const archiveReports = reports.filter(r => ARCHIVED_STATUSES.includes(r.status));
  const activeReports = reports.filter(r => !ARCHIVED_STATUSES.includes(r.status));

  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<string>('all');

  const issuePermit = async () => {
    if (!selectedReport || !permitFile) {
      toast.error('يرجى اختيار ملف الترخيص (PDF)');
      return;
    }
    
    setUploadingPermit(true);
    try {
      const storageRef = ref(storage, `permits/${selectedReport.id}_${Date.now()}.pdf`);
      const snapshot = await uploadBytes(storageRef, permitFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'Permitted',
        permitUrl: downloadURL,
        permitIssuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast.success('تم رفع الترخيص وإصدار تصريح العمل بنجاح');
      setSelectedReport(null);
      setPermitFile(null);
    } catch (error) {
      console.error("Error uploading permit:", error);
      toast.error('فشل رفع الترخيص');
    } finally {
      setUploadingPermit(false);
    }
  };

  const similarReports = selectedReport ? reports.filter(r => 
    r.id !== selectedReport.id && 
    r.type === selectedReport.type &&
    calculateDistance(r.location.lat, r.location.lng, selectedReport.location.lat, selectedReport.location.lng) < 0.05 // 50 meters
  ) : [];

  const escalateReport = async (reportId: string, to: 'District' | 'Province') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        escalatedTo: to,
        escalationTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.info(`تم تصعيد البلاغ إلى ${to === 'District' ? 'الدائرة' : 'الولاية'}`);
    } catch (error) {
      toast.error('فشل التصعيد');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'Authority']} ({profile?.municipality || profile?.district || profile?.province || 'مسؤول حكومي'})</p>
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
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'overview' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Dashboard className="w-5 h-5" />
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'reports' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Reports className="w-5 h-5" />
            إدارة البلاغات
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'archive' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Archive className="w-5 h-5" />
            الأرشيف
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'monthly' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Report className="w-5 h-5" />
            التقارير الشهرية
          </button>
          <button
            onClick={() => setActiveTab('coordination')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'coordination' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Briefcase className="w-5 h-5" />
            التنسيق الذكي
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'tools' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Settings className="w-5 h-5" />
            أدوات الاختبار
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'profile' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.User className="w-5 h-5" />
            الملف الشخصي
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'map' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Location className="w-5 h-5" />
            الخريطة
          </button>
        </div>

        {activeTab === 'profile' ? (
          <Profile />
        ) : activeTab === 'map' ? (
          <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Icons.Location className="w-5 h-5 text-brand-primary" />
                خريطة البلاغات الشاملة
              </h3>
              <p className="text-sm text-slate-500">عرض كافة البلاغات في منطقتك بمختلف حالاتها</p>
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
        ) : activeTab === 'monthly' ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">التقارير الشهرية المستلمة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {monthlyReports.length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-3xl text-center text-slate-400 border border-dashed border-slate-200">
                  <Icons.Report className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد تقارير شهرية مستلمة حالياً</p>
                </div>
              ) : (
                monthlyReports.map((report) => (
                  <div key={report.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-blue-50 p-3 rounded-2xl">
                        <Icons.Report className="w-6 h-6 text-blue-600" />
                      </div>
                      <span className="text-xs text-slate-400">{new Date(report.sentAt).toLocaleDateString('ar-DZ')}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">تقرير شهر {report.month}</h3>
                    <p className="text-sm text-slate-500 mb-4">المنطقة: {report.region}</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-slate-50 p-3 rounded-2xl">
                        <p className="text-[10px] text-slate-400">إجمالي البلاغات</p>
                        <p className="text-lg font-bold text-slate-900">{report.stats.total}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-2xl">
                        <p className="text-[10px] text-green-400">تم إصلاحها</p>
                        <p className="text-lg font-bold text-green-600">{report.stats.repaired}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">إجمالي البلاغات النشطة</p>
              <h3 className="text-3xl font-bold text-gray-900">{reports.length}</h3>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 w-2/3" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">بلاغات قيد الإصلاح</p>
              <h3 className="text-3xl font-bold text-gray-900">{reports.filter(r => r.status === 'Repairing').length}</h3>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 w-1/3" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 mb-1">بلاغات مكتملة (Verified)</p>
              <h3 className="text-3xl font-bold text-gray-900">{reports.filter(r => r.status === 'Verified').length}</h3>
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 w-1/2" />
              </div>
            </div>
          </div>
        ) : activeTab === 'coordination' ? (
          <div className="animate-slide-up">
            <CoordinatorDashboard />
          </div>
        ) : activeTab === 'tools' ? (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Icons.Settings className="w-6 h-6 text-blue-600" />
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
        ) : activeTab === 'reports' ? (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button
                onClick={() => setReportSubTab('new')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  reportSubTab === 'new' ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                بلاغات جديدة ({activeReports.filter(r => r.status === 'New').length})
              </button>
              <button
                onClick={() => setReportSubTab('inspected')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  reportSubTab === 'inspected' ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                تمت معاينتها ({activeReports.filter(r => ['Inspected', 'Pricing', 'Negotiating', 'Permitted'].includes(r.status)).length})
              </button>
              <button
                onClick={() => setReportSubTab('repairing')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  reportSubTab === 'repairing' ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                قيد الإصلاح ({activeReports.filter(r => r.status === 'Repairing').length})
              </button>
              <button
                onClick={() => setReportSubTab('repaired')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  reportSubTab === 'repaired' ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                تم إصلاحها ({reports.filter(r => r.status === 'Repaired').length})
              </button>
              <button
                onClick={() => setReportSubTab('false')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  reportSubTab === 'false' ? "bg-red-100 text-red-700" : "bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                بلاغات كاذبة ({reports.filter(r => r.status === 'False').length})
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className={cn("lg:col-span-1 space-y-4", selectedReport && "hidden lg:block")}>
                {activeReports.filter(r => {
                  if (reportSubTab === 'new') return r.status === 'New';
                  if (reportSubTab === 'inspected') return ['Inspected', 'Pricing', 'Negotiating', 'Permitted'].includes(r.status);
                  if (reportSubTab === 'repairing') return r.status === 'Repairing';
                  if (reportSubTab === 'repaired') return r.status === 'Repaired';
                  if (reportSubTab === 'false') return r.status === 'False';
                  return false;
                }).length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl text-center text-gray-400 border border-dashed border-gray-200">
                    <Icons.Reports className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>لا توجد بلاغات نشطة في هذا القسم حالياً</p>
                  </div>
                ) : (
                  activeReports.filter(r => {
                    if (reportSubTab === 'new') return r.status === 'New';
                    if (reportSubTab === 'inspected') return ['Inspected', 'Pricing', 'Negotiating', 'Permitted'].includes(r.status);
                    if (reportSubTab === 'repairing') return r.status === 'Repairing';
                    if (reportSubTab === 'repaired') return r.status === 'Repaired';
                    if (reportSubTab === 'false') return r.status === 'False';
                    return false;
                  }).map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={cn(
                        "w-full bg-white p-4 rounded-3xl border transition-all text-right flex items-center gap-4 shadow-sm hover:shadow-md",
                        selectedReport?.id === report.id ? "border-blue-600 ring-2 ring-blue-50 shadow-lg" : "border-gray-100"
                      )}
                    >
                      <img src={report.photoUrl} className="w-16 h-16 rounded-2xl object-cover" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <p className="font-bold text-gray-900">
                              {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label || report.type}
                            </p>
                            <span className="text-[9px] font-mono font-bold text-gray-400">
                              {report.serialNumber || '---'}
                            </span>
                          </div>
                          {reports.filter(r => r.id !== report.id && r.type === report.type && calculateDistance(r.location.lat, r.location.lng, report.location.lat, report.location.lng) < 0.05).length > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-lg text-[8px] font-bold">
                              <Icons.Reports className="w-2 h-2" />
                              مكرر
                            </div>
                          )}
                        </div>
                        <div className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1", STATUS_COLORS[report.status as keyof typeof STATUS_COLORS])}>
                          {STATUS_LABELS[report.status as keyof typeof STATUS_LABELS]}
                        </div>
                      </div>
                      <Icons.Right className="w-5 h-5 text-gray-300" />
                    </button>
                  ))
                )}
              </div>

            <div className={cn("lg:col-span-2", !selectedReport && "hidden lg:block")} ref={detailsRef}>
              {selectedReport ? (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden sticky top-24">
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedReport(null)}
                          className="lg:hidden p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-all"
                        >
                          <Icons.Right className="w-6 h-6 rotate-180" />
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900">
                          <span className="block text-xs font-mono font-bold text-gray-400 mb-1">
                            {selectedReport.serialNumber || '---'}
                          </span>
                          تفاصيل البلاغ والتعاقد
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => escalateReport(selectedReport.id, 'District')}
                          className="p-2 hover:bg-orange-50 rounded-xl text-orange-600 transition-all"
                          title="تصعيد للدائرة"
                        >
                          <Icons.Escalate className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400">صورة البلاغ</p>
                            <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-slate-100">
                              <img src={selectedReport.photoUrl} className="w-full h-full object-cover" />
                            </div>
                          </div>
                          {selectedReport.landmarkPhotoUrl && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400">معالم المكان</p>
                              <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-slate-100">
                                <img src={selectedReport.landmarkPhotoUrl} className="w-full h-full object-cover" />
                              </div>
                            </div>
                          )}
                        </div>

                        {selectedReport.status === 'False' && (
                          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 space-y-4">
                            <h3 className="font-bold text-red-900 flex items-center gap-2">
                              <Icons.Delete className="w-5 h-5" />
                              سبب تصنيف البلاغ ككاذب
                            </h3>
                            <p className="text-sm text-red-800">{selectedReport.falseReason || 'لا يوجد تبرير مسجل'}</p>
                            
                            {selectedReport.falseEvidenceUrl && (
                              <div className="mt-4 space-y-2">
                                <p className="text-xs font-bold text-red-700">الدليل المرفق:</p>
                                {selectedReport.falseEvidenceType === 'video' ? (
                                  <video 
                                    src={selectedReport.falseEvidenceUrl} 
                                    controls 
                                    className="w-full rounded-xl border border-red-200"
                                  />
                                ) : (
                                  <img 
                                    src={selectedReport.falseEvidenceUrl} 
                                    className="w-full rounded-xl border border-red-200"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {similarReports.length > 0 && (
                          <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4">
                            <h3 className="font-bold text-orange-900 flex items-center gap-2">
                              <Icons.Reports className="w-5 h-5" />
                              بلاغات مشابهة في نفس الموقع ({similarReports.length})
                            </h3>
                            <p className="text-xs text-orange-700">تم رصد بلاغات أخرى لنفس المشكلة في هذا الموقع. يمكنك مراجعة صورهم وتفاصيلهم هنا.</p>
                            <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
                              {similarReports.map((r) => (
                                <button 
                                  key={r.id}
                                  onClick={() => setSelectedReport(r)}
                                  className="flex-shrink-0 w-32 bg-white p-2 rounded-2xl border border-orange-200 shadow-sm hover:shadow-md transition-all text-right"
                                >
                                  <img src={r.photoUrl} className="w-full h-20 rounded-xl object-cover mb-2" />
                                  <p className="text-[10px] font-bold text-gray-900 truncate">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                                  <div className={cn("text-[8px] px-1 rounded-full inline-block mt-1", STATUS_COLORS[r.status as keyof typeof STATUS_COLORS])}>
                                    {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {selectedReport.inspectionDetails && (
                          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-4">
                            <h3 className="font-bold text-blue-900 flex items-center gap-2">
                              <Icons.Reports className="w-5 h-5" />
                              تفاصيل المعاينة الميدانية
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] text-blue-400">التكلفة المقترحة</p>
                                <p className="font-bold text-blue-700">{selectedReport.inspectionDetails.price.toLocaleString()} دج</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-blue-400">المقترح</p>
                                <p className="font-bold text-blue-700">{selectedReport.inspectionDetails.proposal}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-400">ملاحظات</p>
                              <p className="text-sm text-blue-800">{selectedReport.inspectionDetails.note}</p>
                            </div>
                            {selectedReport.inspectionDetails.photos?.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto py-2">
                                {selectedReport.inspectionDetails.photos.map((url: string, i: number) => (
                                  <img key={i} src={url} className="w-20 h-20 rounded-xl object-cover border border-blue-200" />
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {selectedReport.repairDetails && (
                          <div className="bg-green-50 p-6 rounded-3xl border border-green-100 space-y-4">
                            <h3 className="font-bold text-green-900 flex items-center gap-2">
                              <Icons.Check className="w-5 h-5" />
                              تفاصيل الإصلاح (المقاول)
                            </h3>
                            <p className="text-sm text-green-800">{selectedReport.repairDetails.note}</p>
                            {selectedReport.repairDetails.photos?.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto py-2">
                                {selectedReport.repairDetails.photos.map((url: string, i: number) => (
                                  <img key={i} src={url} className="w-20 h-20 rounded-xl object-cover border border-green-200" />
                                ))}
                              </div>
                            )}
                            {selectedReport.repairDetails.videos?.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto py-2">
                                {selectedReport.repairDetails.videos.map((url: string, i: number) => (
                                  <video key={i} src={url} className="w-40 h-24 rounded-xl object-cover border border-green-200" controls />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        {selectedReport.status === 'New' ? (
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                            <Icons.Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-900 font-bold">في انتظار معاينة فريق المراقبة</p>
                          </div>
                        ) : selectedReport.status === 'Inspected' || selectedReport.status === 'Pricing' || selectedReport.status === 'Negotiating' ? (
                          <>
                            <div className="space-y-2">
                              <label className="block text-sm font-bold text-gray-700">المقاول المكلف (تلقائي):</label>
                              <select 
                                value={selectedContractor}
                                onChange={(e) => setSelectedContractor(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50 font-bold"
                              >
                                <option value="">اختر مقاولاً...</option>
                                {contractors.map(c => (
                                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                ))}
                              </select>
                              {selectedContractor && (
                                <p className="text-[10px] text-blue-600 font-bold">تم اختيار المقاول بناءً على تغطية المنطقة.</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-bold text-gray-700">السعر النهائي المعتمد (دج):</label>
                              <div className="relative">
                                <Icons.Price className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                  type="number"
                                  value={finalPrice}
                                  onChange={(e) => setFinalPrice(Number(e.target.value))}
                                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                            <button
                              onClick={handleSetPrice}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all"
                            >
                              إرسال للمقاول وبدء التفاوض
                            </button>

                            {selectedReport.status === 'Negotiating' && selectedReport.contractorResponse === 'Accepted' && (
                              <div className="mt-8 p-6 bg-green-50 rounded-3xl border border-green-100 space-y-4">
                                <h3 className="font-bold text-green-900 flex items-center gap-2">
                                  <Icons.Check className="w-5 h-5" />
                                  المقاول قبل السعر - بانتظار الترخيص
                                </h3>
                                <p className="text-sm text-green-700">يرجى رفع ملف الترخيص (PDF) لإتمام العملية.</p>
                                
                                <input 
                                  type="file" 
                                  accept=".pdf"
                                  ref={fileInputRef}
                                  onChange={(e) => setPermitFile(e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                                
                                <button
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-green-300 text-green-700 font-bold hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                                >
                                  {permitFile ? (
                                    <>
                                      <Icons.Check className="w-5 h-5" />
                                      {permitFile.name}
                                    </>
                                  ) : (
                                    <>
                                      <Icons.Add className="w-5 h-5" />
                                      اختر ملف PDF للترخيص
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={issuePermit}
                                  disabled={!permitFile || uploadingPermit}
                                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-200 transition-all flex items-center justify-center gap-2"
                                >
                                  {uploadingPermit ? (
                                    <>
                                      <Icons.Clock className="w-5 h-5 animate-spin" />
                                      جاري الرفع...
                                    </>
                                  ) : (
                                    <>
                                      <Icons.Permit className="w-5 h-5" />
                                      إصدار الترخيص النهائي
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </>
                        ) : selectedReport.status === 'Permitted' ? (
                          <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                            <div className="flex items-center gap-3 mb-4">
                              <Icons.Permit className="w-8 h-8 text-green-600" />
                              <h3 className="font-bold text-green-900">تم إصدار التصريح</h3>
                            </div>
                            <p className="text-sm text-green-800 mb-6">تم رفع ملف الترخيص. في انتظار بدء المقاول لعملية الإصلاح.</p>
                            {selectedReport.permitUrl && (
                              <a 
                                href={selectedReport.permitUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-green-200 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-all mb-4"
                              >
                                <Icons.Report className="w-5 h-5" />
                                عرض ملف الترخيص
                              </a>
                            )}
                          </div>
                        ) : selectedReport.status === 'Repairing' ? (
                          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                            <Icons.Clock className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                            <p className="text-indigo-900 font-bold">البلاغ قيد الإصلاح حالياً</p>
                            <p className="text-xs text-indigo-600 mt-2">المقاول: {contractors.find(c => c.id === selectedReport.contractorUid)?.name || 'غير محدد'}</p>
                          </div>
                        ) : selectedReport.status === 'Repaired' ? (
                          <div className="space-y-4">
                            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                              <h3 className="font-bold text-emerald-900 mb-2">تم الانتهاء من الإصلاح</h3>
                              <p className="text-sm text-emerald-800">في انتظار التحقق النهائي من فريق المراقبة أو اتخاذ قرار مباشر.</p>
                            </div>
                            <div className="flex gap-4">
                              <button
                                onClick={() => updateDoc(doc(db, 'reports', selectedReport.id), { status: 'Verified', updatedAt: new Date().toISOString() })}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 transition-all"
                              >
                                قبول نهائي
                              </button>
                              <button
                                onClick={() => updateDoc(doc(db, 'reports', selectedReport.id), { status: 'Rejected', updatedAt: new Date().toISOString() })}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-red-200 transition-all"
                              >
                                رفض وإعادة
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                  <Icons.Reports className="w-20 h-20 mb-4 opacity-10" />
                  <p className="text-lg">اختر بلاغاً لمراجعته واتخاذ قرار</p>
                </div>
              )}
            </div>
          </div>
        </div>
        ) : activeTab === 'archive' ? (
          <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Icons.Archive className="w-5 h-5 text-brand-primary" />
                أرشيف البلاغات
              </h3>
              <p className="text-sm text-slate-500">البحث في كافة البلاغات المنتهية، المرفوضة، أو الكاذبة</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث في الأرشيف (رقم، نوع، بلدية...)"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
                />
              </div>
              <select
                value={archiveStatusFilter}
                onChange={(e) => setArchiveStatusFilter(e.target.value)}
                className="px-6 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-right"
              >
                <option value="all">كل الأرشيف</option>
                {ARCHIVED_STATUSES.map(status => (
                  <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">البلاغ</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">المنطقة</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">الحالة النهائية</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">تاريخ الأرشفة</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {archiveReports
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
                    <tr key={r.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={r.photoUrl} className="w-10 h-10 rounded-lg object-cover grayscale opacity-60" />
                          <div>
                            <p className="font-bold text-slate-900">{r.serialNumber || 'بدون رقم'}</p>
                            <p className="text-xs text-slate-400">
                              {Object.values(REPORT_TYPES).flat().find(t => t.id === r.type)?.label || r.type}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
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
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(r.updatedAt || r.createdAt).toLocaleDateString('ar-DZ')}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => { setSelectedReport(r); setActiveTab('reports'); }}
                          className="text-blue-600 hover:underline text-xs font-bold"
                        >
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                  {archiveReports.length === 0 && (
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
        ) : null}
      </main>
    </div>
  );
};
