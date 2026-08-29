import React, { useEffect, useState } from 'react';
import { Skull, RotateCcw, Volume2, EyeOff, ShieldAlert, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameOverModalProps {
  onRespawn: () => void;
  onRestartFacility: () => void;
  onOpenCredits?: () => void;
}

const SURVIVAL_TIPS = [
  'The Hollow cannot see well in the pitch dark, but walking or running makes noise that echoes down corridors.',
  'Crouching generates almost zero sound (2 dB). Running creates 40 dB and alerts anything nearby.',
  'Shining your halogen flashlight directly at The Hollow from a distance will catch its attention.',
  'If you hear scratching on the pipes, The Hollow is stalking between sectors. Freeze or crouch.',
  'Closing sliding doors dampens the acoustic range of your footsteps.',
];

export const GameOverModal: React.FC<GameOverModalProps> = ({ onRespawn, onRestartFacility, onOpenCredits }) => {
  const [tip] = useState(() => SURVIVAL_TIPS[Math.floor(Math.random() * SURVIVAL_TIPS.length)]);
  const [glitchActive, setGlitchActive] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => setGlitchActive(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      id="game-over-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none overflow-hidden"
    >
      {/* Red/Black Horror static pulse background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/40 via-black to-black opacity-80 animate-pulse pointer-events-none" />

      {/* Screen static distortion lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.8)_51%)] bg-[length:100%_4px] pointer-events-none opacity-35" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 max-w-md w-full mx-4 p-7 bg-[#0a0c10] border border-red-950/80 rounded-xl shadow-2xl shadow-red-950/40 text-neutral-200"
      >
        {/* Header with Skull / Horror symbol */}
        <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-neutral-800/80">
          <div className="relative p-3 rounded-full bg-red-950/40 border border-red-800/50 text-red-500 shadow-lg shadow-red-900/50">
            <Skull className="w-9 h-9 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-mono font-black tracking-widest text-red-500 uppercase">
              {glitchActive ? 'YOU WERE TAKEN' : 'YOU WERE TAKEN INTO THE DARK'}
            </h2>
            <p className="text-xs font-mono tracking-wider text-neutral-400 mt-1 uppercase">
              FACILITY INCIDENT &bull; 03:16 AM &bull; SECTOR BREACH
            </p>
          </div>
        </div>

        {/* Creature Sensory Lore / Tip */}
        <div className="my-5 p-4 rounded-lg bg-neutral-900/90 border border-neutral-800/80 space-y-2">
          <div className="flex items-center space-x-2 text-red-400/90 font-mono text-xs tracking-wider">
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold uppercase">Acoustic Containment Protocol</span>
          </div>
          <p className="text-xs text-neutral-300 font-mono leading-relaxed">
            {tip}
          </p>
        </div>

        {/* Noise Guide Legend */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono text-neutral-400 py-1 mb-5">
          <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800/60">
            <div className="text-emerald-400 font-bold">2 dB</div>
            <div>Crouch</div>
          </div>
          <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800/60">
            <div className="text-amber-400 font-bold">10 dB</div>
            <div>Walk</div>
          </div>
          <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800/60">
            <div className="text-red-400 font-bold">40 dB</div>
            <div>Sprint</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            id="respawn-checkpoint-btn"
            onClick={onRespawn}
            className="w-full py-3 px-4 bg-red-900/70 hover:bg-red-800 text-white font-mono text-xs sm:text-sm font-bold tracking-widest uppercase rounded-lg border border-red-700/60 shadow-lg shadow-red-950/50 transition duration-150 flex items-center justify-center space-x-2 active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESPAWN AT CHECKPOINT</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              id="restart-facility-btn"
              onClick={onRestartFacility}
              className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 font-mono text-xs tracking-wider uppercase rounded-lg border border-neutral-800 transition duration-150 active:scale-[0.98]"
            >
              Restart Facility
            </button>

            {onOpenCredits && (
              <button
                id="gameover-credits-btn"
                onClick={onOpenCredits}
                className="flex items-center justify-center space-x-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 font-mono text-xs tracking-wider uppercase rounded-lg border border-neutral-800 transition duration-150 active:scale-[0.98]"
              >
                <Info className="w-3.5 h-3.5 text-neutral-500" />
                <span>Credits</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
