import * as THREE from 'three';
import { GameSettings, InteractableObject } from '../types';
import { soundEngine } from "./SoundEngine";
import { soundEvents } from './SoundEventManager';

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
  crouch: boolean;
  // Mobile virtual joystick input vector (-1 to 1)
  joystickX: number;
  joystickY: number;
}

// Preallocated scratch variables to eliminate per-frame Garbage Collection
const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _targetVelocity = new THREE.Vector3();
const _moveStep = new THREE.Vector3();
const _playerBox = new THREE.Box3();
const _minVec = new THREE.Vector3();
const _maxVec = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _scratchForward = new THREE.Vector3();
const _toItem = new THREE.Vector3();

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public settings: GameSettings;

  // Position & Velocity
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.7, 14); // Start in arrival corridor
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Rotation angles (Euler YXZ)
  public pitch: number = 0; // Target look up/down (-Math.PI/2 to Math.PI/2)
  public yaw: number = 0;   // Target look left/right (facing North = 0)
  public currentPitch: number = 0; // Smoothed look
  public currentYaw: number = 0;

  // Player physical dimensions
  public radius: number = 0.38;
  public standHeight: number = 1.7;
  public crouchHeight: number = 0.95;
  public currentHeight: number = 1.7;

  // States
  public isRunning: boolean = false;
  public isCrouching: boolean = false;
  public stamina: number = 100;
  public maxStamina: number = 100;
  public flashlightOn: boolean = true;
  public flashlightBattery: number = 100;
  public isLocked: boolean = false;
  public currentNoise: number = 0;

  // Flashlight 3D Objects & Controlled Stability System
  public flashlight!: THREE.SpotLight;
  public flashlightTarget!: THREE.Object3D;
  private flashlightBaseIntensity: number = 2.85;
  private flashlightCurrentIntensity: number = 2.85;
  private flashlightTargetIntensity: number = 2.85;
  private flashlightSway = new THREE.Vector3(0.2, -0.2, 0.1);
  private flickerSequence: { time: number; intensity: number }[] = [];
  private flickerTimer: number = 0;

  // Head bobbing & footsteps
  private bobTimer: number = 0;
  private lastBobPhase: number = 0;

  // Input
  public input: PlayerInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
    crouch: false,
    joystickX: 0,
    joystickY: 0,
  };

  // Interaction
  public hoveredInteractable: InteractableObject | null = null;
  public onInteractCallback?: (item: InteractableObject) => void;
  public onPauseCallback?: () => void;

  // Pointer lock state
  private pointerLockSupported: boolean = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, settings: GameSettings) {
    this.camera = camera;
    this.domElement = domElement;
    this.settings = settings;

    this.currentPitch = this.pitch;
    this.currentYaw = this.yaw;

    this.initFlashlight();
    this.initPointerLock();
    this.bindEvents();
  }

  private initFlashlight() {
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -8);
    this.camera.add(this.flashlightTarget);

    // Warm halogen horror flashlight beam - Stable, persistent SpotLight
    this.flashlight = new THREE.SpotLight(0xfffaea, this.flashlightBaseIntensity, 30, Math.PI / 5.2, 0.55, 1.25);
    this.flashlight.position.set(0.2, -0.2, 0.1);
    this.flashlight.target = this.flashlightTarget;
    this.flashlight.castShadow = this.settings.graphics !== 'LOW';
    this.flashlight.shadow.mapSize.width = 512;
    this.flashlight.shadow.mapSize.height = 512;
    this.flashlight.shadow.bias = -0.002;
    this.camera.add(this.flashlight);

    this.flashlightCurrentIntensity = this.flashlightBaseIntensity;
    this.flashlightTargetIntensity = this.flashlightBaseIntensity;
  }

  private initPointerLock() {
    this.pointerLockSupported = 'pointerLockElement' in document;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public requestPointerLock() {
    if (this.pointerLockSupported && this.domElement) {
      try {
        this.domElement.requestPointerLock();
      } catch {
        // Fallback for mobile/unsupported
      }
    }
  }

  public exitPointerLock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  private handlePointerLockChange = () => {
    this.isLocked = document.pointerLockElement === this.domElement;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    soundEngine.resumeContext();

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.run = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
      case 'KeyC':
        this.toggleCrouch();
        break;
      case 'KeyF':
        this.toggleFlashlight();
        break;
      case 'KeyE':
        this.triggerInteraction();
        break;
      case 'Escape':
        if (this.onPauseCallback) {
          this.onPauseCallback();
        }
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.input.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.input.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.input.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.input.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.run = false;
        break;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;

    const sens = (this.settings.mouseSensitivity ?? 1.0) * 0.0022;
    const invert = this.settings.invertY ? -1 : 1;

    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens * invert;

    // Clamp pitch to prevent somersaults
    this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));

    // If camera smoothing is disabled (0), sync immediately
    if (!this.settings.cameraSmoothing || this.settings.cameraSmoothing === 0) {
      this.currentYaw = this.yaw;
      this.currentPitch = this.pitch;
    }
  };

  /**
   * Touch look for mobile touch pad drag
   */
  public handleTouchLook(deltaX: number, deltaY: number) {
    const sens = (this.settings.touchSensitivity ?? 1.2) * 0.0032;
    const invert = this.settings.invertY ? -1 : 1;

    this.yaw -= deltaX * sens;
    this.pitch -= deltaY * sens * invert;
    this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));

    if (!this.settings.cameraSmoothing || this.settings.cameraSmoothing === 0) {
      this.currentYaw = this.yaw;
      this.currentPitch = this.pitch;
    }
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlightTargetIntensity = this.flashlightOn ? this.flashlightBaseIntensity : 0;
    if (!this.flashlightOn) {
      this.flashlight.intensity = 0;
      this.flashlightCurrentIntensity = 0;
      this.flashlight.visible = false;
    } else {
      this.flashlight.visible = true;
    }
    soundEngine.playFlashlightClick(this.flashlightOn);
  }

  /**
   * Trigger an intentional, controlled horror flicker event.
   * Example: ON -> dim -> OFF briefly -> ON (never flickers continuously)
   */
  public triggerControlledFlicker() {
    if (!this.flashlightOn) return;
    this.flickerSequence = [
      { time: 0.08, intensity: this.flashlightBaseIntensity * 0.35 },
      { time: 0.06, intensity: 0.0 }, // brief off
      { time: 0.05, intensity: this.flashlightBaseIntensity * 0.5 },
      { time: 0.04, intensity: 0.1 },
      { time: 0.12, intensity: this.flashlightBaseIntensity },
    ];
    this.flickerTimer = 0;
  }

  public toggleCrouch(colliders?: THREE.Box3[]) {
    if (this.isCrouching) {
      // Check overhead clearance before standing up
      if (colliders && !this.canStandUp(colliders)) {
        return; // Overhead blockage prevents standing
      }
      this.isCrouching = false;
    } else {
      this.isCrouching = true;
    }
  }

  public canStandUp(colliders: THREE.Box3[]): boolean {
    _minVec.set(this.position.x - this.radius, 0.1, this.position.z - this.radius);
    _maxVec.set(this.position.x + this.radius, this.standHeight + 0.1, this.position.z + this.radius);
    _playerBox.set(_minVec, _maxVec);

    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (col.isEmpty()) continue;
      if (_playerBox.intersectsBox(col)) {
        return false;
      }
    }
    return true;
  }

  public triggerInteraction() {
    if (this.hoveredInteractable && this.onInteractCallback) {
      this.onInteractCallback(this.hoveredInteractable);
    }
  }

  /**
   * Update player physics, collision, stamina, and camera positioning
   */
  public update(delta: number, colliders: THREE.Box3[], interactables: Map<string, InteractableObject>) {
    // Safe bounded delta to prevent physics jumps
    const dt = Math.min(delta, 0.1);

    // 1. Crouch Height Interpolation (smooth ease)
    const targetHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
    this.currentHeight += (targetHeight - this.currentHeight) * Math.min(1, dt * 10);

    // 2. Movement Intent Vector
    let moveZ = 0;
    let moveX = 0;

    if (this.input.forward) moveZ -= 1;
    if (this.input.backward) moveZ += 1;
    if (this.input.left) moveX -= 1;
    if (this.input.right) moveX += 1;

    // Mobile virtual joystick input with dead zone check
    const jx = this.input.joystickX;
    const jy = this.input.joystickY;
    if (Math.abs(jx) > 0.08) moveX += jx;
    if (Math.abs(jy) > 0.08) moveZ += jy;

    const moveLenSq = moveX * moveX + moveZ * moveZ;
    if (moveLenSq > 1) {
      const invLen = 1 / Math.sqrt(moveLenSq);
      moveX *= invLen;
      moveZ *= invLen;
    }

    const isMoving = moveLenSq > 0.01;

    // 3. Stamina & Speed Curve
    let speed = 3.6; // Normal walk speed in m/s
    if (this.isCrouching) {
      speed = 1.8;
      this.isRunning = false;
      // Recover stamina faster when crouching
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 25);
    } else if (this.input.run && isMoving && this.stamina > 5) {
      this.isRunning = true;
      speed = 6.2;
      this.stamina = Math.max(0, this.stamina - dt * 28);
      if (this.stamina <= 0) {
        this.isRunning = false;
      }
    } else {
      this.isRunning = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 18);
    }

    // 4. Compute World-Space Velocity from Camera Yaw
    _forwardVec.set(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
    _rightVec.set(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));

    _targetVelocity.set(0, 0, 0);
    _targetVelocity.addScaledVector(_forwardVec, -moveZ * speed);
    _targetVelocity.addScaledVector(_rightVec, moveX * speed);

    // Frame-rate-independent smooth acceleration & deceleration damping
    const accelRate = isMoving ? 14 : 18;
    const lerpFactor = 1 - Math.exp(-accelRate * dt);
    this.velocity.lerp(_targetVelocity, lerpFactor);

    // 5. Collision Detection & Wall Sliding
    this.resolveCollisions(dt, colliders);

    // 6. Camera Look Smoothing
    const smoothing = this.settings.cameraSmoothing ?? 0.3;
    if (smoothing > 0) {
      const rotSpeed = 35 - smoothing * 22; // higher = faster/crisper
      const rotLerp = 1 - Math.exp(-rotSpeed * dt);
      this.currentPitch += (this.pitch - this.currentPitch) * rotLerp;
      this.currentYaw += (this.yaw - this.currentYaw) * rotLerp;
    } else {
      this.currentPitch = this.pitch;
      this.currentYaw = this.yaw;
    }

    _euler.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    // 7. Head Bobbing & Footsteps (Subtle, never nauseating)
    const currentSpeed = this.velocity.length();
    if (currentSpeed > 0.2) {
      const bobFreq = this.isRunning ? 12 : this.isCrouching ? 6 : 8.5;
      this.bobTimer += dt * bobFreq;

      // Natural vertical and lateral bob
      const ampY = this.isRunning ? 0.045 : this.isCrouching ? 0.012 : 0.024;
      const ampX = this.isRunning ? 0.025 : this.isCrouching ? 0.008 : 0.015;

      const bobY = Math.sin(this.bobTimer) * ampY;
      const bobX = Math.cos(this.bobTimer * 0.5) * ampX;

      this.camera.position.set(
        this.position.x + bobX,
        this.position.y + bobY,
        this.position.z
      );

      // Footstep sound at the bottom phase of the step
      const currentBobPhase = Math.sin(this.bobTimer);
      if (this.lastBobPhase > 0 && currentBobPhase <= 0) {
        soundEngine.playFootstep(this.isRunning, this.isCrouching);
        const noise = this.isCrouching ? 2 : this.isRunning ? 40 : 10;
        this.currentNoise = noise;
        soundEvents.emit(this.position.x, this.position.y, this.position.z, noise, 'player');
      }
      this.lastBobPhase = currentBobPhase;
    } else {
      // Noise decay when stationary
      this.currentNoise = Math.max(0, this.currentNoise - dt * 25);
      // Gentle breathing idle sway
      const breath = Math.sin(performance.now() * 0.002) * 0.008;
      this.camera.position.set(this.position.x, this.position.y + breath, this.position.z);
    }

    // 8. Flashlight Stabilization & Controlled Flickering
    if (this.flashlightOn) {
      // Handle controlled horror flicker sequence if active
      if (this.flickerSequence.length > 0) {
        const step = this.flickerSequence[0];
        this.flickerTimer += dt;
        this.flashlightTargetIntensity = step.intensity;
        if (this.flickerTimer >= step.time) {
          this.flickerTimer = 0;
          this.flickerSequence.shift();
          if (this.flickerSequence.length === 0) {
            this.flashlightTargetIntensity = this.flashlightBaseIntensity;
          }
        }
      } else {
        this.flashlightTargetIntensity = this.flashlightBaseIntensity;
      }

      // Smooth intensity interpolation (no sudden frame jumps)
      this.flashlightCurrentIntensity +=
        (this.flashlightTargetIntensity - this.flashlightCurrentIntensity) * Math.min(1, dt * 20);
      this.flashlight.intensity = this.flashlightCurrentIntensity;
      this.flashlight.visible = this.flashlightCurrentIntensity > 0.01;

      // Smooth handheld sway with gentle damping
      const targetSwayX = 0.20 - this.velocity.x * 0.015;
      const targetSwayY = -0.20 - this.velocity.y * 0.015;
      this.flashlightSway.x += (targetSwayX - this.flashlightSway.x) * Math.min(1, dt * 8);
      this.flashlightSway.y += (targetSwayY - this.flashlightSway.y) * Math.min(1, dt * 8);
      this.flashlight.position.set(this.flashlightSway.x, this.flashlightSway.y, 0.1);
    }

    // 9. Interaction Raycast
    this.checkInteraction(interactables);
  }

  /**
   * Continuous axis-aligned bounding box collision resolution with stable wall sliding
   * (Zero object allocation)
   */
  private resolveCollisions(dt: number, colliders: THREE.Box3[]) {
    _moveStep.copy(this.velocity).multiplyScalar(dt);

    const skin = 0.001; // tiny margin to prevent sticking

    // --- 1. Resolve X Axis ---
    this.position.x += _moveStep.x;
    this.updatePlayerBox();

    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (col.isEmpty()) continue;
      if (_playerBox.intersectsBox(col)) {
        if (_moveStep.x > 0) {
          this.position.x = col.min.x - this.radius - skin;
        } else if (_moveStep.x < 0) {
          this.position.x = col.max.x + this.radius + skin;
        }
        this.velocity.x = 0;
        this.updatePlayerBox();
      }
    }

    // --- 2. Resolve Z Axis ---
    this.position.z += _moveStep.z;
    this.updatePlayerBox();

    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      if (col.isEmpty()) continue;
      if (_playerBox.intersectsBox(col)) {
        if (_moveStep.z > 0) {
          this.position.z = col.min.z - this.radius - skin;
        } else if (_moveStep.z < 0) {
          this.position.z = col.max.z + this.radius + skin;
        }
        this.velocity.z = 0;
        this.updatePlayerBox();
      }
    }

    // Keep height constant to current crouch/stand height
    this.position.y = this.currentHeight;
  }

  private updatePlayerBox() {
    _minVec.set(this.position.x - this.radius, 0.1, this.position.z - this.radius);
    _maxVec.set(this.position.x + this.radius, this.currentHeight + 0.1, this.position.z + this.radius);
    _playerBox.set(_minVec, _maxVec);
  }

  /**
   * Center ray test to detect interactable items within range
   * (Zero object allocations)
   */
  private checkInteraction(interactables: Map<string, InteractableObject>) {
    _scratchForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

    let closestItem: InteractableObject | null = null;
    let closestDist = 2.8; // Maximum interaction range in meters

    for (const item of interactables.values()) {
      _toItem.set(item.position[0] - this.camera.position.x, item.position[1] - this.camera.position.y, item.position[2] - this.camera.position.z);
      const dist = _toItem.length();

      if (dist <= closestDist) {
        _toItem.normalize();
        const dot = _scratchForward.dot(_toItem);
        if (dot > 0.72) {
          closestItem = item;
          closestDist = dist;
        }
      }
    }

    this.hoveredInteractable = closestItem;
  }
}
