import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { toast } from 'sonner';
import { Profile } from './Profile';
import { CitizenMap } from './CitizenMap';
import NavigationHUD from './NavigationHUD';
import { calculateDistance, formatDistance } from '../utils/geo';

import { MapPicker } from './MapPicker';

export const MaintenanceDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'profile' | 'map'>('tasks');
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [repairPhotos, setRepairPhotos] = useState<string[]>([]);
  const [repairVideos, setRepairVideos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [recalculateKey, setRecalculateKey] = useState(0);
  const [navigationData, setNavigationData] = useState({
    instruction: '',
    distance: '',
    eta: '',
    totalDistance: ''
  });

  const similarReports = selectedReport ? reports.filter(r => 
    r.id !== selectedReport.id && 
    r.type === selectedReport.type &&
    calculateDistance(r.location.lat, r.location.lng, selectedReport.location.lat, selectedReport.location.lng) < 0.05 // 50 meters
  ) : [];

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCurrentLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('MaintenanceDashboard: Geolocation error', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleNavigate = () => {
    if (!selectedReport) return;
    const { lat, lng } = selectedReport.location;
    
    if (currentLocation) {
      setIsNavigating(true);
      toast.success('تم تفعيل وضع الملاحة');
    } else {
      toast.info('جاري تحديد موقعك الحالي لبدء الملاحة...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
          setIsNavigating(true);
          toast.success('تم تفعيل وضع الملاحة');
        },
        (err) => {
          console.warn('Could not get current location for navigation origin', err);
          const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
          window.open(googleUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleRouteFound = (route: any) => {
    if (route.instructions && route.instructions.length > 0) {
      const nextStep = route.instructions[0];
      setNavigationData({
        instruction: nextStep.text,
        distance: `${Math.round(nextStep.distance)} م`,
        eta: `${Math.round(route.summary.totalTime / 60)}`,
        totalDistance: `${(route.summary.totalDistance / 1000).toFixed(1)}`
      });
    }
  };

  useEffect(() => {
    if (!profile) return;

    const districts = profile.districts && profile.districts.length > 0 
      ? profile.districts 
      : [profile.region || profile.district || ''];
    
    const entityFilter = profile.entity || 'Municipality';
    console.log('Maintenance Query:', { districts, entityFilter });

    // Fetch reports assigned to maintenance
    // Note: Firestore only allows one 'in' operator per query.
    // We filter by region and then filter status client-side if needed, 
    // or just fetch all and filter client-side.
    const q = query(
      collection(db, 'reports'),
      where('targetEntity', '==', entityFilter),
      where('region', 'in', districts),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = allReports.filter((r: any) => 
        ['Permitted', 'Repairing', 'Rejected'].includes(r.status)
      );
      
      // Sort: Urgent first, then oldest by date
      const sortedReports = filtered.sort((a: any, b: any) => {
        if (a.urgency === 'Urgent' && b.urgency !== 'Urgent') return -1;
        if (a.urgency !== 'Urgent' && b.urgency === 'Urgent') return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
      setReports(sortedReports);
      setLoading(false);
    }, (error) => {
      console.error("MaintenanceDashboard: Error fetching reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return () => unsub();
  }, [profile]);

  const startRepair = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'Repairing',
        repairStartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.info('تم بدء عملية الإصلاح');
    } catch (error) {
      toast.error('فشل العملية');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `repairs/${selectedReport.id}/${type}_${Date.now()}_${i}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        newUrls.push(url);
      }
      
      if (type === 'photo') {
        setRepairPhotos(prev => [...prev, ...newUrls]);
      } else {
        setRepairVideos(prev => [...prev, ...newUrls]);
      }
      toast.success('تم رفع الملفات بنجاح');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الملفات');
    } finally {
      setUploading(false);
    }
  };

  const completeRepair = async () => {
    if (!selectedReport) return;
    
    if (repairPhotos.length === 0) {
      toast.error('يجب إرفاق صورة واحدة على الأقل لتوثيق الإصلاح');
      return;
    }
    if (repairVideos.length === 0) {
      toast.error('يجب إرفاق فيديو واحد على الأقل لتوثيق الإصلاح');
      return;
    }
    if (!note.trim()) {
      toast.error('يرجى كتابة تفاصيل عملية الإصلاح');
      return;
    }

    try {
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'Repaired',
        repairDetails: {
          photos: repairPhotos,
          videos: repairVideos,
          note: note,
          documents: []
        },
        repairEndedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('تم إكمال الإصلاح وإرساله للمعاينة');
      setSelectedReport(null);
      setNote('');
      setRepairPhotos([]);
      setRepairVideos([]);
    } catch (error) {
      toast.error('فشل إرسال التقرير');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      {/* Full Screen Navigation Overlay */}
      {isNavigating && selectedReport && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          <div className="relative flex-1">
            <MapPicker 
              initialLocation={selectedReport.location} 
              readOnly={true} 
              showUserLocation={true}
              className="rounded-none border-none h-full"
              routing={currentLocation ? {
                origin: currentLocation,
                destination: [selectedReport.location.lat, selectedReport.location.lng],
                onRouteFound: handleRouteFound,
                key: recalculateKey
              } : null}
            />
            
            <div className="absolute top-6 left-6 right-6 z-20">
              <NavigationHUD 
                instruction={navigationData.instruction}
                distance={navigationData.distance}
                eta={navigationData.eta}
                totalDistance={navigationData.totalDistance}
                onStop={() => setIsNavigating(false)}
                onRecalculate={() => setRecalculateKey(prev => prev + 1)}
                destinationName={Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label || 'البلاغ'}
              />
            </div>

            <button 
              onClick={() => setIsNavigating(false)}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl flex items-center gap-2 hover:bg-red-700 transition-all"
            >
              <Icons.Close className="w-5 h-5" />
              إنهاء الملاحة
            </button>
          </div>
        </div>
      )}

      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'Maintenance']}</p>
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
            <Icons.Maintenance className="w-5 h-5" />
            مهام الصيانة
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
                خريطة مهام الصيانة
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
              <h2 className="text-lg font-bold text-gray-900 mb-4">مهام الصيانة</h2>
            {reports.length === 0 && (
              <div className="bg-white p-12 rounded-3xl text-center text-gray-400 border border-dashed border-gray-200">
                <Icons.Maintenance className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>لا توجد مهام حالياً</p>
              </div>
            )}
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={cn(
                  "w-full bg-white p-4 rounded-3xl border transition-all text-right flex items-center gap-4 shadow-sm hover:shadow-md relative overflow-hidden",
                  selectedReport?.id === report.id ? "border-blue-600 ring-2 ring-blue-50 shadow-lg" : "border-gray-100",
                  report.urgency === 'Urgent' && "border-red-200 bg-red-50/30"
                )}
              >
                {report.urgency === 'Urgent' && (
                  <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-br-xl font-bold">
                    عاجل
                  </div>
                )}
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
            ))}
          </div>

          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden sticky top-24">
                <div className="relative h-64 bg-gray-900">
                  <MapPicker 
                    initialLocation={selectedReport.location} 
                    readOnly={true} 
                    showUserLocation={true}
                    className="rounded-none border-none"
                    routing={isNavigating && currentLocation ? {
                      origin: currentLocation,
                      destination: [selectedReport.location.lat, selectedReport.location.lng],
                      onRouteFound: handleRouteFound,
                      key: recalculateKey
                    } : null}
                  />
                  <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                    <button 
                      onClick={handleNavigate}
                      className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-white transition-all"
                    >
                      <Icons.Navigate className="w-4 h-4 text-blue-600" />
                      ملاحة لموقع العطل
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <span className="text-xs font-mono font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md mb-1 inline-block">
                        {selectedReport.serialNumber || 'بدون رقم تسلسلي'}
                      </span>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label || selectedReport.type}
                      </h2>
                      {currentLocation && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold mt-1 w-fit">
                          <Icons.Navigate className="w-3 h-3" />
                          {formatDistance(calculateDistance(currentLocation[0], currentLocation[1], selectedReport.location.lat, selectedReport.location.lng))}
                        </div>
                      )}
                    </div>
                    <div className={cn("px-4 py-2 rounded-xl text-sm font-bold", STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS])}>
                      {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}
                    </div>
                  </div>

                  <div className="space-y-6">
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

                    {selectedReport.status === 'Permitted' || selectedReport.status === 'Rejected' ? (
                      <button
                        onClick={() => startRepair(selectedReport.id)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all"
                      >
                        بدء الإصلاح الميداني
                      </button>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">توثيق الإصلاح:</label>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                            placeholder="اكتب تفاصيل عملية الإصلاح..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500">الصور (إجباري):</label>
                            <div className="flex flex-wrap gap-2">
                              {repairPhotos.map((url, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                                  <img src={url} className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => setRepairPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5"
                                  >
                                    <Icons.Close className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                                <Icons.Camera className="w-6 h-6 text-gray-400" />
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'photo')} disabled={uploading} />
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500">الفيديو (إجباري):</label>
                            <div className="flex flex-wrap gap-2">
                              {repairVideos.map((url, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-black flex items-center justify-center">
                                  <Icons.Video className="w-6 h-6 text-white opacity-50" />
                                  <button 
                                    onClick={() => setRepairVideos(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5"
                                  >
                                    <Icons.Close className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                                <Icons.Video className="w-6 h-6 text-gray-400" />
                                <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, 'video')} disabled={uploading} />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <button
                            onClick={completeRepair}
                            disabled={uploading}
                            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl shadow-xl shadow-teal-200 transition-all flex items-center justify-center gap-2"
                          >
                            {uploading ? <Icons.Clock className="w-5 h-5 animate-spin" /> : <Icons.Check className="w-5 h-5" />}
                            إرسال تقرير الإنجاز
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <Icons.Maintenance className="w-20 h-20 mb-4 opacity-10" />
                <p className="text-lg">اختر مهمة من القائمة للبدء في إصلاحها</p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
};
