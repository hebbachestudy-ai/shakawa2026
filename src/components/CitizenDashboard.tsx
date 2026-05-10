import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, GeoPoint, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, ENTITIES, REPORT_TYPES, Logo, cn, STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getNextSerialNumber } from '../utils/serial';
import { toast } from 'sonner';
import { set, get, del, keys } from 'idb-keyval';
import { MEDEA_GEO_DATA } from '../data/geoData';
import { Profile } from './Profile';
import { CitizenReports } from './CitizenReports';
import { MapPicker } from './MapPicker';
import { CitizenMap } from './CitizenMap';
import { Report } from '../types';

export const CitizenDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'report' | 'reports' | 'profile' | 'map'>('report');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [landmarkPhoto, setLandmarkPhoto] = useState<string | null>(null);
  const [captureStep, setCaptureStep] = useState<'issue' | 'landmark'>('issue');
  const [video, setVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [district, setDistrict] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterMunicipality, setFilterMunicipality] = useState('');
  const [selectedReportForMap, setSelectedReportForMap] = useState<Report | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    loadOfflineQueue();
    // Sync when online
    window.addEventListener('online', syncOfflineQueue);
    
    // Initial location and continuous tracking for high accuracy
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log('Location updated:', pos.coords.latitude, pos.coords.longitude, 'Accuracy:', pos.coords.accuracy);
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn('Geolocation tracking failed', err);
        // Fallback to single position if watch fails
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.error('Geolocation initial failed', err),
          geoOptions
        );
      },
      geoOptions
    );

    // Fetch My reports
    let unsubMy: () => void = () => {};
    let isFirstLoadMy = true;
    if (auth.currentUser) {
      const qMy = query(
        collection(db, 'reports'),
        where('citizenUid', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      unsubMy = onSnapshot(qMy, (snapshot) => {
        const newReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
        
        if (!isFirstLoadMy) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified') {
              const report = { id: change.doc.id, ...change.doc.data() } as Report;
              const oldReport = reports.find(r => r.id === report.id);
              if (oldReport && oldReport.status !== report.status) {
                sendNotification(
                  'تحديث حالة البلاغ',
                  `تغيرت حالة بلاغك رقم ${report.serialNumber || report.id.slice(0, 5)} إلى: ${STATUS_LABELS[report.status]}`
                );
              }
            }
          });
        }
        
        setReports(newReports);
        isFirstLoadMy = false;
      }, (error) => {
        console.error("Error fetching my reports:", error);
      });
    }

    // Fetch All reports for the map
    const qAll = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc')
    );

    let isFirstLoadAll = true;
    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const allNewReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      
      if (!isFirstLoadAll) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const report = { id: change.doc.id, ...change.doc.data() } as Report;
            // Only notify if it's in the same municipality and not my own report
            if (report.citizenUid !== auth.currentUser?.uid && 
                report.municipality === profile?.municipality) {
              const entityTypes = REPORT_TYPES[report.targetEntity] || [];
              const typeLabel = entityTypes.find((t: any) => t.id === report.type)?.label || report.type;
              sendNotification(
                'بلاغ جديد في منطقتك',
                `تم تسجيل بلاغ جديد (${typeLabel}) في ${report.municipality}`
              );
            }
          }
        });
      }

      setAllReports(allNewReports);
      isFirstLoadAll = false;
    }, (error) => {
      console.error("Error fetching all reports:", error);
    });

    return () => {
      window.removeEventListener('online', syncOfflineQueue);
      navigator.geolocation.clearWatch(watchId);
      unsubMy();
      unsubAll();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const sendNotification = (title: string, body: string) => {
    // Show browser notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' });
    }
    
    // Show toast
    toast.info(title, { description: body });
    
    // Add to local notifications list
    setNotifications(prev => [{
      id: Date.now(),
      title,
      body,
      time: new Date().toISOString(),
      read: false
    }, ...prev]);
  };

  const loadOfflineQueue = async () => {
    const allKeys = await keys();
    const reports = await Promise.all(allKeys.map(k => get(k)));
    setOfflineQueue(reports.filter(r => r && r.type === 'offline-report'));
  };

  const syncOfflineQueue = async () => {
    if (!navigator.onLine) {
      toast.error('لا يوجد اتصال بالإنترنت حالياً للمزامنة');
      return;
    }

    const allKeys = await keys();
    let successCount = 0;
    let failCount = 0;

    for (const key of allKeys) {
      const report = await get(key);
      if (report && report.type === 'offline-report') {
        try {
          // Increase timeout to 60 seconds for sync as it might involve large files
          await Promise.race([
            uploadReport(report.data),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 60000))
          ]);
          await del(key);
          successCount++;
        } catch (error) {
          console.error('Sync failed for key:', key, error);
          failCount++;
        }
      }
    }

    if (successCount > 0) {
      toast.success(`تم مزامنة ${successCount} بلاغ(ات) بنجاح`);
    }
    if (failCount > 0) {
      toast.error(`فشل مزامنة ${failCount} بلاغ(ات). تأكد من جودة الاتصال.`);
    }
    
    loadOfflineQueue();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    // Always stop existing camera before starting
    stopCamera();
    setCameraError(false);

    const constraints = [
      { video: { facingMode: { exact: 'environment' } } },
      { video: { facingMode: 'environment' } },
      { video: true }
    ];

    let lastError = null;

    for (const constraint of constraints) {
      try {
        console.log('Attempting camera with constraints:', constraint);
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('Camera started successfully');
          setCameraError(false);
          return; // Success!
        }
      } catch (err: any) {
        console.warn(`Constraint search failed for:`, constraint, err.name, err.message);
        lastError = err;
        // If it's a permission error, don't bother trying other constraints
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    console.error('All camera start attempts failed:', lastError);
    setCameraError(true);
    if (lastError?.name === 'NotReadableError' || lastError?.message?.includes('Could not start video source')) {
      toast.error('الكاميرا قيد الاستخدام من تطبيق آخر أو متصفح آخر. يرجى إغلاق التطبيقات الأخرى.');
    } else if (lastError?.name === 'NotAllowedError') {
      toast.error('تم رفض الوصول للكاميرا. يرجى تفعيل الصلاحيات من إعدادات المتصفح.');
    } else {
      toast.error('فشل الوصول للكاميرا. حاول استخدام زر رفع الصور بدلاً من ذلك.');
    }
  };

  const startRecording = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => setVideo(reader.result as string);
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.info('بدأ التسجيل (بحد أقصى 10 ثوانٍ)');
      
      setTimeout(() => {
        if (recorder.state === 'recording') {
          stopRecording();
        }
      }, 10000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('تم حفظ الفيديو');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Resize for faster upload and storage efficiency
        const maxWidth = 1024;
        const maxHeight = 1024;
        let width = videoRef.current.videoWidth;
        let height = videoRef.current.videoHeight;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        
        // Use lower quality for faster transmission
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
        
        if (captureStep === 'issue') {
          setPhoto(dataUrl);
          setCaptureStep('landmark');
          toast.info('تم تصوير البلاغ. الآن يرجى تصوير معالم المكان (المحيط)');
        } else {
          setLandmarkPhoto(dataUrl);
          // Stop stream
          const stream = videoRef.current.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
        
        // Get location with high accuracy
        const geoOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => toast.error('فشل تحديد الموقع بدقة'),
          geoOptions
        );
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (file.type.startsWith('image/')) {
          if (captureStep === 'issue') {
            setPhoto(reader.result as string);
            setCaptureStep('landmark');
            toast.info('تم اختيار صورة البلاغ. الآن يرجى اختيار صورة لمعالم المكان');
          } else {
            setLandmarkPhoto(reader.result as string);
          }
        } else if (file.type.startsWith('video/')) {
          setVideo(reader.result as string);
          setCaptureStep('landmark');
          toast.info('تم تسجيل الفيديو. الآن يرجى تصوير معالم المكان');
        }
        // Also try to get location when file is selected
        const geoOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        };
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.warn('Geolocation failed', err),
          geoOptions
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadReport = async (data: any) => {
    // 0. Get Serial Number
    const serialNumber = await getNextSerialNumber();

    // 1. Upload image to Storage
    const response = await fetch(data.photo);
    const blob = await response.blob();
    const storageRef = ref(storage, `reports/${auth.currentUser?.uid}/${Date.now()}_issue.jpg`);
    await uploadBytes(storageRef, blob);
    const photoUrl = await getDownloadURL(storageRef);

    // 1.1 Upload landmark image if exists
    let landmarkPhotoUrl = '';
    if (data.landmarkPhoto) {
      const lResponse = await fetch(data.landmarkPhoto);
      const lBlob = await lResponse.blob();
      const lStorageRef = ref(storage, `reports/${auth.currentUser?.uid}/${Date.now()}_landmark.jpg`);
      await uploadBytes(lStorageRef, lBlob);
      landmarkPhotoUrl = await getDownloadURL(lStorageRef);
    }

    // 2. Upload video if exists
    let videoUrl = '';
    if (data.video) {
      const vResponse = await fetch(data.video);
      const vBlob = await vResponse.blob();
      const vStorageRef = ref(storage, `reports/${auth.currentUser?.uid}/${Date.now()}.webm`);
      await uploadBytes(vStorageRef, vBlob);
      videoUrl = await getDownloadURL(vStorageRef);
    }

    // 3. Save to Firestore (New Reports collection as requested)
    try {
      await addDoc(collection(db, 'Reports'), {
        userId: auth.currentUser?.uid,
        serialNumber,
        targetEntity: data.targetEntity,
        type: data.type,
        imageUrl: photoUrl,
        landmarkPhotoUrl: landmarkPhotoUrl,
        videoUrl: videoUrl,
        location: new GeoPoint(data.location.lat, data.location.lng),
        note: data.note,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      console.log('Saved to Reports collection');
    } catch (error) {
      console.error('Error saving to Reports collection:', error);
      // Don't throw here, try to save to the legacy collection too
    }

    try {
      // Also save to legacy reports for existing dashboards to work
      await addDoc(collection(db, 'reports'), {
        citizenUid: auth.currentUser?.uid,
        serialNumber,
        targetEntity: data.targetEntity,
        type: data.type,
        photoUrl,
        landmarkPhotoUrl,
        videoUrl,
        location: data.location,
        district: data.district,
        municipality: data.municipality,
        region: data.district,
        province: MEDEA_GEO_DATA.province,
        note: data.note,
        status: 'New',
        severity: 'Medium',
        urgency: 'Medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('Saved to reports (legacy) collection');
    } catch (error) {
      console.error('Error saving to reports (legacy) collection:', error);
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    }
  };

  const handleSubmit = async () => {
    if (!selectedEntity || !selectedType || !photo || !landmarkPhoto || !location || !district || !municipality) {
      toast.error('يرجى ملء كافة البيانات المطلوبة (الجهة، النوع، صورة البلاغ، صورة المعالم، الموقع، الدائرة والبلدية)');
      return;
    }
    setLoading(true);

    try {
      const reportData = {
        targetEntity: selectedEntity,
        type: selectedType,
        photo,
        landmarkPhoto,
        video,
        location,
        district,
        municipality,
        note,
        createdAt: new Date().toISOString()
      };

      // Add a timeout to the upload process to prevent hanging
      const uploadWithTimeout = (data: any) => {
        return Promise.race([
          uploadReport(data),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 60000))
        ]);
      };

      // Always try to upload if navigator says we are online, but fail fast
      if (navigator.onLine) {
        try {
          await uploadWithTimeout(reportData);
          toast.success('تم إرسال البلاغ بنجاح');
          resetForm();
        } catch (error) {
          console.warn('Upload failed or timed out, saving offline:', error);
          await saveOffline(reportData);
        }
      } else {
        await saveOffline(reportData);
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast.error('فشل الإرسال، تم الحفظ محلياً');
    } finally {
      setLoading(false);
    }
  };

  const saveOffline = async (data: any) => {
    const id = `report-${Date.now()}`;
    await set(id, { type: 'offline-report', data });
    toast.info('تم حفظ البلاغ محلياً. سيتم الإرسال عند توفر الإنترنت.');
    resetForm();
    loadOfflineQueue();
  };

  const resetForm = () => {
    setSelectedEntity(null);
    setSelectedType(null);
    setPhoto(null);
    setLandmarkPhoto(null);
    setCaptureStep('issue');
    setVideo(null);
    setLocation(null);
    setDistrict('');
    setMunicipality('');
    setNote('');
    setActiveTab('reports');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl pb-20" dir="rtl">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 relative"
          >
            <Icons.Notification className="w-5 h-5" />
            {notifications.some(n => !n.read) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500"
          >
            <Icons.Logout className="w-5 h-5" />
          </button>
        </div>
      </header>

      {showNotifications && (
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex justify-center items-start p-4 pt-20" onClick={() => setShowNotifications(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900">التنبيهات</h3>
              <button 
                onClick={() => {
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  setShowNotifications(false);
                }}
                className="text-xs text-brand-primary font-bold"
              >
                تحديد الكل كمقروء
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Icons.Notification className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد تنبيهات حالياً</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map(n => (
                    <div key={n.id} className={cn("p-4 transition-colors", !n.read ? "bg-brand-primary/5" : "bg-white")}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-slate-900">{n.title}</span>
                        <span className="text-[10px] text-slate-400">{new Date(n.time).toLocaleTimeString('ar-DZ')}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 0 && (
              <button 
                onClick={() => setNotifications([])}
                className="w-full p-3 text-xs text-red-500 font-medium border-t border-slate-100 hover:bg-red-50 transition-colors"
              >
                مسح جميع التنبيهات
              </button>
            )}
          </div>
        </div>
      )}

      <main className="p-6 max-w-md mx-auto animate-slide-up">
        {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
          <div className="mb-6 bg-brand-secondary/10 border border-brand-secondary/20 p-4 rounded-3xl flex items-center gap-4">
            <div className="bg-brand-secondary/20 p-2 rounded-xl">
              <Icons.Notification className="w-5 h-5 text-brand-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">تفعيل التنبيهات</p>
              <p className="text-[10px] text-slate-500">فعل التنبيهات لتصلك تحديثات بلاغاتك فوراً</p>
            </div>
            <button 
              onClick={() => typeof Notification !== 'undefined' && Notification.requestPermission().then(() => window.location.reload())}
              className="bg-brand-secondary text-white text-[10px] font-bold px-3 py-1.5 rounded-xl"
            >
              تفعيل
            </button>
          </div>
        )}

        {activeTab === 'report' ? (
          <div className="space-y-6">
            {!selectedEntity ? (
              <div className="grid grid-cols-1 gap-4">
                <h2 className="text-xl font-bold text-slate-800 mb-2">اختر الجهة المعنية بالبلاغ</h2>
                <div className="grid grid-cols-1 gap-4">
                  {ENTITIES.map((entity: any) => (
                    <button
                      key={entity.id}
                      onClick={() => setSelectedEntity(entity.id)}
                      className="glass-card flex items-center gap-4 p-6 rounded-3xl hover:border-brand-primary/30 transition-all text-right group"
                    >
                      <div className="bg-brand-primary/10 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                        <entity.icon className="w-8 h-8 text-brand-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-900 text-lg">{entity.label}</span>
                        <span className="text-sm text-slate-500">اضغط لاختيار هذه الجهة</span>
                      </div>
                      <Icons.Chevron className="w-5 h-5 text-slate-300 group-hover:text-brand-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : !selectedType ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-slate-800">ماذا تريد أن تبلغ؟</h2>
                  <button 
                    onClick={() => setSelectedEntity(null)}
                    className="text-sm text-brand-primary font-bold"
                  >
                    تغيير الجهة
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {(REPORT_TYPES[selectedEntity] || []).map((type: any) => (
                    <button
                      key={type.id}
                      onClick={() => { setSelectedType(type.id); startCamera(); }}
                      className="glass-card flex items-center gap-4 p-6 rounded-3xl hover:border-brand-primary/30 transition-all text-right group"
                    >
                      <div className="bg-brand-primary/10 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                        <Icons.Report className="w-8 h-8 text-brand-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-900 text-lg">{type.label}</span>
                        <span className="text-sm text-slate-500">اضغط للبدء في تصوير البلاغ</span>
                      </div>
                      <Icons.Chevron className="w-5 h-5 text-slate-300 group-hover:text-brand-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : !photo || !landmarkPhoto ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-slate-800">
                    {captureStep === 'issue' ? 'الخطوة 1: صور المشكلة' : 'الخطوة 2: صور معالم المكان'}
                  </h2>
                  <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full">
                    {captureStep === 'issue' ? '1 / 2' : '2 / 2'}
                  </span>
                </div>
                
                <div className="relative aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  
                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white p-6 text-center">
                      <Icons.Alert className="w-12 h-12 text-amber-500 mb-4" />
                      <p className="font-bold mb-2">تعذر تشغيل الكاميرا</p>
                      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                        قد تكون الكاميرا مستخدمة من قبل تطبيق آخر أو تم رفض الصلاحيات.
                      </p>
                      <button 
                        onClick={startCamera}
                        className="btn-primary py-2 px-6 text-sm"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
                    <button
                      onClick={capturePhoto}
                      className="w-20 h-20 bg-white rounded-full border-8 border-gray-300/50 flex items-center justify-center shadow-lg active:scale-95 transition-all"
                    >
                      <div className="w-14 h-14 bg-red-500 rounded-full" />
                    </button>
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={cn(
                        "w-20 h-20 rounded-full border-8 border-gray-300/50 flex items-center justify-center shadow-lg active:scale-95 transition-all",
                        isRecording ? "bg-red-600 animate-pulse" : "bg-white/20 backdrop-blur"
                      )}
                    >
                      <Icons.Video className={cn("w-10 h-10", isRecording ? "text-white" : "text-red-500")} />
                    </button>
                    <button
                      onClick={() => { stopCamera(); nativeCameraRef.current?.click(); }}
                      className="w-14 h-14 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                      title="استخدام كاميرا الهاتف مباشرة"
                    >
                      <Icons.Camera className="w-8 h-8" />
                    </button>
                    <button
                      onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
                      className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                      title="رفع صورة أو فيديو"
                    >
                      <Icons.Add className="w-8 h-8" />
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept="image/*,video/*" 
                    className="hidden" 
                  />
                  <input 
                    type="file" 
                    ref={nativeCameraRef} 
                    onChange={handleFileSelect} 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                  />
                </div>
                <p className="text-center text-xs text-slate-400">
                  {captureStep === 'issue' 
                    ? 'صور المشكلة بوضوح (حفرة، تسرب، تخريب...)' 
                    : 'صور معالم المكان المحيطة (مبنى مميز، لافتة، تقاطع...) لتسهيل الوصول'}
                </p>
                <button
                  onClick={() => { 
                    stopCamera();
                    setSelectedType(null); 
                    setPhoto(null); 
                    setLandmarkPhoto(null); 
                    setCaptureStep('issue'); 
                    setVideo(null); 
                  }}
                  className="w-full py-4 text-gray-500 font-medium"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 mr-1">صورة البلاغ:</p>
                    <div className="aspect-square rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                      {photo ? (
                        <img src={photo} alt="Issue" className="w-full h-full object-cover" />
                      ) : (
                        <video src={video!} controls className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 mr-1">معالم المكان:</p>
                    <div className="aspect-square rounded-2xl overflow-hidden shadow-lg border-2 border-white bg-slate-100 flex items-center justify-center">
                      {landmarkPhoto ? (
                        <img src={landmarkPhoto} alt="Landmark" className="w-full h-full object-cover" />
                      ) : (
                        <Icons.Location className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 mr-1">موقع البلاغ:</label>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        location ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        <Icons.Location className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {location ? `إحداثيات: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'جاري تحديد الموقع...'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {location ? 'تم تحديد الموقع تلقائياً' : 'يرجى الانتظار لتحديد الموقع'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                              toast.success('تم تحديث الموقع');
                            },
                            (err) => toast.error('فشل تحديث الموقع'),
                            geoOptions
                          );
                        }}
                        className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-all"
                        title="تحديث الموقع"
                      >
                        <Icons.Clock className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (location) {
                            window.open(`geo:${location.lat},${location.lng}?q=${location.lat},${location.lng}(موقع البلاغ)`, '_blank');
                          } else {
                            toast.error('الموقع غير متاح حالياً');
                          }
                        }}
                        className="p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-all"
                        title="فتح في تطبيق خرائط خارجي (مثل Offline Maps)"
                      >
                        <Icons.Navigate className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setShowMap(true)}
                        className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg hover:bg-brand-primary/20 transition-all"
                        title="تحديد بدقة على الخريطة"
                      >
                        <Icons.Map className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {showMap && (
                  <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-500">
                    <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur">
                      <h3 className="font-bold text-slate-800">حدد موقع البلاغ على الخريطة</h3>
                      <button 
                        onClick={() => setShowMap(false)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-all"
                      >
                        <Icons.Close className="w-6 h-6 text-slate-500" />
                      </button>
                    </div>
                    <div className="flex-1 relative">
                      <MapPicker 
                        onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
                        initialLocation={location}
                        className="rounded-none border-none h-full"
                      />
                    </div>
                    <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                      <button 
                        onClick={() => setShowMap(false)}
                        className="w-full btn-primary py-4 text-lg"
                      >
                        تأكيد الموقع المختار
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 mr-1">الدائرة:</label>
                    <select
                      value={district}
                      onChange={(e) => {
                        const d = e.target.value;
                        setDistrict(d);
                        if (d && MEDEA_GEO_DATA.districts[d as keyof typeof MEDEA_GEO_DATA.districts]) {
                          setMunicipality(MEDEA_GEO_DATA.districts[d as keyof typeof MEDEA_GEO_DATA.districts][0]);
                        } else {
                          setMunicipality('');
                        }
                      }}
                      className="input-field"
                      required
                    >
                      <option value="">اختر الدائرة</option>
                      {Object.keys(MEDEA_GEO_DATA.districts).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 mr-1">البلدية:</label>
                    <select
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className="input-field"
                      required
                      disabled={!district}
                    >
                      <option value="">اختر البلدية</option>
                      {district && MEDEA_GEO_DATA.districts[district as keyof typeof MEDEA_GEO_DATA.districts].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 mr-1">أضف ملاحظة (اختياري):</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="اكتب تفاصيل إضافية هنا..."
                    className="input-field h-32 resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading || !location}
                  className="w-full btn-primary disabled:opacity-50"
                >
                  {loading ? 'جاري الإرسال...' : 'إرسال البلاغ الآن'}
                </button>
                
                <button
                  onClick={() => { setSelectedType(null); setSelectedEntity(null); setPhoto(null); setLandmarkPhoto(null); setCaptureStep('issue'); setVideo(null); startCamera(); }}
                  className="w-full py-2 text-slate-400 text-sm hover:text-brand-danger transition-colors"
                >
                  إعادة التصوير
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'reports' ? (
          <CitizenReports reports={reports} />
        ) : (
          <Profile />
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-6 py-3 flex justify-around shadow-2xl z-50">
        <button
          onClick={() => setActiveTab('report')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'report' ? "text-brand-primary scale-110" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Icons.Add className="w-6 h-6" />
          <span className="text-[10px] font-bold">تقديم بلاغ</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'reports' ? "text-brand-primary scale-110" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Icons.Reports className="w-6 h-6" />
          <span className="text-[10px] font-bold">بلاغاتي</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'profile' ? "text-brand-primary scale-110" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Icons.User className="w-6 h-6" />
          <span className="text-[10px] font-bold">الملف الشخصي</span>
        </button>
      </nav>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
