import * as THREE from 'three';
import { GameSettings, GameStatus, GraphicsQuality, InteractableObject, Objective, PlayerStats, TheHollowState } from '../types';
import { WorldBuilder } from './WorldBuilder';
import { PlayerController } from './PlayerController';
import { TheHollowAI } from './TheHollowAI';
import { soundEvents } from './SoundEventManager';
import { soundEngine } from '../audio/SoundEngine';

export class GameEngine {
  public container: HTMLElement;
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public worldBuilder!: WorldBuilder;
  public playerController!: PlayerController;
  public theHollow!: TheHollowAI;

  public settings: GameSettings;
  public status: GameStatus = 'INTRO';
  public objective: Objective = {
    id: 'find_sector9',
    title: 'SECTOR 9 ACCESS',
    description: 'Find a way into Sector 9.',
    completed: false,
  };

  public playerStats: PlayerStats = {
    position: { x: 0, y: 1.7, z: 14 },
    isRunning: false,
    isCrouching: false,
    stamina: 100,
    health: 100,
    maxHealth: 100,
    isHurt: false,
    flashlightOn: true,
    flashlightBattery: 100,
    hasSector9Keycard: false,
    hasPowerRestored: false,
    hasSector9Bypassed: false,
    currentNoise: 0,
    hollowProximity: 0,
    hollowState: 'IDLE',
  };

  private hurtTimer: number = 0;
  private isRunningLoop: boolean = false;
  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private sector9EndingTriggered: boolean = false;

  // React state sync callbacks
  public onStatusChange?: (status: GameStatus) => void;
  public onObjectiveChange?: (obj: Objective) => void;
  public onNotification?: (msg: string, type?: 'info' | 'warn' | 'success') => void;
  public onStatsUpdate?: (stats: PlayerStats) => void;
  public onHoverInteractable?: (item: InteractableObject | null) => void;

  constructor(container: HTMLElement, initialSettings: GameSettings) {
    this.container = container;
    this.settings = initialSettings;

    this.initThree();
    this.initWorld();
    this.initPlayer();
    this.initCreature();
    this.applyGraphicsSettings(this.settings.graphics);
    this.setupResizeHandler();
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060a);

