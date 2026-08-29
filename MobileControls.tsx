import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PlayerController } from '../game/PlayerController';
import { Flashlight, Shield, Zap, Hand } from 'lucide-react';

interface MobileControlsProps {
  playerController: PlayerController | null;
  hasHoveredItem: boolean;
  onInteract: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  playerController,
  hasHoveredItem,
  onInteract,
}) => {
  // Virtual joystick state
  const [joystickActive, setJoystickActive] = useState<boolean>(false);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch look trackpad state
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Action states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCrouching, setIsCrouching] = useState<boolean>(false);

  // Left joystick touch handlers
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;

    const rect = joystickBaseRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      joystickOrigin.current = { x: centerX, y: centerY };
    } else {
      joystickOrigin.current = { x: touch.clientX, y: touch.clientY };
    }

    setJoystickActive(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        if (playerController) {
          playerController.input.joystickX = 0;
          playerController.input.joystickY = 0;
        }
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const maxRadius = 45;
    const dx = clientX - joystickOrigin.current.x;
    const dy = clientY - joystickOrigin.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let clampedX = dx;
    let clampedY = dy;

    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: clampedX, y: clampedY });

    if (playerController) {
      // Apply deadzone and smooth radial mapping
      const deadZone = 0.08;
      const normX = clampedX / maxRadius;
      const normY = clampedY / maxRadius;
      const normDist = Math.sqrt(normX * normX + normY * normY);

      if (normDist < deadZone) {
        playerController.input.joystickX = 0;
        playerController.input.joystickY = 0;
      } else {
        // Rescale smoothly from deadZone to 1.0
        const scale = (normDist - deadZone) / (1 - deadZone) / normDist;
        playerController.input.joystickX = normX * scale;
        playerController.input.joystickY = normY * scale;
      }
    }
  };

  // Right touch look handlers
  const handleLookTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const deltaX = touch.clientX - lastLookPos.current.x;
        const deltaY = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };

        if (playerController) {
          playerController.handleTouchLook(deltaX, deltaY);
        }
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  };

  const toggleRun = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const next = !isRunning;
    setIsRunning(next);
    if (playerController) {
      playerController.input.run = next;
    }
  };

  const toggleCrouch = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const next = !isCrouching;
    setIsCrouching(next);
    if (playerController) {
      playerController.toggleCrouch();
    }
  };

  const toggleFlashlight = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (playerController) {
      playerController.toggleFlashlight();
    }
  };

  const handleInteractButton = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onInteract();
  };

  return (
    <div
      id="mobile-controls-overlay"
      className="fixed inset-0 z-40 pointer-events-none select-none touch-none"
    >
      {/* Left Joystick Area */}
      <div
        id="joystick-touch-zone"
        onTouchStart={handleJoystickTouchStart}
        onTouchMove={handleJoystickTouchMove}
        onTouchEnd={handleJoystickTouchEnd}
        onTouchCancel={handleJoystickTouchEnd}
        className="absolute bottom-6 left-6 w-36 h-36 flex items-center justify-center pointer-events-auto"
      >
        <div
          ref={joystickBaseRef}
          className="w-28 h-28 rounded-full border-2 border-white/20 bg-black/40 backdrop-blur-xs relative flex items-center justify-center"
        >
          {/* Inner stick */}
          <div
            className={`w-12 h-12 rounded-full border border-white/40 bg-neutral-700/80 transition-transform ${
              joystickActive ? 'bg-amber-500/80' : ''
            }`}
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Right Look Area (Full right half of screen above bottom action bar) */}
      <div
        id="look-touch-zone"
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
        onTouchCancel={handleLookTouchEnd}
        className="absolute top-16 right-0 bottom-24 w-1/2 pointer-events-auto"
      />

      {/* Right Side Action Buttons */}
      <div className="absolute bottom-6 right-6 flex items-center space-x-3 pointer-events-auto">
        {/* Flashlight Button */}
        <button
          id="btn-flashlight-mobile"
          onClick={toggleFlashlight}
          onTouchStart={(e) => e.stopPropagation()}
          className={`w-13 h-13 rounded-full border flex flex-col items-center justify-center text-[10px] font-mono tracking-wider transition-all active:scale-90 shadow-xl ${
            playerController?.flashlightOn
              ? 'bg-amber-600/90 border-amber-400 text-amber-100 shadow-amber-950/50'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-400'
          }`}
        >
          <Flashlight className="w-4 h-4 mb-0.5" />
          <span>LIGHT</span>
        </button>

        {/* Crouch Button */}
        <button
          id="btn-crouch-mobile"
          onClick={toggleCrouch}
          onTouchStart={(e) => e.stopPropagation()}
          className={`w-13 h-13 rounded-full border flex flex-col items-center justify-center text-[10px] font-mono tracking-wider transition-all active:scale-90 shadow-xl ${
            isCrouching
              ? 'bg-neutral-700 border-white text-white'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-400'
          }`}
        >
          <Shield className="w-4 h-4 mb-0.5" />
          <span>CROUCH</span>
        </button>

        {/* Run Button */}
        <button
          id="btn-run-mobile"
          onClick={toggleRun}
          onTouchStart={(e) => e.stopPropagation()}
          className={`w-13 h-13 rounded-full border flex flex-col items-center justify-center text-[10px] font-mono tracking-wider transition-all active:scale-90 shadow-xl ${
            isRunning
              ? 'bg-red-700 border-red-400 text-white'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-400'
          }`}
        >
          <Zap className="w-4 h-4 mb-0.5" />
          <span>RUN</span>
        </button>

        {/* Interact Button */}
        <button
          id="btn-interact-mobile"
          onClick={handleInteractButton}
          onTouchStart={(e) => e.stopPropagation()}
          className={`w-15 h-15 rounded-full border-2 flex flex-col items-center justify-center text-[10px] font-mono tracking-wider font-bold transition-all active:scale-90 shadow-2xl ${
            hasHoveredItem
              ? 'bg-amber-500 border-white text-black ring-4 ring-amber-500/40 animate-pulse'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-400'
          }`}
        >
          <Hand className="w-5 h-5 mb-0.5" />
          <span>USE</span>
        </button>
      </div>
    </div>
  );
};
