import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { toast } from 'sonner';
import { Profile } from './Profile';

export const BranchManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'profile' | 'tools'>('overview');
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const detailsRef = React.useRef<HTMLDivElement>(null);

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
      const region = profile?.region || 'المدية';
      const district = profile?.district || 'المدية';
      const municipality = profile?.municipality || 'المدية';
      const province = profile?.province || 'المدية';

      for (const report of testReports) {
        await addDoc(collection(db, 'reports'), {
          ...report,
          citizenUid: testCitizenUid,
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
      console.error("BranchManagerDashboard: Error generating test data:", error);
      toast.error('فشل إنشاء البيانات التجريبية');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (!profile) return;

    // Fetch reports for this branch region
    const entityFilter = profile.entity || 'Municipality';
    const qReports = query(
      collection(db, 'reports'),
      where('targetEntity', '==', entityFilter),
      where('region', '==', profile.region || ''),
      orderBy('createdAt', 'desc')
    );
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("BranchManagerDashboard: Error fetching reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    // Fetch teams (Inspection and Maintenance) in this region
    const qTeams = query(
      collection(db, 'users'),
      where('region', '==', profile.region || ''),
      where('role', 'in', ['Inspection', 'Maintenance'])
    );
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("BranchManagerDashboard: Error fetching teams snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubReports();
      unsubTeams();
    };
  }, [profile]);

  const sendMonthlyReport = async () => {
    try {
      const summary = {
        total: reports.length,
        completed: reports.filter(r => r.status === 'Verified').length,
        pending: reports.filter(r => r.status === 'New').length,
        inProgress: reports.filter(r => r.status === 'Repairing').length,
        month: new Date().toLocaleString('ar-DZ', { month: 'long' }),
        year: new Date().getFullYear(),
        region: profile?.region,
        branchManager: profile?.name
      };

      // In a real app, this would send an email or create a notification for Authority users
      await addDoc(collection(db, 'monthly_reports'), {
        ...summary,
        createdAt: new Date().toISOString()
      });

      toast.success('تم إرسال التقرير الشهري للبلدية والدائرة والولاية');
    } catch (error) {
      toast.error('فشل إرسال التقرير');
    }
  };

  const stats = {
    total: reports.length,
    new: reports.filter(r => r.status === 'New').length,
    pricing: reports.filter(r => r.status === 'Pricing').length,
    permitted: reports.filter(r => r.status === 'Permitted').length,
    repairing: reports.filter(r => r.status === 'Repairing').length,
    repaired: reports.filter(r => r.status === 'Repaired').length,
    verified: reports.filter(r => r.status === 'Verified').length,
    rejected: reports.filter(r => r.status === 'Rejected').length,
  };

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredReports = statusFilter === 'all' 
    ? reports 
    : reports.filter(r => r.status === statusFilter);

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'BranchManager']} ({profile?.region || 'بدون منطقة'})</p>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
          >
            <Icons.Logout className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex gap-2 p-1 bg-white rounded-2xl border border-slate-200 w-full md:w-fit overflow-x-auto scrollbar-hide whitespace-nowrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shrink-0",
                activeTab === 'overview' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icons.Dashboard className="w-4 h-4" />
              نظرة عامة
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shrink-0",
                activeTab === 'teams' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icons.Users className="w-4 h-4" />
              فرق العمل
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shrink-0",
                activeTab === 'tools' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icons.Settings className="w-4 h-4" />
              أدوات الاختبار
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shrink-0",
                activeTab === 'profile' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icons.User className="w-4 h-4" />
              الملف الشخصي
            </button>
          </div>
          <button
            onClick={sendMonthlyReport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 text-sm"
          >
            <Icons.Reports className="w-5 h-5" />
            إرسال التقرير الشهري
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 mb-1">الإجمالي</p>
                <p className="text-xl font-black text-slate-900">{stats.total}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-blue-500 mb-1">جديد</p>
                <p className="text-xl font-black text-blue-600">{stats.new}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-amber-500 mb-1">قيد التقييم</p>
                <p className="text-xl font-black text-amber-600">{stats.pricing}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-indigo-500 mb-1">مرخص</p>
                <p className="text-xl font-black text-indigo-600">{stats.permitted}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-orange-500 mb-1">قيد الإصلاح</p>
                <p className="text-xl font-black text-orange-600">{stats.repairing}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-teal-500 mb-1">تم الإصلاح</p>
                <p className="text-xl font-black text-teal-600">{stats.repaired}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-500 mb-1">مكتمل</p>
                <p className="text-xl font-black text-emerald-600">{stats.verified}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold text-rose-500 mb-1">مرفوض</p>
                <p className="text-xl font-black text-rose-600">{stats.rejected}</p>
              </div>
            </div>

            {/* Filters and List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className={cn("lg:col-span-1 space-y-6", selectedReport && "hidden lg:block")}>
                <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                      statusFilter === 'all' ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                    )}
                  >
                    الكل
                  </button>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                        statusFilter === key ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredReports.length === 0 ? (
                  <div className="bg-white p-20 rounded-3xl text-center border border-dashed border-slate-200">
                    <Icons.Reports className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400 font-bold text-lg">لا توجد بلاغات في هذا التصنيف</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={cn(
                          "w-full bg-white rounded-3xl overflow-hidden shadow-sm border transition-all text-right flex items-center gap-4 p-4 hover:shadow-md",
                          selectedReport?.id === report.id ? "border-blue-600 ring-2 ring-blue-50 shadow-lg" : "border-slate-100"
                        )}
                      >
                        <img src={report.photoUrl} className="w-16 h-16 rounded-2xl object-cover" />
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">
                            {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label || report.type}
                          </p>
                          <div className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1", STATUS_COLORS[report.status as keyof typeof STATUS_COLORS])}>
                            {STATUS_LABELS[report.status as keyof typeof STATUS_LABELS]}
                          </div>
                        </div>
                        <Icons.Right className="w-5 h-5 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={cn("lg:col-span-2", !selectedReport && "hidden lg:block")} ref={detailsRef}>
                {selectedReport ? (
                  <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden sticky top-24">
                    <div className="p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setSelectedReport(null)}
                            className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"
                          >
                            <Icons.Right className="w-6 h-6 rotate-180" />
                          </button>
                          <h2 className="text-2xl font-bold text-slate-900">تفاصيل البلاغ</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Icons.Clock className="w-4 h-4" />
                          {new Date(selectedReport.createdAt).toLocaleDateString('ar-DZ')}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="aspect-video rounded-3xl overflow-hidden bg-slate-100">
                            <img src={selectedReport.photoUrl} className="w-full h-full object-cover" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                              <p className="text-[10px] text-slate-400 mb-1">البلدية</p>
                              <p className="font-bold text-slate-700">{selectedReport.municipality}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                              <p className="text-[10px] text-slate-400 mb-1">الحالة</p>
                              <div className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS])}>
                                {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          {selectedReport.subType && (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                              <p className="text-[10px] text-blue-600 font-bold mb-1">النوع التفصيلي</p>
                              <p className="font-bold text-slate-800">{selectedReport.subType}</p>
                            </div>
                          )}

                          {selectedReport.extraDetails && Object.keys(selectedReport.extraDetails).length > 0 && (
                            <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                              <p className="text-[10px] text-slate-400 border-b border-slate-200 pb-1">تفاصيل إضافية</p>
                              <div className="grid grid-cols-1 gap-2">
                                {Object.entries(selectedReport.extraDetails).map(([key, value]) => {
                                  const field = (Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type) as any)?.extraFields?.find((f: any) => f.id === key);
                                  return (
                                    <div key={key} className="flex justify-between items-center text-sm">
                                      <span className="text-slate-500">{field?.label || key}:</span>
                                      <span className="font-bold text-slate-800">{String(value)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="bg-slate-50 p-4 rounded-2xl">
                            <p className="text-[10px] text-slate-400 mb-1">الملاحظات</p>
                            <p className="text-slate-700 text-sm leading-relaxed">{selectedReport.note || 'لا توجد ملاحظات'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                    <Icons.Reports className="w-20 h-20 mb-4 opacity-10" />
                    <p className="text-lg">اختر بلاغاً من القائمة لمراجعة تفاصيله</p>
                  </div>
                )}
              </div>
            </div>
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
        ) : activeTab === 'teams' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Icons.Search className="w-5 h-5" />
                  فرق المعاينة والمراقبة
                </h2>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {teams.filter(t => t.role === 'Inspection').length} فريق
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {teams.filter(t => t.role === 'Inspection').length === 0 ? (
                  <div className="p-12 text-center text-slate-400">لا توجد فرق معاينة مسجلة في هذه المنطقة</div>
                ) : (
                  teams.filter(t => t.role === 'Inspection').map(t => (
                    <div key={t.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-bold text-xl">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{t.name} {t.surname}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Icons.Phone className="w-3 h-3" />
                            {t.phoneNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-bold">متصل الآن</span>
                        <p className="text-[10px] text-slate-400">{t.municipality}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-orange-500 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Icons.Maintenance className="w-5 h-5" />
                  فرق الصيانة الميدانية
                </h2>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {teams.filter(t => t.role === 'Maintenance').length} فريق
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {teams.filter(t => t.role === 'Maintenance').length === 0 ? (
                  <div className="p-12 text-center text-slate-400">لا توجد فرق صيانة مسجلة في هذه المنطقة</div>
                ) : (
                  teams.filter(t => t.role === 'Maintenance').map(t => (
                    <div key={t.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-bold text-xl">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{t.name} {t.surname}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Icons.Phone className="w-3 h-3" />
                            {t.phoneNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-bold">جاهز للعمل</span>
                        <p className="text-[10px] text-slate-400">{t.municipality}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <Profile />
        )}
      </main>
    </div>
  );
};
