import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { Icons, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, cn, Logo, ENTITIES } from '../../constants';
import { db, auth } from '../../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { Project, Report, Conflict, ProjectLog } from '../../types';
import { ProjectList } from './ProjectList';
import { ConflictList } from './ConflictList';
import { ProjectMap } from './ProjectMap';
import { ProjectDetails } from './ProjectDetails';

export const WaliDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'projects' | 'conflicts' | 'reports' | 'performance'>('overview');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Data State
  const [stats, setStats] = useState({
    reportsTotal: 0,
    reportsProcessed: 0,
    reportsDelayed: 0,
    projectsTotal: 0,
    projectsInProgress: 0,
    projectsWaitingBudget: 0,
    projectsReserved: 0,
    conflictsTotal: 0,
    conflictsResolved: 0,
    directorateDelays: 0
  });

  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentConflicts, setRecentConflicts] = useState<Conflict[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allConflicts, setAllConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Listen to Projects
    const qProjects = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubProjects = onSnapshot(qProjects, (snap) => {
      const projects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setAllProjects(projects);
      setRecentProjects(projects.slice(0, 5));
      
      const pStats = {
        total: projects.length,
        inProgress: projects.filter(p => p.status === 'in_progress').length,
        waitingBudget: projects.filter(p => p.status === 'waiting_for_budget').length,
        reserved: projects.filter(p => p.status === 'reserved_area').length
      };

      setStats(prev => ({
        ...prev,
        projectsTotal: pStats.total,
        projectsInProgress: pStats.inProgress,
        projectsWaitingBudget: pStats.waitingBudget,
        projectsReserved: pStats.reserved
      }));
    });

    // Listen to Conflicts
    const qConflicts = query(collection(db, 'conflicts'), orderBy('createdAt', 'desc'));
    const unsubConflicts = onSnapshot(qConflicts, (snap) => {
      const conflicts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conflict));
      setAllConflicts(conflicts);
      setRecentConflicts(conflicts.filter(c => c.status === 'Detected').slice(0, 5));
      
      setStats(prev => ({
        ...prev,
        conflictsTotal: conflicts.filter(c => c.status === 'Detected').length,
        conflictsResolved: conflicts.filter(c => c.status === 'Resolved').length
      }));
    });

    // Listen to Reports (Complaints)
    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubReports = onSnapshot(qReports, (snap) => {
      const reports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      setRecentReports(reports.slice(0, 5));
      
      setStats(prev => ({
        ...prev,
        reportsTotal: reports.length,
        reportsProcessed: reports.filter(r => r.status === 'Repaired' || r.status === 'Verified').length,
        // Simple delay logic: more than 7 days and still new/inspected
        reportsDelayed: reports.filter(r => {
          const created = new Date(r.createdAt).getTime();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          return (Date.now() - created > sevenDays) && (r.status === 'New' || r.status === 'Inspected');
        }).length
      }));
      setLoading(false);
    });

    return () => {
      unsubProjects();
      unsubConflicts();
      unsubReports();
    };
  }, [profile]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 rtl" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo className="scale-90" />
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              {[
                { id: 'overview', label: 'الرؤية العامة', icon: Icons.Dashboard },
                { id: 'map', label: 'خريطة الولاية', icon: Icons.Map },
                { id: 'projects', label: 'المشاريع', icon: Icons.Briefcase },
                { id: 'conflicts', label: 'فض النزاعات', icon: Icons.AlertTriangle },
                { id: 'reports', label: 'متابعة البلاغات', icon: Icons.Reports },
                { id: 'performance', label: 'الأداء والفعالية', icon: Icons.TrendingUp },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab.id 
                      ? "bg-white text-brand-primary shadow-sm shadow-brand-primary/10" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">{profile?.name}</p>
              <p className="text-xs text-brand-primary font-bold">والي الولاية</p>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-slate-600"
            >
              <Icons.Logout className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-10">
        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard 
                title="إجمالي البلاغات" 
                value={stats.reportsTotal} 
                subtitle={`${stats.reportsProcessed} معالجة`} 
                icon={Icons.Reports}
                color="blue"
              />
              <StatCard 
                title="بلاغات متأخرة" 
                value={stats.reportsDelayed} 
                subtitle="تحتاج تدخل فوري" 
                icon={Icons.Clock}
                color="red"
              />
              <StatCard 
                title="مشاريع الولاية" 
                value={stats.projectsTotal} 
                subtitle={`${stats.projectsInProgress} قيد الإنجاز`} 
                icon={Icons.Briefcase}
                color="emerald"
              />
              <StatCard 
                title="تعارضات نشطة" 
                value={stats.conflictsTotal} 
                subtitle={`${stats.conflictsResolved} تم حلها`} 
                icon={Icons.AlertTriangle}
                color="orange"
              />
              <StatCard 
                title="أماكن محجوزة" 
                value={stats.projectsReserved} 
                subtitle="مشاريع مستقبلية" 
                icon={Icons.Location}
                color="teal"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Conflict Monitoring */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Icons.AlertTriangle className="w-5 h-5" />
                    </div>
                    التعارضات التي تحتاج قراراً استراتيجياً
                  </h2>
                  <button onClick={() => setActiveTab('conflicts')} className="text-sm font-bold text-brand-primary hover:underline">
                    عرض الكل
                  </button>
                </div>
                <ConflictList 
                  conflicts={recentConflicts} 
                  projects={allProjects}
                />
              </div>

              {/* Reports Dashboard Summary */}
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Icons.Reports className="w-5 h-5" />
                  </div>
                  آخر البلاغات الكبرى
                </h2>
                <div className="space-y-4">
                  {recentReports.map(report => (
                    <div key={report.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
                      <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0">
                        <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{report.type}</p>
                        <p className="text-xs text-slate-500 truncate">{report.note}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-bold",
                            report.severity === 'Critical' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {report.severity}
                          </span>
                          <span className="text-[10px] text-slate-400">{new Date(report.createdAt).toLocaleDateString('ar-DZ')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setActiveTab('reports')} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                    متابعة كافة البلاغات
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Monitoring Section */}
            <div className="bg-white rounded-[32px] p-8 border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">مؤشرات أداء المديريات</h2>
                    <p className="text-slate-500 mt-1">تتبع سرعة الاستجابة والتنسيق بين مختلف المصالح الولائية</p>
                  </div>
                  <Icons.TrendingUp className="w-8 h-8 text-slate-300" />
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                 {ENTITIES.map(entity => {
                   const directorateProjects = allProjects.filter(p => p.ownerDirectorateId === entity.id);
                   const delayCount = allConflicts.filter(c => 
                     allProjects.find(p => p.id === c.projectId)?.ownerDirectorateId === entity.id
                   ).length;

                   return (
                    <div key={entity.id} className="space-y-4 p-6 rounded-2xl border border-slate-50 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <entity.icon className="w-5 h-5 text-brand-primary" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm truncate">{entity.label}</span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-slate-900">{directorateProjects.length}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">إجمالي المشاريع</p>
                        </div>
                        <div className={cn(
                          "w-16 h-8 rounded-full flex items-center justify-center",
                          delayCount > 0 ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          <span className="text-[10px] font-bold">{delayCount > 0 ? `${delayCount} تعارض` : 'مثالي'}</span>
                        </div>
                      </div>
                    </div>
                   );
                 })}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="h-[calc(100vh-180px)] bg-white rounded-[32px] border border-slate-100 overflow-hidden relative shadow-2xl shadow-brand-primary/5">
            <ProjectMap projects={allProjects} fullScreen />
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6">
            {selectedProject ? (
              <ProjectDetails 
                project={selectedProject} 
                onBack={() => setSelectedProject(null)} 
              />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">سجل مشاريع الولاية</h2>
                  <div className="flex gap-4">
                    <button className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2">
                      <Icons.Reports className="w-4 h-4" />
                      تصدير تقرير استراتيجي
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {['all', 'in_progress', 'waiting_for_budget', 'reserved_area'].map(filter => (
                    <button 
                      key={filter}
                      className="p-4 bg-white rounded-2xl border border-slate-100 text-right hover:shadow-md transition-all"
                    >
                      <p className="text-xs text-slate-500 font-bold">{PROJECT_STATUS_LABELS[filter] || 'الكل'}</p>
                      <p className="text-xl font-black text-slate-900">
                        {filter === 'all' ? allProjects.length : allProjects.filter(p => p.status === filter).length}
                      </p>
                    </button>
                  ))}
                </div>
                <ProjectList 
                  projects={allProjects} 
                  onSelect={(p) => setSelectedProject(p)} 
                  hideCreation
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h2 className="text-2xl font-bold text-slate-900">متابعة كافة بلاغات الولاية</h2>
               <div className="flex gap-2">
                 <button className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-bold text-xs">عرض المتأخرة فقط</button>
                 <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">فلترة حسب البلدية</button>
               </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {recentReports.map(report => (
                 <div key={report.id} className="bg-white rounded-[32px] p-6 border border-slate-100 hover:shadow-xl transition-all">
                   <div className="relative aspect-video rounded-2xl overflow-hidden mb-4">
                     <img src={report.photoUrl} alt="" className="w-full h-full object-cover" />
                     <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-brand-primary">
                       {report.type}
                     </div>
                   </div>
                   <h3 className="font-bold text-slate-900 mb-2 truncate">{report.note}</h3>
                   <div className="flex items-center justify-between text-[10px] text-slate-500">
                     <div className="flex items-center gap-2">
                       <Icons.Location className="w-3 h-3" />
                       <span>{report.municipality}</span>
                     </div>
                     <span className="font-bold">{new Date(report.createdAt).toLocaleDateString('ar-DZ')}</span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="space-y-6">
             <div className="p-8 bg-brand-primary text-white rounded-[32px] mb-10 overflow-hidden relative shadow-2xl shadow-brand-primary/20">
               <div className="relative z-10 max-w-2xl">
                 <h2 className="text-3xl font-black mb-4 leading-tight text-white">إدارة النزاعات والمصادقة الإدارية</h2>
                 <p className="text-white/80 leading-relaxed font-medium">بصفتك والي الولاية، تملك الصلاحية النهائية للفصل في التعارضات المعقدة بين المديريات والمصادقة على حلول المنسق الإداري.</p>
               </div>
               <Icons.ShieldCheck className="absolute -bottom-10 -right-10 w-64 h-64 text-white/10 rotate-12" />
             </div>
             <ConflictList 
               conflicts={allConflicts} 
               projects={allProjects}
             />
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-8 rounded-[32px] border border-slate-100">
                <h3 className="text-xl font-bold mb-6">أسرع المديريات استجابة</h3>
                <div className="space-y-6">
                  {ENTITIES.map((ent, idx) => (
                    <div key={ent.id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-bold">{ent.label}</span>
                          <span className="text-xs text-emerald-600 font-bold">98%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", idx === 0 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: idx === 0 ? '98%' : '85%' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-slate-100">
                <h3 className="text-xl font-bold mb-6">توزيع البلاغات حسب البلديات</h3>
                {/* Mock data for visualization */}
                <div className="space-y-4">
                  {['المدية', 'وزرة', 'البرواقية', 'بني سليمان'].map(mun => (
                    <div key={mun} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="font-bold text-sm">{mun}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 font-bold">42 بلاغ</span>
                        <div className="w-24 h-2 bg-blue-100 rounded-full overflow-hidden">
                          <div className="w-2/3 h-full bg-blue-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-500/10',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/10',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 shadow-orange-500/10',
    red: 'bg-red-50 text-red-600 border-red-100 shadow-red-500/10',
    teal: 'bg-teal-50 text-teal-600 border-teal-100 shadow-teal-500/10',
  };

  return (
    <div className={cn(
      "p-6 rounded-[28px] border-2 bg-white flex flex-col justify-between h-40 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
      colors[color]
    )}>
      <div className="flex items-center justify-between">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", colors[color].split(' ')[0])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{title}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
      </div>
      <div>
        <div className="w-full h-1 bg-slate-100 rounded-full mb-3 overflow-hidden">
          <div className="w-2/3 h-full bg-current rounded-full" />
        </div>
        <p className="text-[11px] font-bold text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
};
