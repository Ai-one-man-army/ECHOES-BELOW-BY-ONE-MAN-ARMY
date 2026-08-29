import * as THREE from 'three';
import { TextureGenerator } from './ProceduralTextures';
import { InteractableObject } from '../types';

export interface LightFlickerInstance {
  light: THREE.PointLight | THREE.SpotLight;
  fixtureMesh: THREE.Mesh;
  baseIntensity: number;
  color: THREE.Color;
  rate: number;
  offset: number;
  isFlickering: boolean;
  erraticTimer: number;
}

export interface AnimatedDoor {
  id: string;
  doorMesh: THREE.Object3D;
  leftPanel?: THREE.Object3D;
  rightPanel?: THREE.Object3D;
  pivotMesh?: THREE.Object3D;
  isOpen: boolean;
  isAnimating: boolean;
  openProgress: number; // 0 to 1
  type: 'slide' | 'swing';
  colliderIndex: number;
  baseCollider: THREE.Box3;
}

export class WorldBuilder {
  public scene: THREE.Scene;
  public colliders: THREE.Box3[] = [];
  public interactables: Map<string, InteractableObject> = new Map();
  public interactableMeshes: Map<string, THREE.Object3D> = new Map();
  public flickeringLights: LightFlickerInstance[] = [];
  public doors: Map<string, AnimatedDoor> = new Map();

