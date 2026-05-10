import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { calculateDistance } from '../utils/geo';
import { toast } from 'sonner';
import { Profile } from './Profile';
import { CitizenMap } from './CitizenMap';

export const ContractorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'profile' | 'map'>('tasks');
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [counterPrice, setCounterPrice] = useState<number>(0);

  useEffect(() => {
    if (!profile) return;

    // Fetch reports assigned to this contractor
    const q = query(
      collection(db, 'reports'),
      where('contractorUid', '==', auth.currentUser?.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("ContractorDashboard: Error fetching reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return () => unsub();
  }, [profile]);

  const handleNegotiation = async (accepted: boolean) => {
    if (!selectedReport) return;
    try {
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: accepted ? 'Permitted' : 'Negotiating',
        contractorResponse: accepted ? 'Accepted' : 'Rejected',
        counterPrice: accepted ? selectedReport.finalPrice : counterPrice,
        updatedAt: new Date().toISOString()
      });
      toast.success(accepted ? 'تم قبول السعر. بانتظار تصريح العمل.' : 'تم إرسال السعر المقترح للبلدية');
      setSelectedReport(null);
    } catch (error) {
      toast.error('فشل العملية');
    }
  };

  const dispatchToMaintenance = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'Repairing',
        dispatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('تم إرسال المهمة لفريق الصيانة');
      setSelectedReport(null);
    } catch (error) {
      toast.error('فشل الإرسال');
    }
  };

  const similarReports = selectedReport ? reports.filter(r => 
    r.id !== selectedReport.id && 
    r.type === selectedReport.type &&
    calculateDistance(r.location.lat, r.location.lng, selectedReport.location.lat, selectedReport.location.lng) < 0.05 // 50 meters
  ) : [];

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'Contractor']}</p>
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
            onClick={() => setActiveTab('tasks')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'tasks' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Contractor className="w-5 h-5" />
            طلبات الصيانة
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
        </div>

        {activeTab === 'profile' ? (
          <Profile />
        ) : activeTab === 'map' ? (
          <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Icons.Location className="w-5 h-5 text-brand-primary" />
                خريطة طلبات الصيانة
              </h3>
              <p className="text-sm text-slate-500">عرض البلاغات المقبولة للصيانة فقط</p>
            </div>
            
            <CitizenMap 
              reports={reports.filter(r => ['Permitted', 'Repairing'].includes(r.status))} 
              onReportClick={(report) => {
                setSelectedReport(report);
                setActiveTab('tasks');
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">طلبات الصيانة</h2>
            {reports.length === 0 && (
              <div className="bg-white p-12 rounded-3xl text-center text-gray-400 border border-dashed border-gray-200">
                <Icons.Contractor className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>لا توجد طلبات حالياً</p>
              </div>
            )}
            {reports.map((report) => (
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
                        {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label}
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
            ))}
          </div>

          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden sticky top-24">
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <span className="text-xs font-mono font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md mb-1 inline-block">
                        {selectedReport.serialNumber || 'بدون رقم تسلسلي'}
                      </span>
                      <h2 className="text-2xl font-bold text-gray-900">تفاصيل الطلب والتعاقد</h2>
                    </div>
                    <div className={cn("px-4 py-2 rounded-xl text-sm font-bold", STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS])}>
                      {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                      <div className="aspect-video rounded-2xl overflow-hidden bg-gray-100">
                        <img src={selectedReport.photoUrl} className="w-full h-full object-cover" />
                      </div>

                      {similarReports.length > 0 && (
                        <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 space-y-4">
                          <h3 className="font-bold text-orange-900 flex items-center gap-2 text-sm">
                            <Icons.Reports className="w-4 h-4" />
                            بلاغات مشابهة في نفس الموقع ({similarReports.length})
                          </h3>
                          <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
                            {similarReports.map((r) => (
                              <button 
                                key={r.id}
                                onClick={() => setSelectedReport(r)}
                                className="flex-shrink-0 w-28 bg-white p-2 rounded-2xl border border-orange-200 shadow-sm hover:shadow-md transition-all text-right"
                              >
                                <img src={r.photoUrl} className="w-full h-16 rounded-xl object-cover mb-2" />
                                <p className="text-[8px] font-bold text-gray-900 truncate">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</p>
                                <div className={cn("text-[7px] px-1 rounded-full inline-block mt-1", STATUS_COLORS[r.status as keyof typeof STATUS_COLORS])}>
                                  {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {selectedReport.inspectionDetails && (
                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 space-y-4">
                          <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                            <Icons.Reports className="w-4 h-4" />
                            تقرير المعاينة الميدانية
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-blue-400">المقترح</p>
                              <p className="font-bold text-blue-700 text-sm">{selectedReport.inspectionDetails.proposal}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-blue-400">التكلفة المقدرة</p>
                              <p className="font-bold text-blue-700 text-sm">{selectedReport.inspectionDetails.price.toLocaleString()} دج</p>
                            </div>
                          </div>
                          {selectedReport.inspectionDetails.photos?.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto py-2">
                              {selectedReport.inspectionDetails.photos.map((url: string, i: number) => (
                                <img key={i} src={url} className="w-16 h-16 rounded-xl object-cover border border-blue-200" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100 text-white">
                        <p className="text-xs opacity-70 mb-1">السعر المعروض من السلطة:</p>
                        <p className="text-3xl font-bold">{selectedReport.finalPrice?.toLocaleString()} دج</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {selectedReport.status === 'Negotiating' ? (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">سعر مقترح (في حال الرفض):</label>
                            <div className="relative">
                              <Icons.Price className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                              <input
                                type="number"
                                value={counterPrice}
                                onChange={(e) => setCounterPrice(Number(e.target.value))}
                                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={() => handleNegotiation(true)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-200 transition-all"
                            >
                              قبول السعر
                            </button>
                            <button
                              onClick={() => handleNegotiation(false)}
                              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-orange-200 transition-all"
                            >
                              إرسال سعر مضاد
                            </button>
                          </div>
                        </div>
                      ) : selectedReport.status === 'Permitted' ? (
                        <div className="space-y-6">
                          <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
                            <div className="flex items-center gap-3 mb-4">
                              <Icons.Permit className="w-8 h-8 text-green-600" />
                              <h3 className="font-bold text-green-900">تم استلام التصريح</h3>
                            </div>
                            <p className="text-sm text-green-800 mb-6">يمكنك الآن مراجعة ملف الترخيص وإرسال المهمة لفريق الصيانة.</p>
                            
                            {selectedReport.permitUrl ? (
                              <a 
                                href={selectedReport.permitUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-green-200 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-all mb-4"
                              >
                                <Icons.Report className="w-5 h-5" />
                                عرض ملف الترخيص (PDF)
                              </a>
                            ) : (
                              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-orange-700 text-sm mb-4">
                                بانتظار رفع ملف الترخيص من قبل البلدية...
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => dispatchToMaintenance(selectedReport.id)}
                            disabled={!selectedReport.permitUrl}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Icons.Maintenance className="w-5 h-5" />
                            إرسال لفريق الصيانة
                          </button>
                        </div>
                      ) : selectedReport.status === 'Repairing' || selectedReport.status === 'Repaired' || selectedReport.status === 'Verified' ? (
                        <div className="space-y-6">
                          {selectedReport.repairDetails && (
                            <div className="bg-green-50 p-6 rounded-3xl border border-green-100 space-y-4">
                              <h3 className="font-bold text-green-900 flex items-center gap-2">
                                <Icons.Check className="w-5 h-5" />
                                تفاصيل الإصلاح المنجز
                              </h3>
                              <p className="text-sm text-green-800">{selectedReport.repairDetails.note}</p>
                              
                              {selectedReport.repairDetails.photos?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-green-600 font-bold">الصور التوثيقية:</p>
                                  <div className="flex gap-2 overflow-x-auto py-2">
                                    {selectedReport.repairDetails.photos.map((url: string, i: number) => (
                                      <img key={i} src={url} className="w-20 h-20 rounded-xl object-cover border border-green-200" />
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {selectedReport.repairDetails.videos?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-green-600 font-bold">الفيديوهات التوثيقية:</p>
                                  <div className="flex gap-2 overflow-x-auto py-2">
                                    {selectedReport.repairDetails.videos.map((url: string, i: number) => (
                                      <video key={i} src={url} className="w-40 h-24 rounded-xl object-cover border border-green-200" controls />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="bg-gray-50 p-8 rounded-3xl text-center">
                            <Icons.Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">المهمة في مرحلة {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-8 rounded-3xl text-center">
                          <Icons.Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">المهمة قيد التنفيذ أو المراجعة</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <Icons.Contractor className="w-20 h-20 mb-4 opacity-10" />
                <p className="text-lg">اختر طلباً لمراجعته أو البدء في تنفيذه</p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
};
