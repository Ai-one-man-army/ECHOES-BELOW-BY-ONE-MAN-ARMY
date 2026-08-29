import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, Shield } from 'lucide-react';
import { soundEngine } from "./SoundEngine";

interface CreditsScreenProps {
  onBack: () => void;
}

interface CreditItem {
  role: string;
  name: string;
  subName?: string;
  highlight?: boolean;
}

const CREDITS_DATA: CreditItem[] = [
  { role: 'GAME', name: 'ECHOES BELOW', highlight: true },
  { role: 'CREATED BY', name: 'ONE MAN ARMY', subName: 'Misbaul Alam', highlight: true },
  { role: 'CREATOR', name: 'Misbaul Alam' },
  { role: 'STORY & CONCEPT', name: 'ONE MAN ARMY' },
  { role: 'GAME DESIGN', name: 'ONE MAN ARMY' },
  { role: 'PROGRAMMING', name: 'ONE MAN ARMY' },
  { role: '3D / ENVIRONMENT DESIGN', name: 'ONE MAN ARMY' },
  { role: 'PUZZLE DESIGN', name: 'ONE MAN ARMY' },
  { role: 'HORROR DESIGN', name: 'ONE MAN ARMY' },
  { role: 'UI / UX', name: 'ONE MAN ARMY' },
];

