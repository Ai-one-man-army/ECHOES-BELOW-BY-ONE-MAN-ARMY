import { SoundEvent } from '../types';

export class SoundEventManager {
  private static instance: SoundEventManager;
  private events: SoundEvent[] = [];
  private maxAgeMs: number = 4500; // Events linger for 4.5 seconds
  private listeners: ((event: SoundEvent) => void)[] = [];

  public static getInstance(): SoundEventManager {
    if (!SoundEventManager.instance) {
      SoundEventManager.instance = new SoundEventManager();
    }
    return SoundEventManager.instance;
  }

  public emit(x: number, y: number, z: number, volume: number, source: SoundEvent['source'] = 'player') {
    const event: SoundEvent = {
      id: `snd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      position: { x, y, z },
      volume,
      timestamp: performance.now(),
      source,
    };

    this.events.push(event);

    // Keep events buffer bounded
    if (this.events.length > 50) {
      this.events.shift();
    }

    // Notify active listeners
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public addListener(cb: (event: SoundEvent) => void) {
    this.listeners.push(cb);
  }

  public removeListener(cb: (event: SoundEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  public getRecentEvents(now: number = performance.now()): SoundEvent[] {
    this.cleanup(now);
    return this.events;
  }

  public getLoudestNearbyEvent(
    listenerPos: { x: number; y: number; z: number },
    hearingThreshold: number = 1.8,
    now: number = performance.now()
  ): { event: SoundEvent; perceivedVolume: number; distance: number } | null {
    this.cleanup(now);

    let loudest: { event: SoundEvent; perceivedVolume: number; distance: number } | null = null;
    let maxPerceived = 0;

    for (const ev of this.events) {
      const dx = ev.position.x - listenerPos.x;
      const dy = ev.position.y - listenerPos.y;
      const dz = ev.position.z - listenerPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Acoustic falloff: inverse square with dampening
      const perceivedVolume = ev.volume / (1.0 + distance * 0.28 + (distance * distance) * 0.015);

      if (perceivedVolume >= hearingThreshold && perceivedVolume > maxPerceived) {
        maxPerceived = perceivedVolume;
        loudest = { event: ev, perceivedVolume, distance };
      }
    }

    return loudest;
  }

  private cleanup(now: number) {
    this.events = this.events.filter((e) => now - e.timestamp < this.maxAgeMs);
  }

  public clear() {
    this.events = [];
  }
}

export const soundEvents = SoundEventManager.getInstance();
