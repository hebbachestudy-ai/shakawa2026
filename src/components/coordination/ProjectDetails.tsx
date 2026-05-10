import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { Icons, cn, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../../constants';
import { Project, CoordinationRequest, DirectorateResponse, Conflict, ProjectLog, ProjectStatus } from '../../types';
import { coordinationService } from '../../services/coordinationService';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { DirectorateResponseForm } from './DirectorateResponse';
import { AdministrativeDecision } from '../../types';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onBack }) => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [requests, setRequests] = useState<CoordinationRequest[]>([]);
  const [responses, setResponses] = useState<DirectorateResponse[]>([]);
  const [decisions, setDecisions] = useState<AdministrativeDecision[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'coordination' | 'conflicts' | 'logs' | 'decisions'>('info');
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionText, setDecisionText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch related data
    const qLogs = query(collection(db, 'project_logs'), where('projectId', '==', project.id), orderBy('createdAt', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectLog))));

    const qReqs = query(collection(db, 'coordination_requests'), where('projectId', '==', project.id));
    const unsubReqs = onSnapshot(qReqs, (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as CoordinationRequest))));

    const qRes = query(collection(db, 'directorate_responses'), where('projectId', '==', project.id));
    const unsubRes = onSnapshot(qRes, (snap) => setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectorateResponse))));

    const qDec = query(collection(db, 'administrative_decisions'), where('projectId', '==', project.id), orderBy('createdAt', 'desc'));
    const unsubDec = onSnapshot(qDec, (snap) => setDecisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdministrativeDecision))));

    return () => {
      unsubLogs();
      unsubReqs();
      unsubRes();
      unsubDec();
    };
  }, [project.id]);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!profile) return;
    try {
      await coordinationService.updateProjectStatus(project.id, profile.uid, newStatus, 'تم تغيير الحالة يدوياً من الشاشة');
      toast.success('تم تحديث حالة المشروع');
    } catch (err) {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleIssueDecision = async (type: string) => {
    if (!profile) return;
    if (!decisionText.trim()) {
      toast.error('يرجى كتابة نص القرار أو التعليمات');
      return;
    }

    setLoading(true);
    try {
      await coordinationService.issueDecision({
        projectId: project.id,
        issuedByUserId: profile.uid,
        issuedByName: profile.name,
        issuedByRole: profile.role as 'wali' | 'Admin',
        decisionType: type as any,
        decisionText: decisionText,
        affectedDirectorates: [project.ownerDirectorateId],
        status: 'Final'
      });
      
      // Update project status based on decision
      if (type === 'freeze_project') await handleStatusChange('cancelled');
      if (type === 'approve_project') await handleStatusChange('ready_to_start');
      if (type === 'confirm_reserved_area') await handleStatusChange('reserved_area');
      
      toast.success('تم إصدار القرار الإداري بنجاح');
      setShowDecisionForm(false);
      setDecisionText('');
      setActiveTab('decisions');
    } catch (err) {
      toast.error('فشل إصدار القرار');
    } finally {
      setLoading(false);
    }
  };

  const isCoordinator = profile?.role === 'Coordinator' || profile?.role === 'Admin' || profile?.role === 'Supervisor';
  const isWali = profile?.role === 'wali' || profile?.role === 'Admin';
  const isOwner = profile?.entity === project.ownerDirectorateId;

  return (
    <div className="bg-white rounded-[32px] overflow-hidden shadow-xl border border-slate-100 animate-slide-up">
      {/* Header */}
      <div className="bg-slate-900 text-white p-8">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <Icons.Chevron className="w-6 h-6 rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <span className={cn("px-4 py-1.5 rounded-full text-xs font-bold border", PROJECT_STATUS_COLORS[project.status])}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
            <span className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              {project.id.slice(-6)}
            </span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-4">{project.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Icons.Briefcase className="w-4 h-4" />
            {project.ownerDirectorateName}
          </div>
          <div className="flex items-center gap-2">
            <Icons.Location className="w-4 h-4" />
            {project.municipality} - {project.locationName}
          </div>
          <div className="flex items-center gap-2">
            <Icons.Calendar className="w-4 h-4" />
            البداية: {project.expectedStartDate}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-8">
        {[
          { id: 'info', label: 'المعلومات', icon: Icons.Reports },
          { id: 'coordination', label: 'التنسيق والردود', icon: Icons.Users },
          { id: 'conflicts', label: 'التعارضات', icon: Icons.AlertTriangle },
          { id: 'decisions', label: 'القرارات الإدارية', icon: Icons.ShieldCheck },
          { id: 'logs', label: 'سجل العمليات', icon: Icons.Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-5 font-bold text-sm transition-all border-b-2",
              activeTab === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-8">
        {showResponseForm && (
          <div className="mb-8 animate-scale-up">
            <DirectorateResponseForm 
              project={project} 
              onComplete={() => { setShowResponseForm(false); setActiveTab('coordination'); }}
              onCancel={() => setShowResponseForm(false)}
            />
          </div>
        )}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h3 className="font-bold text-lg mb-4">وصف المشروع</h3>
                <p className="text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl">{project.description}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">البلدية</p>
                  <p className="font-bold text-sm">{project.municipality}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">مدة الإنجاز</p>
                  <p className="font-bold text-sm">{project.expectedDuration}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">الميزانية</p>
                  <p className="font-bold text-sm">{project.budgetStatus === 'Available' ? 'متوفرة' : 'في انتظار التمويل'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50">
                  <p className="text-[10px] text-slate-500 uppercase mb-1">الأولوية</p>
                  <p className={cn("font-bold text-sm", project.priority === 'High' ? "text-red-600" : "text-emerald-600")}>
                    {project.priority === 'High' ? 'عالية' : 'متوسطة'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6">
                <h3 className="font-bold text-sm mb-4">الموقع على الخريطة</h3>
                <div className="aspect-video bg-white rounded-xl flex items-center justify-center border border-slate-200">
                  <p className="text-slate-400 text-sm">خريطة مصغرة للموقع ({project.latitude}, {project.longitude})</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-[24px] border border-slate-100">
                <h3 className="font-bold text-sm mb-6">إجراءات سريعة</h3>
                <div className="space-y-3">
                  {isWali && (
                    <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 mb-4">
                      <p className="text-[10px] font-bold text-brand-primary uppercase mb-3 flex items-center gap-2">
                        <Icons.ShieldCheck className="w-3 h-3" />
                        صلاحيات الوالي
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => setShowDecisionForm(true)}
                          className="w-full py-2.5 px-4 rounded-xl bg-brand-primary text-white font-bold text-xs flex items-center gap-2 justify-center shadow-lg shadow-brand-primary/20"
                        >
                          <Icons.Edit className="w-3.5 h-3.5" />
                          إصدار قرار أو تعليمات
                        </button>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button 
                            onClick={() => coordinationService.updatePriority(project.id, profile.uid, 'Critical')}
                            className="py-2 px-3 rounded-xl bg-red-100 text-red-600 font-bold text-[10px] hover:bg-red-200"
                          >
                            أولوية قصوى
                          </button>
                          <button 
                            onClick={() => coordinationService.requestMeeting(project.id, profile.uid, 'اجتماع تنسيقي بطلب من الوالي')}
                            className="py-2 px-3 rounded-xl bg-blue-100 text-blue-600 font-bold text-[10px] hover:bg-blue-200"
                          >
                            طلب اجتماع
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {isCoordinator && (
                    <>
                      <button 
                        onClick={() => handleStatusChange('under_review')}
                        className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 justify-center"
                      >
                        <Icons.Reports className="w-4 h-4" />
                        إرسال طلبات التنسيق
                      </button>
                      <button 
                        onClick={() => handleStatusChange('ready_to_start')}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 justify-center"
                      >
                        <Icons.Check className="w-4 h-4" />
                        جاهز للانطلاق
                      </button>
                      <button className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 justify-center">
                        <Icons.ShieldCheck className="w-4 h-4" />
                        إصدار شهادة
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <button className="w-full py-3 px-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex items-center gap-2 justify-center">
                      <Icons.Edit className="w-4 h-4" />
                      تعديل بيانات المشروع
                    </button>
                  )}
                  {(profile?.role === 'Authority' || profile?.role === 'Coordinator') && !isOwner && (
                    <button 
                      onClick={() => setShowResponseForm(true)}
                      className="w-full py-3 px-4 rounded-xl bg-brand-primary text-white font-bold text-sm flex items-center gap-2 justify-center"
                    >
                      <Icons.Reports className="w-4 h-4" />
                      الرد على الطلب
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coordination' && (
          <div className="space-y-8 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">طلبات التنسيق المرسلة</h3>
              {isCoordinator && (
                <button className="btn-primary py-2 px-6 text-xs">إضافة طلب جديد</button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {responses.map(res => (
                <div key={res.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-900">{res.directorateName}</span>
                    <span className={cn(
                      "text-[10px] px-2 py-1 rounded-full font-bold",
                      res.responseType === 'NoConflict' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {res.responseType === 'NoConflict' ? 'لا يوجد تعارض' : 'يوجد ملاحظات'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200">{res.comment}</p>
                  <div className="text-[10px] text-slate-400">التاريخ: {new Date(res.createdAt).toLocaleDateString('ar-DZ')}</div>
                </div>
              ))}
              {responses.length === 0 && <p className="col-span-full text-center py-12 text-slate-400">لا توجد ردود حتى الآن</p>}
            </div>
          </div>
        )}

        {showDecisionForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl animate-scale-up">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">إصدار قرار إداري رسمي</h3>
                <button onClick={() => setShowDecisionForm(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <Icons.Close className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <textarea
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  placeholder="اكتب نص القرار أو التعليمات الرسمية هنا..."
                  className="w-full h-40 p-5 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleIssueDecision('approve_project')}
                    className="py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold text-xs"
                  >
                    اعتماد المشروع
                  </button>
                  <button 
                    onClick={() => handleIssueDecision('reject_project')}
                    className="py-3 px-4 bg-red-600 text-white rounded-xl font-bold text-xs"
                  >
                    رفض / إلغاء المشروع
                  </button>
                  <button 
                    onClick={() => handleIssueDecision('freeze_project')}
                    className="py-3 px-4 bg-slate-900 text-white rounded-xl font-bold text-xs"
                  >
                    تجميد المشروع مؤقتاً
                  </button>
                  <button 
                    onClick={() => handleIssueDecision('confirm_reserved_area')}
                    className="py-3 px-4 bg-teal-600 text-white rounded-xl font-bold text-xs"
                  >
                    تأكيد حجز المجال
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">القرارات والتعليمات الإدارية</h3>
              {isWali && (
                <button onClick={() => setShowDecisionForm(true)} className="btn-primary py-2 px-6 text-xs">إصدار قرار جديد</button>
              )}
            </div>
            <div className="space-y-4">
              {decisions.map(decision => (
                <div key={decision.id} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                        <Icons.ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{decision.issuedByName}</p>
                        <p className="text-[10px] text-slate-500">{decision.issuedByRole === 'wali' ? 'الوالي' : 'المدير العام'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">{new Date(decision.createdAt).toLocaleString('ار-DZ')}</span>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{decision.decisionText}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold">
                      {decision.decisionType}
                    </span>
                  </div>
                </div>
              ))}
              {decisions.length === 0 && (
                <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                   <Icons.Reports className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                   <p className="text-slate-500 font-medium">لا توجد قرارات إدارية مسجلة لهذا المشروع</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4 animate-slide-up">
            {logs.map((log, idx) => (
              <div key={log.id} className="relative flex gap-4 pl-4 group">
                {idx !== logs.length - 1 && <div className="absolute top-8 bottom-0 right-4 w-px bg-slate-100 group-hover:bg-brand-primary/20 transition-all"></div>}
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 z-10">
                  <Icons.Clock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="pb-8">
                  <p className="font-bold text-sm text-slate-900">{log.action}</p>
                  {log.note && <p className="text-xs text-slate-500 mt-1">{log.note}</p>}
                  <p className="text-[10px] text-slate-400 mt-2">{new Date(log.createdAt).toLocaleString('ar-DZ')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
