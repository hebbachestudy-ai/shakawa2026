import React from 'react';
import { Navigation, X, ArrowUpLeft, ArrowUpRight, ArrowUp, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavigationHUDProps {
  instruction: string;
  distance: string;
  eta: string;
  totalDistance: string;
  onStop: () => void;
  onRecalculate?: () => void;
  destinationName: string;
}

const NavigationHUD: React.FC<NavigationHUDProps> = ({
  instruction,
  distance,
  eta,
  totalDistance,
  onStop,
  onRecalculate,
  destinationName,
}) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] pointer-events-none flex flex-col justify-between p-4 bg-black/5">
        {/* Top Instruction Bar - Dark & High Contrast */}
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="w-full max-w-md mx-auto bg-slate-900 text-white rounded-3xl p-6 shadow-2xl pointer-events-auto flex items-center gap-6 border border-white/10"
        >
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-900/50">
            {instruction.includes('يسار') ? (
              <ArrowUpLeft className="w-10 h-10" />
            ) : instruction.includes('يمين') ? (
              <ArrowUpRight className="w-10 h-10" />
            ) : (
              <ArrowUp className="w-10 h-10" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black leading-tight tracking-tight">{instruction || 'استمر في الطريق'}</h2>
            <p className="text-blue-400 font-mono text-xl mt-1 font-bold">{distance || '0 م'}</p>
          </div>
          <button
            onClick={onStop}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </motion.div>

        {/* Bottom Info Bar - Clean & Modern */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="w-full max-w-md mx-auto bg-white rounded-[2.5rem] p-6 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)] pointer-events-auto border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="text-sm font-bold text-slate-500 truncate max-w-[150px]">إلى: {destinationName}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-xs">
              <Navigation className="w-3 h-3" />
              <span>{instruction.includes('أوفلاين') ? 'وضع الملاحة (أوفلاين)' : 'وضع الملاحة النشط'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">{eta || '--'}</span>
                <span className="text-lg font-bold text-slate-400">دقيقة</span>
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">وقت الوصول المتوقع</p>
            </div>
            
            <div className="h-12 w-px bg-slate-100 mx-4" />

            <div className="flex flex-col items-end text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">{totalDistance || '--'}</span>
                <span className="text-lg font-bold text-slate-400">كلم</span>
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">المسافة المتبقية</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onStop}
              className="flex-[2] bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <X className="w-5 h-5" />
              إيقاف الملاحة
            </button>
            <button
              onClick={onRecalculate}
              className="flex-1 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all active:scale-95 flex items-center justify-center"
              title="إعادة التوجيه"
            >
              <RotateCcw className="w-6 h-6 text-slate-600" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NavigationHUD;
