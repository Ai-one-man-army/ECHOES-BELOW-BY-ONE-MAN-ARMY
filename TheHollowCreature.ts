import * as THREE from 'three';
import { TextureGenerator } from './ProceduralTextures';

export interface CreatureLimbs {
  root: THREE.Group;
  torso: THREE.Group;
  spine: THREE.Mesh[];
  ribs: THREE.Mesh[];
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Mesh;
  leftEyeHollow: THREE.Mesh;
  rightEyeHollow: THREE.Mesh;
  
  // Left Arm
  leftShoulder: THREE.Group;
  leftUpperArm: THREE.Mesh;
  leftElbow: THREE.Group;
  leftForearm: THREE.Mesh;
  leftHand: THREE.Group;
  leftFingers: THREE.Mesh[];

  // Right Arm
  rightShoulder: THREE.Group;
  rightUpperArm: THREE.Mesh;
  rightElbow: THREE.Group;
  rightForearm: THREE.Mesh;
  rightHand: THREE.Group;
  rightFingers: THREE.Mesh[];

  // Left Leg
  leftHip: THREE.Group;
  leftThigh: THREE.Mesh;
  leftKnee: THREE.Group;
  leftShin: THREE.Mesh;
  leftFoot: THREE.Mesh;

  // Right Leg
  rightHip: THREE.Group;
  rightThigh: THREE.Mesh;
  rightKnee: THREE.Group;
  rightShin: THREE.Mesh;
  rightFoot: THREE.Mesh;
}

export class TheHollowCreature {
  public group: THREE.Group;
  public limbs!: CreatureLimbs;
  private skinMaterial!: THREE.MeshStandardMaterial;
  private voidMaterial!: THREE.MeshBasicMaterial;

