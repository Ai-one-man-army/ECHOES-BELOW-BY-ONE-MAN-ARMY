import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, Volume2 } from 'lucide-react';
import { soundEngine } from './SoundEngine;

interface OpeningSequenceProps {
  onComplete: () => void;
  onOpenCredits?: () => void;
}

export const OpeningSequence: React.FC<OpeningSequenceProps> = ({ onComplete, onOpenCredits }) => {
  const [stage, setStage] = useState<number>(0);
  const [hasStartedAudio, setHasStartedAudio] = useState<boolean>(false);

  const startSequence = () => {
    soundEngine.init();
    soundEngine.resumeContext();
    soundEngine.playDistantGroan();
    setHasStartedAudio(true);
    setStage(1);
  };

  const handleOpenCredits = () => {
    soundEngine.init();
    soundEngine.resumeContext();
    if (onOpenCredits) {
      onOpenCredits();
    }
  };

  useEffect(() => {
    if (stage === 1) {
      // "ECHOES BELOW"
      const timer = setTimeout(() => {
        setStage(2);
      }, 2600);
      return () => clearTimeout(timer);
    } else if (stage === 2) {
      // "3:16 AM"
      const timer = setTimeout(() => {
        setStage(3);
      }, 2400);
      return () => clearTimeout(timer);
    } else if (stage === 3) {
      // "DO NOT ANSWER THE SOUND."
      const timer = setTimeout(() => {
        setStage(4);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (stage === 4) {
      // Fade into gameplay
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [stage, onComplete]);

  return (
    <div
      id="opening-sequence-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black select-none cursor-default overflow-hidden"
    >
      {/* Subtle Ambient Vignette & Grain */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,0,0,0.25)_0%,rgba(0,0,0,0.95)_70%,#000_100%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div
            key="stage-start"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex flex-col items-center text-center px-6 max-w-xl z-10 w-full"
          >
            {/* Minimal Red Accent Bar */}
            <div className="w-12 h-[2px] bg-red-700/90 mb-4" />

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.35em] text-neutral-100 font-['Cinzel',serif] mb-2 uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]">
              ECHOES BELOW
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 font-['Share_Tech_Mono',monospace] tracking-[0.25em] uppercase mb-4">
              A 3D Psychological Horror Experience
            </p>

            {/* Required Small Creator Credit on Main Menu */}
            <div className="mb-8 px-3.5 py-1 bg-neutral-950/80 border border-neutral-800/80 text-[11px] font-mono tracking-[0.25em] text-neutral-400 uppercase">
              AN ORIGINAL GAME BY <span className="text-neutral-200 font-bold">ONE MAN ARMY</span>
            </div>

            {/* Menu Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-sm">
              <button
                id="start-intro-btn"
                onClick={startSequence}
                className="w-full sm:flex-1 px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-600/90 text-neutral-100 hover:text-white font-['Share_Tech_Mono',monospace] tracking-[0.25em] text-xs sm:text-sm uppercase transition-all duration-150 shadow-lg shadow-black/80 hover:shadow-red-950/40 active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>[ ENTER FACILITY ]</span>
              </button>

              <button
                id="main-menu-credits-btn"
                onClick={handleOpenCredits}
                className="w-full sm:flex-1 px-6 py-3.5 bg-neutral-950/90 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 font-['Share_Tech_Mono',monospace] tracking-[0.25em] text-xs sm:text-sm uppercase transition-all duration-150 active:scale-95 flex items-center justify-center space-x-2"
              >
                <Info className="w-3.5 h-3.5 text-neutral-500" />
                <span>CREDITS</span>
              </button>
            </div>

            <p className="mt-8 text-[11px] text-neutral-600 font-['Share_Tech_Mono',monospace] tracking-wider flex items-center space-x-1.5">
              <Volume2 className="w-3 h-3 text-neutral-600" />
              <span>Best experienced with headphones &bull; Click to initialize audio</span>
            </p>
          </motion.div>
        )}

        {stage === 1 && (
          <motion.div
            key="stage-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 1.2 }}
            className="text-center px-4 z-10"
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.45em] text-neutral-100 font-['Cinzel',serif] uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              ECHOES BELOW
            </h1>
          </motion.div>
        )}

        {stage === 2 && (
          <motion.div
            key="stage-time"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="text-center px-4 z-10"
          >
            <p className="text-3xl sm:text-5xl font-mono text-neutral-300 font-['Share_Tech_Mono',monospace] tracking-[0.3em]">
              3:16 AM
            </p>
            <p className="text-xs text-neutral-600 uppercase tracking-widest mt-2 font-mono">
              SUB-LEVEL 7 // ATMOSPHERIC PRESSURE CRITICAL
            </p>
          </motion.div>
        )}

        {stage === 3 && (
          <motion.div
            key="stage-warning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.1 }}
            className="text-center px-6 max-w-xl z-10"
          >
            <p className="text-2xl sm:text-4xl font-bold tracking-[0.3em] text-red-600/90 font-['Cinzel',serif] uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.4)]">
              DO NOT ANSWER THE SOUND.
            </p>
          </motion.div>
        )}

        {stage === 4 && (
          <motion.div
            key="stage-fade"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="fixed inset-0 bg-black z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Skip Button during sequence */}
      {stage > 0 && stage < 4 && (
        <button
          id="skip-intro-btn"
          onClick={onComplete}
          className="absolute bottom-6 right-6 text-xs text-neutral-600 hover:text-neutral-400 font-mono tracking-widest uppercase transition-colors"
        >
          [ SKIP INTRO &gt; ]
        </button>
      )}
    </div>
  );
};
