import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InteractableObject, Objective, PlayerStats } from '../types';
import { Flashlight, ShieldAlert, Zap, KeyRound, Pause, Eye, Volume2, Radio, HeartPulse } from 'lucide-react';

interface HUDProps {
  objective: Objective;
  stats: PlayerStats;
  hoveredItem: InteractableObject | null;
  notification: string | null;
  notificationType: 'info' | 'warn' | 'success';
  onPauseClick: () => void;
  isMobile: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  objective,
  stats,
  hoveredItem,
  notification,
  notificationType,
  onPauseClick,
  isMobile,
}) => {
  const noiseVal = stats.currentNoise || 0;
  const proxVal = stats.hollowProximity || 0;
  const health = stats.health !== undefined ? stats.health : 100;
  const maxHealth = stats.maxHealth || 100;
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <div id="game-hud" className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden">
      {/* Horror Dynamic Proximity Vignette Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{
          background: proxVal > 0.3
            ? `radial-gradient(circle at center, transparent ${Math.max(20, 60 - proxVal * 40)}%, rgba(40, 0, 0, ${0.4 + proxVal * 0.5}) 100%)`
            : `radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.85) 100%)`
        }}
      />

      {/* Hurt Screen Flash / Blood Vignette */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          stats.isHurt
            ? 'opacity-90 bg-radial-[ellipse_at_center,_transparent_40%,_rgba(180,0,0,0.85)_100%]'
            : health < 40
            ? 'opacity-60 bg-radial-[ellipse_at_center,_transparent_50%,_rgba(140,0,0,0.65)_100%] animate-pulse'
            : 'opacity-0'
        }`}
      />

      {/* Top Bar: Objective & System Time */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
        {/* Current Objective */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-black/60 backdrop-blur-xs border-l-2 border-amber-500/80 px-3.5 py-2 text-left max-w-sm sm:max-w-md shadow-lg"
        >
          <div className="flex items-center space-x-2 text-[10px] sm:text-xs font-mono tracking-widest text-amber-500 font-bold uppercase">
            <span className="inline-block w-2 h-2 bg-amber-500 animate-pulse" />
            <span>OBJECTIVE</span>
          </div>
          <p className="text-xs sm:text-sm font-['Share_Tech_Mono',monospace] text-neutral-200 mt-0.5 tracking-wide">
            {objective.description}
          </p>
        </motion.div>

        {/* Top Right: Status & Pause Button */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-2 bg-black/60 px-3 py-1.5 border border-neutral-800 text-[11px] font-mono text-neutral-400">
            <span>TIME: 03:16 AM</span>
            <span className="text-neutral-600">|</span>
            <span className="text-red-500/90 font-bold">SECTOR 9</span>
          </div>

          <button
            id="pause-hud-btn"
            onClick={onPauseClick}
            className="pointer-events-auto bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-300 p-2 transition-all active:scale-95 shadow-md"
            title="Pause Menu (Esc)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 text-center border font-mono text-xs sm:text-sm tracking-wider uppercase backdrop-blur-md shadow-2xl ${
              notificationType === 'warn'
                ? 'bg-red-950/80 border-red-600 text-red-200'
                : notificationType === 'success'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-neutral-900/90 border-neutral-600 text-neutral-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {notificationType === 'warn' && <ShieldAlert className="w-4 h-4 text-red-400" />}
              {notificationType === 'success' && <Zap className="w-4 h-4 text-emerald-400" />}
              <span>{notification}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Reticle & Interaction Indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Subtle center dot */}
        <div
          className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
            hoveredItem ? 'w-3 h-3 bg-amber-400 scale-125 ring-2 ring-amber-400/50' : 'bg-white/40'
          }`}
        />

        {/* Interaction Prompt when hovering over an interactive item */}
        <AnimatePresence>
          {hoveredItem && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mt-4 flex flex-col items-center text-center bg-black/75 backdrop-blur-xs border border-neutral-700 px-4 py-2 shadow-2xl max-w-xs"
            >
              <div className="flex items-center space-x-1.5 text-amber-400 font-mono text-xs tracking-widest uppercase font-bold">
                <Eye className="w-3.5 h-3.5" />
                <span>{isMobile ? 'INTERACT' : '[E] INTERACT'}</span>
              </div>
              <p className="text-white font-['Share_Tech_Mono',monospace] text-xs font-semibold mt-0.5 tracking-wider">
                {hoveredItem.prompt}
              </p>
              {hoveredItem.subText && (
                <p className="text-[10px] text-neutral-400 font-mono mt-1">
                  {hoveredItem.subText}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar: Inventory, Stamina, Noise Level, Health, Flashlight */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
        {/* Bottom Left: Health, Stamina & Noise */}
        <div className="flex flex-col space-y-2">
          {/* Inventory chips */}
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-mono border uppercase tracking-wider ${
                stats.hasSector9Keycard
                  ? 'bg-blue-950/70 border-blue-500 text-blue-300'
                  : 'bg-black/40 border-neutral-800 text-neutral-600'
              }`}
            >
              <KeyRound className="w-3 h-3" />
              <span>LVL 4 KEYCARD: {stats.hasSector9Keycard ? 'ACQUIRED' : 'MISSING'}</span>
            </div>

            <div
              className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-mono border uppercase tracking-wider ${
                stats.hasPowerRestored
                  ? 'bg-amber-950/70 border-amber-500 text-amber-300'
                  : 'bg-black/40 border-neutral-800 text-neutral-600'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>POWER GRID: {stats.hasPowerRestored ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>

          {/* Health / Vitals Meter (100 HP) */}
          <div className="w-36 sm:w-48 bg-black/60 border border-neutral-800 p-1.5 shadow-md">
            <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest mb-1">
              <span className="flex items-center space-x-1 text-neutral-300">
                <HeartPulse className={`w-2.5 h-2.5 ${health < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
                <span>VITALS</span>
              </span>
              <span className={health <= 35 ? 'text-red-500 font-bold animate-pulse' : health <= 70 ? 'text-amber-400' : 'text-emerald-400'}>
                {Math.round(health)} HP
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  health <= 35 ? 'bg-red-600 animate-pulse' : health <= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
          </div>

          {/* Stamina Meter */}
          <div className="w-36 sm:w-48 bg-black/60 border border-neutral-800 p-1.5 shadow-md">
            <div className="flex justify-between text-[9px] font-mono text-neutral-400 uppercase tracking-widest mb-1">
              <span>STAMINA</span>
              <span>{Math.round(stats.stamina)}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  stats.stamina < 20 ? 'bg-red-500 animate-pulse' : 'bg-neutral-300'
                }`}
                style={{ width: `${stats.stamina}%` }}
              />
            </div>
          </div>

          {/* Acoustic Noise Output Meter */}
          <div className="w-36 sm:w-48 bg-black/60 border border-neutral-800 p-1.5 shadow-md">
            <div className="flex justify-between text-[9px] font-mono text-neutral-400 uppercase tracking-widest mb-1">
              <span className="flex items-center space-x-1">
                <Volume2 className="w-2.5 h-2.5" />
                <span>NOISE LEVEL</span>
              </span>
              <span className={noiseVal > 25 ? 'text-red-400 font-bold' : noiseVal > 5 ? 'text-amber-400' : 'text-emerald-400'}>
                {Math.round(noiseVal)} dB
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  noiseVal > 25 ? 'bg-red-500' : noiseVal > 5 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (noiseVal / 50) * 100)}%` }}
              />
            </div>
          </div>

          {/* Crouch state badge */}
          {stats.isCrouching && (
            <div className="inline-block self-start bg-neutral-900/90 text-neutral-300 border border-neutral-700 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest">
              [CROUCHING &bull; SILENT]
            </div>
          )}
        </div>

        {/* Bottom Right: Flashlight Indicator & Threat Sensor */}
        <div className="flex flex-col items-end space-y-1.5">
          {proxVal > 0.4 && (
            <div className="flex items-center space-x-1.5 bg-red-950/80 border border-red-700/80 px-2.5 py-1 text-[10px] font-mono text-red-300 tracking-wider uppercase animate-pulse shadow-lg">
              <Radio className="w-3 h-3 text-red-400" />
              <span>PROXIMITY DANGER</span>
            </div>
          )}

          <div
            className={`flex items-center space-x-2 px-3 py-1.5 border font-mono text-xs uppercase tracking-wider shadow-md ${
              stats.flashlightOn
                ? 'bg-amber-950/60 border-amber-600 text-amber-200'
                : 'bg-black/60 border-neutral-800 text-neutral-500'
            }`}
          >
            <Flashlight className={`w-3.5 h-3.5 ${stats.flashlightOn ? 'text-amber-400 animate-pulse' : 'text-neutral-600'}`} />
            <span>{isMobile ? 'FLASHLIGHT' : '[F] FLASHLIGHT'}: {stats.flashlightOn ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
