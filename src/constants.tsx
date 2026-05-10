import React from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Camera, 
  Video, 
  Clock, 
  CheckCircle, 
  User, 
  LogOut, 
  Plus, 
  ChevronRight,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Bell,
  Navigation,
  Search,
  Trash2,
  Archive,
  ArrowRight,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  HardHat,
  Wrench,
  AlertCircle,
  Brain,
  Map as MapIcon,
  Briefcase,
  Calendar,
  Pencil,
  Phone,
  Lock,
  Globe
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Icons = {
  Report: AlertTriangle,
  Location: MapPin,
  Camera: Camera,
  Video: Video,
  Status: Clock,
  Clock: Clock,
  Completed: CheckCircle,
  Check: CheckCircle,
  User: User,
  Logout: LogOut,
  Add: Plus,
  Chevron: ChevronRight,
  Right: ArrowRight,
  Menu: Menu,
  Close: X,
  Dashboard: LayoutDashboard,
  Reports: FileText,
  Users: Users,
  Settings: Settings,
  Notification: Bell,
  Navigate: Navigation,
  Search: Search,
  Delete: Trash2,
  Archive: Archive,
  Escalate: TrendingUp,
  TrendingUp: TrendingUp,
  Danger: AlertTriangle,
  Price: DollarSign,
  Permit: ShieldCheck,
  ShieldCheck: ShieldCheck,
  Alert: AlertCircle,
  Contractor: HardHat,
  Maintenance: Wrench,
  AI: Brain,
  Map: MapIcon,
  AlertTriangle: AlertTriangle,
  Briefcase: Briefcase,
  Calendar: Calendar,
  Edit: Pencil,
  Phone: Phone,
  Lock: Lock,
  Globe: Globe
};

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
    <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
      {/* Map Base */}
      <svg viewBox="0 0 24 24" className="absolute w-full h-full text-brand-primary opacity-20" fill="currentColor">
        <path d="M3 5.25V19.5l6-3 6 3 6-3V4.75l-6 3-6-3-6 3z" />
      </svg>
      {/* Pin */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-brand-primary rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/30 border-2 border-white">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 fill-yellow-400/20" />
        </div>
        <div className="w-2 h-2 bg-brand-primary rotate-45 -mt-1 shadow-lg border-r border-b border-white"></div>
      </div>
    </div>
    <span className="font-display font-bold tracking-tighter text-2xl sm:text-3xl bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent truncate">شكاوي</span>
  </div>
);

export const ENTITIES = [
  { id: 'Municipality', label: 'البلدية', icon: Icons.Dashboard },
  { id: 'Sonelgaz', label: 'سونلغاز', icon: Icons.Contractor },
  { id: 'ADE', label: 'الجزائرية للمياه', icon: Icons.Contractor },
  { id: 'ONA', label: 'مؤسسة التطهير (ONA)', icon: Icons.Contractor },
  { id: 'ProjectsCoordination', label: 'مديرية تنسيق المشاريع', icon: Icons.Briefcase },
  { id: 'Wilaya', label: 'الولاية', icon: Icons.Globe },
];

export const REPORT_TYPES: Record<string, any[]> = {
  Municipality: [
    { 
      id: 'Asphalt', 
      label: 'حفر في الأسفلت', 
      color: 'bg-gray-800',
      subTypes: ['حفرة عميقة', 'تشقق سطحي', 'هبوط في الطريق', 'تآكل الحواف'],
      extraFields: [
        { id: 'size', label: 'المساحة التقريبية (متر مربع)', type: 'number' },
        { id: 'depth', label: 'العمق التقريبي (سم)', type: 'number' }
      ]
    },
    { 
      id: 'Pavement', 
      label: 'رصيف متضرر', 
      color: 'bg-amber-600',
      subTypes: ['بلاط مكسور', 'حواف مفقودة', 'رصيف غير مستوٍ', 'عوائق على الرصيف'],
      extraFields: [
        { id: 'length', label: 'الطول المتضرر (متر)', type: 'number' }
      ]
    },
    { 
      id: 'Lighting', 
      label: 'إنارة عمومية تالفة', 
      color: 'bg-yellow-500',
      subTypes: ['مصباح محروق', 'عمود مائل', 'إنارة تومض', 'انقطاع كلي في الشارع'],
      extraFields: [
        { id: 'poleNumber', label: 'رقم العمود (إن وجد)', type: 'text' }
      ]
    },
    { 
      id: 'General Hazard', 
      label: 'مخاطر عامة', 
      color: 'bg-red-600',
      subTypes: ['أسلاك مكشوفة', 'سقوط ركام', 'انسداد مجاري صرف', 'لوحة إعلانية آيلة للسقوط'],
      extraFields: [
        { id: 'hazardLevel', label: 'مستوى الخطورة', type: 'select', options: ['منخفض', 'متوسط', 'عالي', 'خطير جداً'] }
      ]
    },
    { 
      id: 'Vandalism', 
      label: 'تخريب أملاك الدولة', 
      color: 'bg-purple-700',
      subTypes: ['تخريب كراسي عمومية', 'كتابة على الجدران', 'تكسير حاويات النفايات', 'تخريب مساحات خضراء', 'سرقة أغطية البالوعات'],
      extraFields: [
        { id: 'damageLevel', label: 'حجم الضرر', type: 'select', options: ['بسيط', 'متوسط', 'جسيم'] }
      ]
    },
  ],
  Sonelgaz: [
    {
      id: 'Electricity',
      label: '🔌 الكهرباء',
      color: 'bg-yellow-600',
      subTypes: ['انقطاع الكهرباء', 'ضعف التوتر', 'تماس كهربائي', 'عمود كهربائي خطر', 'أسلاك مكشوفة', 'عداد معطل'],
    },
    {
      id: 'Gas',
      label: '🔥 الغاز',
      color: 'bg-orange-600',
      subTypes: ['تسرب غاز', 'رائحة غاز', 'عداد غاز معطل', 'أنبوب غاز مكشوف', 'خطر انفجار'],
    }
  ],
  ADE: [
    {
      id: 'Distribution',
      label: '🚰 التوزيع',
      color: 'bg-blue-600',
      subTypes: ['انقطاع المياه', 'ضعف التدفق', 'تذبذب التوزيع', 'غياب الماء لأيام'],
    },
    {
      id: 'Leaks',
      label: '💦 التسربات',
      color: 'bg-cyan-600',
      subTypes: ['تسرب في الطريق', 'تسرب من عداد', 'كسر أنبوب', 'فيضان ماء نظيف'],
    },
    {
      id: 'Quality',
      label: '🧪 جودة المياه',
      color: 'bg-teal-600',
      subTypes: ['ماء عكر', 'رائحة كريهة', 'طعم غير طبيعي', 'شك في تلوث'],
    }
  ],
  ONA: [
    {
      id: 'Sewage',
      label: '🕳️ الصرف الصحي',
      color: 'bg-stone-600',
      subTypes: ['انسداد المجاري', 'فيضان الصرف الصحي', 'تسرب مياه قذرة', 'غطاء بالوعة مفقود'],
    },
    {
      id: 'Environmental',
      label: '🤢 المشاكل البيئية',
      color: 'bg-green-600',
      subTypes: ['روائح كريهة', 'انتشار الحشرات', 'تلوث بيئي'],
    }
  ]
};