    // Underground atmospheric exponential fog (optimized for 5-10m readability)
    this.scene.fog = new THREE.FogExp2(0x05080e, 0.055);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(this.settings.fov || 75, width / height, 0.1, 80);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.settings.graphics === 'HIGH',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15; // 20-30% brighter exposure
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    // Ambient/fill lighting (raised by 25% to prevent pitch-black voids while retaining horror shadows)
    const ambientLight = new THREE.AmbientLight(0x242d38, 0.28);
    this.scene.add(ambientLight);
  }

  private initWorld() {
    this.worldBuilder = new WorldBuilder(this.scene);
    this.worldBuilder.buildFacility();
  }

  private initCreature() {
    this.theHollow = new TheHollowAI(this.scene);

    // Hollow attack damage handler (35 damage per hit)
    this.theHollow.onPlayerDamaged = (damage: number) => {
      if (this.status !== 'PLAYING') return;

      const currentHp = this.playerStats.health ?? 100;
      const newHp = Math.max(0, currentHp - damage);
      this.playerStats.health = newHp;
      this.playerStats.isHurt = true;
      this.hurtTimer = 0.6; // Red screen vignette flash duration

      if (this.onNotification) {
        this.onNotification(`DAMAGE TAKEN: -${damage} HP [HEALTH: ${newHp}%]`, 'warn');
      }

      if (newHp <= 0) {
        soundEngine.playGameOverJumpscare();
        this.status = 'GAME_OVER';
        this.playerController.exitPointerLock();
        if (this.onStatusChange) {
          this.onStatusChange('GAME_OVER');
        }
      }
    };

    this.theHollow.onPlayerCaught = () => {
      if (this.status === 'PLAYING') {
        this.playerStats.health = 0;
        soundEngine.playGameOverJumpscare();
        this.status = 'GAME_OVER';
        this.playerController.exitPointerLock();
        if (this.onStatusChange) {
          this.onStatusChange('GAME_OVER');
        }
      }
    };
  }

  private initPlayer() {
    this.playerController = new PlayerController(this.camera, this.renderer.domElement, this.settings);

    this.playerController.onInteractCallback = (item) => {
      this.handleInteract(item);
    };

    this.playerController.onPauseCallback = () => {
      if (this.status === 'PLAYING') {
        this.pauseGame();
      }
    };

    this.playerController.onToggleDebugPhysics = () => {
      this.toggleDebugPhysics();
    };
  }

  public toggleDebugPhysics(): boolean {
    const isEnabled = this.worldBuilder.toggleDebugColliders();
    if (this.onNotification) {
      this.onNotification(
        `COLLISION DEBUG (F3): ${isEnabled ? 'ACTIVE' : 'OFF'} (${this.worldBuilder.getBlockingColliders().length} active colliders)`,
        isEnabled ? 'info' : 'warn'
      );
    }
    return isEnabled;
  }

  private setupResizeHandler() {
    const handleResize = () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    this.resizeObserver = new ResizeObserver(() => handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', handleResize);
  }

  public applyGraphicsSettings(quality: GraphicsQuality) {
    this.settings.graphics = quality;
    if (!this.renderer) return;

    if (quality === 'LOW') {
      this.renderer.setPixelRatio(0.85);
      this.renderer.shadowMap.enabled = false;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.07;
      }
      if (this.playerController?.flashlight) {
        this.playerController.flashlight.castShadow = false;
      }
    } else if (quality === 'MEDIUM') {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.055;
      }
      if (this.playerController?.flashlight) {
        this.playerController.flashlight.castShadow = true;
      }
    } else {
      // HIGH
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.05;
      }
      if (this.playerController?.flashlight) {
        this.playerController.flashlight.castShadow = true;
      }
    }
  }

  public startGame() {
    this.status = 'PLAYING';
    soundEngine.init();
    soundEngine.resumeContext();
    this.playerController.requestPointerLock();
    this.startLoop();
    if (this.onStatusChange) this.onStatusChange('PLAYING');
  }

  public pauseGame() {
    this.status = 'PAUSED';
    this.playerController.exitPointerLock();
    if (this.onStatusChange) this.onStatusChange('PAUSED');
  }

  public resumeGame() {
    this.status = 'PLAYING';
    soundEngine.resumeContext();
    this.playerController.requestPointerLock();
    if (this.onStatusChange) this.onStatusChange('PLAYING');
  }

  public restartGame() {
    // Reset player position and health
    this.playerController.position.set(0, 1.75, 18);
    this.playerController.velocity.set(0, 0, 0);
    this.playerController.yaw = 0;
    this.playerController.pitch = 0;
    this.playerController.stamina = 100;
    this.sector9EndingTriggered = false;
    this.hurtTimer = 0;

    this.playerStats = {
      position: { x: 0, y: 1.75, z: 18 },
      isRunning: false,
      isCrouching: false,
      stamina: 100,
      health: 100,
      maxHealth: 100,
      isHurt: false,
      flashlightOn: true,
      flashlightBattery: 100,
      hasSector9Keycard: false,
      hasPowerRestored: false,
      hasSector9Bypassed: false,
      currentNoise: 0,
      hollowProximity: 0,
      hollowState: 'IDLE',
    };
    this.objective = {
      id: 'find_sector9',
      title: 'SECTOR 9 ACCESS',
      description: 'Find a way into Sector 9.',
      completed: false,
    };
    soundEvents.clear();
    if (this.theHollow) {
      this.theHollow.reset(0);
    }
    if (this.onObjectiveChange) this.onObjectiveChange(this.objective);
    this.resumeGame();
  }

  public respawnAtCheckpoint() {
    // Determine safest checkpoint based on player progression
    let safeX = 0;
    let safeZ = 18; // Checkpoint Lobby

    if (this.playerStats.hasPowerRestored && this.playerStats.hasSector9Keycard) {
      safeX = 0;
      safeZ = -2; // Main corridor North near Control Hub
    } else if (this.playerStats.hasPowerRestored) {
      safeX = 0;
      safeZ = 5; // Main corridor Mid
    } else if (this.playerStats.hasSector9Keycard) {
      safeX = 0;
      safeZ = 5; // Main corridor Mid
    }

    this.playerController.position.set(safeX, 1.75, safeZ);
    this.playerController.velocity.set(0, 0, 0);
    this.playerController.yaw = 0;
    this.playerController.pitch = 0;
    this.playerController.stamina = 100;
    this.playerStats.health = 100;
    this.playerStats.isHurt = false;
    this.hurtTimer = 0;

    // Reset The Hollow to deep chamber
    soundEvents.clear();
    if (this.theHollow) {
      this.theHollow.reset(0);
    }

    this.status = 'PLAYING';
    soundEngine.resumeContext();
    this.playerController.requestPointerLock();
    if (this.onStatusChange) this.onStatusChange('PLAYING');
    if (this.onNotification) {
      this.onNotification('CHECKPOINT RESTORED: Health replenished. Crouch to stay silent.', 'info');
    }
  }

  public handleInteract(item: InteractableObject) {
    soundEngine.resumeContext();

    // 1. Sector 9 Blast Gate
    if (item.id === 'door_sector9') {
      const door = this.worldBuilder.doors.get('door_sector9');
      if (!door) return;

      if (!this.playerStats.hasPowerRestored) {
        soundEngine.playInteractBeep(false);
        if (this.onNotification) {
          this.onNotification('ACCESS DENIED: Auxiliary Power Offline. Check Sub-Station.', 'warn');
        }
        return;
      }

      if (!this.playerStats.hasSector9Keycard) {
        soundEngine.playInteractBeep(false);
        if (this.onNotification) {
          this.onNotification('KEYCARD REQUIRED: Level 4 Clearance Needed (Found in Bio-Lab).', 'warn');
        }
        return;
      }

      // Unlock and Open Sector 9 Gate!
      if (!door.isOpen) {
        door.isOpen = true;
        door.isAnimating = true;
        item.isOpen = true;
        soundEngine.playDoorSound(true);
        soundEngine.playInteractBeep(true);
        // Loud blast door sound event
        soundEvents.emit(0, 1.5, -18, 50, 'door');

        this.objective = {
          id: 'sector9_breached',
          title: 'SECTOR 9 UNLOCKED',
          description: 'Sector 9 blast gate opened. Proceed with extreme caution.',
          completed: true,
        };
        if (this.onObjectiveChange) this.onObjectiveChange(this.objective);
        if (this.onNotification) {
          this.onNotification('SECTOR 9 BLAST GATE OPENED. DO NOT ANSWER THE SOUND.', 'success');
        }
      }
      return;
    }

    // 2. Sub-Station Breaker Switch
    if (item.id === 'power_switch') {
      if (!this.playerStats.hasPowerRestored) {
        this.playerStats.hasPowerRestored = true;
        item.isActivated = true;
        item.prompt = 'AUXILIARY POWER ENGAGED';
        soundEngine.playSwitchSound();
        soundEngine.playSparkSound();

        // Breaker flip generates loud sound event (50)
        soundEvents.emit(18, 1.5, -10, 50, 'switch');

        // Animate switch lever
        const mesh = this.worldBuilder.interactableMeshes.get('power_switch');
        if (mesh) {
          mesh.children.forEach((c) => {
            if (c instanceof THREE.Mesh && c.geometry instanceof THREE.BoxGeometry && c.position.z > 0.1) {
              c.rotation.x = Math.PI / 4; // Up = On
            }
          });
        }

        if (this.onNotification) {
          this.onNotification('SUB-STATION AUXILIARY POWER RESTORED', 'success');
        }

        // Update Objective
        if (!this.playerStats.hasSector9Keycard) {
          this.objective = {
            id: 'find_keycard',
            title: 'SECURITY CLEARANCE',
            description: 'Find the Level 4 Keycard in Biological Research Wing.',
            completed: false,
          };
        } else {
          this.objective = {
            id: 'return_to_sector9',
            title: 'SECTOR 9 ACCESS',
            description: 'Return to Sector 9 Blast Gate and initiate override.',
            completed: false,
          };
        }
        if (this.onObjectiveChange) this.onObjectiveChange(this.objective);
      }
      return;
    }

    // 3. Level 4 Keycard Pickup
    if (item.id === 'keycard_sector9') {
      if (!this.playerStats.hasSector9Keycard) {
        this.playerStats.hasSector9Keycard = true;
        soundEngine.playInteractBeep(true);
        soundEvents.emit(-18, 1.0, -10, 15, 'prop');

        // Hide 3D mesh
        const mesh = this.worldBuilder.interactableMeshes.get('keycard_sector9');
        if (mesh) mesh.visible = false;
        this.worldBuilder.interactables.delete('keycard_sector9');

        if (this.onNotification) {
          this.onNotification('OBTAINED: Sector 9 Clearance Keycard (Level 4)', 'success');
        }

        if (this.playerStats.hasPowerRestored) {
          this.objective = {
            id: 'open_sector9',
            title: 'SECTOR 9 ACCESS',
            description: 'Return to Sector 9 Blast Gate and swipe keycard.',
            completed: false,
          };
        } else {
          this.objective = {
            id: 'restore_power',
            title: 'RESTORE POWER',
            description: 'Restore electrical power in Sub-Station Breaker Room.',
            completed: false,
          };
        }
        if (this.onObjectiveChange) this.onObjectiveChange(this.objective);
      }
      return;
    }

    // 4. Lab / Office Sliding Doors
    if (item.type === 'door') {
      const door = this.worldBuilder.doors.get(item.id);
      if (door) {
        door.isOpen = !door.isOpen;
        door.isAnimating = true;
        item.isOpen = door.isOpen;
        soundEngine.playDoorSound(door.isOpen);
        // Opening door generates noise (20)
        soundEvents.emit(item.position[0], item.position[1], item.position[2], 20, 'door');
      }
      return;
    }

    // 5. Security CRT Terminal
    if (item.id === 'terminal_security') {
      soundEngine.playInteractBeep(true);
      soundEvents.emit(-12, 1.2, 10, 15, 'prop');
      if (this.onNotification) {
        this.onNotification('LOG: Anomaly 03:16 AM detected in bedrock. Auxiliary power required.', 'info');
      }
    }
  }

  private startLoop() {
    if (this.isRunningLoop) return;
    this.isRunningLoop = true;
    this.lastTime = performance.now();
    this.animate();
  }

  private animate = () => {
    if (!this.isRunningLoop) return;

    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;

    if (this.status === 'PLAYING') {
      // 1. Update Player Controls & Collision
      this.playerController.update(delta, this.worldBuilder.colliders, this.worldBuilder.interactables);

      // 2. Update Hurt Screen Vignette decay
      if (this.hurtTimer > 0) {
        this.hurtTimer -= delta;
        if (this.hurtTimer <= 0) {
          this.playerStats.isHurt = false;
        }
      }

      // 3. Update The Hollow AI
      if (this.theHollow) {
        this.theHollow.update(
          delta,
          this.playerController.position,
          this.playerController.yaw,
          this.playerController.flashlightOn,
          this.playerController.isCrouching,
          this.worldBuilder.colliders
        );
      }

      // 4. Update Fluorescent Flickers
      this.worldBuilder.updateLights(delta);

      // 5. Update Door Animations
      this.worldBuilder.updateDoors(delta);

      // 6. Check Sector 9 Anomaly Chamber Discovery Ending (Z <= -22)
      if (
        !this.sector9EndingTriggered &&
        this.playerStats.hasPowerRestored &&
        this.playerStats.hasSector9Keycard &&
        this.playerController.position.z <= -22
      ) {
        this.sector9EndingTriggered = true;
        this.status = 'SECTOR_9_ENDING';
        this.playerController.exitPointerLock();
        if (this.onStatusChange) {
          this.onStatusChange('SECTOR_9_ENDING');
        }
      }

      // 7. Sync State to UI
      if (this.onHoverInteractable) {
        this.onHoverInteractable(this.playerController.hoveredInteractable);
      }

      if (this.onStatsUpdate && this.theHollow) {
        const dist = this.playerController.position.distanceTo(this.theHollow.position);
        // Proximity 0 to 1 (1 when <= 2m, 0 when >= 24m)
        const prox = Math.max(0, Math.min(1, 1 - (dist - 2) / 22));

        this.playerStats.position = {
          x: this.playerController.position.x,
          y: this.playerController.position.y,
          z: this.playerController.position.z,
        };
        this.playerStats.isRunning = this.playerController.isRunning;
        this.playerStats.isCrouching = this.playerController.isCrouching;
        this.playerStats.stamina = this.playerController.stamina;
        this.playerStats.flashlightOn = this.playerController.flashlightOn;
        this.playerStats.currentNoise = this.playerController.currentNoise;
        this.playerStats.hollowProximity = prox;
        this.playerStats.hollowState = this.theHollow.state;

        this.onStatsUpdate({ ...this.playerStats });
      }
    }

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  };

  public dispose() {
    this.isRunningLoop = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.playerController) {
      this.playerController.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}
