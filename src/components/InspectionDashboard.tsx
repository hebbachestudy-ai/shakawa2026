import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, addDoc, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS, Logo, cn, ROLE_LABELS } from '../constants';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import { Profile } from './Profile';
import { MapPicker } from './MapPicker';
import { CitizenMap } from './CitizenMap';
import NavigationHUD from './NavigationHUD';
import { calculateDistance, formatDistance } from '../utils/geo';

export const InspectionDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'new' | 'repaired' | 'profile' | 'map'>('new');
  const [reports, setReports] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedReport && window.innerWidth < 1024) {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedReport]);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [subType, setSubType] = useState('');
  const [extraDetails, setExtraDetails] = useState<Record<string, any>>({});
  const [proposal, setProposal] = useState('');
  const [note, setNote] = useState('');
  const [inspectionPhotos, setInspectionPhotos] = useState<string[]>([]);
  const [inspectionVideos, setInspectionVideos] = useState<string[]>([]);
  const [inspectionDocuments, setInspectionDocuments] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [inspectionPhoto, setInspectionPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showFalseModal, setShowFalseModal] = useState(false);
  const [falseReason, setFalseReason] = useState('');
  const [falseEvidence, setFalseEvidence] = useState<File | null>(null);
  const [recalculateKey, setRecalculateKey] = useState(0);
  const [navigationData, setNavigationData] = useState({
    instruction: '',
    distance: '',
    eta: '',
    totalDistance: ''
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;

    const statusFilter = activeTab === 'new' ? 'New' : 'Repaired';
    const entityFilter = profile.entity || 'Municipality';
    
    let q;
    const districts = profile.districts && profile.districts.length > 0 
      ? profile.districts 
      : (profile.district || profile.region ? [profile.district || profile.region] : []);
    
    console.log('Inspection Query Params:', { 
      districts, 
      statusFilter, 
      entityFilter,
      role: profile.role, 
      province: profile.province,
      uid: profile.uid
    });
 
    if (districts.length > 0) {
      console.log('Querying by districts:', districts);
      q = query(
        collection(db, 'reports'), 
        where('targetEntity', '==', entityFilter),
        where('region', 'in', districts),
        where('status', '==', statusFilter)
      );
    } else {
      const province = profile.province || 'المدية';
      console.log('Querying by province fallback:', province);
      q = query(
        collection(db, 'reports'),
        where('targetEntity', '==', entityFilter),
        where('province', '==', province),
        where('status', '==', statusFilter)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      console.log(`Fetched ${snapshot.docs.length} reports for status ${statusFilter}`);
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
      console.error("InspectionDashboard: Error fetching reports snapshot:", error);
      handleFirestoreError(error, OperationType.LIST, 'reports');
      setLoading(false);
    });

    // Fetch all reports for map
    let qAll;
    if (districts.length > 0) {
      qAll = query(
        collection(db, 'reports'), 
        where('region', 'in', districts)
      );
    } else {
      const province = profile.province || 'المدية';
      qAll = query(
        collection(db, 'reports'),
        where('province', '==', province)
      );
    }

    const unsubAll = onSnapshot(qAll, (snapshot) => {
      setAllReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("InspectionDashboard: Error fetching all reports snapshot:", error);
    });

    return () => {
      unsub();
      unsubAll();
    };
  }, [profile, activeTab]);

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCurrentLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('InspectionDashboard: Geolocation error', err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const classifyReportWithAI = async (report: any) => {
    if (!process.env.GEMINI_API_KEY) return;
    setIsAnalyzing(true);
    try {
      let blob: Blob;
      const isFirebaseStorageUrl = report.photoUrl.includes('firebasestorage.googleapis.com') || !report.photoUrl.startsWith('http');
      
      if (isFirebaseStorageUrl) {
        const storageRef = ref(storage, report.photoUrl);
        blob = await getBlob(storageRef);
      } else {
        const imgResponse = await fetch(report.photoUrl);
        blob = await imgResponse.blob();
      }

      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: `Analyze this citizen report.
            Image provided.
            Note: ${report.note}
            Type: ${report.type}
            ${report.videoUrl ? 'Note: A video is also available for this report which shows more detail.' : ''}
            
            Classify the report for the Monitoring Team.
            Determine if it's 'Urgent' or 'Normal'.
            Provide a summary of the damage and a suggested priority.
            
            Return JSON: { "urgency": "Urgent" | "Normal", "aiAnalysis": string, "suggestedPriority": number }` },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        },
        config: { responseMimeType: 'application/json' }
      });
      
      const result = JSON.parse(response.text);
      
      await updateDoc(doc(db, 'reports', report.id), {
        urgency: result.urgency,
        aiAnalysis: result.aiAnalysis,
        suggestedPriority: result.suggestedPriority,
        sentToMonitoring: true,
        updatedAt: new Date().toISOString()
      });
      
      toast.success(`تم تصنيف البلاغ كـ ${result.urgency === 'Urgent' ? 'عاجل' : 'عادي'} بواسطة الذكاء الاصطناعي`);
    } catch (error) {
      console.error('AI Classification Error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInspect = async () => {
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      let photoUrl = selectedReport.photoUrl;
      const uploadedPhotos: string[] = [];
      
      // Handle multiple photos
      if (inspectionPhoto) {
        const response = await fetch(inspectionPhoto);
        const blob = await response.blob();
        const storageRef = ref(storage, `inspections/${selectedReport.id}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        uploadedPhotos.push(url);
        photoUrl = url; // Set primary photo if needed
      }

      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'Inspected',
        estimatedCost,
        subType,
        extraDetails,
        inspectionDetails: {
          photos: uploadedPhotos,
          videos: [], // Placeholder for videos
          price: estimatedCost,
          proposal: proposal,
          note: note,
          documents: [], // Placeholder for documents
          subType,
          extraDetails
        },
        inspectedBy: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('تم إرسال التقرير التفصيلي للبلدية');
      setSelectedReport(null);
      setInspectionPhoto(null);
      setNote('');
      setProposal('');
      setEstimatedCost(0);
      setSubType('');
      setExtraDetails({});
    } catch (error) {
      console.error('Inspection error:', error);
      toast.error('فشل إرسال التقرير');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (accepted: boolean) => {
    if (!selectedReport) return;
    try {
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: accepted ? 'Verified' : 'Rejected',
        verificationDetails: {
          photos: [], // Placeholder
          videos: [],
          note: note,
          documents: [],
          status: accepted ? 'Accepted' : 'Rejected'
        },
        verifiedBy: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      });
      
      toast.success(accepted ? 'تم قبول العمل وإرسال التقرير للبلدية' : 'تم رفض العمل وإعادته للصيانة');
      setSelectedReport(null);
      setNote('');
    } catch (error) {
      toast.error('فشل العملية');
    }
  };

  const checkDuplicate = async (report: any) => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Gemini API Key is missing');
      return;
    }
    setIsAnalyzing(true);
    try {
      console.log('Fetching image for AI analysis:', report.photoUrl);
      
      let blob: Blob;
      const isFirebaseStorageUrl = report.photoUrl.includes('firebasestorage.googleapis.com') || !report.photoUrl.startsWith('http');
      
      if (isFirebaseStorageUrl) {
        try {
          const storageRef = ref(storage, report.photoUrl);
          blob = await getBlob(storageRef);
        } catch (fetchError) {
          console.error('Error fetching image via getBlob:', fetchError);
          // Fallback to fetch if getBlob fails
          const imgResponse = await fetch(report.photoUrl);
          if (!imgResponse.ok) throw new Error(`Image fetch failed: ${imgResponse.status}`);
          blob = await imgResponse.blob();
        }
      } else {
        // Direct fetch for non-Firebase URLs
        const imgResponse = await fetch(report.photoUrl);
        if (!imgResponse.ok) throw new Error(`Image fetch failed: ${imgResponse.status}`);
        blob = await imgResponse.blob();
      }

      const base64Data = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = (height / width) * maxDim;
              width = maxDim;
            } else {
              width = (width / height) * maxDim;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl.split(',')[1]);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        };
        img.src = objectUrl;
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { text: `Analyze if this report is a duplicate of existing reports based on the image and location.
                Current report type: ${report.type}, Location: ${JSON.stringify({ lat: report.location.lat, lng: report.location.lng })}.
                Existing reports: ${JSON.stringify(reports.filter(r => r.id !== report.id).slice(0, 10).map(r => ({ type: r.type, location: r.location })))}.
                Return JSON: { "isDuplicate": boolean, "confidence": number, "duplicateId": string | null, "reason": string }` },
                { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
              ]
            },
            config: { responseMimeType: 'application/json' }
          });
          break;
        } catch (aiError) {
          retries--;
          if (retries === 0) throw aiError;
          console.warn(`AI fetch failed, retrying... (${retries} left)`, aiError);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (!response) throw new Error('AI response was empty');
      const result = JSON.parse(response.text);
      if (result.isDuplicate) {
        toast.warning(`بلاغ مكرر محتمل (ثقة: ${result.confidence}%): ${result.reason}`);
      } else {
        toast.success('تم فحص البلاغ بالذكاء الاصطناعي: لا توجد بلاغات مكررة');
      }
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Failed to fetch')) {
        toast.error('فشل الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من إعدادات CORS أو الاتصال بالإنترنت.');
      } else {
        toast.error('فشل فحص التكرار بالذكاء الاصطناعي');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createTestReport = async () => {
    if (!profile) {
      toast.error('لم يتم تحميل ملفك الشخصي بعد');
      return;
    }
    try {
      const region = (profile.districts && profile.districts.length > 0) 
        ? profile.districts[0] 
        : (profile.region || profile.district || '');
      const province = profile.province || '';
      const district = (profile.districts && profile.districts.length > 0)
        ? profile.districts[0]
        : (profile.district || '');
      const municipality = profile.municipality || '';

      const testReport = {
        citizenUid: auth.currentUser?.uid,
        type: 'Asphalt',
        photoUrl: 'https://picsum.photos/seed/pothole/800/600',
        location: {
          lat: 36.7538,
          lng: 3.0588,
          address: 'شارع ديدوش مراد، الجزائر الوسطى'
        },
        note: 'هذا بلاغ تجريبي لاختبار واجهة المعاينة. يوجد حفرة كبيرة في وسط الطريق تعيق حركة المرور.',
        status: 'New',
        severity: 'High',
        urgency: 'Medium',
        region: region,
        province: province,
        district: district,
        municipality: municipality,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Creating test report with data:', testReport);
      const docRef = await addDoc(collection(db, 'reports'), testReport);
      console.log('Test report created with ID:', docRef.id);
      toast.success('تم إنشاء بلاغ تجريبي بنجاح');
    } catch (error: any) {
      console.error('Error creating test report:', error);
      const errorMessage = error?.message || 'خطأ غير معروف';
      toast.error(`فشل إنشاء البلاغ: ${errorMessage}`);
    }
  };

  const handleMarkFalse = async () => {
    if (!selectedReport || !falseReason.trim()) {
      toast.error('يرجى إدخال سبب تصنيف البلاغ ككاذب');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let evidenceUrl = null;
      let evidenceType = null;

      if (falseEvidence) {
        const storageRef = ref(storage, `false_reports/${selectedReport.id}/${Date.now()}_${falseEvidence.name}`);
        const snapshot = await uploadBytes(storageRef, falseEvidence);
        evidenceUrl = await getDownloadURL(snapshot.ref);
        evidenceType = falseEvidence.type.startsWith('video') ? 'video' : 'photo';
      }

      await updateDoc(doc(db, 'reports', selectedReport.id), {
        status: 'False',
        falseReason: falseReason,
        falseEvidenceUrl: evidenceUrl,
        falseEvidenceType: evidenceType,
        markedFalseBy: auth.currentUser?.uid,
        updatedAt: new Date().toISOString()
      });
      toast.success('تم تصنيف البلاغ كبلاغ كاذب وإرساله للقسم المختص');
      setSelectedReport(null);
      setShowFalseModal(false);
      setFalseReason('');
      setFalseEvidence(null);
    } catch (error) {
      console.error('Mark false error:', error);
      toast.error('فشل تصنيف البلاغ');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          // Fallback to external maps
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

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const startCamera = async () => {
    // Always stop existing camera before starting
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
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
          setShowCamera(true);
          return; // Success!
        }
      } catch (err: any) {
        console.warn(`Constraint search failed for:`, constraint, err.name, err.message);
        lastError = err;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    console.error('All camera start attempts failed:', lastError);
    if (lastError?.name === 'NotReadableError' || lastError?.message?.includes('Could not start video source')) {
      toast.error('الكاميرا قيد الاستخدام من تطبيق آخر أو متصفح آخر. يرجى إغلاق التطبيقات الأخرى.');
    } else if (lastError?.name === 'NotAllowedError') {
      toast.error('تم رفض الوصول للكاميرا. يرجى تفعيل الصلاحيات من إعدادات المتصفح.');
    } else {
      toast.error('فشل الوصول للكاميرا. حاول استخدام زر رفع الصور بدلاً من ذلك.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
        setInspectionPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInspectionPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen font-sans">جاري التحميل...</div>;

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

      {/* False Report Modal */}
      {showFalseModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Icons.Delete className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">تصنيف كبلاغ كاذب</h3>
              <p className="text-center text-gray-500 mb-8">يرجى توضيح سبب تصنيف هذا البلاغ كبلاغ كاذب. سيتم إرسال هذا التبرير للبلدية للمراجعة.</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">التبرير / السبب:</label>
                  <textarea
                    value={falseReason}
                    onChange={(e) => setFalseReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none min-h-[120px]"
                    placeholder="مثلاً: الموقع لا يوجد به أي عطل، أو الصورة لا تطابق الواقع..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">إرفاق دليل (صورة أو فيديو):</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setFalseEvidence(e.target.files?.[0] || null)}
                      className="hidden"
                      id="false-evidence-upload"
                    />
                    <label
                      htmlFor="false-evidence-upload"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all cursor-pointer text-gray-500"
                    >
                      {falseEvidence ? (
                        <span className="text-red-600 font-bold truncate">{falseEvidence.name}</span>
                      ) : (
                        <>
                          <Icons.Camera className="w-5 h-5" />
                          <span>اختر صورة أو فيديو</span>
                        </>
                      )}
                    </label>
                    {falseEvidence && (
                      <button 
                        onClick={() => setFalseEvidence(null)}
                        className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200"
                      >
                        <Icons.Close className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowFalseModal(false);
                      setFalseReason('');
                      setFalseEvidence(null);
                    }}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleMarkFalse}
                    disabled={isSubmitting || !falseReason.trim()}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 shadow-xl shadow-red-200 transition-all disabled:bg-gray-300 disabled:shadow-none"
                  >
                    {isSubmitting ? <Icons.Clock className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد الإرسال'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <button 
            onClick={createTestReport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all border border-amber-200 font-bold text-xs sm:text-sm"
          >
            <Icons.Add className="w-4 h-4" />
            <span className="hidden sm:inline">إنشاء بلاغ تجريبي</span>
            <span className="sm:hidden">تجريبي</span>
          </button>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role || 'Inspection']}</p>
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
            onClick={() => setActiveTab('new')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'new' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Reports className="w-5 h-5" />
            بلاغات المواطنين
          </button>
          <button
            onClick={() => setActiveTab('repaired')}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'repaired' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icons.Check className="w-5 h-5" />
            بلاغات تم إصلاحها
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

        {/* Debug Info (Hidden in production but useful for now) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-4 p-4 bg-gray-800 text-white text-xs rounded-xl font-mono overflow-auto">
            <p>Debug: districts={JSON.stringify(profile?.districts)} | region={profile?.region} | province={profile?.province}</p>
            <p>ActiveTab: {activeTab} | Status: {activeTab === 'new' ? 'New' : 'Repaired'}</p>
            <p>Reports Count: {reports.length}</p>
          </div>
        )}

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
              reports={allReports} 
              onReportClick={(report) => {
                setSelectedReport(report);
                setActiveTab(report.status === 'New' ? 'new' : 'repaired');
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* List */}
            <div className={cn("lg:col-span-1 space-y-4", selectedReport && "hidden lg:block")}>
            {reports.length === 0 && (
              <div className="bg-white p-12 rounded-3xl text-center text-gray-400 border border-dashed border-gray-200">
                <Icons.Reports className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>لا توجد بلاغات حالياً</p>
              </div>
            )}
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => { 
                  setSelectedReport(report); 
                  checkDuplicate(report);
                  if (!report.sentToMonitoring) classifyReportWithAI(report);
                }}
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
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-bold text-gray-900">
                      {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-gray-400">
                      {report.serialNumber || '---'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Icons.Location className="w-3 h-3" />
                    {report.location.address || 'موقع محدد'}
                  </p>
                </div>
                <Icons.Right className="w-5 h-5 text-gray-300" />
              </button>
            ))}
          </div>

          {/* Details */}
          <div className={cn("lg:col-span-2", !selectedReport && "hidden lg:block")} ref={detailsRef}>
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
                  <div className="absolute top-4 right-4 z-20 lg:hidden">
                    <button 
                      onClick={() => setSelectedReport(null)}
                      className="bg-white/90 backdrop-blur p-2 rounded-xl text-gray-600 shadow-lg"
                    >
                      <Icons.Right className="w-6 h-6 rotate-180" />
                    </button>
                  </div>
                  <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                    <button 
                      onClick={handleNavigate}
                      className="bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-white transition-all"
                    >
                      <Icons.Navigate className="w-4 h-4 text-blue-600" />
                      فتح الخريطة (ملاحة)
                    </button>
                    <button 
                      onClick={() => setShowFalseModal(true)}
                      className="bg-red-50/90 backdrop-blur px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-red-100 text-red-600 transition-all border border-red-100"
                    >
                      <Icons.Delete className="w-4 h-4" />
                      بلاغ كاذب
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
                        {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label}
                      </h2>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-gray-500">{selectedReport.note}</p>
                        {currentLocation && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                            <Icons.Navigate className="w-3 h-3" />
                            {formatDistance(calculateDistance(currentLocation[0], currentLocation[1], selectedReport.location.lat, selectedReport.location.lng))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={cn("px-4 py-2 rounded-xl text-sm font-bold", STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS])}>
                      {STATUS_LABELS[selectedReport.status as keyof typeof STATUS_LABELS]}
                    </div>
                  </div>

                  {activeTab === 'new' ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">نوع البلاغ التفصيلي:</label>
                          <select
                            value={subType}
                            onChange={(e) => setSubType(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                          >
                            <option value="">اختر النوع التفصيلي</option>
                            {(Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type) as any)?.subTypes?.map((st: string) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">مستوى الخطورة:</label>
                          <select className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="Low">منخفض</option>
                            <option value="Medium">متوسط</option>
                            <option value="High">مرتفع</option>
                            <option value="Critical">حرج جداً</option>
                          </select>
                        </div>
                      </div>

                      {/* Extra Fields based on type */}
                      {(Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type) as any)?.extraFields?.map((field: any) => (
                        <div key={field.id} className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">{field.label}:</label>
                          {field.type === 'select' ? (
                            <select
                              value={extraDetails[field.id] || ''}
                              onChange={(e) => setExtraDetails(prev => ({ ...prev, [field.id]: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="">اختر {field.label}</option>
                              {field.options.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              value={extraDetails[field.id] || ''}
                              onChange={(e) => setExtraDetails(prev => ({ ...prev, [field.id]: e.target.value }))}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder={field.label}
                            />
                          )}
                        </div>
                      ))}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">التكلفة التقديرية (دج):</label>
                          <div className="relative">
                            <Icons.Price className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="number"
                              value={estimatedCost}
                              onChange={(e) => setEstimatedCost(Number(e.target.value))}
                              className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-gray-700">مستوى الخطورة:</label>
                          <select className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="Low">منخفض</option>
                            <option value="Medium">متوسط</option>
                            <option value="High">مرتفع</option>
                            <option value="Critical">حرج جداً</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">المقترح (طريقة الإصلاح):</label>
                        <input
                          type="text"
                          value={proposal}
                          onChange={(e) => setProposal(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="مثال: إعادة تعبيد، استبدال مصباح..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">ملاحظات المعاينة:</label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                          placeholder="اكتب تفاصيل المعاينة الميدانية..."
                        />
                      </div>

                      {inspectionPhoto ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-blue-100 group">
                          <img src={inspectionPhoto} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setInspectionPhoto(null)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Icons.Close className="w-4 h-4" />
                          </button>
                        </div>
                      ) : showCamera ? (
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button
                              onClick={capturePhoto}
                              className="w-12 h-12 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-lg"
                            >
                              <div className="w-8 h-8 bg-red-500 rounded-full" />
                            </button>
                            <button
                              onClick={stopCamera}
                              className="w-12 h-12 bg-gray-800/80 text-white rounded-full flex items-center justify-center shadow-lg"
                            >
                              <Icons.Close className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex gap-4">
                        <button
                          onClick={handleInspect}
                          disabled={isSubmitting}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all disabled:opacity-50"
                        >
                          {isSubmitting ? 'جاري الإرسال...' : 'إرسال التقرير للبلدية'}
                        </button>
                        <div className="flex gap-2">
                          <button 
                            onClick={startCamera}
                            className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all"
                            title="التقاط صورة"
                          >
                            <Icons.Camera className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all"
                            title="رفع ملف"
                          >
                            <Icons.Add className="w-6 h-6" />
                          </button>
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileSelect} 
                          accept="image/*" 
                          className="hidden" 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100">
                        <h3 className="font-bold text-teal-900 mb-2">تقرير الصيانة:</h3>
                        <p className="text-sm text-teal-800">تم إصلاح العطل وتوثيق العمل بالصور والفيديو.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">ملاحظات التحقق:</label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                          placeholder="اكتب سبب القبول أو الرفض..."
                        />
                      </div>

                      <div className="flex gap-4">
                        <button
                          onClick={() => handleVerify(true)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 transition-all"
                        >
                          قبول العمل
                        </button>
                        <button
                          onClick={() => handleVerify(false)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-red-200 transition-all"
                        >
                          رفض العمل (إعادة صيانة)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <Icons.Navigate className="w-20 h-20 mb-4 opacity-10" />
                <p className="text-lg">اختر بلاغاً من القائمة لمعاينته</p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {isNavigating && selectedReport && (
        <NavigationHUD
          instruction={navigationData.instruction}
          distance={navigationData.distance}
          eta={navigationData.eta}
          totalDistance={navigationData.totalDistance}
          onStop={() => setIsNavigating(false)}
          onRecalculate={() => {
            setRecalculateKey(prev => prev + 1);
            toast.info('جاري إعادة حساب المسار...');
          }}
          destinationName={Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label || 'البلاغ'}
        />
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
