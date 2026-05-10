import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Icons, cn, REPORT_TYPES, STATUS_COLORS, STATUS_LABELS } from '../constants';
import { Report } from '../types';
import { get, keys } from 'idb-keyval';

interface CitizenReportsProps {
  reports?: Report[];
}

const NoteContent: React.FC<{ note: string }> = ({ note }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 100;
  const shouldTruncate = note.length > maxLength;

  if (!shouldTruncate) {
    return <p className="text-slate-700 leading-relaxed">{note}</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-slate-700 leading-relaxed">
        {isExpanded ? note : `${note.slice(0, maxLength)}...`}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-brand-primary text-xs font-bold hover:underline"
      >
        {isExpanded ? 'عرض أقل' : 'اقرأ المزيد'}
      </button>
    </div>
  );
};

export const CitizenReports: React.FC<CitizenReportsProps> = ({ reports: initialReports }) => {
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>(initialReports || []);
  const [offlineReports, setOfflineReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialReports);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (initialReports) {
      setReports(initialReports);
      setLoading(false);
    }
  }, [initialReports]);

  useEffect(() => {
    // Load offline reports
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

    if (!profile || initialReports) return;

    // Load online reports
    const q = query(
      collection(db, 'reports'),
      where('citizenUid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [profile]);

  if (selectedReport) {
    return (
      <div className="space-y-6 animate-slide-up">
        <button 
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-brand-primary transition-colors mb-4"
        >
          <Icons.Chevron className="w-4 h-4 rotate-180" />
          <span>العودة للقائمة</span>
        </button>

        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="grid grid-cols-2 gap-1 bg-slate-200">
            <div className="relative">
              <img src={selectedReport.photoUrl} className="w-full aspect-square object-cover" alt="Report" />
              <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">صورة البلاغ</span>
            </div>
            {selectedReport.landmarkPhotoUrl ? (
              <div className="relative">
                <img src={selectedReport.landmarkPhotoUrl} className="w-full aspect-square object-cover" alt="Landmark" />
                <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">معالم المكان</span>
              </div>
            ) : (
              <div className="bg-slate-100 flex items-center justify-center aspect-square">
                <Icons.Location className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </div>
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                    {selectedReport.serialNumber || 'بدون رقم'}
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === selectedReport.type)?.label || selectedReport.type}
                  </h2>
                </div>
                <p className="text-slate-500 text-sm">
                  تم التبليغ في {new Date(selectedReport.createdAt).toLocaleString('ar-DZ')}
                </p>
              </div>
              <span className={cn("px-4 py-1.5 rounded-full font-bold text-sm shadow-sm", STATUS_COLORS[selectedReport.status] || "bg-slate-100 text-slate-600")}>
                {STATUS_LABELS[selectedReport.status] || selectedReport.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs text-slate-400 mb-1">الدائرة</p>
                <p className="font-bold text-slate-700">{selectedReport.district}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs text-slate-400 mb-1">البلدية</p>
                <p className="font-bold text-slate-700">{selectedReport.municipality}</p>
              </div>
            </div>

            {selectedReport.subType && (
              <div className="bg-brand-primary/5 p-4 rounded-2xl border border-brand-primary/10">
                <p className="text-xs text-brand-primary font-bold mb-1">النوع التفصيلي</p>
                <p className="font-bold text-slate-800">{selectedReport.subType}</p>
              </div>
            )}

            {selectedReport.extraDetails && Object.keys(selectedReport.extraDetails).length > 0 && (
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <p className="text-xs text-slate-400 border-b border-slate-200 pb-1">تفاصيل إضافية</p>
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

            {selectedReport.note && (
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs text-slate-400 mb-1">الملاحظات</p>
                <NoteContent note={selectedReport.note} />
              </div>
            )}

            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Icons.Alert className="w-4 h-4 text-brand-primary" />
                تتبع حالة البلاغ
              </h4>
              <div className="relative pr-4 border-r-2 border-slate-100 space-y-8 py-2">
                {[
                  { status: 'New', label: 'تم استلام البلاغ', desc: 'تم تسجيل بلاغك في النظام بنجاح' },
                  { status: 'Inspected', label: 'تمت المعاينة', desc: 'قام المفتش بمعاينة الموقع وتحديد حجم الضرر' },
                  { status: 'Repairing', label: 'جاري الإصلاح', desc: 'فريق الصيانة يعمل حالياً على إصلاح العطب' },
                  { status: 'Repaired', label: 'تم الإصلاح', desc: 'تم الانتهاء من أعمال الصيانة' },
                  { status: 'Verified', label: 'تم التأكيد', desc: 'تم التأكد من جودة الإصلاح وإغلاق البلاغ' }
                ].map((step, index) => {
                  const isCompleted = ['New', 'Inspected', 'Repairing', 'Repaired', 'Verified'].indexOf(selectedReport.status) >= ['New', 'Inspected', 'Repairing', 'Repaired', 'Verified'].indexOf(step.status);
                  return (
                    <div key={step.status} className="relative">
                      <div className={cn(
                        "absolute -right-[25px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-colors",
                        isCompleted ? "bg-brand-primary" : "bg-slate-200"
                      )} />
                      <div className={cn("transition-opacity", isCompleted ? "opacity-100" : "opacity-40")}>
                        <p className="font-bold text-slate-900 text-sm">{step.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <Icons.Reports className="w-5 h-5 text-brand-primary" />
        بلاغاتي ({reports.length + offlineReports.length})
      </h3>
      
      <div className="space-y-4">
        {loading && reports.length === 0 && offlineReports.length === 0 ? (
          <div className="text-center py-10 text-slate-400">جاري تحميل البلاغات...</div>
        ) : reports.length === 0 && offlineReports.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-white rounded-3xl border border-slate-100">
            <Icons.Reports className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>لم تقم بإرسال أي بلاغات بعد</p>
          </div>
        ) : (
          <>
            {offlineReports.map((report) => (
              <div key={report.id} className="glass-card p-4 rounded-2xl flex items-center gap-4 border-dashed border-brand-secondary/50 bg-brand-secondary/5">
                <img src={report.photo} className="w-16 h-16 rounded-xl object-cover shadow-sm grayscale" alt="Offline Report" />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">
                    {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label || report.type}
                  </p>
                  {report.subType && (
                    <p className="text-[11px] text-brand-secondary font-medium">{report.subType}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-secondary/10 text-brand-secondary">
                      في انتظار المزامنة (أوفلاين)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(report.createdAt).toLocaleDateString('ar-DZ')}
                    </span>
                  </div>
                </div>
                <Icons.Alert className="w-4 h-4 text-brand-secondary animate-pulse" />
              </div>
            ))}
            {reports.map((report) => (
              <button 
                key={report.id} 
                onClick={() => setSelectedReport(report)}
                className="w-full glass-card p-4 rounded-2xl flex items-center gap-4 hover:border-brand-primary/30 transition-all group text-right"
              >
                <img src={report.photoUrl} className="w-16 h-16 rounded-xl object-cover shadow-sm" alt="Report" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-bold text-slate-900">
                      {Object.values(REPORT_TYPES).flat().find((t: any) => t.id === report.type)?.label || report.type}
                    </p>
                    <span className="text-[9px] font-mono font-bold text-slate-400">
                      {report.serialNumber || '---'}
                    </span>
                  </div>
                  {report.subType && (
                    <p className="text-[11px] text-brand-primary font-medium">{report.subType}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", STATUS_COLORS[report.status] || "bg-slate-100 text-slate-600")}>
                      {STATUS_LABELS[report.status] || report.status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(report.createdAt).toLocaleDateString('ar-DZ')}
                    </span>
                  </div>
                </div>
                <Icons.Chevron className="w-4 h-4 text-slate-300 group-hover:text-brand-primary transition-colors" />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