  // Materials cache
  private concreteFloorMat!: THREE.MeshStandardMaterial;
  private concreteWallMat!: THREE.MeshStandardMaterial;
  private metalPanelMat!: THREE.MeshStandardMaterial;
  private darkSteelMat!: THREE.MeshStandardMaterial;
  private pipeMat!: THREE.MeshStandardMaterial;
  private pipeBrassMat!: THREE.MeshStandardMaterial;
  private cableMat!: THREE.MeshStandardMaterial;
  private fluorescentGlassMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
  }

  private initMaterials() {
    const concreteTex = TextureGenerator.createConcreteTexture('#3c4045', '#222529');
    concreteTex.repeat.set(4, 4);

    const wallTex = TextureGenerator.createConcreteTexture('#464b50', '#2a2d32');
    wallTex.repeat.set(4, 2);

    const metalTex = TextureGenerator.createMetalPanelTexture();
    metalTex.repeat.set(1, 1);

    this.concreteFloorMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.82,
      metalness: 0.12,
    });

    this.concreteWallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.88,
      metalness: 0.08,
    });

    this.metalPanelMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      roughness: 0.42,
      metalness: 0.78,
    });

    this.darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x282e34,
      roughness: 0.45,
      metalness: 0.75,
    });

    this.pipeMat = new THREE.MeshStandardMaterial({
      color: 0x4a525a,
      roughness: 0.32,
      metalness: 0.85,
    });

    this.pipeBrassMat = new THREE.MeshStandardMaterial({
      color: 0xa8874a,
      roughness: 0.38,
      metalness: 0.8,
    });

    this.cableMat = new THREE.MeshStandardMaterial({
      color: 0x181a1d,
      roughness: 0.92,
      metalness: 0.05,
    });

    this.fluorescentGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd6f0ff,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });

    this.woodMat = new THREE.MeshStandardMaterial({
      color: 0x6e4e3f,
      roughness: 0.88,
      metalness: 0.05,
    });
  }

  public buildFacility() {
    // 1. Corridors & Rooms Floors and Ceilings
    this.createFloorsAndCeilings();

    // 2. Concrete Perimeter & Internal Walls with Colliders
    this.createWalls();

    // 3. Doors (Sector 9 Blast Gate, Lab Doors, Security Door)
    this.createDoors();

    // 4. Industrial Overhead Infrastructure (Pipes, Valves, Hanging Cable Bundles)
    this.createInfrastructure();

    // 5. Fluorescent Lights & Spotlights
    this.createLightingFixtures();

    // 6. Laboratories & Furniture (Tables, Monitors, Cabinets, Barrels, Racks)
    this.createLabRooms();

    // 7. Interactive Props (Breaker Switch, Security Keycard, Terminals, Logs)
    this.createInteractiveProps();

    // 8. Environmental Horror Debris (Scattered Crates, Warning Signs, Fallen Tiles, Rubble)
    this.createDebrisAndAtmosphere();
  }

  private addCollider(box: THREE.Box3) {
    this.colliders.push(box);
  }

  private createWallBlock(x: number, y: number, z: number, w: number, h: number, d: number, mat = this.concreteWallMat) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const halfW = w / 2;
    const halfH = h / 2;
    const halfD = d / 2;
    const box = new THREE.Box3(
      new THREE.Vector3(x - halfW, y - halfH, z - halfD),
      new THREE.Vector3(x + halfW, y + halfH, z + halfD)
    );
    this.addCollider(box);
    return mesh;
  }

  private createFloorsAndCeilings() {
    // Main Facility Floor (-30 to +30 on X, -40 to +20 on Z)
    const floorGeom = new THREE.PlaneGeometry(60, 60);
    const floorMesh = new THREE.Mesh(floorGeom, this.concreteFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0, -10);
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Ceiling with dark metal beams
    const ceilMesh = new THREE.Mesh(floorGeom, this.concreteWallMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(0, 3.8, -10);
    ceilMesh.receiveShadow = true;
    this.scene.add(ceilMesh);

    // Structural Ceiling I-Beams
    const beamMat = this.darkSteelMat;
    for (let z = -35; z <= 15; z += 6) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(58, 0.35, 0.45), beamMat);
      beam.position.set(0, 3.65, z);
      this.scene.add(beam);
    }
  }

  private createWalls() {
    const H = 3.8;
    const Y = H / 2;

    // Facility Exterior Boundaries
    this.createWallBlock(0, Y, 18, 56, H, 1);   // South outer wall
    this.createWallBlock(0, Y, -38, 56, H, 1);  // North outer wall
    this.createWallBlock(-28, Y, -10, 1, H, 58); // West outer wall
    this.createWallBlock(28, Y, -10, 1, H, 58);  // East outer wall

    // Central Starting Corridor (Width 4m, runs from Z=16 to Z=2)
    // Left wall of start corridor
    this.createWallBlock(-2.4, Y, 10, 0.4, H, 14);
    // Right wall of start corridor
    this.createWallBlock(2.4, Y, 10, 0.4, H, 14);

    // Main East-West Corridor (at Z = 2, runs from X=-26 to X=26, with doorways)
    // North wall of E-W corridor (with gap for Sector 9 at X=0)
    this.createWallBlock(-14, Y, 2, 24, H, 0.5); // West segment
    this.createWallBlock(14, Y, 2, 24, H, 0.5);  // East segment

    // South wall of E-W corridor (with gaps to Start corridor and side rooms)
    this.createWallBlock(-15, Y, 6, 22, H, 0.5);
    this.createWallBlock(15, Y, 6, 22, H, 0.5);

    // North Sector (Sector 9 Anomaly corridor: Z=2 to Z=-18, width 6m)
    this.createWallBlock(-3.4, Y, -8, 0.5, H, 18);
    this.createWallBlock(3.4, Y, -8, 0.5, H, 18);

    // Sector 9 Inner Chamber (Z=-18 to Z=-36, X=-16 to X=16)
    this.createWallBlock(-16, Y, -27, 0.5, H, 20); // West wall
    this.createWallBlock(16, Y, -27, 0.5, H, 20);  // East wall
    this.createWallBlock(0, Y, -37.5, 32, H, 0.5); // Back wall of Sector 9

    // Lab 1: Biological Research Wing (West side: X=-27 to X=-4, Z=2 to Z=-16)
    this.createWallBlock(-15, Y, -16, 24, H, 0.5); // North wall of Lab 1
    this.createWallBlock(-4, Y, -10, 0.5, H, 12);  // East wall of Lab 1 (connecting corridor)

    // Lab 2: Power Sub-Station & Monitoring (East side: X=4 to X=27, Z=2 to Z=-16)
    this.createWallBlock(15, Y, -16, 24, H, 0.5); // North wall of Lab 2
    this.createWallBlock(4, Y, -10, 0.5, H, 12);   // West wall of Lab 2

    // Security Checkpoint Office (South-West: X=-27 to X=-3, Z=7 to Z=17)
    this.createWallBlock(-15, Y, 17.5, 24, H, 0.5);
    this.createWallBlock(-3, Y, 12, 0.5, H, 10);

    // Storage Room / Archive (South-East: X=3 to X=27, Z=7 to Z=17)
    this.createWallBlock(15, Y, 17.5, 24, H, 0.5);
    this.createWallBlock(3, Y, 12, 0.5, H, 10);
  }

  private createDoors() {
    // 1. SECTOR 9 BLAST GATE (At X=0, Z=-18) - The Main Objective Door
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, -18);

    // Heavy reinforced frame
    const frameMat = this.darkSteelMat;
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.8, 1), frameMat);
    topFrame.position.set(0, 3.4, 0);
    gateGroup.add(topFrame);

    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.8, 1), frameMat);
    leftFrame.position.set(-2.8, 1.9, 0);
    gateGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.8, 1), frameMat);
    rightFrame.position.set(2.8, 1.9, 0);
    gateGroup.add(rightFrame);

    // Sliding Left and Right Heavy Blast Panels
    const sector9SignTex = TextureGenerator.createSector9DoorTexture();
    const blastPanelMat = new THREE.MeshStandardMaterial({
      map: sector9SignTex,
      roughness: 0.4,
      metalness: 0.8,
    });

    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.35), blastPanelMat);
    leftPanel.position.set(-1.2, 1.5, 0);
    leftPanel.castShadow = true;
    gateGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 0.35), blastPanelMat);
    rightPanel.position.set(1.2, 1.5, 0);
    rightPanel.castShadow = true;
    gateGroup.add(rightPanel);

    // Hazard Stripes on bottom sill
    const hazardTex = TextureGenerator.createHazardStripeTexture();
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.6), hazardMat);
    sill.position.set(0, 0.05, 0);
    gateGroup.add(sill);

    // Red Emergency Beacon above door
    const beaconGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.25, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff1100,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
    });
    const beaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
    beaconMesh.position.set(0, 3.2, 0.55);
    gateGroup.add(beaconMesh);

    // Keycard Access Terminal beside Sector 9 Door
    const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.2), this.darkSteelMat);
    terminalBox.position.set(2.2, 1.4, 0.5);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
    });
    const terminalScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), screenMat);
    terminalScreen.position.set(2.2, 1.45, 0.61);
    gateGroup.add(terminalBox);
    gateGroup.add(terminalScreen);

    this.scene.add(gateGroup);

    // Sector 9 Collider Box
    const sector9Collider = new THREE.Box3(
      new THREE.Vector3(-2.5, 0, -18.5),
      new THREE.Vector3(2.5, 3.8, -17.5)
    );
    const colIndex = this.colliders.length;
    this.addCollider(sector9Collider);

    this.doors.set('door_sector9', {
      id: 'door_sector9',
      doorMesh: gateGroup,
      leftPanel,
      rightPanel,
      isOpen: false,
      isAnimating: false,
      openProgress: 0,
      type: 'slide',
      colliderIndex: colIndex,
      baseCollider: sector9Collider.clone(),
    });

    this.interactables.set('door_sector9', {
      id: 'door_sector9',
      name: 'Sector 9 Blast Gate',
      type: 'door',
      prompt: 'SECTOR 9 BLAST GATE',
      subText: 'Requires Level 4 Security Keycard & Sub-Station Power',
      position: [0, 1.5, -17],
      requiresItem: 'keycard_sector9',
      isLocked: true,
      isOpen: false,
    });
    this.interactableMeshes.set('door_sector9', gateGroup);

    // 2. Standard Lab Sliding Doors (Lab 1 at X=-4, Z=4)
    this.createLabSlidingDoor('door_lab1', 'Biological Research Wing A', -4, 0, 4, Math.PI / 2);

    // 3. Standard Lab Sliding Doors (Power Sub-Station at X=4, Z=4)
    this.createLabSlidingDoor('door_substation', 'Sub-Station & Power Grid', 4, 0, 4, -Math.PI / 2);

    // 4. Security Office Door (X=-3, Z=10)
    this.createLabSlidingDoor('door_security', 'Security Control Room', -3, 0, 10, Math.PI / 2);
  }

  private createLabSlidingDoor(id: string, name: string, x: number, y: number, z: number, rotationY: number = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotationY;

    // Door Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 0.4), this.darkSteelMat);
    frame.position.set(0, 1.6, 0);

    // Door Panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.7, 0.15), this.metalPanelMat);
    panel.position.set(0, 1.35, 0);
    panel.castShadow = true;
    group.add(panel);

    // Glass viewport
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.1, metalness: 0.9 })
    );
    glass.position.set(0, 1.8, 0.09);
    panel.add(glass);

    // Door label sign above
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        emissive: 0x334455,
        emissiveIntensity: 0.3,
      })
    );
    sign.position.set(0, 2.9, 0.22);
    group.add(sign);

    this.scene.add(group);

    // Door Collider Box
    const box = new THREE.Box3();
    box.setFromObject(panel);
    box.expandByVector(new THREE.Vector3(0.2, 0.5, 0.2));
    const colIndex = this.colliders.length;
    this.addCollider(box);

    this.doors.set(id, {
      id,
      doorMesh: group,
      leftPanel: panel,
      isOpen: false,
      isAnimating: false,
      openProgress: 0,
      type: 'slide',
      colliderIndex: colIndex,
      baseCollider: box.clone(),
    });

    this.interactables.set(id, {
      id,
      name,
      type: 'door',
      prompt: `${name.toUpperCase()} DOOR`,
      position: [x, 1.4, z],
      isOpen: false,
      isLocked: false,
    });
    this.interactableMeshes.set(id, group);
  }

  private createInfrastructure() {
    // Overhead Industrial Pipes running along main corridors
    const pipePointsMain: THREE.Vector3[] = [];
    for (let z = 16; z >= -34; z -= 4) {
      pipePointsMain.push(new THREE.Vector3(-1.8, 3.2, z));
    }
    const pipeCurve = new THREE.CatmullRomCurve3(pipePointsMain);
    const pipeGeom = new THREE.TubeGeometry(pipeCurve, 32, 0.12, 8, false);
    const mainPipe = new THREE.Mesh(pipeGeom, this.pipeMat);
    this.scene.add(mainPipe);

    // Secondary parallel brass coolant pipe
    const pipePoints2: THREE.Vector3[] = [];
    for (let z = 16; z >= -34; z -= 4) {
      pipePoints2.push(new THREE.Vector3(1.8, 3.3, z));
    }
    const pipeCurve2 = new THREE.CatmullRomCurve3(pipePoints2);
    const pipeGeom2 = new THREE.TubeGeometry(pipeCurve2, 32, 0.08, 8, false);
    const mainPipe2 = new THREE.Mesh(pipeGeom2, this.pipeBrassMat);
    this.scene.add(mainPipe2);

    // Pressure Valves on pipes
    for (let z = 10; z >= -30; z -= 12) {
      const valve = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16), this.pipeBrassMat);
      valve.position.set(-1.8, 3.05, z);
      valve.rotation.x = Math.PI / 2;
      this.scene.add(valve);
    }

    // Hanging Electrical Cable Bundles with catenary droop
    this.createHangingCables(-2, 3.5, 12, 2, 3.5, 12);
    this.createHangingCables(-2, 3.5, 4, 2, 3.5, 4);
    this.createHangingCables(-2, 3.5, -4, 2, 3.5, -4);
    this.createHangingCables(-2, 3.5, -12, 2, 3.5, -12);
    this.createHangingCables(-12, 3.5, -6, -4, 3.5, -6);
    this.createHangingCables(4, 3.5, -6, 12, 3.5, -6);
  }

  private createHangingCables(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - (0.4 + Math.random() * 0.3); // Droop
    const midZ = (z1 + z2) / 2;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(x2, y2, z2)
    );
    const geom = new THREE.TubeGeometry(curve, 16, 0.03, 6, false);
    const mesh = new THREE.Mesh(geom, this.cableMat);
    this.scene.add(mesh);
  }

  private createLightingFixtures() {
    // Ceiling Fluorescent Light Fixtures across corridors & rooms (20-30% brighter for clear readability)
    const lightPositions: Array<{ x: number; y: number; z: number; color: number; flicker: boolean; intensity: number }> = [
      // Start corridor
      { x: 0, y: 3.4, z: 12, color: 0xdff0ff, flicker: false, intensity: 1.5 },
      { x: 0, y: 3.4, z: 6, color: 0xbfe5ff, flicker: true, intensity: 1.3 }, // Flickering fluorescent
      // Crossroads & E-W corridor
      { x: -8, y: 3.4, z: 4, color: 0xffe6c4, flicker: false, intensity: 1.2 },
      { x: 8, y: 3.4, z: 4, color: 0xb5eaff, flicker: true, intensity: 1.35 },
      // Sector 9 Anomaly corridor
      { x: 0, y: 3.4, z: -2, color: 0xbbe8ff, flicker: false, intensity: 1.25 },
      { x: 0, y: 3.4, z: -10, color: 0xff6655, flicker: true, intensity: 1.6 }, // Ominous red/flickering near Sector 9
      // Sector 9 Inner Chamber (remains darker/ominous)
      { x: 0, y: 3.4, z: -26, color: 0x4499ff, flicker: true, intensity: 2.1 },
      // Lab 1 (Biology)
      { x: -14, y: 3.4, z: -6, color: 0xd6f7f4, flicker: false, intensity: 1.5 },
      { x: -14, y: 3.4, z: -12, color: 0xbbeee0, flicker: true, intensity: 1.2 },
      // Lab 2 (Sub-Station)
      { x: 14, y: 3.4, z: -6, color: 0xffbf66, flicker: true, intensity: 1.55 },
      { x: 14, y: 3.4, z: -12, color: 0xff9944, flicker: true, intensity: 1.35 },
      // Security Office
      { x: -14, y: 3.4, z: 12, color: 0xc4ecff, flicker: false, intensity: 1.35 },
      // Storage Archive Area
      { x: 14, y: 3.4, z: 12, color: 0xd8e8f8, flicker: true, intensity: 1.2 },
    ];

    lightPositions.forEach((pos, idx) => {
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.set(pos.x, pos.y, pos.z);

      // Industrial metal fixture housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.4), this.darkSteelMat);
      fixtureGroup.add(housing);

      // Emissive fluorescent tube
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8),
        new THREE.MeshStandardMaterial({
          color: pos.color,
          emissive: pos.color,
          emissiveIntensity: pos.intensity,
          roughness: 0.2,
        })
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.y = -0.1;
      fixtureGroup.add(tube);

      this.scene.add(fixtureGroup);

      // PointLight with 12m radius and gentle decay for balanced illumination
      const pointLight = new THREE.PointLight(pos.color, pos.intensity, 12, 1.35);
      pointLight.position.set(pos.x, pos.y - 0.2, pos.z);
      pointLight.castShadow = idx % 2 === 0; // Optimize shadow casters
      pointLight.shadow.mapSize.width = 512;
      pointLight.shadow.mapSize.height = 512;
      pointLight.shadow.bias = -0.002;
      this.scene.add(pointLight);

      if (pos.flicker) {
        this.flickeringLights.push({
          light: pointLight,
          fixtureMesh: tube,
          baseIntensity: pos.intensity,
          color: new THREE.Color(pos.color),
          rate: 0.05 + Math.random() * 0.08,
          offset: Math.random() * 100,
          isFlickering: true,
          erraticTimer: 0,
        });
      }
    });
  }

  private createLabRooms() {
    // === LAB 1: BIOLOGICAL RESEARCH WING (X=-14, Z=-9) ===
    // Stainless Steel Lab Island Table
    const tableGeom = new THREE.BoxGeometry(6, 0.9, 2.2);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x889299, metalness: 0.9, roughness: 0.25 });
    const labTable = new THREE.Mesh(tableGeom, tableMat);
    labTable.position.set(-14, 0.45, -9);
    labTable.castShadow = true;
    labTable.receiveShadow = true;
    this.scene.add(labTable);
    this.addCollider(new THREE.Box3().setFromObject(labTable));

    // Lab Equipment on Table (Microscope, Flasks, Centrifuge)
    const micro = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), this.darkSteelMat);
    micro.position.set(-15.5, 1.15, -9);
    this.scene.add(micro);

    const flaskGeom = new THREE.CylinderGeometry(0.08, 0.14, 0.35, 8);
    const flaskMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00aa44,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.75,
    });
    const flask = new THREE.Mesh(flaskGeom, flaskMat);
    flask.position.set(-14.2, 1.1, -9.3);
    this.scene.add(flask);

    // Bio-hazard containment barrel
    const barrelGeom = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 14);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xb58900,
      metalness: 0.6,
      roughness: 0.4,
    });
    const barrel1 = new THREE.Mesh(barrelGeom, barrelMat);
    barrel1.position.set(-22, 0.55, -14);
    this.scene.add(barrel1);
    this.addCollider(new THREE.Box3().setFromObject(barrel1));

    const barrel2 = new THREE.Mesh(barrelGeom, barrelMat);
    barrel2.position.set(-21, 0.55, -14.3);
    this.scene.add(barrel2);
    this.addCollider(new THREE.Box3().setFromObject(barrel2));

    // === LAB 2: SUB-STATION & POWER GRID (X=14, Z=-9) ===
    // Heavy High-Voltage Transformer Unit
    const transformerGeom = new THREE.BoxGeometry(2.4, 2.6, 1.8);
    const transMat = new THREE.MeshStandardMaterial({ color: 0x223328, roughness: 0.7, metalness: 0.5 });
    const transformer = new THREE.Mesh(transformerGeom, transMat);
    transformer.position.set(16, 1.3, -13);
    transformer.castShadow = true;
    this.scene.add(transformer);
    this.addCollider(new THREE.Box3().setFromObject(transformer));

    // Transformer Warning Decal
    const transDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.6),
      new THREE.MeshStandardMaterial({ map: TextureGenerator.createHazardStripeTexture(), roughness: 0.5 })
    );
    transDecal.position.set(16, 1.8, -12.08);
    this.scene.add(transDecal);

    // Server Racks with blinking LEDs
    for (let i = 0; i < 3; i++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.8, 0.9), this.darkSteelMat);
      rack.position.set(8 + i * 1.8, 1.4, -14.5);
      this.scene.add(rack);
      this.addCollider(new THREE.Box3().setFromObject(rack));
    }

    // === SECURITY OFFICE & CHECKPOINT (X=-14, Z=12) ===
    // Security Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.85, 1.4), this.woodMat);
    desk.position.set(-14, 0.425, 12);
    this.scene.add(desk);
    this.addCollider(new THREE.Box3().setFromObject(desk));
  }

  private createInteractiveProps() {
    // 1. SUB-STATION MAIN BREAKER SWITCH (At X=14, Z=-7 on wall)
    const breakerBox = new THREE.Group();
    breakerBox.position.set(13.8, 1.5, -4.2);

    const boxHousing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.25), this.darkSteelMat);
    breakerBox.add(boxHousing);

    // Switch Lever
    const lever = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x550000 })
    );
    lever.position.set(0, 0, 0.15);
    lever.rotation.x = -Math.PI / 4; // Down = Off
    breakerBox.add(lever);

    // Status LED
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.9 })
    );
    led.position.set(0, 0.3, 0.14);
    breakerBox.add(led);

    this.scene.add(breakerBox);

    this.interactables.set('power_switch', {
      id: 'power_switch',
      name: 'Sub-Station Power Breaker',
      type: 'power_switch',
      prompt: 'ENGAGE EMERGENCY AUXILIARY POWER',
      subText: 'Restores primary electrical conduits and unlocks Sector 9 authorization',
      position: [13.8, 1.5, -4.2],
      isActivated: false,
    });
    this.interactableMeshes.set('power_switch', breakerBox);

    // 2. LEVEL 4 SECURITY KEYCARD (On the Lab 1 Table at X=-14, Z=-9)
    const keycardGroup = new THREE.Group();
    keycardGroup.position.set(-14, 0.95, -9);

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.02, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0044aa, emissiveIntensity: 0.6 })
    );
    keycardGroup.add(card);

    // Subtle pulsating glow light around keycard to help player spot it in the horror darkness
    const keycardLight = new THREE.PointLight(0x00aaff, 0.8, 2.5);
    keycardLight.position.set(0, 0.15, 0);
    keycardGroup.add(keycardLight);

    this.scene.add(keycardGroup);

    this.interactables.set('keycard_sector9', {
      id: 'keycard_sector9',
      name: 'Sector 9 Clearance Keycard (Level 4)',
      type: 'keycard',
      prompt: 'PICK UP LEVEL 4 KEYCARD',
      subText: 'Required for Sector 9 Anomaly Access Gate',
      position: [-14, 0.95, -9],
      isActivated: false,
    });
    this.interactableMeshes.set('keycard_sector9', keycardGroup);

    // 3. SECURITY CRT TERMINAL (In Security Office at X=-14, Z=12)
    const crtGroup = new THREE.Group();
    crtGroup.position.set(-14, 1.1, 12);

    const crtMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), this.darkSteelMat);
    crtGroup.add(crtMonitor);

    const screenTex = TextureGenerator.createTerminalTexture([
      'INCIDENT REPORT: 03:16 AM',
      'SECTOR 9 SUB-BEDROCK ANOMALY',
      'ACOUSTIC PATTERN DETECTED',
      'WARNING: DO NOT MAKE SOUND',
      'POWER GRID: OFFLINE',
      'OVERRIDE: SUB-STATION B',
    ], 'FACILITY LOG 03-16');

    const crtScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.45),
      new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: 0x1fe86b,
        emissiveIntensity: 0.7,
        emissiveMap: screenTex,
      })
    );
    crtScreen.position.set(0, 0, 0.26);
    crtGroup.add(crtScreen);

    this.scene.add(crtGroup);

    this.interactables.set('terminal_security', {
      id: 'terminal_security',
      name: 'Security Incident Terminal',
      type: 'terminal',
      prompt: 'READ TERMINAL LOG: INCIDENT 03:16 AM',
      subText: 'Facility security log recorded minutes before containment collapse',
      position: [-14, 1.1, 12],
    });
    this.interactableMeshes.set('terminal_security', crtGroup);
  }

  private createDebrisAndAtmosphere() {
    // Wooden Shipping Crates & Pallets scattered in corridors
    const crateMat = this.woodMat;
    const crateGeom = new THREE.BoxGeometry(1.0, 1.0, 1.0);

    const crateLocations = [
      { x: -1.8, y: 0.5, z: 8, rot: 0.15 },
      { x: 1.9, y: 0.5, z: 10, rot: -0.3 },
      { x: 1.9, y: 1.4, z: 10.1, rot: 0.1 }, // Stacked crate
      { x: -7, y: 0.5, z: 3.2, rot: 0.45 },
      { x: 7, y: 0.5, z: 5.2, rot: -0.2 },
      { x: -2.8, y: 0.5, z: -14, rot: 0.6 },
      { x: 2.7, y: 0.5, z: -15, rot: -0.4 },
      { x: -18, y: 0.5, z: -4, rot: 0.2 },
    ];

    crateLocations.forEach((loc) => {
      const crate = new THREE.Mesh(crateGeom, crateMat);
      crate.position.set(loc.x, loc.y, loc.z);
      crate.rotation.y = loc.rot;
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
      this.addCollider(new THREE.Box3().setFromObject(crate));
    });

    // Fallen Ceiling Metal Grid / Rubble near Sector 9
    const rubbleGeom = new THREE.BoxGeometry(1.6, 0.08, 1.2);
    const rubble = new THREE.Mesh(rubbleGeom, this.darkSteelMat);
    rubble.position.set(0.8, 0.04, -6);
    rubble.rotation.y = 0.5;
    this.scene.add(rubble);

    // Floor Bloodstain / Chemical residue near Lab 1
    const stainGeom = new THREE.PlaneGeometry(2.4, 2.4);
    const stainMat = new THREE.MeshStandardMaterial({
      color: 0x3a0d0d,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const stain = new THREE.Mesh(stainGeom, stainMat);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(-4, 0.01, 1);
    this.scene.add(stain);
  }

  /**
   * Update dynamic lights flickering logic with smooth interpolation
   */
  public updateLights(delta: number) {
    const dt = Math.min(delta, 0.1);
    const time = performance.now() * 0.001;

    for (let i = 0; i < this.flickeringLights.length; i++) {
      const fl = this.flickeringLights[i];
      if (!fl.isFlickering) continue;

      fl.erraticTimer += dt;

      // Smooth multi-frequency sine wave calculation
      const wave1 = Math.sin(time * 6.5 + fl.offset);
      const wave2 = Math.sin(time * 14.2 + fl.offset * 1.8);
      const wave3 = Math.sin(time * 28.0 + fl.offset * 3.4);

      let targetIntensity = fl.baseIntensity * (0.88 + 0.12 * wave1);

      // Occasional subtle voltage dip
      if (wave2 > 0.92 && wave3 < -0.4) {
        targetIntensity = fl.baseIntensity * 0.45;
      }

      // Smoothly interpolate towards target intensity to prevent jarring frame-by-frame strobes
      const currentIntensity = fl.light.intensity;
      const smoothedIntensity = currentIntensity + (targetIntensity - currentIntensity) * Math.min(1, dt * 15);

      fl.light.intensity = smoothedIntensity;

      if (fl.fixtureMesh.material instanceof THREE.MeshStandardMaterial) {
        fl.fixtureMesh.material.emissiveIntensity = smoothedIntensity;
      }
    }
  }

  /**
   * Animate opening/closing doors with smooth pneumatic easing
   */
  public updateDoors(delta: number) {
    const dt = Math.min(delta, 0.1);
    const speed = 1.35; // ~0.75s to fully open

    for (const door of this.doors.values()) {
      if (door.isAnimating) {
        if (door.isOpen && door.openProgress < 1) {
          door.openProgress = Math.min(1, door.openProgress + dt * speed);
          if (door.openProgress >= 1) door.isAnimating = false;
        } else if (!door.isOpen && door.openProgress > 0) {
          door.openProgress = Math.max(0, door.openProgress - dt * speed);
          if (door.openProgress <= 0) door.isAnimating = false;
        }

        // Smooth cubic easeInOut
        const t = door.openProgress;
        const p = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        if (door.type === 'slide') {
          if (door.leftPanel && door.rightPanel) {
            // Dual blast gate (Sector 9)
            door.leftPanel.position.x = -1.2 - p * 1.8;
            door.rightPanel.position.x = 1.2 + p * 1.8;
          } else if (door.leftPanel) {
            // Single sliding lab door
            door.leftPanel.position.x = p * 1.8;
          }

          // Update or disable collider when door opens
          if (door.colliderIndex >= 0 && door.colliderIndex < this.colliders.length) {
            if (p > 0.5) {
              this.colliders[door.colliderIndex].makeEmpty();
            } else {
              this.colliders[door.colliderIndex].copy(door.baseCollider);
            }
          }
        }
      }
    }
  }
}
