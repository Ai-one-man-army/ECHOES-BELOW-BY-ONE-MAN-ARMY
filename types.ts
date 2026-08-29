export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export type GameStatus = 'TITLE' | 'INTRO' | 'PLAYING' | 'PAUSED' | 'SECTOR9_OPENED' | 'SECTOR_9_ENDING' | 'GAME_OVER';

export type TheHollowState =
  | 'IDLE'
  | 'LISTEN'
  | 'INVESTIGATE'
  | 'SEARCH'
  | 'CHASE'
  | 'ATTACK'
  | 'COOLDOWN'
  | 'RETURN';

export interface SoundEvent {
  id: string;
  position: { x: number; y: number; z: number };
  volume: number; // 2 (crouch), 10 (walk), 20 (door), 40 (run), 50 (drop/loud)
  timestamp: number;
  source: 'player' | 'door' | 'switch' | 'prop' | 'ambient';
}

export interface GameSettings {
  graphics: GraphicsQuality;
  volume: number;
  mouseSensitivity: number;
  touchSensitivity: number;
  cameraSmoothing: number; // 0 (crisp raw input) to 1 (cinematic smooth)
  invertY: boolean;
  fov: number;
}

export type InteractableType = 'door' | 'power_switch' | 'terminal' | 'keycard' | 'document' | 'valve';

export interface InteractableObject {
  id: string;
  name: string;
  type: InteractableType;
  prompt: string;
  subText?: string;
  position: [number, number, number];
  requiresItem?: string;
  isLocked?: boolean;
  isOpen?: boolean;
  isActivated?: boolean;
  distanceThreshold?: number;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface PlayerStats {
  position: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  isHurt: boolean;
  isRunning: boolean;
  isCrouching: boolean;
  stamina: number;
  flashlightOn: boolean;
  flashlightBattery: number;
  hasSector9Keycard: boolean;
  hasPowerRestored: boolean;
  hasSector9Bypassed: boolean;
  currentNoise: number;
  hollowProximity: number; // 0 to 1 distance factor for tension/vignette
  hollowState: TheHollowState;
}

export interface LightFlickerConfig {
  baseIntensity: number;
  color: number;
  flickerRate: number; // 0 to 1
  flickerType: 'erratic' | 'steady_hum' | 'dying' | 'pulse';
}


