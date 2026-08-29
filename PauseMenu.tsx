import React, { useState } from 'react';
import { GameSettings, GraphicsQuality } from '../types';
import { Play, RotateCcw, Monitor, Volume2, Sliders, Keyboard, Smartphone, Info } from 'lucide-react';

interface PauseMenuProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenCredits?: () => void;
  isMobile: boolean;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  settings,
  onUpdateSettings,
  onResume,
  onRestart,
  onOpenCredits,
  isMobile,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'controls'>('settings');

  const handleGraphicsChange = (quality: GraphicsQuality) => {
    onUpdateSettings({ graphics: quality });
  };

  return (
    <div
      id="pause-menu-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md select-none p-4"
    >
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-neutral-900/80 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 bg-red-600 animate-pulse" />
            <h2 className="text-xl font-bold tracking-[0.25em] text-white font-['Cinzel',serif] uppercase">
              PAUSED
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-500 tracking-wider">
            ECHOES BELOW // BUILD 1.0
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/40">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 text-xs font-mono tracking-widest uppercase transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-neutral-800/80 text-amber-400 border-b-2 border-amber-400'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>SETTINGS</span>
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex-1 py-2.5 text-xs font-mono tracking-widest uppercase transition-colors flex items-center justify-center space-x-1.5 ${
              activeTab === 'controls'
                ? 'bg-neutral-800/80 text-amber-400 border-b-2 border-amber-400'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>CONTROLS</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto font-['Share_Tech_Mono',monospace]">
          {activeTab === 'settings' ? (
            <>
              {/* Graphics Presets */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-xs text-neutral-300 font-bold uppercase tracking-wider">
                  <Monitor className="w-4 h-4 text-amber-400" />
                  <span>GRAPHICS QUALITY</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleGraphicsChange(q)}
                      className={`py-2 px-3 text-xs tracking-wider border transition-all ${
                        settings.graphics === q
                          ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold shadow-lg shadow-amber-950/40'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500">
                  {settings.graphics === 'LOW' && 'Low: Optimized resolution and lighting for smooth mobile performance.'}
                  {settings.graphics === 'MEDIUM' && 'Medium: Balanced real-time shadow casting and native resolution.'}
                  {settings.graphics === 'HIGH' && 'High: Soft shadow filtering, enhanced fog, and high pixel density.'}
                </p>
              </div>

              {/* Master Volume */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-300 font-bold uppercase tracking-wider">
                  <label className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>AUDIO VOLUME</span>
                  </label>
                  <span>{Math.round(settings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.volume}
                  onChange={(e) => onUpdateSettings({ volume: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-none appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Sensitivity */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-300 font-bold uppercase tracking-wider">
                  <label className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>{isMobile ? 'TOUCH SENSITIVITY' : 'MOUSE SENSITIVITY'}</span>
                  </label>
                  <span>
                    {isMobile
                      ? Math.round((settings.touchSensitivity ?? 1.2) * 10) / 10
                      : Math.round((settings.mouseSensitivity ?? 1.0) * 10) / 10}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={isMobile ? (settings.touchSensitivity ?? 1.2) : (settings.mouseSensitivity ?? 1.0)}
                  onChange={(e) =>
                    onUpdateSettings(
                      isMobile
                        ? { touchSensitivity: parseFloat(e.target.value) }
                        : { mouseSensitivity: parseFloat(e.target.value) }
                    )
                  }
                  className="w-full h-1.5 bg-neutral-800 rounded-none appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Camera Smoothing */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-300 font-bold uppercase tracking-wider">
                  <label className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>CAMERA SMOOTHING</span>
                  </label>
                  <span>
                    {settings.cameraSmoothing === 0
                      ? 'RAW (0%)'
                      : `${Math.round((settings.cameraSmoothing ?? 0.3) * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={settings.cameraSmoothing ?? 0.3}
                  onChange={(e) => onUpdateSettings({ cameraSmoothing: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-none appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[11px] text-neutral-500">
                  {settings.cameraSmoothing === 0
                    ? 'Instant direct mouse/touch input.'
                    : 'Interpolated look velocity for cinematic smoothness without latency.'}
                </p>
              </div>

              {/* Field of View (FOV) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-300 font-bold uppercase tracking-wider">
                  <label className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-amber-400" />
                    <span>FIELD OF VIEW (FOV)</span>
                  </label>
                  <span>{settings.fov ?? 75}°</span>
                </div>
                <input
                  type="range"
                  min="65"
                  max="95"
                  step="1"
                  value={settings.fov ?? 75}
                  onChange={(e) => onUpdateSettings({ fov: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-neutral-800 rounded-none appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Invert Y */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-900">
                <span className="text-xs text-neutral-300 uppercase tracking-wider">INVERT LOOK Y-AXIS</span>
                <button
                  onClick={() => onUpdateSettings({ invertY: !settings.invertY })}
                  className={`px-3 py-1 text-xs border tracking-wider uppercase transition-colors ${
                    settings.invertY
                      ? 'bg-amber-950 border-amber-500 text-amber-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                  }`}
                >
                  {settings.invertY ? 'ON' : 'OFF'}
                </button>
              </div>
            </>
          ) : (
            /* Controls Guide */
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider">
                  <Keyboard className="w-4 h-4" />
                  <span>PC / LAPTOP KEYBINDS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">WASD / ARROWS:</span> Move
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">MOUSE:</span> Look Camera
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">SHIFT:</span> Run / Sprint
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">CTRL / C:</span> Crouch
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">F:</span> Flashlight Toggle
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">E:</span> Interact
                  </div>
                  <div className="bg-neutral-900/60 p-2 border border-neutral-800 col-span-2">
                    <span className="text-neutral-500">ESC:</span> Pause Menu
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-900">
                <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" />
                  <span>MOBILE / TOUCH CONTROLS</span>
                </div>
                <div className="space-y-1.5 text-neutral-300">
                  <p className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">LEFT SCREEN:</span> Virtual Joystick for 360° Movement
                  </p>
                  <p className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">RIGHT SCREEN:</span> Drag to Pan & Pitch Camera
                  </p>
                  <p className="bg-neutral-900/60 p-2 border border-neutral-800">
                    <span className="text-neutral-500">ACTION BUTTONS:</span> Run, Crouch, Light, Use
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-neutral-900/80 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-neutral-800 flex flex-col space-y-3">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <button
                id="restart-game-btn"
                onClick={onRestart}
                className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900 hover:bg-red-950/60 border border-neutral-700 hover:border-red-600/80 text-neutral-400 hover:text-red-200 text-xs font-mono tracking-wider uppercase transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESTART</span>
              </button>

              {onOpenCredits && (
                <button
                  id="pause-menu-credits-btn"
                  onClick={onOpenCredits}
                  className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200 text-xs font-mono tracking-wider uppercase transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>CREDITS</span>
                </button>
              )}
            </div>

            <button
              id="resume-game-btn"
              onClick={onResume}
              className="flex items-center space-x-2 px-5 sm:px-6 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold tracking-widest uppercase transition-transform active:scale-95 shadow-lg shadow-amber-950/30"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>RESUME</span>
            </button>
          </div>

          <div className="text-center text-[10px] font-mono text-neutral-600 tracking-widest uppercase">
            AN ORIGINAL GAME BY <span className="text-neutral-400 font-bold">ONE MAN ARMY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
