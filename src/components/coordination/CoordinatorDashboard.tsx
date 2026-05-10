import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { Icons, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, cn, Logo, ENTITIES } from '../../constants';
import { auth, db } from '../../firebase';
import { Project, CoordinationRequest, Conflict, NoConflictCertificate } from '../../types';
import { coordinationService } from '../../services/coordinationService';
import { ProjectList } from './ProjectList';
import { CreateProject } from './CreateProject';
import { ProjectDetails } from './ProjectDetails';
import { ConflictList } from './ConflictList';
import { CertificateList } from './CertificateList';
import { toast } from 'sonner';

export const CoordinatorDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'projects' | 'create' | 'conflicts' | 'certs' | 'requests'>('home');
  const [projects, setProjects] = useState<Project[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubProjects = coordinationService.subscribeToProjects((data) => {
      setProjects(data);
      setLoading(false);
    });

    const unsubConflicts = coordinationService.subscribeToConflicts((data) => {
      setConflicts(data);
    });

    return () => {
      unsubProjects();
      unsubConflicts();
    };
  }, []);

  const stats = {
    total: projects.length,
    new: projects.filter(p => p.status === 'under_review').length,
    waiting: projects.filter(p => p.status === 'waiting_for_directorates').length,
    conflicts: conflicts.filter(c => c.status === 'Detected').length,
    ready: projects.filter(p => p.status === 'ready_to_start').length,
    reserved: projects.filter(p => p.status === 'reserved_area' || p.status === 'waiting_for_budget').length,
  };

  if (loading) return <div className="flex items-center justify-center h-screen">جاري تحميل بيانات التنسيق...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans rtl" dir="rtl">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
            <p className="text-xs text-slate-500">
              {profile?.role === 'Coordinator' ? `منسق إداري - ${ENTITIES.find(e => e.id === profile?.entity)?.label || ''}` : 
               profile?.role === 'Supervisor' ? 'المشرف العام' : 
               profile?.role === 'Admin' ? 'المدير العام' : 'مسؤول التنسيق'}
            </p>
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
        {/* Menu Tabs */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => { setActiveTab('home'); setSelectedProject(null); }}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'home' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Dashboard className="w-5 h-5" />
            لوحة التحكم
          </button>
          <button
            onClick={() => { setActiveTab('projects'); setSelectedProject(null); }}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'projects' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Reports className="w-5 h-5" />
            قائمة المشاريع
          </button>
          <button
            onClick={() => { setActiveTab('create'); setSelectedProject(null); }}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'create' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.Add className="w-5 h-5" />
            إضافة مشروع
          </button>
          <button
            onClick={() => { setActiveTab('conflicts'); setSelectedProject(null); }}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'conflicts' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.AlertTriangle className="w-5 h-5" />
            التعارضات
            {stats.conflicts > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.conflicts}</span>}
          </button>
          <button
            onClick={() => { setActiveTab('certs'); setSelectedProject(null); }}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0",
              activeTab === 'certs' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icons.ShieldCheck className="w-5 h-5" />
            شهادات عدم التعارض
          </button>
        </div>

        {/* Tab Content */}
        {selectedProject ? (
          <ProjectDetails 
            project={selectedProject} 
            onBack={() => setSelectedProject(null)} 
          />
        ) : activeTab === 'home' ? (
          <div className="space-y-8 animate-slide-up">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="glass-card p-4 rounded-2xl text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">المشاريع الجديدة</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.new}</h3>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">بانتظار الردود</p>
                <h3 className="text-2xl font-bold text-blue-600">{stats.waiting}</h3>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center border-red-100">
                <p className="text-[10px] text-red-500 uppercase tracking-wider mb-1">تعارضات مكتشفة</p>
                <h3 className="text-2xl font-bold text-red-600">{stats.conflicts}</h3>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">جاهزة للانطلاق</p>
                <h3 className="text-2xl font-bold text-emerald-600">{stats.ready}</h3>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">مجالات محجوزة</p>
                <h3 className="text-2xl font-bold text-teal-600">{stats.reserved}</h3>
              </div>
              <div className="glass-card p-4 rounded-2xl text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">الإجمالي</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Icons.Clock className="w-5 h-5 text-brand-primary" />
                  آخر المشاريع المضافة
                </h3>
                <div className="space-y-3">
                  {projects.slice(0, 5).map(project => (
                    <div 
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-sm">{project.title}</p>
                        <p className="text-xs text-slate-500">{project.ownerDirectorateName}</p>
                      </div>
                      <span className={cn("text-[10px] px-2 py-1 rounded-full font-bold", PROJECT_STATUS_COLORS[project.status])}>
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </div>
                  ))}
                  {projects.length === 0 && <p className="text-center text-slate-400 py-8">لا توجد مشاريع مسجلة حالياً</p>}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-600">
                  <Icons.AlertTriangle className="w-5 h-5" />
                  آخر التعارضات المكتشفة
                </h3>
                <div className="space-y-3">
                  {conflicts.slice(0, 5).map(conflict => {
                    const p1 = projects.find(p => p.id === conflict.projectId);
                    const p2 = projects.find(p => p.id === conflict.conflictingProjectId);
                    return (
                      <div key={conflict.id} className="p-4 rounded-2xl bg-red-50 border border-red-100 space-y-2">
                        <p className="text-xs font-bold text-red-800">{conflict.description}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-bold">{p1?.title || 'مشروع 1'}</span>
                          <Icons.Chevron className="w-3 h-3 rotate-180" />
                          <span className="font-bold">{p2?.title || 'مشروع 2'}</span>
                        </div>
                      </div>
                    );
                  })}
                  {conflicts.length === 0 && <p className="text-center text-slate-400 py-8">لا توجد تعارضات نشطة</p>}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'projects' ? (
          <ProjectList 
            projects={projects} 
            onSelect={setSelectedProject} 
          />
        ) : activeTab === 'create' ? (
          <CreateProject onComplete={() => setActiveTab('projects')} />
        ) : activeTab === 'conflicts' ? (
          <ConflictList conflicts={conflicts} projects={projects} />
        ) : activeTab === 'certs' ? (
          <CertificateList projects={projects} />
        ) : null}
      </main>
    </div>
  );
};
