import React from 'react';
import { Conflict, Project } from '../../types';
import { Icons, cn } from '../../constants';
import { useAuth } from '../../AuthContext';
import { coordinationService } from '../../services/coordinationService';
import { toast } from 'sonner';

interface ConflictListProps {
  conflicts: Conflict[];
  projects: Project[];
}

export const ConflictList: React.FC<ConflictListProps> = ({ conflicts, projects }) => {
  const { profile } = useAuth();

  const handleResolve = async (conflictId: string, projectId: string, resolution: string) => {
    if (!profile) return;
    try {
      await coordinationService.resolveConflict(conflictId, projectId, profile.uid, resolution);
      toast.success('تم حل التعارض واعتماد المسار');
    } catch (err) {
      toast.error('فشل معالجة التعارض');
    }
  };

  const isWali = profile?.role === 'wali' || profile?.role === 'Admin';

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
          <Icons.AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-red-900">إدارة التعارضات المكتشفة</h2>
          <p className="text-sm text-red-700/80">تنبيه آلي للمشاريع التي تتقاطع في الزمان أو المكان.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {conflicts.map(conflict => {
          const p1 = projects.find(p => p.id === conflict.projectId);
          const p2 = projects.find(p => p.id === conflict.conflictingProjectId);
          
          return (
            <div key={conflict.id} className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-6">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold",
                  conflict.status === 'Detected' ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  {conflict.status === 'Detected' ? 'تعارض نشط' : 'تم الحل'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-tight">{conflict.id}</span>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase mb-1">المشروع الأول</p>
                  <p className="font-bold text-sm text-slate-900">{p1?.title || 'مشروع غير متاح'}</p>
                </div>
                
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                    <Icons.Close className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase mb-1">المشروع المتعارض معه</p>
                  <p className="font-bold text-sm text-slate-900">{p2?.title || 'مشروع غير متاح'}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-600 font-medium mb-4">{conflict.description}</p>
                <div className="flex gap-2">
                  {isWali && conflict.status === 'Detected' ? (
                    <div className="flex flex-col w-full gap-2">
                      <button 
                        onClick={() => handleResolve(conflict.id, conflict.projectId, 'اعتماد المشروع الأول كأولوية')}
                        className="w-full py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-lg shadow-brand-primary/20"
                      >
                        قرار: اعتماد المشروع الأول
                      </button>
                      <button 
                        onClick={() => handleResolve(conflict.id, conflict.projectId, 'اعتماد المشروع الثاني كأولوية')}
                        className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                      >
                        قرار: اعتماد المشروع الثاني
                      </button>
                    </div>
                  ) : (
                    <>
                      <button className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all">
                        فتح اجتماع تنسيقي
                      </button>
                      <button className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-all">
                        تقرير التحليل المخطط
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {conflicts.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">لا يوجد تعارضات</h3>
            <p className="text-slate-500 text-sm">كل المشاريع الحالية متوافقة مكانياً وزمانياً</p>
          </div>
        )}
      </div>
    </div>
  );
};
