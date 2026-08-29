import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, RotateCcw, Info } from 'lucide-react';

interface Sector9ModalProps {
  onContinue: () => void;
  onRestart: () => void;
  onOpenCredits?: () => void;
}

export const Sector9Modal: React.FC<Sector9ModalProps> = ({ onContinue, onRestart, onOpenCredits }) => {
  return (
    <div
      id="sector9-complete-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-neutral-950 border-2 border-red-700/80 shadow-2xl p-6 text-center space-y-5 font-['Share_Tech_Mono',monospace]"
      >
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500 mx-auto flex items-center justify-center text-red-400">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-2xl font-bold font-['Cinzel',serif] tracking-[0.25em] text-red-500 uppercase">
            SECTOR 9 UNLOCKED
          </h2>
          <p className="text-xs text-neutral-400 mt-2 tracking-wider">
            You successfully restored auxiliary power, retrieved the Level 4 Security Keycard, and opened the Sector 9 Blast Gate.
          </p>
        </div>

        <div className="bg-red-950/40 border border-red-900/60 p-3 text-xs text-red-300">
          "The containment seal has been broken. Whatever was locked below is now listening."
        </div>

        <div className="flex flex-col space-y-2 pt-2">
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs tracking-wider uppercase transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESTART</span>
            </button>
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider uppercase transition-transform active:scale-95 shadow-lg shadow-red-950/50"
            >
              <span>CONTINUE</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {onOpenCredits && (
            <button
              onClick={onOpenCredits}
              className="w-full flex items-center justify-center space-x-1.5 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-[11px] tracking-widest uppercase transition-colors"
            >
              <Info className="w-3 h-3 text-neutral-500" />
              <span>VIEW CREDITS &amp; CREATOR</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
