import React, { useState } from 'react';
import { useAuth } from '../../AuthContext';
import { Icons, cn, ENTITIES } from '../../constants';
import { coordinationService } from '../../services/coordinationService';
import { toast } from 'sonner';
import { CitizenMap } from '../CitizenMap';
import { MEDEA_GEO_DATA } from '../../data/geoData';

interface CreateProjectProps {
  onComplete: () => void;
}

export const CreateProject: React.FC<CreateProjectProps> = ({ onComplete }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectType: 'Immediate' as 'Immediate' | 'Future',
    ownerDirectorateId: profile?.entity || '',
    ownerDirectorateName: ENTITIES.find(e => e.id === profile?.entity)?.label || 'مديرية غير معروفة',
    locationName: '',
    latitude: 36.2648,
    longitude: 2.7539,
    municipality: '',
    district: '',
    wilaya: MEDEA_GEO_DATA.province,
    expectedStartDate: '',
    expectedDuration: '',
    budgetStatus: 'Available' as 'Available' | 'Pending' | 'Unknown',
    projectStage: 'Planning',
    priority: 'Medium' as 'Medium' | 'High' | 'Low' | 'Urgent',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      const status = formData.projectType === 'Future' ? 'waiting_for_budget' : 'under_review';
      
      await coordinationService.createProject({
        ...formData,
        status,
        createdBy: profile.uid,
      });
      
      toast.success('تم تسجيل المشروع بنجاح');
      onComplete();
    } catch (error) {
      console.error(error);
      toast.error('فشل في تسجيل المشروع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-slide-up">
      <form onSubmit={handleSubmit} className="space-y-8 pb-12">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
            <Icons.Add className="w-6 h-6 text-brand-primary" />
            بيانات المشروع الأساسية
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700">اسم المشروع</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="مثال: تجديد شبكة الإنارة في حي 500 مسكن"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700">وصف المشروع</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
                placeholder="تفاصيل حول نطاق العمل والأهداف..."
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">نوع المشروع</label>
              <select
                value={formData.projectType}
                onChange={(e) => setFormData({...formData, projectType: e.target.value as any})}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="Immediate">قريب الإنجاز (مبرمج للعام الحالي)</option>
                <option value="Future">مشروع مستقبلي (ينتظر التمويل/مجال محجوز)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الجهة المالكة</label>
              <select
                value={formData.ownerDirectorateId}
                disabled={profile?.role === 'Coordinator' && profile?.entity !== 'ProjectsCoordination'}
                onChange={(e) => {
                  const ent = ENTITIES.find(ent => ent.id === e.target.value);
                  setFormData({
                    ...formData, 
                    ownerDirectorateId: e.target.value,
                    ownerDirectorateName: ent?.label || 'مديرية'
                  })
                }}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                {ENTITIES.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
            <Icons.Location className="w-6 h-6 text-brand-primary" />
            الموقع الجغرافي
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الدائرة</label>
              <select
                required
                value={formData.district}
                onChange={(e) => setFormData({...formData, district: e.target.value, municipality: ''})}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="">اختر الدائرة</option>
                {Object.keys(MEDEA_GEO_DATA.districts).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">البلدية</label>
              <select
                required
                value={formData.municipality}
                onChange={(e) => setFormData({...formData, municipality: e.target.value})}
                disabled={!formData.district}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="">اختر البلدية</option>
                {formData.district && MEDEA_GEO_DATA.districts[formData.district as keyof typeof MEDEA_GEO_DATA.districts].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-4">
              <label className="text-sm font-bold text-slate-700">اسم الموقع الميداني</label>
              <input
                type="text"
                required
                value={formData.locationName}
                onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                placeholder="مثال: تقاطع شارع الاستقلال مع نهج أكتوبر"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              />
              
              <div 
                onClick={() => setShowMap(true)}
                className="aspect-video bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 cursor-pointer hover:bg-slate-200 transition-all group"
              >
                <Icons.Map className="w-10 h-10 text-slate-400 group-hover:text-brand-primary mb-2" />
                <p className="text-slate-500 font-bold group-hover:text-brand-primary transition-colors">تحديد الموقع على الخريطة</p>
                {formData.latitude !== 36.2648 && (
                  <p className="text-[10px] text-brand-primary mt-1">✓ تم التحديد: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
            <Icons.Calendar className="w-6 h-6 text-brand-primary" />
            الجدولة والميزانية
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">التاريخ المتوقع للبداية</label>
              <input
                type="date"
                required
                value={formData.expectedStartDate}
                onChange={(e) => setFormData({...formData, expectedStartDate: e.target.value})}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">مدة الإنجاز المتوقعة (أيام/أشهر)</label>
              <input
                type="text"
                required
                value={formData.expectedDuration}
                onChange={(e) => setFormData({...formData, expectedDuration: e.target.value})}
                placeholder="مثال: 45 يوماً"
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">حالة الميزانية</label>
              <select
                value={formData.budgetStatus}
                onChange={(e) => setFormData({...formData, budgetStatus: e.target.value as any})}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="Available">متوفرة</option>
                <option value="Pending">في انتظار التمويل</option>
                <option value="Unknown">غير معروفة</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الأولوية</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="Low">منخفضة</option>
                <option value="Medium">متوسطة</option>
                <option value="High">عالية</option>
                <option value="Urgent">استثنائية / استعجالية</option>
              </select>
            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-40">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-brand-primary text-white rounded-2xl font-bold shadow-2xl shadow-brand-primary/40 hover:shadow-brand-primary/60 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Icons.Clock className="w-6 h-6 animate-spin" /> : <Icons.Check className="w-6 h-6 group-hover:scale-110 transition-transform" />}
            تسجيل المشروع وإرسال للمراجعة
          </button>
        </div>
      </form>

      {showMap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rtl" dir="rtl">
          <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">تحديد موقع المشروع</h3>
              <button 
                onClick={() => setShowMap(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <Icons.Close className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[60vh] relative">
              <CitizenMap 
                onLocationSelect={(loc) => setFormData({...formData, latitude: loc.lat, longitude: loc.lng})}
                initialLocation={{ lat: formData.latitude, lng: formData.longitude }}
              />
            </div>
            <div className="p-4 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowMap(false)}
                className="btn-primary py-2 px-8"
              >
                تأكيد الموقع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
