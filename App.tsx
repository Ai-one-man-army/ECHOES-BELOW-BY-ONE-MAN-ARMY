/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from "./GameEngine";
import { OpeningSequence } from "./OpeningSequence";
import { HUD } from "./HUD";
import { MobileControls } from "./MobileControls";
import { PauseMenu } from "./PauseMenu";
import { Sector9Modal } from "./Sector9Modal";
import GameOverModal from "./GameOverModal";
import { CreditsScreen } from "./CreditsScreen";


export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Device detection for automatic mobile graphics default
  const isMobileDevice = useCallback(() => {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 768
    );
  }, []);

  // Settings state with LocalStorage persistence
  const [settings, setSettings] = useState<GameSettings>(() => {
    const isMobile = typeof window !== 'undefined' && (
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768
    );

    const defaultGraphics: GraphicsQuality = isMobile ? 'LOW' : 'MEDIUM';

    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return {
          graphics: defaultGraphics,
          volume: 0.7,
          mouseSensitivity: 1.0,
          touchSensitivity: 1.2,
          cameraSmoothing: 0.3,
          invertY: false,
          fov: 75,
          ...JSON.parse(saved),
        };
      }
    } catch {
      // Ignore localStorage error
    }

    return {
      graphics: defaultGraphics,
      volume: 0.7,
      mouseSensitivity: 1.0,
      touchSensitivity: 1.2,
      cameraSmoothing: 0.3,
      invertY: false,
      fov: 75,
    };
  });

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>('INTRO');
  const [objective, setObjective] = useState<Objective>({
    id: 'find_sector9',
    title: 'SECTOR 9 ACCESS',
    description: 'Find a way into Sector 9.',
    completed: false,
  });

  const [hoveredItem, setHoveredItem] = useState<InteractableObject | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'info' | 'warn' | 'success'>('info');
  const notificationTimeout = useRef<number | null>(null);
  const [showSector9Modal, setShowSector9Modal] = useState<boolean>(false);
  const [showCredits, setShowCredits] = useState<boolean>(false);

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    position: { x: 0, y: 1.7, z: 14 },
    isRunning: false,
    isCrouching: false,
    stamina: 100,
    flashlightOn: true,
    flashlightBattery: 100,
    hasSector9Keycard: false,
    hasPowerRestored: false,
    hasSector9Bypassed: false,
  });

  // Check mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobileDevice]);

  // Sync sound engine volume
  useEffect(() => {
    soundEngine.setVolume(settings.volume);
  }, [settings.volume]);

  // Initialize GameEngine once container is mounted
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(containerRef.current, settings);
    engineRef.current = engine;

    engine.onStatusChange = (status) => {
      setGameStatus(status);
    };

    engine.onObjectiveChange = (obj) => {
      setObjective(obj);
      if (obj.id === 'sector9_breached') {
        setShowSector9Modal(true);
      }
    };

    engine.onHoverInteractable = (item) => {
      setHoveredItem(item);
    };

    engine.onStatsUpdate = (stats) => {
      setPlayerStats(stats);
    };

    engine.onNotification = (msg, type = 'info') => {
      setNotification(msg);
      setNotificationType(type);
      if (notificationTimeout.current !== null) {
        window.clearTimeout(notificationTimeout.current);
      }
      notificationTimeout.current = window.setTimeout(() => {
        setNotification(null);
      }, 4000);
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartGameAfterIntro = () => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  };

  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }

      if (newSettings.graphics && engineRef.current) {
        engineRef.current.applyGraphicsSettings(newSettings.graphics);
      }
      if (newSettings.volume !== undefined) {
        soundEngine.setVolume(newSettings.volume);
      }
      if (newSettings.fov && engineRef.current?.camera) {
        engineRef.current.camera.fov = newSettings.fov;
        engineRef.current.camera.updateProjectionMatrix();
      }
      if (engineRef.current?.playerController) {
        engineRef.current.playerController.settings = updated;
      }

      return updated;
    });
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resumeGame();
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pauseGame();
    }
  };

  const handleRestart = () => {
    setShowSector9Modal(false);
    if (engineRef.current) {
      engineRef.current.restartGame();
    }
  };

  const handleRespawnCheckpoint = () => {
    if (engineRef.current) {
      engineRef.current.respawnAtCheckpoint();
    }
  };

  const handleCanvasClick = () => {
    if (gameStatus === 'PLAYING' && engineRef.current?.playerController && !isMobile) {
      engineRef.current.playerController.requestPointerLock();
    }
  };

  const handleMobileInteract = () => {
    if (engineRef.current?.playerController && hoveredItem) {
      engineRef.current.playerController.triggerInteraction();
    }
  };

  return (
    <div
      id="game-root-container"
      className="relative w-full h-full overflow-hidden bg-black select-none touch-none"
      onClick={handleCanvasClick}
    >
      {/* 3D WebGL Three.js Container */}
      <div
        ref={containerRef}
        id="webgl-canvas-wrapper"
        className="absolute inset-0 w-full h-full z-0 cursor-crosshair"
      />

      {/* Opening Cinematic Sequence */}
      {gameStatus === 'INTRO' && (
        <OpeningSequence
          onComplete={handleStartGameAfterIntro}
          onOpenCredits={() => setShowCredits(true)}
        />
      )}

      {/* In-Game Heads Up Display */}
      {gameStatus === 'PLAYING' && (
        <>
          <HUD
            objective={objective}
            stats={playerStats}
            hoveredItem={hoveredItem}
            notification={notification}
            notificationType={notificationType}
            onPauseClick={handlePause}
            isMobile={isMobile}
          />

          {/* Touch controls on mobile / tablet */}
          {isMobile && (
            <MobileControls
              playerController={engineRef.current?.playerController || null}
              hasHoveredItem={hoveredItem !== null}
              onInteract={handleMobileInteract}
            />
          )}
        </>
      )}

      {/* In-Game Pause Menu */}
      {gameStatus === 'PAUSED' && (
        <PauseMenu
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenCredits={() => setShowCredits(true)}
          isMobile={isMobile}
        />
      )}

      {/* Sector 9 Objective Breached Success Modal */}
      {showSector9Modal && (
        <Sector9Modal
          onContinue={() => setShowSector9Modal(false)}
          onRestart={handleRestart}
          onOpenCredits={() => setShowCredits(true)}
        />
      )}

      {/* Game Over Caught By The Hollow Modal */}
      {gameStatus === 'GAME_OVER' && (
        <GameOverModal
          onRespawn={handleRespawnCheckpoint}
          onRestartFacility={handleRestart}
          onOpenCredits={() => setShowCredits(true)}
        />
      )}

      {/* Cinematic Full-Screen Horror Credits Screen */}
      {showCredits && (
        <CreditsScreen onBack={() => setShowCredits(false)} />
      )}
    </div>
  );
}
