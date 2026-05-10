import React, { useState } from 'react';
import { Project } from '../../types';
import { Icons, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, cn } from '../../constants';

interface ProjectListProps {
  projects: Project[];
  onSelect: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelect }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = projects.filter(p => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.ownerDirectorateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.municipality.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="relative w-full md:w-96">
          <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="البحث في المشاريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              filterStatus === 'all' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            الكل
          </button>
          {['under_review', 'waiting_for_directorates', 'conflict_detected', 'ready_to_start', 'in_progress'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                filterStatus === status ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {PROJECT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(project => (
          <div 
            key={project.id}
            onClick={() => onSelect(project)}
            className="glass-card p-6 rounded-3xl hover:shadow-xl transition-all cursor-pointer group border border-slate-100"
          >
            <div className="flex justify-between items-start mb-4">
              <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-bold border", PROJECT_STATUS_COLORS[project.status])}>
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
              {project.hasConflict && (
                <span className="bg-red-100 text-red-600 p-1.5 rounded-lg animate-pulse">
                  <Icons.AlertTriangle className="w-4 h-4" />
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-primary transition-colors leading-tight">
              {project.title}
            </h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icons.Briefcase className="w-4 h-4 text-brand-primary/60" />
                <span>{project.ownerDirectorateName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icons.Location className="w-4 h-4 text-brand-primary/60" />
                <span>{project.municipality} - {project.locationName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Icons.Calendar className="w-4 h-4 text-brand-primary/60" />
                <span>البداية: {project.expectedStartDate}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                    D{i}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white bg-brand-primary/10 flex items-center justify-center text-[8px] font-bold text-brand-primary italic">
                  +2
                </div>
              </div>
              <button className="text-brand-primary font-bold text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                تفاصيل
                <Icons.Chevron className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.Search className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">لا توجد نتائج</h3>
          <p className="text-slate-500 text-sm">جرب تغيير الفلاتر أو كلمة البحث</p>
        </div>
      )}
    </div>
  );
};