export const STATUS_COLORS: Record<string, string> = {
  'New': 'text-blue-600 bg-blue-50',
  'Inspected': 'text-indigo-600 bg-indigo-50',
  'Pricing': 'text-purple-600 bg-purple-50',
  'Negotiating': 'text-orange-600 bg-orange-50',
  'Permitted': 'text-teal-600 bg-teal-50',
  'Repairing': 'text-amber-600 bg-amber-50',
  'Repaired': 'text-emerald-600 bg-emerald-50',
  'Verified': 'text-green-600 bg-green-50',
  'Archived': 'text-slate-600 bg-slate-50',
  'Pending': 'text-amber-600 bg-amber-50',
  'In Progress': 'text-blue-600 bg-blue-50',
  'Completed': 'text-green-600 bg-green-50',
  'Escalated': 'text-red-600 bg-red-50',
  'Rejected': 'text-red-600 bg-red-50',
  'False': 'text-red-700 bg-red-100',
};

export const STATUS_LABELS: Record<string, string> = {
  'New': 'جديد',
  'Inspected': 'تمت المعاينة',
  'Pricing': 'تحديد السعر',
  'Negotiating': 'قيد التفاوض',
  'Permitted': 'مرخص للعمل',
  'Repairing': 'قيد الإصلاح',
  'Repaired': 'تم الإصلاح',
  'Verified': 'تم التأكيد',
  'Archived': 'مؤرشف',
  'Pending': 'قيد الانتظار',
  'In Progress': 'قيد التنفيذ',
  'Completed': 'مكتمل',
  'Escalated': 'تم التصعيد',
  'Rejected': 'مرفوض',
  'False': 'بلاغ كاذب',
};

export const ROLE_LABELS: Record<string, string> = {
  'Admin': 'المدير العام',
  'Authority': 'المديرية الولائية',
  'BranchManager': 'الفرع البلدي',
  'Maintenance': 'عمال الصيانة',
  'Inspection': 'المعاينة والرقابة',
  'Contractor': 'المقاول المعتمد',
  'Citizen': 'مواطن',
  'Coordinator': 'المنسق الإداري',
  'Supervisor': 'المشرف العام',
  'wali': 'حساب الوالي',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  'draft': 'مسودة',
  'under_review': 'قيد المراجعة',
  'waiting_for_directorates': 'في انتظار رد المديريات',
  'has_preliminary_works': 'توجد أشغال قبلية',
  'conflict_detected': 'يوجد تعارض',
  'coordination_meeting_required': 'اجتماع تنسيقي مطلوب',
  'reserved_area': 'مجال محجوز',
  'waiting_for_budget': 'في انتظار التمويل',
  'ready_to_start': 'جاهز للانطلاق',
  'in_progress': 'قيد الإنجاز',
  'completed': 'منجز',
  'cancelled': 'ملغى'
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  'draft': 'text-slate-600 bg-slate-50',
  'under_review': 'text-blue-600 bg-blue-50 border-blue-100',
  'waiting_for_directorates': 'text-indigo-600 bg-indigo-50 border-indigo-100',
  'has_preliminary_works': 'text-amber-600 bg-amber-50 border-amber-100',
  'conflict_detected': 'text-red-600 bg-red-50 border-red-100',
  'coordination_meeting_required': 'text-orange-600 bg-orange-50 border-orange-100',
  'reserved_area': 'text-teal-600 bg-teal-50 border-teal-100',
  'waiting_for_budget': 'text-purple-600 bg-purple-50 border-purple-100',
  'ready_to_start': 'text-green-600 bg-green-50 border-green-100',
  'in_progress': 'text-brand-primary bg-brand-primary/5 border-brand-primary/20',
  'completed': 'text-emerald-600 bg-emerald-50 border-emerald-100',
  'cancelled': 'text-rose-600 bg-rose-50 border-rose-100'
};
