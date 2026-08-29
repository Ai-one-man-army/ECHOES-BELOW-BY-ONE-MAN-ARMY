import * as THREE from 'three';
import { ColliderType, PhysicsCollider, SoundEvent, TheHollowState } from '../types';
import { TheHollowCreature } from './TheHollowCreature';
import { soundEngine } from '../audio/SoundEngine';
import { soundEvents } from './SoundEventManager';

interface Waypoint {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
}

// Module-level preallocated scratch variables to prevent GC pauses
const _origin = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ray = new THREE.Ray();
const _scratchHit = new THREE.Vector3();
const _testPos = new THREE.Vector3();
const _toPlayer2D = new THREE.Vector2();
const _facing2D = new THREE.Vector2();
const _toCreature2D = new THREE.Vector2();
const _playerLook2D = new THREE.Vector2();

export class TheHollowAI {
  public scene: THREE.Scene;
  public creature: TheHollowCreature;

  // Spatial Transform
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, -26); // Spawn in deep Sector 9 Anomaly Chamber
  public rotation: number = 0; // Yaw facing angle (radians)
  public currentSpeed: number = 0;

  // Speeds
  public walkSpeed: number = 2.2;
  public chaseSpeed: number = 4.8;
  public returnSpeed: number = 1.8;

  // State Machine
  public state: TheHollowState = 'IDLE';
  public stateTimer: number = 0;
  public targetPos: THREE.Vector3 = new THREE.Vector3(0, 0, -26);
  public lastKnownPlayerPos: THREE.Vector3 | null = null;
  public loseTargetTimer: number = 0;
  public searchScanAngle: number = 0;

  // Combat & Attack Timing
  public attackRange: number = 1.75;
  public attackCancelRange: number = 2.45;
  public attackTelegraphTime: number = 0.55; // 0.55s wind-up warning
  public attackTotalDuration: number = 0.95;  // 0.95s full swipe animation
  public attackCooldownDuration: number = 1.85; // 1.85s recovery cooldown
  public attackTimer: number = 0;
  public attackDamageDealt: boolean = false;
  public cooldownTimer: number = 0;

  // Callbacks
  public onStateChange?: (state: TheHollowState) => void;
  public onPlayerDamaged?: (damage: number) => void;
  public onPlayerCaught?: () => void;

  // Facility Waypoint Graph for intelligent corridor navigation
  private waypoints: Map<string, Waypoint> = new Map();
  private currentPath: THREE.Vector3[] = [];
  private currentPathIndex: number = 0;

  // Sound & Atmosphere timers
  private footstepTimer: number = 0;
  private breathTimer: number = 2;
  private ambientFxTimer: number = 8;

  // Lurking shadowy spawn spots
  private lurkPositions = [
    { x: 0, z: -25 },  // Sector 9 deep chamber
    { x: 0, z: -15 },  // Sector 9 corridor
    { x: -5.5, z: 0 }, // Biology Lab
    { x: 5.5, z: 0 },  // Sub-Station
    { x: 5.5, z: 10 }, // Storage archive
  ];
  private currentLurkIndex: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.creature = new TheHollowCreature();
    this.scene.add(this.creature.group);
    this.initWaypoints();
    this.reset(0);
  }

  private initWaypoints() {
    const addWp = (id: string, x: number, z: number, neighbors: string[]) => {
      this.waypoints.set(id, { id, x, z, neighbors });
    };

    // Checkpoint & Main Corridor Spine
    addWp('checkpoint_spawn', 0, 18, ['corridor_south']);
    addWp('corridor_south', 0, 10, ['checkpoint_spawn', 'corridor_mid', 'sec_office', 'storage_room']);
    addWp('sec_office', -5.5, 10, ['corridor_south']);
    addWp('storage_room', 5.5, 10, ['corridor_south']);

    addWp('corridor_mid', 0, 5, ['corridor_south', 'corridor_north', 'biolab', 'power_substation']);
    addWp('biolab', -5.5, 0, ['corridor_mid']);
    addWp('power_substation', 5.5, 0, ['corridor_mid']);

    addWp('corridor_north', 0, -2, ['corridor_mid', 'control_hub']);
    addWp('control_hub', 0, -8.5, ['corridor_north', 'sector9_gate']);

    // Sector 9 Containment Area
    addWp('sector9_gate', 0, -13, ['control_hub', 'sector9_mid']);
    addWp('sector9_mid', 0, -18, ['sector9_gate', 'sector9_deep']);
    addWp('sector9_deep', 0, -25, ['sector9_mid']);
  }

  public reset(lurkIndex: number = 0) {
    this.currentLurkIndex = lurkIndex % this.lurkPositions.length;
    const lurk = this.lurkPositions[this.currentLurkIndex];
    this.position.set(lurk.x, 0, lurk.z);
    this.targetPos.set(lurk.x, 0, lurk.z);
    this.state = 'IDLE';
    this.stateTimer = 5 + Math.random() * 8;
    this.lastKnownPlayerPos = null;
    this.loseTargetTimer = 0;
    this.currentSpeed = 0;
    this.attackTimer = 0;
    this.attackDamageDealt = false;
    this.cooldownTimer = 0;
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.creature.group.position.copy(this.position);
    if (this.onStateChange) this.onStateChange(this.state);
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    isFlashlightOn: boolean,
    isPlayerCrouching: boolean,
    colliders: PhysicsCollider[] | THREE.Box3[]
  ) {
    const dt = Math.min(delta, 0.1);

    // 1. Calculate distance and line of sight to player
    const distToPlayer = this.position.distanceTo(playerPos);
    const hasSight = this.checkLineOfSight(playerPos, colliders);

    // 2. Check Flashlight Detection
    const illuminatedByFlashlight = isFlashlightOn && this.isIlluminatedByPlayer(playerPos, playerYaw, distToPlayer);

    // 3. Acoustic Perception: Listen for nearby sound events
    const acousticHit = soundEvents.getLoudestNearbyEvent(
      { x: this.position.x, y: 1.5, z: this.position.z },
      2.0
    );

    // 4. Update State Machine
    this.updateStateMachine(
      dt,
      playerPos,
      playerYaw,
      distToPlayer,
      hasSight,
      illuminatedByFlashlight,
      isPlayerCrouching,
      acousticHit,
      colliders
    );

    // 5. Move & Smoothly Rotate towards current target
    this.moveTowardsTarget(dt, colliders);

    // 6. Audio Generation
    this.updateAudio(dt, playerPos, playerYaw, distToPlayer);

    // 7. Update 3D procedural animations
    const isChasing = this.state === 'CHASE';
    const isListening = this.state === 'LISTEN';
    const isAttacking = this.state === 'ATTACK';
    const attackProgress = isAttacking ? Math.min(1.0, this.attackTimer / this.attackTotalDuration) : 0;
    const isCooldown = this.state === 'COOLDOWN';

    this.creature.update(
      dt,
      this.currentSpeed,
      isChasing,
      isListening,
      isAttacking,
      attackProgress,
      isCooldown
    );
  }

  private updateStateMachine(
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    distToPlayer: number,
    hasSight: boolean,
    illuminatedByFlashlight: boolean,
    isPlayerCrouching: boolean,
    acousticHit: { event: SoundEvent; perceivedVolume: number; distance: number } | null,
    colliders: PhysicsCollider[] | THREE.Box3[]
  ) {
    this.stateTimer -= dt;

    const visionRange = isPlayerCrouching ? 6.0 : 11.0;
    const proximityRange = isPlayerCrouching ? 1.5 : 2.6;

    const canSeePlayer =
      hasSight &&
      (illuminatedByFlashlight ||
        (distToPlayer <= visionRange && this.isInVisionCone(playerPos, 80)) ||
        distToPlayer <= proximityRange);

    if (canSeePlayer && this.state !== 'CHASE' && this.state !== 'ATTACK' && this.state !== 'COOLDOWN') {
      this.setState('CHASE');
      this.lastKnownPlayerPos = playerPos.clone();
      this.targetPos.copy(playerPos);
      soundEngine.playCreatureScreech(this.position, playerPos, playerYaw);
      return;
    }

    switch (this.state) {
      case 'IDLE': {
        // Decelerate to stop
        this.currentSpeed += (0 - this.currentSpeed) * Math.min(1, dt * 10);

        if (acousticHit) {
          this.setState('LISTEN');
          this.stateTimer = 1.8 + Math.random() * 1.0;
          this.targetPos.set(acousticHit.event.position.x, 0, acousticHit.event.position.z);
          return;
        }

        if (this.stateTimer <= 0) {
          this.currentLurkIndex = (this.currentLurkIndex + 1) % this.lurkPositions.length;
          const nextLurk = this.lurkPositions[this.currentLurkIndex];
          this.setPathToTarget(new THREE.Vector3(nextLurk.x, 0, nextLurk.z));
          this.setState('RETURN');
        }
        break;
      }

      case 'LISTEN': {
        this.currentSpeed += (0 - this.currentSpeed) * Math.min(1, dt * 10);

        // Turn smoothly towards sound source
        const angle = Math.atan2(this.targetPos.x - this.position.x, this.targetPos.z - this.position.z);
        let diff = angle - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotation += diff * Math.min(1.0, dt * 5.0);

        if (this.stateTimer <= 0) {
          this.setState('INVESTIGATE');
          this.setPathToTarget(this.targetPos.clone());
          this.stateTimer = 14.0;
        }
        break;
      }

      case 'INVESTIGATE': {
        // Accelerate smoothly to walk speed
        this.currentSpeed += (this.walkSpeed - this.currentSpeed) * Math.min(1, dt * 6);

        if (acousticHit && acousticHit.perceivedVolume > 4.5) {
          this.targetPos.set(acousticHit.event.position.x, 0, acousticHit.event.position.z);
          this.setPathToTarget(this.targetPos.clone());
        }

        const distToTarget = Math.hypot(this.position.x - this.targetPos.x, this.position.z - this.targetPos.z);
        if (distToTarget < 1.6 || this.stateTimer <= 0) {
          this.setState('SEARCH');
          this.stateTimer = 5.5 + Math.random() * 2.5;
          this.searchScanAngle = this.rotation;
        }
        break;
      }

      case 'SEARCH': {
        this.currentSpeed += (0 - this.currentSpeed) * Math.min(1, dt * 10);

        this.searchScanAngle += dt * 1.2;
        this.rotation = this.searchScanAngle + Math.sin(this.stateTimer * 2.5) * 0.8;

        if (acousticHit && acousticHit.perceivedVolume > 3.0) {
          this.setState('LISTEN');
          this.stateTimer = 1.4;
          this.targetPos.set(acousticHit.event.position.x, 0, acousticHit.event.position.z);
          return;
        }

        if (this.stateTimer <= 0) {
          this.currentLurkIndex = Math.floor(Math.random() * this.lurkPositions.length);
          const lurk = this.lurkPositions[this.currentLurkIndex];
          this.setPathToTarget(new THREE.Vector3(lurk.x, 0, lurk.z));
          this.setState('RETURN');
        }
        break;
      }

      case 'CHASE': {
        // Accelerate smoothly to chase speed
        this.currentSpeed += (this.chaseSpeed - this.currentSpeed) * Math.min(1, dt * 8);

        if (distToPlayer <= this.attackRange && hasSight) {
          this.setState('ATTACK');
          this.attackTimer = 0;
          this.attackDamageDealt = false;
          soundEngine.playCreatureTelegraphCue(this.position, playerPos, playerYaw);
          return;
        }

        if (hasSight) {
          this.lastKnownPlayerPos = playerPos.clone();
          this.targetPos.copy(playerPos);
          this.currentPath = [playerPos.clone()];
          this.currentPathIndex = 0;
          this.loseTargetTimer = 0;
        } else {
          this.loseTargetTimer += dt;
          if (this.lastKnownPlayerPos && this.currentPath.length === 0) {
            this.setPathToTarget(this.lastKnownPlayerPos);
          }

          const distToLastKnown = this.lastKnownPlayerPos
            ? this.position.distanceTo(this.lastKnownPlayerPos)
            : 0;

          if (distToLastKnown < 1.6 || this.loseTargetTimer > 3.8) {
            this.setState('SEARCH');
            this.stateTimer = 6.0;
            this.searchScanAngle = this.rotation;
          }
        }
        break;
      }

      case 'ATTACK': {
        this.currentSpeed += (0 - this.currentSpeed) * Math.min(1, dt * 14);
        this.attackTimer += dt;

        // Turn to face player during attack
        const targetAngle = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotation += diff * Math.min(1.0, dt * 8.0);

        if (this.attackTimer < this.attackTelegraphTime) {
          if (distToPlayer > this.attackCancelRange || !this.checkLineOfSight(playerPos, colliders)) {
            this.setState('CHASE');
            this.targetPos.copy(playerPos);
            return;
          }
        } else {
          if (!this.attackDamageDealt) {
            this.attackDamageDealt = true;

            if (distToPlayer <= 2.1 && this.checkLineOfSight(playerPos, colliders)) {
              soundEngine.playCreatureAttackSwipe(this.position, playerPos, playerYaw);
              soundEngine.playPlayerHurtSound();

              if (this.onPlayerDamaged) {
                this.onPlayerDamaged(35);
              }
            } else {
              soundEngine.playCreatureAttackSwipe(this.position, playerPos, playerYaw);
            }
          }

          if (this.attackTimer >= this.attackTotalDuration) {
            this.setState('COOLDOWN');
            this.cooldownTimer = this.attackCooldownDuration;
          }
        }
        break;
      }

      case 'COOLDOWN': {
        this.currentSpeed += (this.walkSpeed * 0.4 - this.currentSpeed) * Math.min(1, dt * 6);
        this.cooldownTimer -= dt;

        const targetAngle = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotation += diff * Math.min(1.0, dt * 3.5);

        if (this.cooldownTimer <= 0) {
          if (hasSight && distToPlayer <= 14) {
            this.setState('CHASE');
            this.targetPos.copy(playerPos);
          } else {
            this.setState('SEARCH');
            this.stateTimer = 4.5;
            this.searchScanAngle = this.rotation;
          }
        }
        break;
      }

      case 'RETURN': {
        this.currentSpeed += (this.returnSpeed - this.currentSpeed) * Math.min(1, dt * 6);

        if (acousticHit && acousticHit.perceivedVolume > 2.5) {
          this.setState('LISTEN');
          this.stateTimer = 1.6;
          this.targetPos.set(acousticHit.event.position.x, 0, acousticHit.event.position.z);
          return;
        }

        const distToLurk = Math.hypot(this.position.x - this.targetPos.x, this.position.z - this.targetPos.z);
        if (distToLurk < 1.8 || this.stateTimer <= 0) {
          this.setState('IDLE');
          this.stateTimer = 8.0 + Math.random() * 10.0;
        }
        break;
      }
    }
  }

  private setState(newState: TheHollowState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  private setPathToTarget(destination: THREE.Vector3) {
    this.targetPos.copy(destination);

    let startWp: Waypoint | null = null;
    let startDist = Infinity;
    for (const wp of this.waypoints.values()) {
      const d = Math.hypot(wp.x - this.position.x, wp.z - this.position.z);
      if (d < startDist) {
        startDist = d;
        startWp = wp;
      }
    }

    let endWp: Waypoint | null = null;
    let endDist = Infinity;
    for (const wp of this.waypoints.values()) {
      const d = Math.hypot(wp.x - destination.x, wp.z - destination.z);
      if (d < endDist) {
        endDist = d;
        endWp = wp;
      }
    }

    if (startWp && endWp && startWp.id !== endWp.id) {
      const pathIds = this.findWaypointPath(startWp.id, endWp.id);
      if (pathIds && pathIds.length > 0) {
        this.currentPath = pathIds.map((id) => {
          const wp = this.waypoints.get(id)!;
          return new THREE.Vector3(wp.x, 0, wp.z);
        });
        this.currentPath.push(destination.clone());
        this.currentPathIndex = 0;
        return;
      }
    }

    this.currentPath = [destination.clone()];
    this.currentPathIndex = 0;
  }

  private findWaypointPath(startId: string, endId: string): string[] | null {
    const queue: string[][] = [[startId]];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const currentId = currentPath[currentPath.length - 1];

      if (currentId === endId) {
        return currentPath;
      }

      const wp = this.waypoints.get(currentId);
      if (wp) {
        for (const neighborId of wp.neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push([...currentPath, neighborId]);
          }
        }
      }
    }

    return null;
  }

  private moveTowardsTarget(dt: number, colliders: PhysicsCollider[] | THREE.Box3[]) {
    if (this.currentSpeed <= 0.01) {
      this.creature.group.position.copy(this.position);
      this.creature.group.rotation.y = this.rotation;
      return;
    }

    let activeTarget = this.targetPos;
    if (this.currentPath.length > 0 && this.currentPathIndex < this.currentPath.length) {
      activeTarget = this.currentPath[this.currentPathIndex];
      const distToWp = Math.hypot(activeTarget.x - this.position.x, activeTarget.z - this.position.z);
      if (distToWp < 1.2 && this.currentPathIndex < this.currentPath.length - 1) {
        this.currentPathIndex++;
        activeTarget = this.currentPath[this.currentPathIndex];
      }
    }

    const dx = activeTarget.x - this.position.x;
    const dz = activeTarget.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.05) {
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpeed = this.state === 'CHASE' ? 8.0 : 4.5;
      this.rotation += diff * Math.min(1.0, dt * turnSpeed);

      const step = Math.min(dist, this.currentSpeed * dt);
      const nx = Math.sin(this.rotation) * step;
      const nz = Math.cos(this.rotation) * step;

      const creatureRadius = 0.40;

      // Check X movement with preallocated tests
      let blockedX = false;
      _testPos.set(this.position.x + nx, 1.2, this.position.z);
      for (let i = 0; i < colliders.length; i++) {
        const item = colliders[i];
        let box: THREE.Box3;

        if ('box' in item && 'type' in item) {
          if (!item.enabled || item.type === ColliderType.FLOOR || item.type === ColliderType.CEILING || item.type === ColliderType.TRIGGER) {
            continue;
          }
          box = item.box;
        } else {
          box = item as THREE.Box3;
        }

        if (box.isEmpty()) continue;
        if (
          _testPos.x + creatureRadius > box.min.x &&
          _testPos.x - creatureRadius < box.max.x &&
          _testPos.z + creatureRadius > box.min.z &&
          _testPos.z - creatureRadius < box.max.z
        ) {
          blockedX = true;
          break;
        }
      }
      if (!blockedX) this.position.x += nx;

      // Check Z movement with preallocated tests
      let blockedZ = false;
      _testPos.set(this.position.x, 1.2, this.position.z + nz);
      for (let i = 0; i < colliders.length; i++) {
        const item = colliders[i];
        let box: THREE.Box3;

        if ('box' in item && 'type' in item) {
          if (!item.enabled || item.type === ColliderType.FLOOR || item.type === ColliderType.CEILING || item.type === ColliderType.TRIGGER) {
            continue;
          }
          box = item.box;
        } else {
          box = item as THREE.Box3;
        }

        if (box.isEmpty()) continue;
        if (
          _testPos.x + creatureRadius > box.min.x &&
          _testPos.x - creatureRadius < box.max.x &&
          _testPos.z + creatureRadius > box.min.z &&
          _testPos.z - creatureRadius < box.max.z
        ) {
          blockedZ = true;
          break;
        }
      }
      if (!blockedZ) this.position.z += nz;
    }

    this.position.y = 0;
    this.creature.group.position.copy(this.position);
    this.creature.group.rotation.y = this.rotation;
  }

  private updateAudio(
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    distToPlayer: number
  ) {
    if (this.currentSpeed > 0.2) {
      this.footstepTimer -= dt;
      const interval = this.state === 'CHASE' ? 0.30 : 0.65;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = interval;
        soundEngine.playSpatialCreatureFootstep(
          this.position,
          playerPos,
          playerYaw,
          this.state === 'CHASE'
        );
      }
    }

    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      this.breathTimer = 4.0 + Math.random() * 4.0;
      if (distToPlayer < 25) {
        const intensity = this.state === 'CHASE' ? 1.0 : this.state === 'INVESTIGATE' ? 0.7 : 0.4;
        soundEngine.playSpatialBreathing(this.position, playerPos, playerYaw, intensity);
      }
    }

    this.ambientFxTimer -= dt;
    if (this.ambientFxTimer <= 0) {
      this.ambientFxTimer = 9.0 + Math.random() * 14.0;
      if (distToPlayer < 30) {
        const fxType = Math.random();
        if (fxType < 0.4) {
          soundEngine.playSpatialScratching(this.position, playerPos, playerYaw);
        } else if (fxType < 0.75) {
          soundEngine.playSpatialMetalImpact(this.position, playerPos, playerYaw);
        } else {
          soundEngine.playSpatialKnocking(this.position, playerPos, playerYaw);
        }
      }
    }
  }

  public checkLineOfSight(playerPos: THREE.Vector3, colliders: PhysicsCollider[] | THREE.Box3[]): boolean {
    _origin.set(this.position.x, 2.0, this.position.z);
    _target.set(playerPos.x, playerPos.y, playerPos.z);
    _dir.copy(_target).sub(_origin);
    const totalDist = _dir.length();
    if (totalDist < 0.1) return true;
    _dir.normalize();

    _ray.set(_origin, _dir);
    for (let i = 0; i < colliders.length; i++) {
      const item = colliders[i];
      let box: THREE.Box3;

      if ('box' in item && 'type' in item) {
        if (!item.enabled || item.type === ColliderType.FLOOR || item.type === ColliderType.CEILING || item.type === ColliderType.TRIGGER) {
          continue;
        }
        box = item.box;
      } else {
        box = item as THREE.Box3;
      }

      if (box.isEmpty()) continue;
      const hit = _ray.intersectBox(box, _scratchHit);
      if (hit && _origin.distanceTo(hit) < totalDist - 0.4) {
        return false;
      }
    }

    return true;
  }

  private isInVisionCone(playerPos: THREE.Vector3, fovDeg: number): boolean {
    _toPlayer2D.set(playerPos.x - this.position.x, playerPos.z - this.position.z).normalize();
    _facing2D.set(Math.sin(this.rotation), Math.cos(this.rotation));
    const dot = _toPlayer2D.dot(_facing2D);
    const threshold = Math.cos((fovDeg / 2) * (Math.PI / 180));
    return dot >= threshold;
  }

  private isIlluminatedByPlayer(playerPos: THREE.Vector3, playerYaw: number, distToPlayer: number): boolean {
    if (distToPlayer > 24) return false;

    _toCreature2D.set(this.position.x - playerPos.x, this.position.z - playerPos.z).normalize();
    _playerLook2D.set(-Math.sin(playerYaw), -Math.cos(playerYaw));

    const dot = _toCreature2D.dot(_playerLook2D);
    return dot > 0.91;
  }
}
