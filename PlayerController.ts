import * as THREE from 'three';
import { ColliderType, GameSettings, InteractableObject, PhysicsCollider } from '../types';
import { soundEngine } from '../audio/SoundEngine';
import { soundEvents } from './SoundEventManager';

export const PLAYER_SPAWN = {
  x: 0,
  y: 1.75,
  z: 18,
};

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
  public position: THREE.Vector3 = new THREE.Vector3(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Rotation angles (Euler YXZ)
  public pitch: number = 0; // Target look up/down (-Math.PI/2 to Math.PI/2)
  public yaw: number = 0;   // Target look left/right (facing North = 0)
  public currentPitch: number = 0; // Smoothed look
  public currentYaw: number = 0;

  // Player physical dimensions
  public radius: number = 0.30;
  public standHeight: number = 1.75;
  public crouchHeight: number = 1.0;
  public currentHeight: number = 1.75;

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

  // Interaction & Callbacks
  public hoveredInteractable: InteractableObject | null = null;
  public onInteractCallback?: (item: InteractableObject) => void;
  public onPauseCallback?: () => void;
  public onToggleDebugPhysics?: () => void;

  // Pointer lock state
  private pointerLockSupported: boolean = false;
  private lastPointerLockExitTime: number = 0;
  private pointerLockCooldownMs: number = 350;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, settings: GameSettings) {
    this.camera = camera;
    this.domElement = domElement;
    this.settings = settings;

    this.currentPitch = this.pitch;
    this.currentYaw = this.yaw;

    this.initFlashlight();
    this.bindEvents();
  }

  private initFlashlight() {
    this.flashlight = new THREE.SpotLight(0xfffaed, this.flashlightBaseIntensity, 24, Math.PI / 5.2, 0.42, 1.2);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.width = 1024;
    this.flashlight.shadow.mapSize.height = 1024;
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 24;
    this.flashlight.shadow.bias = -0.001;

    this.flashlight.position.set(0.2, -0.2, 0.1);

    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -5);

    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);

    this.pointerLockSupported = 'pointerLockElement' in document;
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  public dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
  }

  public requestPointerLock() {
    if (this.pointerLockSupported && this.domElement) {
      // Respect browser security cooldown period between pointer lock exit and next lock request
      const now = performance.now();
      if (now - this.lastPointerLockExitTime < this.pointerLockCooldownMs) {
        return;
      }

      try {
        const promise = (this.domElement as any).requestPointerLock?.();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            // Silently absorb security rate-limit rejections without console error
          });
        }
      } catch {
        // Handled silently
      }
    }
  }

  public exitPointerLock() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
      this.lastPointerLockExitTime = performance.now();
    }
  }

  private handlePointerLockChange = () => {
    const isNowLocked = document.pointerLockElement === this.domElement;
    if (!isNowLocked && this.isLocked) {
      this.lastPointerLockExitTime = performance.now();
    }
    this.isLocked = isNowLocked;
  };

  private handlePointerLockError = () => {
    // Record timestamp on error to prevent immediate rapid retries
    this.lastPointerLockExitTime = performance.now();
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
      case 'F3':
        e.preventDefault();
        if (this.onToggleDebugPhysics) {
          this.onToggleDebugPhysics();
        }
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
      if (colliders && !this.canStandUp(colliders)) {
        return;
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
  public update(
    delta: number,
    colliders: PhysicsCollider[] | THREE.Box3[],
    interactables: Map<string, InteractableObject>
  ) {
    const dt = Math.min(delta, 0.05);

    // Safety Out-of-Bounds Reset
    if (this.position.y < -5 || isNaN(this.position.x) || isNaN(this.position.z)) {
      this.position.set(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
      this.velocity.set(0, 0, 0);
    }

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

    // 3. Stamina & Speed (Walk: 2.8m/s, Sprint: 4.4m/s, Crouch: 1.6m/s)
    let speed = 2.8;
    if (this.isCrouching) {
      speed = 1.6;
      this.isRunning = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 25);
    } else if (this.input.run && isMoving && this.stamina > 5) {
      this.isRunning = true;
      speed = 4.4;
      this.stamina = Math.max(0, this.stamina - dt * 25);
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

    // Smooth acceleration & deceleration damping
    const accelRate = isMoving ? 14 : 18;
    const lerpFactor = 1 - Math.exp(-accelRate * dt);
    this.velocity.lerp(_targetVelocity, lerpFactor);

    // 5. Collision Detection & Wall Sliding
    this.resolveCollisions(dt, colliders);

    // 6. Camera Look Smoothing
    const smoothing = this.settings.cameraSmoothing ?? 0.3;
    if (smoothing > 0) {
      const rotSpeed = 35 - smoothing * 22;
      const rotLerp = 1 - Math.exp(-rotSpeed * dt);
      this.currentPitch += (this.pitch - this.currentPitch) * rotLerp;
      this.currentYaw += (this.yaw - this.currentYaw) * rotLerp;
    } else {
      this.currentPitch = this.pitch;
      this.currentYaw = this.yaw;
    }

    _euler.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    // 7. Head Bobbing & Footsteps (Subtle)
    const currentSpeed = this.velocity.length();
    if (currentSpeed > 0.2) {
      const bobFreq = this.isRunning ? 11 : this.isCrouching ? 6 : 8.0;
      this.bobTimer += dt * bobFreq;

      const ampY = this.isRunning ? 0.035 : this.isCrouching ? 0.010 : 0.020;
      const ampX = this.isRunning ? 0.020 : this.isCrouching ? 0.006 : 0.012;

      const bobY = Math.sin(this.bobTimer) * ampY;
      const bobX = Math.cos(this.bobTimer * 0.5) * ampX;

      this.camera.position.set(
        this.position.x + bobX,
        this.position.y + bobY,
        this.position.z
      );

      const currentBobPhase = Math.sin(this.bobTimer);
      if (this.lastBobPhase > 0 && currentBobPhase <= 0) {
        soundEngine.playFootstep(this.isRunning, this.isCrouching);
        const noise = this.isCrouching ? 2 : this.isRunning ? 40 : 10;
        this.currentNoise = noise;
        soundEvents.emit(this.position.x, this.position.y, this.position.z, noise, 'player');
      }
      this.lastBobPhase = currentBobPhase;
    } else {
      this.currentNoise = Math.max(0, this.currentNoise - dt * 25);
      const breath = Math.sin(performance.now() * 0.002) * 0.006;
      this.camera.position.set(this.position.x, this.position.y + breath, this.position.z);
    }

    // 8. Flashlight Stabilization & Controlled Flickering
    if (this.flashlightOn) {
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

      this.flashlightCurrentIntensity +=
        (this.flashlightTargetIntensity - this.flashlightCurrentIntensity) * Math.min(1, dt * 20);
      this.flashlight.intensity = this.flashlightCurrentIntensity;
      this.flashlight.visible = this.flashlightCurrentIntensity > 0.01;

      const targetSwayX = 0.20 - this.velocity.x * 0.012;
      const targetSwayY = -0.20 - this.velocity.y * 0.012;
      this.flashlightSway.x += (targetSwayX - this.flashlightSway.x) * Math.min(1, dt * 8);
      this.flashlightSway.y += (targetSwayY - this.flashlightSway.y) * Math.min(1, dt * 8);
      this.flashlight.position.set(this.flashlightSway.x, this.flashlightSway.y, 0.1);
    }

    // 9. Interaction Raycast
    this.checkInteraction(interactables);
  }

  /**
   * Continuous cylinder-vs-AABB multi-pass collision resolution.
   * Isolates WALL, DOOR, and OBJECT obstacles; ignores floors, ceilings, and triggers.
   * Prevents cross-axis locking, eliminates invisible walls, and delivers smooth wall sliding.
   */
  private resolveCollisions(dt: number, colliders: PhysicsCollider[] | THREE.Box3[]) {
    _moveStep.copy(this.velocity).multiplyScalar(dt);

    const targetPos = new THREE.Vector3(
      this.position.x + _moveStep.x,
      this.currentHeight,
      this.position.z + _moveStep.z
    );

    // Player vertical bounds
    const playerFeetY = 0.05;
    const playerHeadY = this.currentHeight + 0.08;
    const radius = this.radius;

    // Multi-pass relaxation allows smooth sliding across corner vertices and multi-box seams
    const MAX_PASSES = 4;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let collided = false;

      for (let i = 0; i < colliders.length; i++) {
        const item = colliders[i];
        let box: THREE.Box3;

        // Check if item is PhysicsCollider or raw Box3
        if ('box' in item && 'type' in item) {
          // PhysicsCollider: skip if disabled or non-blocking (floor, ceiling, trigger)
          if (!item.enabled || item.type === ColliderType.FLOOR || item.type === ColliderType.CEILING || item.type === ColliderType.TRIGGER) {
            continue;
          }
          box = item.box;
        } else {
          box = item as THREE.Box3;
        }

        if (box.isEmpty()) continue;

        // 1. Skip if no vertical overlap (e.g. floor below player or high ceiling/lintel above head)
        if (playerHeadY <= box.min.y || playerFeetY >= box.max.y) {
          continue;
        }

        // 2. 2D Circle vs 2D AABB in horizontal (X-Z) plane
        const px = targetPos.x;
        const pz = targetPos.z;

        // Closest point on the AABB in XZ
        const cx = Math.max(box.min.x, Math.min(px, box.max.x));
        const cz = Math.max(box.min.z, Math.min(pz, box.max.z));

        const dx = px - cx;
        const dz = pz - cz;
        const distSq = dx * dx + dz * dz;

        // Circle overlaps the box boundary
        if (distSq < radius * radius && distSq > 0.0000001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          const nx = dx / dist;
          const nz = dz / dist;

          // Push position outwards along contact normal
          targetPos.x += nx * overlap;
          targetPos.z += nz * overlap;

          // Slide velocity along collision normal (preserve perpendicular velocity)
          const velDot = this.velocity.x * nx + this.velocity.z * nz;
          if (velDot < 0) {
            this.velocity.x -= velDot * nx;
            this.velocity.z -= velDot * nz;
          }
          collided = true;
        } else if (distSq <= 0.0000001) {
          // Circle center is inside the box (deep penetration recovery)
          const distMinX = px - box.min.x;
          const distMaxX = box.max.x - px;
          const distMinZ = pz - box.min.z;
          const distMaxZ = box.max.z - pz;

          const minDist = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

          if (minDist === distMinX) {
            targetPos.x = box.min.x - radius - 0.002;
            if (this.velocity.x > 0) this.velocity.x = 0;
          } else if (minDist === distMaxX) {
            targetPos.x = box.max.x + radius + 0.002;
            if (this.velocity.x < 0) this.velocity.x = 0;
          } else if (minDist === distMinZ) {
            targetPos.z = box.min.z - radius - 0.002;
            if (this.velocity.z > 0) this.velocity.z = 0;
          } else {
            targetPos.z = box.max.z + radius + 0.002;
            if (this.velocity.z < 0) this.velocity.z = 0;
          }
          collided = true;
        }
      }

      if (!collided) break;
    }

    this.position.x = targetPos.x;
    this.position.z = targetPos.z;
    this.position.y = this.currentHeight;

    this.updatePlayerBox();
  }

  private updatePlayerBox() {
    _minVec.set(this.position.x - this.radius, 0.1, this.position.z - this.radius);
    _maxVec.set(this.position.x + this.radius, this.currentHeight + 0.1, this.position.z + this.radius);
    _playerBox.set(_minVec, _maxVec);
  }

  /**
   * Center ray test to detect interactable items within range
   */
  private checkInteraction(interactables: Map<string, InteractableObject>) {
    _scratchForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);

    let closestItem: InteractableObject | null = null;
    let closestDist = 2.8;

    for (const item of interactables.values()) {
      _toItem.set(
        item.position[0] - this.camera.position.x,
        item.position[1] - this.camera.position.y,
        item.position[2] - this.camera.position.z
      );
      const dist = _toItem.length();
      const maxRange = item.distanceThreshold || closestDist;

      if (dist <= maxRange) {
        _toItem.normalize();
        const dot = _scratchForward.dot(_toItem);
        if (dot > 0.65) {
          closestItem = item;
          closestDist = dist;
        }
      }
    }

    this.hoveredInteractable = closestItem;
  }
}