export const CreditsScreen: React.FC<CreditsScreenProps> = ({ onBack }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(true);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Sound cue on mount
  useEffect(() => {
    soundEngine.playSwitchSound();
  }, []);

  // Keyboard shortcut: Esc to return
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Auto-scroll cinematic loop
  useEffect(() => {
    let lastTime = performance.now();

    const scrollStep = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isAutoScrolling && scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0) {
          el.scrollTop += delta * 32; // Smooth cinematic 32px/s crawl
          const progress = Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100));
          setScrollProgress(progress);
        }
      }

      animFrameRef.current = requestAnimationFrame(scrollStep);
    };

    animFrameRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isAutoScrolling]);

  const handleManualScroll = () => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        setScrollProgress((el.scrollTop / maxScroll) * 100);
      }
    }
  };

  const handleResetScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      id="credits-screen-root"
      className="fixed inset-0 z-50 flex flex-col bg-[#050507] text-neutral-200 select-none overflow-hidden"
    >
      {/* 1. Atmospheric Ambient Background: Deep Vignette & Dark Red Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(50,0,0,0.18),rgba(0,0,0,0.95)_75%,#000_100%)] pointer-events-none" />

      {/* 2. Slow Animated Fog / Atmospheric Drift */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-neutral-800/30 via-transparent to-transparent animate-pulse" />

      {/* 3. Subtle Film Grain & CRT Scanline Overlay */}
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.9)_51%)] bg-[length:100%_4px]" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-4 border-b border-neutral-900/90 bg-black/60 backdrop-blur-sm">
        <button
          id="credits-back-btn"
          onClick={onBack}
          className="group flex items-center space-x-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-neutral-950/80 hover:bg-neutral-900 border border-neutral-800 hover:border-red-900/80 text-neutral-300 hover:text-white font-mono text-xs tracking-[0.2em] uppercase transition-all duration-150 active:scale-95 shadow-md"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-neutral-400 group-hover:text-red-500 transition-colors" />
          <span>BACK</span>
          <span className="hidden sm:inline text-[10px] text-neutral-600 font-mono ml-1">[ESC]</span>
        </button>

        <div className="flex items-center space-x-3 text-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          <span className="font-['Cinzel',serif] text-xs sm:text-sm tracking-[0.3em] text-neutral-400 uppercase">
            CREDITS &amp; ABOUT
          </span>
        </div>

        {/* Play / Pause Auto-Scroll Control */}
        <div className="flex items-center space-x-2">
          <button
            id="credits-autoscroll-btn"
            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
            title={isAutoScrolling ? 'Pause Auto Scroll' : 'Resume Auto Scroll'}
            className="flex items-center space-x-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-[10px] sm:text-xs font-mono uppercase tracking-wider transition-colors"
          >
            {isAutoScrolling ? (
              <>
                <Pause className="w-3 h-3 text-amber-500" />
                <span className="hidden sm:inline">AUTO-CRAWL ON</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-neutral-400" />
                <span className="hidden sm:inline">AUTO-CRAWL OFF</span>
              </>
            )}
          </button>

          <button
            id="credits-reset-scroll-btn"
            onClick={handleResetScroll}
            title="Return to top"
            className="p-1.5 sm:p-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Credits Stage */}
      <div
        ref={scrollContainerRef}
        onScroll={handleManualScroll}
        onWheel={() => {
          // Pause auto-scroll briefly if user scrolls with mouse wheel
        }}
        onTouchStart={() => {
          // Touch device manual scroll friendly
        }}
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth px-4 py-12 sm:py-20 flex flex-col items-center"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-16 sm:space-y-24 pb-32"
        >
          {/* SECTION 1: Game Title & Creation Lead */}
          <section className="flex flex-col items-center space-y-6 pt-4">
            <div className="w-10 h-[1px] bg-red-800/80 mb-2" />
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.35em] sm:tracking-[0.45em] text-neutral-100 font-['Cinzel',serif] uppercase drop-shadow-[0_0_25px_rgba(255,255,255,0.12)]">
              ECHOES BELOW
            </h1>
            <p className="text-xs sm:text-sm font-mono tracking-[0.25em] text-neutral-400 uppercase max-w-md">
              A 3D Psychological Horror Experience
            </p>

            <div className="pt-8 flex flex-col items-center space-y-2">
              <span className="text-[11px] sm:text-xs font-mono tracking-[0.3em] text-neutral-500 uppercase">
                Created by
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[0.3em] sm:tracking-[0.35em] text-neutral-100 font-['Cinzel',serif] uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.25)]">
                ONE MAN ARMY
              </h2>
              <span className="text-xs sm:text-sm font-mono tracking-[0.2em] text-neutral-400 font-normal">
                Misbaul Alam
              </span>
            </div>
          </section>

          {/* SECTION 2: Divider */}
          <div className="w-full flex items-center justify-center space-x-4 opacity-40">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-neutral-700" />
            <div className="w-1.5 h-1.5 rotate-45 border border-red-500 bg-red-950" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-neutral-700" />
          </div>

          {/* SECTION 3: About The Creator */}
          <section className="flex flex-col items-center space-y-6 max-w-xl px-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-red-950/30 border border-red-900/40 text-red-400 text-[10px] sm:text-xs font-mono tracking-[0.25em] uppercase">
              <Shield className="w-3 h-3 text-red-500" />
              <span>ABOUT THE CREATOR</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold tracking-[0.3em] text-neutral-100 font-['Cinzel',serif] uppercase">
              ONE MAN ARMY
            </h3>

            <div className="p-6 sm:p-8 bg-[#090b0e]/90 border border-neutral-800/80 rounded-sm shadow-2xl relative">
              <div className="absolute -top-2 left-6 text-red-600/40 text-4xl font-serif leading-none select-none">
                &ldquo;
              </div>
              <p className="text-xs sm:text-sm font-mono text-neutral-300 leading-relaxed tracking-wider text-center">
                ONE MAN ARMY is an independent creator building games, experiences, and digital worlds independently — from the idea and design to development and final experience.
              </p>
            </div>
          </section>

          {/* SECTION 4: Divider */}
          <div className="w-full flex items-center justify-center space-x-4 opacity-40">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-neutral-700" />
            <div className="w-1.5 h-1.5 rotate-45 border border-red-500 bg-red-950" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-neutral-700" />
          </div>

          {/* SECTION 5: Full Game Credits Table */}
          <section className="flex flex-col items-center space-y-8 w-full max-w-lg">
            <h3 className="text-lg sm:text-xl font-bold tracking-[0.35em] text-neutral-200 font-['Cinzel',serif] uppercase">
              CREDITS
            </h3>

            <div className="w-full space-y-6 sm:space-y-8">
              {CREDITS_DATA.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center text-center space-y-1.5 py-1 border-b border-neutral-900/60 pb-4"
                >
                  <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.3em] text-neutral-500 uppercase">
                    {item.role}
                  </span>
                  <span
                    className={`font-['Cinzel',serif] tracking-[0.25em] uppercase ${
                      item.highlight
                        ? 'text-base sm:text-lg text-neutral-100 font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]'
                        : 'text-sm sm:text-base text-neutral-300'
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.subName && (
                    <span className="text-xs font-mono tracking-wider text-neutral-400">
                      {item.subName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 6: Divider */}
          <div className="w-full flex items-center justify-center space-x-4 opacity-40">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-neutral-700" />
            <div className="w-1.5 h-1.5 rotate-45 border border-red-500 bg-red-950" />
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-neutral-700" />
          </div>

          {/* SECTION 7: Final Manifesto & Creator Tag */}
          <section className="flex flex-col items-center space-y-8 pt-4">
            <div className="flex flex-col items-center space-y-2">
              <p className="text-sm sm:text-base font-mono tracking-[0.35em] text-neutral-400 uppercase">
                &ldquo;ONE IDEA.
              </p>
              <p className="text-sm sm:text-base font-mono tracking-[0.35em] text-neutral-300 uppercase">
                ONE CREATOR.
              </p>
              <p className="text-sm sm:text-base font-mono tracking-[0.35em] text-neutral-100 uppercase font-bold">
                ONE WORLD.&rdquo;
              </p>
            </div>

            <div className="pt-4 flex flex-col items-center space-y-2">
              <div className="w-8 h-[1px] bg-red-700/80 mb-1" />
              <h4 className="text-2xl sm:text-3xl font-extrabold tracking-[0.4em] text-neutral-100 font-['Cinzel',serif] uppercase drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                ONE MAN ARMY
              </h4>
              <p className="text-[10px] font-mono tracking-[0.25em] text-neutral-600 uppercase">
                ALL SYSTEMS // PROPRIETARY ORIGINAL WORK
              </p>
            </div>

            <div className="pt-10">
              <button
                id="credits-bottom-back-btn"
                onClick={onBack}
                className="px-8 py-3 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-red-600/80 text-neutral-200 hover:text-white font-mono tracking-[0.25em] text-xs uppercase transition-all duration-200 shadow-xl active:scale-95"
              >
                [ RETURN TO FACILITY ]
              </button>
            </div>
          </section>
        </motion.div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="relative z-20 h-1 bg-neutral-950 border-t border-neutral-900">
        <div
          className="h-full bg-red-600/70 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </div>
  );
};
