import React from 'react';
import { Project } from '../../types';
import { Icons, cn } from '../../constants';

interface CertificateListProps {
  projects: Project[];
}

export const CertificateList: React.FC<CertificateListProps> = ({ projects }) => {
  const readyProjects = projects.filter(p => !p.hasConflict || p.status === 'ready_to_start');

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
          <Icons.ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-emerald-900">شهادات عدم التعارض</h2>
          <p className="text-sm text-emerald-700/80">الموافقة النهائية لإطلاق المشاريع بعد استلام كل الردود.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500">رقم المشروع</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500">اسم المشروع</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500">الجهة المالكة</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500">حالة الردود</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {readyProjects.map(project => (
              <tr key={project.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-xs font-mono text-slate-400 capitalize">{project.id.slice(-6)}</td>
                <td className="px-6 py-4 font-bold text-sm text-slate-900">{project.title}</td>
                <td className="px-6 py-4 text-xs text-slate-600">{project.ownerDirectorateName}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-emerald-500"></div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600">75%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button className="flex items-center gap-2 text-brand-primary text-xs font-bold hover:underline">
                    <Icons.ShieldCheck className="w-4 h-4" />
                    إصدار الشهادة
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {readyProjects.length === 0 && (
          <div className="py-20 text-center text-slate-400">لا توجد مشاريع جاهزة لإصدار الشهادات</div>
        )}
      </div>
    </div>
  );
};
