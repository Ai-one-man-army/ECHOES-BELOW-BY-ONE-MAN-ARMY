/**
 * Web Audio API procedural sound synthesizer for Echoes Below.
 * Zero external asset dependencies - generates realistic horror soundscapes in real-time.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.7;
  private initialized: boolean = false;
  private lastFootstepTime: number = 0;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.initAmbientDrone();
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext initialization deferred or unavailable:', e);
    }
  }

  public resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.initialized) {
      this.init();
    }
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Continuous atmospheric subterranean horror drone
   */
  private initAmbientDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    // Deep sub-bass rumble (42Hz)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(42, this.ctx.currentTime);

    // Secondary eerie dissonant layer (53.5Hz)
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(53.5, this.ctx.currentTime);

    // Low-pass filter to give heavy subterranean muffled weight
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    // Fluorescent 60Hz buzz
    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'triangle';
    this.humOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'bandpass';
    humFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
    humFilter.Q.setValueAtTime(5, this.ctx.currentTime);

    this.droneOsc1.connect(filter);
    this.droneOsc2.connect(filter);
    filter.connect(this.ambientGain);

    this.humOsc.connect(humFilter);
    humFilter.connect(this.humGain);
    this.humGain.connect(this.ambientGain);

    this.ambientGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.humOsc.start();

    // Occasional subtle spooky metallic echoes
    setInterval(() => {
      if (Math.random() < 0.35 && this.initialized && !this.isMuted) {
        this.playDistantGroan();
      }
    }, 12000);
  }

  /**
   * Footstep sound on gritty concrete floor
   */
  public playFootstep(isRunning: boolean = false, isCrouching: boolean = false) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = performance.now();
    const minInterval = isRunning ? 280 : isCrouching ? 650 : 440;
    if (now - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = now;

    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const volume = isCrouching ? 0.08 : isRunning ? 0.28 : 0.16;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    // Noise burst for shoe scrape on concrete
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter for muffled thud
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isRunning ? 220 : 180 + Math.random() * 40, t);
    filter.Q.setValueAtTime(1.8, t);

    // Subtle low thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + Math.random() * 15, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.09);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.9, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(t);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Heavy mechanical flashlight toggle click
   */
  public playFlashlightClick(turnOn: boolean) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(turnOn ? 1800 : 1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Heavy mechanical sliding metal blast door
   */
  public playDoorSound(open: boolean) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const duration = 1.4;

    // Pneumatic air hiss
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(open ? 1200 : 400, t + duration);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Low rumble scrape
    const rumble = this.ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(open ? 80 : 100, t);
    rumble.frequency.linearRampToValueAtTime(open ? 130 : 55, t + duration);

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(200, t);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.2, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    noise.start(t);
    rumble.start(t);
    rumble.stop(t + duration);

    // Final heavy metallic lock thud at end
    setTimeout(() => {
      this.playMetalClank();
    }, (duration - 0.2) * 1000);
  }

  /**
   * Heavy metallic clank / latch
   */
  public playMetalClank() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  /**
   * Electrical breaker / switch flip
   */
  public playSwitchSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.setValueAtTime(320, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Fluorescent tube spark / flicker sound
   */
  public playSparkSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 + Math.random() * 80, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Interaction blip / keycard beep / terminal access
   */
  public playInteractBeep(success: boolean = true) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(success ? 880 : 260, t);
    if (success) {
      osc.frequency.setValueAtTime(1320, t + 0.08);
    } else {
      osc.frequency.setValueAtTime(220, t + 0.08);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Subterranean metal groaning echo (spooky atmospheric cue)
   */
  public playDistantGroan() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const duration = 2.5;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.linearRampToValueAtTime(62, t + 1.2);
    osc.frequency.linearRampToValueAtTime(70, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, t);
    filter.frequency.linearRampToValueAtTime(380, t + 1.5);
    filter.Q.setValueAtTime(8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * Helper: Creates a spatial panner and distance gain node for 3D positional sound
   */
  private createSpatialNode(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number,
    baseGain: number = 1.0,
    maxDistance: number = 40
  ): { input: AudioNode; outputGain: GainNode; distance: number; pan: number } | null {
    if (!this.ctx || !this.masterGain || this.isMuted) return null;

    const dx = pos.x - listenerPos.x;
    const dy = pos.y - listenerPos.y;
    const dz = pos.z - listenerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > maxDistance) return null;

    // Angle relative to player view direction (yaw)
    const worldAngle = Math.atan2(dx, dz);
    const relAngle = worldAngle - listenerYaw;

    // Pan: -1 (left) to 1 (right)
    const pan = Math.max(-1, Math.min(1, Math.sin(relAngle)));
    // Distance attenuation
    const distGain = Math.max(0.01, 1.0 / (1.0 + distance * 0.22 + (distance * distance) * 0.01));
    const finalVolume = baseGain * distGain;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(finalVolume, this.ctx.currentTime);

    // Muffle sound slightly if behind or far away
    const isBehind = Math.cos(relAngle) < 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBehind ? 1400 : 4000, this.ctx.currentTime);

    // Stereo panning
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, this.ctx.currentTime);

      gainNode.connect(filter);
      filter.connect(panner);
      panner.connect(this.masterGain);
    } else {
      gainNode.connect(filter);
      filter.connect(this.masterGain);
    }

    return { input: gainNode, outputGain: gainNode, distance, pan };
  }

  /**
   * Distant eerie footsteps of The Hollow (unsettling clicking and heavy bone thuds)
   */
  public playSpatialCreatureFootstep(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number,
    isChase: boolean = false
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, isChase ? 0.65 : 0.35);
    if (!spatial) return;

    const t = this.ctx.currentTime;

    // 1. Spindly claw click on concrete
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'sawtooth';
    clickOsc.frequency.setValueAtTime(isChase ? 820 : 540, t);
    clickOsc.frequency.exponentialRampToValueAtTime(120, t + 0.06);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.4, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    clickOsc.connect(clickGain);
    clickGain.connect(spatial.input);
    clickOsc.start(t);
    clickOsc.stop(t + 0.07);

    // 2. Heavy hollow bone impact
    const thudOsc = this.ctx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(isChase ? 95 : 68, t);
    thudOsc.frequency.exponentialRampToValueAtTime(25, t + 0.12);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(0.6, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    thudOsc.connect(thudGain);
    thudGain.connect(spatial.input);
    thudOsc.start(t);
    thudOsc.stop(t + 0.13);
  }

  /**
   * Wet subterranean breathing / rasping from The Hollow
   */
  public playSpatialBreathing(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number,
    intensity: number = 0.5
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, intensity * 0.45);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const duration = 1.8;

    // Breath noise
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const envelope = Math.sin(progress * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.8;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.linearRampToValueAtTime(480, t + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(240, t + duration);
    filter.Q.setValueAtTime(4.5, t);

    noise.connect(filter);
    filter.connect(spatial.input);
    noise.start(t);
    noise.stop(t + duration);
  }

  /**
   * Long nails/fingers scratching along concrete or metal pipes
   */
  public playSpatialScratching(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, 0.4);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const duration = 1.2;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.linearRampToValueAtTime(2200, t + 0.3);
    osc.frequency.linearRampToValueAtTime(1100, t + 0.8);
    osc.frequency.linearRampToValueAtTime(1800, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.Q.setValueAtTime(12, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.15);
    gain.gain.linearRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(spatial.input);

    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * Heavy distant metal impact / pipe rattle
   */
  public playSpatialMetalImpact(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, 0.6);
    if (!spatial) return;

    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, t);
    filter.Q.setValueAtTime(6, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(spatial.input);

    osc.start(t);
    osc.stop(t + 0.52);
  }

  /**
   * Occasional knocking on metal blast doors or wall panels
   */
  public playSpatialKnocking(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, 0.5);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const knocks = [0, 0.22, 0.45];

    knocks.forEach((offset) => {
      const kt = t + offset;
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + Math.random() * 20, kt);
      osc.frequency.exponentialRampToValueAtTime(35, kt + 0.08);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.5, kt);
      gain.gain.exponentialRampToValueAtTime(0.001, kt + 0.09);

      osc.connect(gain);
      gain.connect(spatial.input);
      osc.start(kt);
      osc.stop(kt + 0.1);
    });
  }

  /**
   * Distorted vocal screech / screeching hiss when The Hollow spots the player or enters chase
   */
  public playCreatureScreech(
    pos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(pos, listenerPos, listenerYaw, 0.9);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const duration = 1.4;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(350, t);
    osc1.frequency.linearRampToValueAtTime(780, t + 0.2);
    osc1.frequency.exponentialRampToValueAtTime(180, t + duration);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(520, t);
    osc2.frequency.linearRampToValueAtTime(940, t + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(210, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(spatial.input);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  /**
   * Terrifying attack telegraph warning (hollow inhale / low screech before strike)
   */
  public playCreatureTelegraphCue(
    sourcePos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(sourcePos, listenerPos, listenerYaw, 0.75);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const duration = 0.65;

    // Guttural screech/inhale
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(180, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.75, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(spatial.input);

    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * Vicious claw swipe through air
   */
  public playCreatureAttackSwipe(
    sourcePos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    listenerYaw: number
  ) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const spatial = this.createSpatialNode(sourcePos, listenerPos, listenerYaw, 0.85);
    if (!spatial) return;

    const t = this.ctx.currentTime;
    const duration = 0.35;

    // Fast white noise swoosh
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + duration);
    filter.Q.setValueAtTime(2.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(spatial.input);

    noise.start(t);
    noise.stop(t + duration);
  }

  /**
   * Impactful player hurt audio cue with heavy heartbeat & trauma gasp
   */
  public playPlayerHurtSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Heavy blunt trauma impact
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(35, t + 0.45);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    // Heartbeat thump
    const hb = this.ctx.createOscillator();
    hb.type = 'triangle';
    hb.frequency.setValueAtTime(75, t + 0.15);
    hb.frequency.exponentialRampToValueAtTime(30, t + 0.55);

    const hbGain = this.ctx.createGain();
    hbGain.gain.setValueAtTime(0.0, t);
    hbGain.gain.setValueAtTime(0.7, t + 0.15);
    hbGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    sub.connect(subGain);
    subGain.connect(this.masterGain);

    hb.connect(hbGain);
    hbGain.connect(this.masterGain);

    sub.start(t);
    sub.stop(t + 0.52);
    hb.start(t + 0.15);
    hb.stop(t + 0.62);
  }

  /**
   * Terrifying jumpscare sting when caught / fatal attack
   */
  public playGameOverJumpscare() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Sub bass drop
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(20, t + 1.2);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    // Harsh metal scrape
    const harsh = this.ctx.createOscillator();
    harsh.type = 'sawtooth';
    harsh.frequency.setValueAtTime(880, t);
    harsh.frequency.exponentialRampToValueAtTime(120, t + 0.6);

    const harshGain = this.ctx.createGain();
    harshGain.gain.setValueAtTime(0.8, t);
    harshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    harsh.connect(harshGain);
    harshGain.connect(this.masterGain);

    sub.start(t);
    harsh.start(t);
    sub.stop(t + 1.3);
    harsh.stop(t + 0.8);
  }
}

export const soundEngine = new SoundEngine();