  // Animation state variables
  private walkTime: number = 0;
  private twitchTimer: number = 0;
  private twitchTargetHead = new THREE.Euler();
  private currentHeadRot = new THREE.Euler();
  private breathPhase: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.initMaterials();
    this.buildProceduralCreature();
  }

  private initMaterials() {
    // Ashen, pale, slightly mottled horror skin texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Pale greyish-bone base
    ctx.fillStyle = '#dcdad7';
    ctx.fillRect(0, 0, 512, 512);

    // Darker vein and mottled subcutaneous undertones
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 14;
      const alpha = 0.04 + Math.random() * 0.12;
      ctx.fillStyle = `rgba(38, 42, 48, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle dark streaks along skin
    ctx.strokeStyle = 'rgba(25, 28, 32, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, 0);
      ctx.bezierCurveTo(
        Math.random() * 512, 170,
        Math.random() * 512, 340,
        Math.random() * 512, 512
      );
      ctx.stroke();
    }

    const skinTexture = new THREE.CanvasTexture(canvas);
    skinTexture.wrapS = THREE.RepeatWrapping;
    skinTexture.wrapT = THREE.RepeatWrapping;

    this.skinMaterial = new THREE.MeshStandardMaterial({
      map: skinTexture,
      color: 0xcccccc,
      roughness: 0.72,
      metalness: 0.18,
    });

    // Pitch black light-absorbing void for eye cavities
    this.voidMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
    });
  }

  private buildProceduralCreature() {
    const root = new THREE.Group();
    this.group.add(root);

    // Height offset: creature stands ~2.95m tall
    root.position.set(0, 0, 0);

    // 1. PELVIS / HIPS (at Y = 1.45m)
    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.22),
      this.skinMaterial
    );
    pelvis.position.set(0, 1.45, 0);
    pelvis.castShadow = true;
    root.add(pelvis);

    // 2. ELONGATED CROOKED TORSO & VERTEBRAE
    const torso = new THREE.Group();
    torso.position.set(0, 1.55, 0);
    root.add(torso);

    const spineMeshes: THREE.Mesh[] = [];
    const ribMeshes: THREE.Mesh[] = [];

    // Vertebrae chain curving slightly forward
    for (let i = 0; i < 5; i++) {
      const vY = i * 0.16;
      const vZ = Math.sin(i * 0.4) * 0.06;
      const vert = new THREE.Mesh(
        new THREE.BoxGeometry(0.14 - i * 0.01, 0.12, 0.16),
        this.skinMaterial
      );
      vert.position.set(0, vY, vZ);
      vert.castShadow = true;
      torso.add(vert);
      spineMeshes.push(vert);

      // Emaciated visible ribcage loops
      if (i >= 1 && i <= 4) {
        const ribWidth = 0.38 - (4 - i) * 0.03;
        const rib = new THREE.Mesh(
          new THREE.CylinderGeometry(ribWidth / 2, ribWidth / 2, 0.04, 8),
          this.skinMaterial
        );
        rib.rotation.x = Math.PI / 2;
        rib.position.set(0, vY, vZ + 0.05);
        rib.scale.set(1.0, 0.65, 1.0);
        rib.castShadow = true;
        torso.add(rib);
        ribMeshes.push(rib);
      }
    }

    // Upper Chest & Collarbones (at Y = 0.75 in torso space => ~2.3m world)
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.24),
      this.skinMaterial
    );
    chest.position.set(0, 0.75, 0.04);
    chest.castShadow = true;
    torso.add(chest);

    // 3. ELONGATED NECK & CRANIUM
    const neck = new THREE.Group();
    neck.position.set(0, 0.88, 0.06);
    torso.add(neck);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.32, 8),
      this.skinMaterial
    );
    neckMesh.position.set(0, 0.16, -0.02);
    neckMesh.rotation.x = 0.2; // Tilted slightly forward
    neckMesh.castShadow = true;
    neck.add(neckMesh);

    // Head Group (Cranium & Sockets)
    const head = new THREE.Group();
    head.position.set(0, 0.36, 0.04);
    neck.add(head);

    // Elongated, narrow distorted skull
    const skullGeom = new THREE.CylinderGeometry(0.12, 0.09, 0.34, 10);
    const skull = new THREE.Mesh(skullGeom, this.skinMaterial);
    skull.position.set(0, 0.1, 0);
    skull.scale.set(1.0, 1.0, 1.35); // Flattened and elongated front-to-back
    skull.castShadow = true;
    head.add(skull);

    // Brow ridge
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.12),
      this.skinMaterial
    );
    brow.position.set(0, 0.14, 0.14);
    head.add(brow);

    // Deep hollow pitch-black eye cavities (No normal eyes)
    const eyeCavityGeom = new THREE.SphereGeometry(0.042, 8, 8);
    const leftEyeHollow = new THREE.Mesh(eyeCavityGeom, this.voidMaterial);
    leftEyeHollow.position.set(-0.065, 0.1, 0.13);
    leftEyeHollow.scale.set(0.8, 1.3, 0.5);
    head.add(leftEyeHollow);

    const rightEyeHollow = new THREE.Mesh(eyeCavityGeom, this.voidMaterial);
    rightEyeHollow.position.set(0.065, 0.1, 0.13);
    rightEyeHollow.scale.set(0.8, 1.3, 0.5);
    head.add(rightEyeHollow);

    // Gaunt hollow jaw
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.14),
      this.skinMaterial
    );
    jaw.position.set(0, -0.04, 0.06);
    head.add(jaw);

    // 4. UNNATURALLY LONG ARMS & SPINDLY FINGERS
    // Left Arm
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.25, 0.78, 0.02);
    torso.add(leftShoulder);

    const upperArmGeom = new THREE.CylinderGeometry(0.045, 0.038, 0.58, 8);
    const leftUpperArm = new THREE.Mesh(upperArmGeom, this.skinMaterial);
    leftUpperArm.position.set(0, -0.29, 0);
    leftUpperArm.castShadow = true;
    leftShoulder.add(leftUpperArm);

    const leftElbow = new THREE.Group();
    leftElbow.position.set(0, -0.58, 0);
    leftShoulder.add(leftElbow);

    const forearmGeom = new THREE.CylinderGeometry(0.036, 0.028, 0.62, 8);
    const leftForearm = new THREE.Mesh(forearmGeom, this.skinMaterial);
    leftForearm.position.set(0, -0.31, 0);
    leftForearm.castShadow = true;
    leftElbow.add(leftForearm);

    const leftHand = new THREE.Group();
    leftHand.position.set(0, -0.62, 0);
    leftElbow.add(leftHand);

    // 4 Spindly needle-like fingers on Left Hand
    const leftFingers: THREE.Mesh[] = [];
    const fingerGeom = new THREE.CylinderGeometry(0.008, 0.004, 0.32, 6);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(fingerGeom, this.skinMaterial);
      const fx = (f - 1.5) * 0.032;
      finger.position.set(fx, -0.16, (f % 2 === 0 ? 0.01 : -0.01));
      finger.rotation.z = (f - 1.5) * 0.08;
      finger.castShadow = true;
      leftHand.add(finger);
      leftFingers.push(finger);
    }

    // Right Arm
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.25, 0.78, 0.02);
    torso.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(upperArmGeom, this.skinMaterial);
    rightUpperArm.position.set(0, -0.29, 0);
    rightUpperArm.castShadow = true;
    rightShoulder.add(rightUpperArm);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(0, -0.58, 0);
    rightShoulder.add(rightElbow);

    const rightForearm = new THREE.Mesh(forearmGeom, this.skinMaterial);
    rightForearm.position.set(0, -0.31, 0);
    rightForearm.castShadow = true;
    rightElbow.add(rightForearm);

    const rightHand = new THREE.Group();
    rightHand.position.set(0, -0.62, 0);
    rightElbow.add(rightHand);

    const rightFingers: THREE.Mesh[] = [];
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(fingerGeom, this.skinMaterial);
      const fx = (f - 1.5) * 0.032;
      finger.position.set(fx, -0.16, (f % 2 === 0 ? 0.01 : -0.01));
      finger.rotation.z = (f - 1.5) * 0.08;
      finger.castShadow = true;
      rightHand.add(finger);
      rightFingers.push(finger);
    }

    // 5. DISTORTED TALL LEGS
    const thighGeom = new THREE.CylinderGeometry(0.065, 0.048, 0.74, 8);
    const shinGeom = new THREE.CylinderGeometry(0.045, 0.032, 0.76, 8);
    const footGeom = new THREE.BoxGeometry(0.1, 0.06, 0.28);

    // Left Leg
    const leftHip = new THREE.Group();
    leftHip.position.set(-0.14, 1.45, 0);
    root.add(leftHip);

    const leftThigh = new THREE.Mesh(thighGeom, this.skinMaterial);
    leftThigh.position.set(0, -0.37, 0);
    leftThigh.castShadow = true;
    leftHip.add(leftThigh);

    const leftKnee = new THREE.Group();
    leftKnee.position.set(0, -0.74, 0);
    leftHip.add(leftKnee);

    const leftShin = new THREE.Mesh(shinGeom, this.skinMaterial);
    leftShin.position.set(0, -0.38, 0.02);
    leftShin.castShadow = true;
    leftKnee.add(leftShin);

    const leftFoot = new THREE.Mesh(footGeom, this.skinMaterial);
    leftFoot.position.set(0, -0.76, 0.08);
    leftFoot.castShadow = true;
    leftKnee.add(leftFoot);

    // Right Leg
    const rightHip = new THREE.Group();
    rightHip.position.set(0.14, 1.45, 0);
    root.add(rightHip);

    const rightThigh = new THREE.Mesh(thighGeom, this.skinMaterial);
    rightThigh.position.set(0, -0.37, 0);
    rightThigh.castShadow = true;
    rightHip.add(rightThigh);

    const rightKnee = new THREE.Group();
    rightKnee.position.set(0, -0.74, 0);
    rightHip.add(rightKnee);

    const rightShin = new THREE.Mesh(shinGeom, this.skinMaterial);
    rightShin.position.set(0, -0.38, 0.02);
    rightShin.castShadow = true;
    rightKnee.add(rightShin);

    const rightFoot = new THREE.Mesh(footGeom, this.skinMaterial);
    rightFoot.position.set(0, -0.76, 0.08);
    rightFoot.castShadow = true;
    rightKnee.add(rightFoot);

    this.limbs = {
      root,
      torso,
      spine: spineMeshes,
      ribs: ribMeshes,
      neck,
      head,
      jaw,
      leftEyeHollow,
      rightEyeHollow,
      leftShoulder,
      leftUpperArm,
      leftElbow,
      leftForearm,
      leftHand,
      leftFingers,
      rightShoulder,
      rightUpperArm,
      rightElbow,
      rightForearm,
      rightHand,
      rightFingers,
      leftHip,
      leftThigh,
      leftKnee,
      leftShin,
      leftFoot,
      rightHip,
      rightThigh,
      rightKnee,
      rightShin,
      rightFoot,
    };
  }

  /**
   * Procedural animation update
   */
  public update(
    delta: number,
    speed: number = 0,
    isChasing: boolean = false,
    isListening: boolean = false,
    isAttacking: boolean = false,
    attackProgress: number = 0, // 0 to 1 during attack (0..0.6 telegraph, 0.6..1 strike)
    isCooldown: boolean = false
  ) {
    this.walkTime += delta * (isChasing ? 9.5 : speed > 0.1 ? 4.0 : 1.0);
    this.breathPhase += delta * (isChasing ? 6.0 : isAttacking ? 8.0 : 1.8);
    this.twitchTimer -= delta;

    const {
      torso,
      neck,
      head,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftHand,
      rightHand,
      leftFingers,
      rightFingers,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      ribs,
    } = this.limbs;

    // 1. Subtle chest & rib cage breathing expansion
    const breath = Math.sin(this.breathPhase) * 0.035;
    torso.scale.set(1.0 + breath * 0.6, 1.0, 1.0 + breath);
    ribs.forEach((r, idx) => {
      r.scale.set(1.0 + breath * (idx % 2 === 0 ? 1.2 : 0.8), 0.65, 1.0 + breath * 1.5);
    });

    // 2. Unnatural sudden twitching & head tilts
    if (this.twitchTimer <= 0 && !isAttacking) {
      this.twitchTimer = 1.2 + Math.random() * 3.5;
      if (Math.random() < 0.65) {
        // Sudden sharp twitch target
        this.twitchTargetHead.set(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 0.45
        );
      } else {
        this.twitchTargetHead.set(0, 0, 0);
      }
    }

    // Smooth-interpolate or snap head
    this.currentHeadRot.x = THREE.MathUtils.lerp(this.currentHeadRot.x, this.twitchTargetHead.x, delta * 12);
    this.currentHeadRot.y = THREE.MathUtils.lerp(this.currentHeadRot.y, this.twitchTargetHead.y, delta * 8);
    this.currentHeadRot.z = THREE.MathUtils.lerp(this.currentHeadRot.z, this.twitchTargetHead.z, delta * 12);

    head.rotation.copy(this.currentHeadRot);

    // 3. Pose based on state
    if (isAttacking) {
      if (attackProgress < 0.6) {
        // Telegraph phase: rearing up tall, raising claw arms menacingly
        const p = attackProgress / 0.6; // 0 to 1
        torso.rotation.set(-0.25 * p, 0, (Math.random() - 0.5) * 0.05);
        neck.rotation.set(-0.3 * p, 0, 0);

        // Arms raised high and wide preparing to strike
        leftShoulder.rotation.set(-1.8 * p, 0.4 * p, -0.6 * p);
        rightShoulder.rotation.set(-1.8 * p, -0.4 * p, 0.6 * p);
        leftElbow.rotation.set(-0.8 * p, 0, 0);
        rightElbow.rotation.set(-0.8 * p, 0, 0);

        leftHip.rotation.set(0.1, 0, 0);
        rightHip.rotation.set(0.1, 0, 0);
        leftKnee.rotation.set(0, 0, 0);
        rightKnee.rotation.set(0, 0, 0);
      } else {
        // Strike phase: violent downward and forward claw lunge
        const p = (attackProgress - 0.6) / 0.4; // 0 to 1
        torso.rotation.set(0.7, 0, Math.sin(p * Math.PI) * 0.15);
        neck.rotation.set(0.3, 0, 0);

        // Claws slashing down hard
        leftShoulder.rotation.set(0.4 - 1.2 * (1 - p), -0.2, 0.3);
        rightShoulder.rotation.set(0.4 - 1.2 * (1 - p), 0.2, -0.3);
        leftElbow.rotation.set(0.2, 0, 0);
        rightElbow.rotation.set(0.2, 0, 0);

        leftHip.rotation.set(0.4, 0, 0);
        rightHip.rotation.set(-0.3, 0, 0);
        leftKnee.rotation.set(0.3, 0, 0);
        rightKnee.rotation.set(0.2, 0, 0);
      }
    } else if (isCooldown) {
      // Cooldown recoil/panting stance
      torso.rotation.set(0.25 + Math.sin(this.breathPhase) * 0.05, 0, 0);
      neck.rotation.set(0.1, 0, 0);
      leftShoulder.rotation.set(-0.3, 0, -0.2);
      rightShoulder.rotation.set(-0.3, 0, 0.2);
      leftElbow.rotation.set(0.4, 0, 0);
      rightElbow.rotation.set(0.4, 0, 0);
      leftHip.rotation.set(0, 0, 0);
      rightHip.rotation.set(0, 0, 0);
      leftKnee.rotation.set(0, 0, 0);
      rightKnee.rotation.set(0, 0, 0);
    } else if (isChasing) {
      // Violent forward hunch, rapid lunging strides
      torso.rotation.x = 0.55 + Math.sin(this.walkTime * 2) * 0.08;
      torso.rotation.z = Math.sin(this.walkTime) * 0.12;

      // Frantic lunging arms reaching forward
      leftShoulder.rotation.x = -1.2 + Math.sin(this.walkTime) * 0.8;
      rightShoulder.rotation.x = -1.2 - Math.sin(this.walkTime) * 0.8;
      leftElbow.rotation.x = -0.4;
      rightElbow.rotation.x = -0.4;

      // Leg stride
      leftHip.rotation.x = Math.sin(this.walkTime) * 0.85;
      rightHip.rotation.x = -Math.sin(this.walkTime) * 0.85;
      leftKnee.rotation.x = Math.max(0, -Math.sin(this.walkTime) * 0.9);
      rightKnee.rotation.x = Math.max(0, Math.sin(this.walkTime) * 0.9);
    } else if (speed > 0.1) {
      // Stalking / Investigating: Slow, deliberate, tall, eerie gait
      torso.rotation.x = 0.15;
      torso.rotation.y = Math.sin(this.walkTime * 0.5) * 0.1;
      torso.rotation.z = Math.sin(this.walkTime) * 0.05;

      // Long arms swinging unnaturally past knees
      leftShoulder.rotation.x = Math.sin(this.walkTime) * 0.45;
      rightShoulder.rotation.x = -Math.sin(this.walkTime) * 0.45;
      leftElbow.rotation.x = 0.15;
      rightElbow.rotation.x = 0.15;

      // Leg strides
      leftHip.rotation.x = Math.sin(this.walkTime) * 0.55;
      rightHip.rotation.x = -Math.sin(this.walkTime) * 0.55;
      leftKnee.rotation.x = Math.max(0, -Math.sin(this.walkTime) * 0.6);
      rightKnee.rotation.x = Math.max(0, Math.sin(this.walkTime) * 0.6);
    } else if (isListening) {
      // Frozen posture, neck stretched, head sharply angled
      torso.rotation.set(0.08, 0, 0);
      neck.rotation.set(0.25, 0.4, 0.2);
      leftShoulder.rotation.set(0.1, 0, -0.15);
      rightShoulder.rotation.set(0.1, 0, 0.15);
      leftHip.rotation.set(0, 0, 0);
      rightHip.rotation.set(0, 0, 0);
      leftKnee.rotation.set(0, 0, 0);
      rightKnee.rotation.set(0, 0, 0);
    } else {
      // IDLE: Slight eerie micro-sway, hanging limbs
      torso.rotation.x = 0.05 + Math.sin(this.walkTime * 0.8) * 0.03;
      torso.rotation.y = Math.sin(this.walkTime * 0.4) * 0.04;
      torso.rotation.z = Math.sin(this.walkTime * 0.6) * 0.02;

      leftShoulder.rotation.x = Math.sin(this.walkTime * 0.7) * 0.08;
      rightShoulder.rotation.x = -Math.sin(this.walkTime * 0.7) * 0.08;
      leftElbow.rotation.x = 0.1;
      rightElbow.rotation.x = 0.1;

      leftHip.rotation.set(0, 0, 0);
      rightHip.rotation.set(0, 0, 0);
      leftKnee.rotation.set(0, 0, 0);
      rightKnee.rotation.set(0, 0, 0);
    }

    // 4. Spindly fingers curling / twitching
    leftFingers.forEach((finger, i) => {
      finger.rotation.x = Math.sin(this.walkTime * 1.5 + i * 0.6) * 0.35 + 0.2;
    });
    rightFingers.forEach((finger, i) => {
      finger.rotation.x = Math.cos(this.walkTime * 1.5 + i * 0.6) * 0.35 + 0.2;
    });
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }
}
