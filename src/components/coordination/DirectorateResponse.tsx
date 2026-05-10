import React, { useState } from 'react';
import { useAuth } from '../../AuthContext';
import { Project } from '../../types';
import { Icons, cn } from '../../constants';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';

interface DirectorateResponseProps {
  project: Project;
  onComplete: () => void;
  onCancel: () => void;
}

export const DirectorateResponseForm: React.FC<DirectorateResponseProps> = ({ project, onComplete, onCancel }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState({
    responseType: 'NoConflict' as 'NoConflict' | 'Conflict' | 'ActionRequired',
    comment: '',
    suggestedDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profile.entity) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'directorate_responses'), {
        projectId: project.id,
        directorateId: profile.entity,
        directorateName: profile.name,
        responseType: response.responseType,
        comment: response.comment,
        suggestedDate: response.suggestedDate,
        createdAt: new Date().toISOString(),
      });

      // Update project if needed or log
      await addDoc(collection(db, 'project_logs'), {
        projectId: project.id,
        userId: profile.uid,
        action: `تم تقديم رد من ${profile.name}`,
        note: response.comment,
        createdAt: new Date().toISOString()
      });

      toast.success('تم إرسال ردك بنجاح');
      onComplete();
    } catch (err) {
      toast.error('فشل في إرسال الرد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 leading-tight">الرد على طلب التنسيق لـ:<br/><span className="text-brand-primary">{project.title}</span></h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full">
          <Icons.Close className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'NoConflict', label: 'لا يوجد تعارض', icon: Icons.Check, color: 'text-emerald-600 bg-emerald-50' },
            { id: 'ActionRequired', label: 'توجد ملاحظات', icon: Icons.Alert, color: 'text-orange-600 bg-orange-50' },
            { id: 'Conflict', label: 'يوجد تعارض', icon: Icons.Close, color: 'text-red-600 bg-red-50' },
          ].map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => setResponse({...response, responseType: type.id as any})}
              className={cn(
                "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                response.responseType === type.id ? "border-brand-primary bg-brand-primary/5" : "border-slate-50 opacity-60 hover:opacity-100"
              )}
            >
              <type.icon className={cn("w-6 h-6", type.color)} />
              <span className="text-xs font-bold">{type.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">ملاحظات تقنية</label>
          <textarea
            required
            value={response.comment}
            onChange={(e) => setResponse({...response, comment: e.target.value})}
            rows={4}
            placeholder="يرجى ذكر أي ملاحظات بخصوص الشبكات التحتية (غاز، ماء، كهرباء) في منطقة المشروع..."
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">تاريخ مقترح (اختياري)</label>
          <input
            type="date"
            value={response.suggestedDate}
            onChange={(e) => setResponse({...response, suggestedDate: e.target.value})}
            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-brand-primary/30 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Icons.Clock className="w-5 h-5 animate-spin" /> : <Icons.Check className="w-5 h-5" />}
            إرسال الرد الرسمي
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
};
