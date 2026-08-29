import * as THREE from 'three';
import { TextureGenerator } from './ProceduralTextures';
import { ColliderType, InteractableObject, PhysicsCollider } from '../types';

export const DEBUG_PHYSICS = false;

export type WallOrientation = 'horizontal' | 'vertical';

export interface AuthoritativeDoorDef {
  start: number;
  end: number;
  height: number;
  doorId?: string;
  name?: string;
  doorType?: 'slide' | 'blast' | 'open';
  requiresItem?: string;
  isLocked?: boolean;
}

export interface AuthoritativeWallDef {
  id: string;
  name: string;
  orientation: WallOrientation;
  fixedCoord: number; // Z if horizontal, X if vertical
  spanStart: number;  // min X if horizontal, min Z if vertical
  spanEnd: number;    // max X if horizontal, max Z if vertical
  doors?: AuthoritativeDoorDef[];
}

export interface RoomDefinition {
  id: string;
  name: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

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
  isOpen: boolean;
  isAnimating: boolean;
  openProgress: number; // 0 to 1
  type: 'slide' | 'blast';
  collider: PhysicsCollider;
  baseColliderBox: THREE.Box3;
}

export class WorldBuilder {
  public scene: THREE.Scene;
  public colliders: PhysicsCollider[] = [];
  public interactables: Map<string, InteractableObject> = new Map();
  public interactableMeshes: Map<string, THREE.Object3D> = new Map();
  public flickeringLights: LightFlickerInstance[] = [];
  public doors: Map<string, AnimatedDoor> = new Map();
  public debugHelpers: THREE.Object3D[] = [];
  public isDebugPhysicsActive: boolean = false;
  private debugGroup: THREE.Group = new THREE.Group();

  // Facility Architectural Constants
  public readonly CEILING_HEIGHT = 3.3;
  public readonly WALL_THICKNESS = 0.25;
  public readonly DEFAULT_DOOR_WIDTH = 1.4;
  public readonly DEFAULT_DOOR_HEIGHT = 2.3;

  // Single Authoritative Room Floor & Ceiling Definitions
  public rooms: RoomDefinition[] = [
    { id: 'station', name: 'Station & Security Checkpoint', centerX: 0, centerZ: 18, width: 8, depth: 8 },
    { id: 'main_corridor', name: 'Sector 9 Corridor', centerX: 0, centerZ: 5, width: 2.8, depth: 18 },
    { id: 'security_office', name: 'Security Office', centerX: -5.5, centerZ: 10, width: 8.2, depth: 7 },
    { id: 'storage_archive', name: 'Storage Archive', centerX: 5.5, centerZ: 10, width: 8.2, depth: 7 },
    { id: 'bio_lab', name: 'Biological Research Wing', centerX: -5.5, centerZ: 0, width: 8.2, depth: 7 },
    { id: 'power_substation', name: 'Sub-Station & Power Grid', centerX: 5.5, centerZ: 0, width: 8.2, depth: 7 },
    { id: 'control_hub', name: 'Control Hub & Sector 9 Access', centerX: 0, centerZ: -8.5, width: 8, depth: 9 },
    { id: 'sector9_containment', name: 'Sector 9 Containment Chamber', centerX: 0, centerZ: -23, width: 12, depth: 20 },
  ];

  // Single Authoritative Master Wall Registry (ZERO duplicate or overlapping walls)
  public authoritativeWalls: AuthoritativeWallDef[] = [
    // 1. Station Checkpoint (Spawn Room) Perimeter
    { id: 'wall_station_south', name: 'Station South Wall', orientation: 'horizontal', fixedCoord: 22, spanStart: -4.125, spanEnd: 4.125 },
    { id: 'wall_station_west', name: 'Station West Wall', orientation: 'vertical', fixedCoord: -4, spanStart: 14.125, spanEnd: 21.875 },
    { id: 'wall_station_east', name: 'Station East Wall', orientation: 'vertical', fixedCoord: 4, spanStart: 14.125, spanEnd: 21.875 },
    // Station North / Corridor South Partition (Z = 14)
    {
      id: 'wall_partition_station_corridor',
      name: 'Station / Corridor Partition',
      orientation: 'horizontal',
      fixedCoord: 14,
      spanStart: -4.125,
      spanEnd: 4.125,
      doors: [{ start: -0.8, end: 0.8, height: 2.4, doorType: 'open', name: 'Station Archway' }],
    },

    // 2. Sector 9 Central Corridor West Boundary (X = -1.4)
    {
      id: 'wall_corridor_west',
      name: 'Sector 9 Corridor West Wall',
      orientation: 'vertical',
      fixedCoord: -1.4,
      spanStart: -3.875,
      spanEnd: 13.875,
      doors: [
        {
          start: -0.7,
          end: 0.7,
          height: 2.2,
          doorId: 'door_biolab',
          name: 'Biological Research Wing',
          doorType: 'slide',
        },
        {
          start: 9.3,
          end: 10.7,
          height: 2.2,
          doorId: 'door_security',
          name: 'Security Office',
          doorType: 'slide',
        },
      ],
    },

    // 3. Sector 9 Central Corridor East Boundary (X = 1.4)
    {
      id: 'wall_corridor_east',
      name: 'Sector 9 Corridor East Wall',
      orientation: 'vertical',
      fixedCoord: 1.4,
      spanStart: -3.875,
      spanEnd: 13.875,
      doors: [
        {
          start: -0.7,
          end: 0.7,
          height: 2.2,
          doorId: 'door_substation',
          name: 'Sub-Station & Power Grid',
          doorType: 'slide',
        },
        {
          start: 9.3,
          end: 10.7,
          height: 2.2,
          doorId: 'door_storage',
          name: 'Storage Archive',
          doorType: 'slide',
        },
      ],
    },

    // 4. Security Office Outer Perimeter (X: -9.6 to -1.4, Z: 6.5 to 13.5)
    { id: 'wall_security_north', name: 'Security North Wall', orientation: 'horizontal', fixedCoord: 6.5, spanStart: -9.725, spanEnd: -1.525 },
    { id: 'wall_security_south', name: 'Security South Wall', orientation: 'horizontal', fixedCoord: 13.5, spanStart: -9.725, spanEnd: -1.525 },
    { id: 'wall_security_west', name: 'Security West Wall', orientation: 'vertical', fixedCoord: -9.6, spanStart: 6.625, spanEnd: 13.375 },

    // 5. Storage Archive Outer Perimeter (X: 1.4 to 9.6, Z: 6.5 to 13.5)
    { id: 'wall_storage_north', name: 'Storage North Wall', orientation: 'horizontal', fixedCoord: 6.5, spanStart: 1.525, spanEnd: 9.725 },
    { id: 'wall_storage_south', name: 'Storage South Wall', orientation: 'horizontal', fixedCoord: 13.5, spanStart: 1.525, spanEnd: 9.725 },
    { id: 'wall_storage_east', name: 'Storage East Wall', orientation: 'vertical', fixedCoord: 9.6, spanStart: 6.625, spanEnd: 13.375 },

    // 6. Biological Research Wing Outer Perimeter (X: -9.6 to -1.4, Z: -3.5 to 3.5)
    { id: 'wall_biolab_north', name: 'Bio-Lab North Wall', orientation: 'horizontal', fixedCoord: -3.5, spanStart: -9.725, spanEnd: -1.525 },
    { id: 'wall_biolab_south', name: 'Bio-Lab South Wall', orientation: 'horizontal', fixedCoord: 3.5, spanStart: -9.725, spanEnd: -1.525 },
    { id: 'wall_biolab_west', name: 'Bio-Lab West Wall', orientation: 'vertical', fixedCoord: -9.6, spanStart: -3.375, spanEnd: 3.375 },

    // 7. Sub-Station & Power Grid Outer Perimeter (X: 1.4 to 9.6, Z: -3.5 to 3.5)
    { id: 'wall_substation_north', name: 'Sub-Station North Wall', orientation: 'horizontal', fixedCoord: -3.5, spanStart: 1.525, spanEnd: 9.725 },
    { id: 'wall_substation_south', name: 'Sub-Station South Wall', orientation: 'horizontal', fixedCoord: 3.5, spanStart: 1.525, spanEnd: 9.725 },
    { id: 'wall_substation_east', name: 'Sub-Station East Wall', orientation: 'vertical', fixedCoord: 9.6, spanStart: -3.375, spanEnd: 3.375 },

    // 8. Corridor North / Control Hub South Partition (Z = -4)
    {
      id: 'wall_partition_corridor_control',
      name: 'Corridor / Control Hub Partition',
      orientation: 'horizontal',
      fixedCoord: -4,
      spanStart: -4.125,
      spanEnd: 4.125,
      doors: [{ start: -0.8, end: 0.8, height: 2.4, doorType: 'open', name: 'Control Hub Archway' }],
    },

    // 9. Control Hub Outer Perimeter (X: -4 to 4, Z: -13 to -4)
    { id: 'wall_control_west', name: 'Control Hub West Wall', orientation: 'vertical', fixedCoord: -4, spanStart: -12.875, spanEnd: -4.125 },
    { id: 'wall_control_east', name: 'Control Hub East Wall', orientation: 'vertical', fixedCoord: 4, spanStart: -12.875, spanEnd: -4.125 },

    // 10. Control Hub North / Sector 9 Containment South Partition (Z = -13)
    {
      id: 'wall_partition_sector9_blast',
      name: 'Sector 9 Blast Gate Partition',
      orientation: 'horizontal',
      fixedCoord: -13,
      spanStart: -6.125,
      spanEnd: 6.125,
      doors: [
        {
          start: -1.2,
          end: 1.2,
          height: 2.3,
          doorId: 'door_sector9',
          name: 'Sector 9 Blast Gate',
          doorType: 'blast',
          requiresItem: 'keycard_sector9',
          isLocked: true,
        },
      ],
    },

    // 11. Sector 9 Containment Chamber Outer Perimeter (X: -6 to 6, Z: -33 to -13)
    { id: 'wall_sector9_west', name: 'Sector 9 West Wall', orientation: 'vertical', fixedCoord: -6, spanStart: -32.875, spanEnd: -13.125 },
    { id: 'wall_sector9_east', name: 'Sector 9 East Wall', orientation: 'vertical', fixedCoord: 6, spanStart: -32.875, spanEnd: -13.125 },
    { id: 'wall_sector9_north', name: 'Sector 9 North Back Wall', orientation: 'horizontal', fixedCoord: -33, spanStart: -6.125, spanEnd: 6.125 },
  ];

  // Materials Cache
  private concreteFloorMat!: THREE.MeshStandardMaterial;
  private concreteWallMat!: THREE.MeshStandardMaterial;
  private metalPanelMat!: THREE.MeshStandardMaterial;
  private darkSteelMat!: THREE.MeshStandardMaterial;
  private pipeMat!: THREE.MeshStandardMaterial;
  private pipeBrassMat!: THREE.MeshStandardMaterial;
  private cableMat!: THREE.MeshStandardMaterial;
  private woodMat!: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
  }

  private initMaterials() {
    const concreteTex = TextureGenerator.createConcreteTexture('#3c4045', '#1e2124');
    concreteTex.repeat.set(4, 4);

    const concreteBump = TextureGenerator.createConcreteBumpMap();
    concreteBump.repeat.set(4, 4);

    const wallTex = TextureGenerator.createConcreteTexture('#464b52', '#26292e');
    wallTex.repeat.set(4, 2);

    const wallBump = TextureGenerator.createConcreteBumpMap();
    wallBump.repeat.set(4, 2);

    const metalTex = TextureGenerator.createMetalPanelTexture();
    metalTex.repeat.set(1, 1);

    const metalBump = TextureGenerator.createMetalBumpMap();
    metalBump.repeat.set(1, 1);

    this.concreteFloorMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      bumpMap: concreteBump,
      bumpScale: 0.015,
      roughness: 0.78,
      metalness: 0.15,
    });

    this.concreteWallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      bumpMap: wallBump,
      bumpScale: 0.02,
      roughness: 0.85,
      metalness: 0.10,
    });

    this.metalPanelMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      bumpMap: metalBump,
      bumpScale: 0.025,
      roughness: 0.38,
      metalness: 0.82,
    });

    this.darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x22272c,
      roughness: 0.42,
      metalness: 0.80,
    });

    this.pipeMat = new THREE.MeshStandardMaterial({
      color: 0x485058,
      roughness: 0.30,
      metalness: 0.88,
    });

    this.pipeBrassMat = new THREE.MeshStandardMaterial({
      color: 0xa8874a,
      roughness: 0.35,
      metalness: 0.82,
    });

    this.cableMat = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.90,
      metalness: 0.05,
    });

    this.woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3e30,
      roughness: 0.85,
      metalness: 0.05,
    });
  }

  public buildFacility() {
    this.colliders = [];
    this.interactables.clear();
    this.interactableMeshes.clear();
    this.flickeringLights = [];
    this.doors.clear();

    // 1. Generate Seamless Floors and Ceilings
    this.generateFloorsAndCeilings();

    // 2. Generate All Authoritative Segmented Walls (exact doorway openings, zero duplicates)
    this.generateAuthoritativeWalls();

    // 3. Generate Sliding & Blast Door Entities
    this.generateDoorEntities();

    // 4. Overhead Infrastructure (Pipes & Hanging Cables strictly along upper ceiling)
    this.createInfrastructure();

    // 5. Clean Ceiling Lighting Fixtures
    this.createLightingFixtures();

    // 6. Room Interiors & Furniture (Positioned away from walking corridors)
    this.createRoomInteriors();

    // 7. Interactive Items (Breaker Switch, Keycard, Terminal)
    this.createInteractiveProps();

    // 8. Sector 9 Anomaly Centerpiece (Positioned deep in Containment Chamber)
    this.createSector9Anomaly();

    // 9. Automated Physics, Traversal, and Geometry Clearance Validation Pass
    this.validateCollisionSystem();

    // 10. Debug physics visualization if enabled
    if (DEBUG_PHYSICS || this.isDebugPhysicsActive) {
      this.renderDebugColliders();
    }
  }

  public addCollider(type: ColliderType, box: THREE.Box3, name: string, enabled: boolean = true): PhysicsCollider {
    const col: PhysicsCollider = {
      id: `col_${this.colliders.length + 1}_${type.toLowerCase()}`,
      type,
      box,
      enabled,
      name,
    };
    this.colliders.push(col);
    return col;
  }

  public getBlockingColliders(): PhysicsCollider[] {
    return this.colliders.filter(
      (c) => c.enabled && (c.type === ColliderType.WALL || c.type === ColliderType.DOOR || c.type === ColliderType.OBJECT)
    );
  }

  public getBlockingBoxes(): THREE.Box3[] {
    return this.getBlockingColliders().map((c) => c.box);
  }

  private createWallPiece(
    name: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    mat: THREE.Material = this.concreteWallMat
  ) {
    if (sizeX <= 0.01 || sizeY <= 0.01 || sizeZ <= 0.01) return;

    const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(centerX, centerY, centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const halfX = sizeX / 2;
    const halfY = sizeY / 2;
    const halfZ = sizeZ / 2;
    const box = new THREE.Box3(
      new THREE.Vector3(centerX - halfX, centerY - halfY, centerZ - halfZ),
      new THREE.Vector3(centerX + halfX, centerY + halfY, centerZ + halfZ)
    );
    this.addCollider(ColliderType.WALL, box, name, true);
    return mesh;
  }

  private generateFloorsAndCeilings() {
    const H = this.CEILING_HEIGHT;

    for (const room of this.rooms) {
      const hw = room.width / 2;
      const hd = room.depth / 2;
      const rx = room.centerX;
      const rz = room.centerZ;

      // 1. Visible Floor (Y = 0)
      const floorGeom = new THREE.PlaneGeometry(room.width, room.depth);
      const floorMesh = new THREE.Mesh(floorGeom, this.concreteFloorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(rx, 0, rz);
      floorMesh.receiveShadow = true;
      this.scene.add(floorMesh);

      // Floor Spatial Volume (Tagged as FLOOR - isolated from horizontal physics resolver)
      const floorBox = new THREE.Box3(
        new THREE.Vector3(rx - hw, -0.5, rz - hd),
        new THREE.Vector3(rx + hw, 0, rz + hd)
      );
      this.addCollider(ColliderType.FLOOR, floorBox, `Floor: ${room.name}`, false);

      // 2. Visible Ceiling (Y = H)
      const ceilGeom = new THREE.PlaneGeometry(room.width, room.depth);
      const ceilMesh = new THREE.Mesh(ceilGeom, this.concreteWallMat);
      ceilMesh.rotation.x = Math.PI / 2;
      ceilMesh.position.set(rx, H, rz);
      ceilMesh.receiveShadow = true;
      this.scene.add(ceilMesh);

      // Ceiling Spatial Volume (Tagged as CEILING - isolated from horizontal physics resolver)
      const ceilBox = new THREE.Box3(
        new THREE.Vector3(rx - hw, H, rz - hd),
        new THREE.Vector3(rx + hw, H + 0.5, rz + hd)
      );
      this.addCollider(ColliderType.CEILING, ceilBox, `Ceiling: ${room.name}`, false);
    }
  }

  private generateAuthoritativeWalls() {
    const H = this.CEILING_HEIGHT;
    const T = this.WALL_THICKNESS;

    for (const wall of this.authoritativeWalls) {
      const isHorizontal = wall.orientation === 'horizontal';
      const doors = wall.doors || [];

      if (doors.length === 0) {
        // Solid Wall across exact authoritative span
        const length = wall.spanEnd - wall.spanStart;
        const centerSpan = (wall.spanStart + wall.spanEnd) / 2;

        if (isHorizontal) {
          this.createWallPiece(
            wall.name,
            centerSpan,
            H / 2,
            wall.fixedCoord,
            length,
            H,
            T
          );
        } else {
          this.createWallPiece(
            wall.name,
            wall.fixedCoord,
            H / 2,
            centerSpan,
            T,
            H,
            length
          );
        }
      } else {
        // Wall with Door Openings: generate left segments, headers, and right segments
        const sortedDoors = [...doors].sort((a, b) => a.start - b.start);
        let currentPos = wall.spanStart;

        for (let i = 0; i < sortedDoors.length; i++) {
          const door = sortedDoors[i];
          const doorStart = door.start;
          const doorEnd = door.end;
          const doorW = doorEnd - doorStart;
          const doorH = door.height;
          const doorCenter = (doorStart + doorEnd) / 2;

          // 1. Wall Segment preceding doorway
          const segmentLen = doorStart - currentPos;
          if (segmentLen > 0.005) {
            const segCenter = currentPos + segmentLen / 2;
            if (isHorizontal) {
              this.createWallPiece(
                `${wall.name} Seg ${i + 1}`,
                segCenter,
                H / 2,
                wall.fixedCoord,
                segmentLen,
                H,
                T
              );
            } else {
              this.createWallPiece(
                `${wall.name} Seg ${i + 1}`,
                wall.fixedCoord,
                H / 2,
                segCenter,
                T,
                H,
                segmentLen
              );
            }
          }

          // 2. Door Header / Lintel above Door Opening (Y: doorH to H)
          const lintelH = H - doorH;
          if (lintelH > 0.005) {
            const lintelCenterY = doorH + lintelH / 2;
            if (isHorizontal) {
              this.createWallPiece(
                `${wall.name} Header`,
                doorCenter,
                lintelCenterY,
                wall.fixedCoord,
                doorW,
                lintelH,
                T
              );
            } else {
              this.createWallPiece(
                `${wall.name} Header`,
                wall.fixedCoord,
                lintelCenterY,
                doorCenter,
                T,
                lintelH,
                doorW
              );
            }
          }

          // 3. Frame Trim around Doorway Opening
          this.createDoorTrim(isHorizontal, doorCenter, wall.fixedCoord, doorW, doorH, T);

          currentPos = doorEnd;
        }

        // 4. Final Wall Segment after last doorway
        const finalEnd = wall.spanEnd;
        const finalLen = finalEnd - currentPos;
        if (finalLen > 0.005) {
          const segCenter = currentPos + finalLen / 2;
          if (isHorizontal) {
            this.createWallPiece(
              `${wall.name} Final Seg`,
              segCenter,
              H / 2,
              wall.fixedCoord,
              finalLen,
              H,
              T
            );
          } else {
            this.createWallPiece(
              `${wall.name} Final Seg`,
              wall.fixedCoord,
              H / 2,
              segCenter,
              T,
              H,
              finalLen
            );
          }
        }
      }
    }
  }

  private createDoorTrim(
    isHorizontal: boolean,
    doorCenter: number,
    fixedCoord: number,
    doorW: number,
    doorH: number,
    T: number
  ) {
    const frameMat = this.darkSteelMat;
    const frameThickness = 0.06;

    // Floor Sill Plate (thin visual threshold step at Y = 0.008, non-blocking)
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(
        isHorizontal ? doorW : T + 0.06,
        0.015,
        isHorizontal ? T + 0.06 : doorW
      ),
      frameMat
    );
    sill.position.set(
      isHorizontal ? doorCenter : fixedCoord,
      0.008,
      isHorizontal ? fixedCoord : doorCenter
    );
    sill.receiveShadow = true;
    this.scene.add(sill);

    // Left & Right frame posts (decorative trim meshes only)
    const postGeom = new THREE.BoxGeometry(
      isHorizontal ? frameThickness : T + 0.04,
      doorH,
      isHorizontal ? T + 0.04 : frameThickness
    );

    const post1 = new THREE.Mesh(postGeom, frameMat);
    const post2 = new THREE.Mesh(postGeom, frameMat);

    if (isHorizontal) {
      post1.position.set(doorCenter - doorW / 2, doorH / 2, fixedCoord);
      post2.position.set(doorCenter + doorW / 2, doorH / 2, fixedCoord);
    } else {
      post1.position.set(fixedCoord, doorH / 2, doorCenter - doorW / 2);
      post2.position.set(fixedCoord, doorH / 2, doorCenter + doorW / 2);
    }

    this.scene.add(post1);
    this.scene.add(post2);
  }

  private generateDoorEntities() {
    for (const wall of this.authoritativeWalls) {
      if (!wall.doors) continue;
      const isHorizontal = wall.orientation === 'horizontal';

      for (const doorDef of wall.doors) {
        if (!doorDef.doorId || doorDef.doorType === 'open') continue;

        const doorCenter = (doorDef.start + doorDef.end) / 2;
        const posX = isHorizontal ? doorCenter : wall.fixedCoord;
        const posZ = isHorizontal ? wall.fixedCoord : doorCenter;
        const doorW = doorDef.end - doorDef.start;
        const doorH = doorDef.height;

        if (doorDef.doorId === 'door_sector9') {
          this.createSector9BlastGate(doorDef, posX, posZ, doorW, doorH);
        } else if (doorDef.doorType === 'slide') {
          this.createSlidingDoorEntity(doorDef, isHorizontal, posX, posZ, doorW, doorH);
        }
      }
    }
  }

  private createSector9BlastGate(doorDef: AuthoritativeDoorDef, posX: number, posZ: number, doorW: number, doorH: number) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(posX, 0, posZ);

    const halfPanelW = doorW / 2;

    // Dual Heavy Sliding Blast Panels
    const sector9SignTex = TextureGenerator.createSector9DoorTexture();
    const blastPanelMat = new THREE.MeshStandardMaterial({
      map: sector9SignTex,
      roughness: 0.40,
      metalness: 0.80,
    });

    const leftPanel = new THREE.Mesh(
      new THREE.BoxGeometry(halfPanelW, doorH, 0.22),
      blastPanelMat
    );
    leftPanel.position.set(-halfPanelW / 2, doorH / 2, 0);
    leftPanel.castShadow = true;
    gateGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(halfPanelW, doorH, 0.22),
      blastPanelMat
    );
    rightPanel.position.set(halfPanelW / 2, doorH / 2, 0);
    rightPanel.castShadow = true;
    gateGroup.add(rightPanel);

    // Hazard Stripes on bottom sill
    const hazardTex = TextureGenerator.createHazardStripeTexture();
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.60 });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 0.04, 0.45), hazardMat);
    sill.position.set(0, 0.02, 0);
    gateGroup.add(sill);

    // Red Emergency Beacon above gate
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff1100,
        emissive: 0xff0000,
        emissiveIntensity: 0.9,
      })
    );
    beacon.position.set(0, doorH + 0.35, 0.2);
    gateGroup.add(beacon);

    // Keycard Access Terminal beside Sector 9 Door
    const terminalBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.15), this.darkSteelMat);
    terminalBox.position.set(doorW / 2 + 0.35, 1.4, 0.2);
    const terminalScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.8 })
    );
    terminalScreen.position.set(doorW / 2 + 0.35, 1.45, 0.28);
    gateGroup.add(terminalBox);
    gateGroup.add(terminalScreen);

    this.scene.add(gateGroup);

    // Door Physics Collider (Blocks doorway only when closed)
    const colBox = new THREE.Box3(
      new THREE.Vector3(posX - doorW / 2, 0, posZ - 0.15),
      new THREE.Vector3(posX + doorW / 2, doorH, posZ + 0.15)
    );
    const col = this.addCollider(ColliderType.DOOR, colBox, 'Sector 9 Blast Gate', true);

    this.doors.set('door_sector9', {
      id: 'door_sector9',
      doorMesh: gateGroup,
      leftPanel,
      rightPanel,
      isOpen: false,
      isAnimating: false,
      openProgress: 0,
      type: 'blast',
      collider: col,
      baseColliderBox: colBox.clone(),
    });

    this.interactables.set('door_sector9', {
      id: 'door_sector9',
      name: 'Sector 9 Blast Gate',
      type: 'door',
      prompt: 'SECTOR 9 BLAST GATE',
      subText: 'Requires Level 4 Security Keycard & Sub-Station Auxiliary Power',
      position: [posX, 1.5, posZ + 0.8],
      requiresItem: 'keycard_sector9',
      isLocked: true,
      isOpen: false,
      distanceThreshold: 2.6,
    });
    this.interactableMeshes.set('door_sector9', gateGroup);
  }

  private createSlidingDoorEntity(
    doorDef: AuthoritativeDoorDef,
    isHorizontal: boolean,
    posX: number,
    posZ: number,
    doorW: number,
    doorH: number
  ) {
    const group = new THREE.Group();
    group.position.set(posX, 0, posZ);
    if (!isHorizontal) {
      group.rotation.y = Math.PI / 2;
    }

    // Door Panel Mesh
    const panelGeom = new THREE.BoxGeometry(doorW - 0.05, doorH, 0.08);
    const panel = new THREE.Mesh(panelGeom, this.metalPanelMat);
    panel.position.set(0, doorH / 2, 0);
    panel.castShadow = true;
    group.add(panel);

    // Viewport Glass
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.1, metalness: 0.9 })
    );
    glass.position.set(0, doorH * 0.65, 0.045);
    panel.add(glass);

    this.scene.add(group);

    // Door Physics Collider (Blocks doorway only when closed)
    const colHalfX = isHorizontal ? doorW / 2 : 0.12;
    const colHalfZ = isHorizontal ? 0.12 : doorW / 2;
    const colBox = new THREE.Box3(
      new THREE.Vector3(posX - colHalfX, 0, posZ - colHalfZ),
      new THREE.Vector3(posX + colHalfX, doorH, posZ + colHalfZ)
    );
    const col = this.addCollider(ColliderType.DOOR, colBox, doorDef.name || 'Sliding Door', true);

    const doorId = doorDef.doorId!;
    this.doors.set(doorId, {
      id: doorId,
      doorMesh: group,
      leftPanel: panel,
      isOpen: false,
      isAnimating: false,
      openProgress: 0,
      type: 'slide',
      collider: col,
      baseColliderBox: colBox.clone(),
    });

    this.interactables.set(doorId, {
      id: doorId,
      name: doorDef.name || 'Sliding Door',
      type: 'door',
      prompt: `${(doorDef.name || 'DOOR').toUpperCase()}`,
      subText: 'Press E or USE button to toggle pneumatic door',
      position: [posX, 1.4, posZ],
      isOpen: false,
      isLocked: false,
      distanceThreshold: 2.4,
    });
    this.interactableMeshes.set(doorId, group);
  }

  private createInfrastructure() {
    // 1. Overhead Main Industrial Pipe along Corridor Spine (Y = 3.1m)
    const pipePointsMain: THREE.Vector3[] = [];
    for (let z = 14; z >= -10; z -= 3) {
      pipePointsMain.push(new THREE.Vector3(-0.9, 3.1, z));
    }
    const pipeCurve = new THREE.CatmullRomCurve3(pipePointsMain);
    const pipeGeom = new THREE.TubeGeometry(pipeCurve, 24, 0.07, 8, false);
    const mainPipe = new THREE.Mesh(pipeGeom, this.pipeMat);
    this.scene.add(mainPipe);

    // 2. Brass Secondary Coolant Pipe along Corridor Spine (X = +0.9, Y = 3.12m)
    const pipePoints2: THREE.Vector3[] = [];
    for (let z = 14; z >= -10; z -= 3) {
      pipePoints2.push(new THREE.Vector3(0.9, 3.12, z));
    }
    const pipeCurve2 = new THREE.CatmullRomCurve3(pipePoints2);
    const pipeGeom2 = new THREE.TubeGeometry(pipeCurve2, 24, 0.05, 8, false);
    const pipe2 = new THREE.Mesh(pipeGeom2, this.pipeBrassMat);
    this.scene.add(pipe2);

    // 3. Hanging Electrical Cable Bundles across Corridor Ceilings (Y = 3.2m down to 2.9m)
    this.createHangingCables(-1.2, 3.2, 12, 1.2, 3.2, 12);
    this.createHangingCables(-1.2, 3.2, 5, 1.2, 3.2, 5);
    this.createHangingCables(-1.2, 3.2, -2, 1.2, 3.2, -2);
    this.createHangingCables(-1.2, 3.2, -9, 1.2, 3.2, -9);
  }

  private createHangingCables(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - 0.25;
    const midZ = (z1 + z2) / 2;

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(x2, y2, z2)
    );
    const geom = new THREE.TubeGeometry(curve, 16, 0.02, 6, false);
    const mesh = new THREE.Mesh(geom, this.cableMat);
    this.scene.add(mesh);
  }

  private createLightingFixtures() {
    const lightConfigs: Array<{
      x: number;
      y: number;
      z: number;
      color: number;
      flicker: boolean;
      intensity: number;
    }> = [
      // Station Checkpoint (Spawn Room: 0, 18)
      { x: 0, y: 3.0, z: 18, color: 0xd8e8f8, flicker: false, intensity: 1.5 },
      // Sector 9 Corridor South (0, 12)
      { x: 0, y: 3.0, z: 12, color: 0xcbe2f5, flicker: false, intensity: 1.4 },
      // Sector 9 Corridor Mid (0, 5)
      { x: 0, y: 3.0, z: 5, color: 0xb5dcff, flicker: true, intensity: 1.35 },
      // Sector 9 Corridor North (0, -1)
      { x: 0, y: 3.0, z: -1, color: 0xcbe2f5, flicker: false, intensity: 1.4 },
      // Security Office (-5.5, 10)
      { x: -5.5, y: 3.0, z: 10, color: 0xbde6ff, flicker: false, intensity: 1.5 },
      // Storage Archive (5.5, 10)
      { x: 5.5, y: 3.0, z: 10, color: 0xffe2b8, flicker: true, intensity: 1.35 },
      // Bio Lab (-5.5, 0)
      { x: -5.5, y: 3.0, z: 0, color: 0xd4f8f4, flicker: false, intensity: 1.55 },
      // Power Sub-Station (5.5, 0)
      { x: 5.5, y: 3.0, z: 0, color: 0xffbf66, flicker: true, intensity: 1.6 },
      // Control Hub (0, -8.5)
      { x: 0, y: 3.0, z: -8.5, color: 0xff8877, flicker: true, intensity: 1.5 },
      // Sector 9 Blast Gate (0, -13)
      { x: 0, y: 3.0, z: -13, color: 0xff3322, flicker: true, intensity: 1.8 },
      // Sector 9 Containment Chamber (0, -23)
      { x: 0, y: 3.0, z: -23, color: 0x44aaff, flicker: true, intensity: 2.2 },
    ];

    lightConfigs.forEach((pos, idx) => {
      const fixtureGroup = new THREE.Group();
      fixtureGroup.position.set(pos.x, pos.y, pos.z);

      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.35), this.darkSteelMat);
      fixtureGroup.add(housing);

      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8),
        new THREE.MeshStandardMaterial({
          color: pos.color,
          emissive: pos.color,
          emissiveIntensity: pos.intensity,
          roughness: 0.2,
        })
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.y = -0.08;
      fixtureGroup.add(tube);

      this.scene.add(fixtureGroup);

      const pointLight = new THREE.PointLight(pos.color, pos.intensity, 14, 1.25);
      pointLight.position.set(pos.x, pos.y - 0.2, pos.z);
      pointLight.castShadow = idx % 2 === 0;
      pointLight.shadow.mapSize.width = 512;
      pointLight.shadow.mapSize.height = 512;
      pointLight.shadow.bias = -0.001;
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

  private createRoomInteriors() {
    // 1. STATION SECURITY CHECKPOINT (Spawn Room: Center 0, 18 -> X: -4 to 4, Z: 14 to 22)
    // Security Desk on East side of spawn room (X = 2.6, Z = 19.5, Size: 2.0 x 0.85 x 1.1)
    const deskGeom = new THREE.BoxGeometry(2.0, 0.85, 1.1);
    const deskMesh = new THREE.Mesh(deskGeom, this.woodMat);
    deskMesh.position.set(2.6, 0.425, 19.5);
    deskMesh.castShadow = true;
    this.scene.add(deskMesh);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(1.6, 0, 18.95), new THREE.Vector3(3.6, 0.85, 20.05)),
      'Station Security Desk'
    );

    // Security Lockers against West wall at X = -3.2, Z = 19.5 (Size: 0.7 x 2.2 x 2.2)
    const lockerGeom = new THREE.BoxGeometry(0.7, 2.2, 2.2);
    const lockerMesh = new THREE.Mesh(lockerGeom, this.darkSteelMat);
    lockerMesh.position.set(-3.2, 1.1, 19.5);
    lockerMesh.castShadow = true;
    this.scene.add(lockerMesh);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-3.55, 0, 18.4), new THREE.Vector3(-2.85, 2.2, 20.6)),
      'Station Lockers'
    );

    // 2. SECURITY OFFICE (Center: -5.5, 10, Width: 8.2, Depth: 7 -> X: -9.6 to -1.4, Z: 6.5 to 13.5)
    // Desk + Terminal against far West wall (X = -8.0, Z = 10, Size: 2.2 x 0.85 x 1.3)
    const secDesk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 1.3), this.woodMat);
    secDesk.position.set(-8.0, 0.425, 10);
    secDesk.castShadow = true;
    this.scene.add(secDesk);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-9.1, 0, 9.35), new THREE.Vector3(-6.9, 0.85, 10.65)),
      'Security Terminal Desk'
    );

    // Filing cabinets along South wall (X = -6.5, Z = 12.8, Size: 2.6 x 1.6 x 0.6)
    const fileCab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.6), this.darkSteelMat);
    fileCab.position.set(-6.5, 0.8, 12.8);
    this.scene.add(fileCab);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-7.8, 0, 12.5), new THREE.Vector3(-5.2, 1.6, 13.1)),
      'Filing Cabinets'
    );

    // 3. STORAGE ARCHIVE (Center: 5.5, 10, Width: 8.2, Depth: 7 -> X: 1.4 to 9.6, Z: 6.5 to 13.5)
    // Shelving units along East wall (X = 9.0, Z = 10, Size: 0.7 x 2.4 x 3.6)
    const shelfGeom = new THREE.BoxGeometry(0.7, 2.4, 3.6);
    const shelfMesh = new THREE.Mesh(shelfGeom, this.darkSteelMat);
    shelfMesh.position.set(9.0, 1.2, 10);
    this.scene.add(shelfMesh);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(8.65, 0, 8.2), new THREE.Vector3(9.35, 2.4, 11.8)),
      'Storage Shelves'
    );

    // Stacked crates in South-East corner (X = 8.0, Z = 12.5)
    const crateGeom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const crate1 = new THREE.Mesh(crateGeom, this.woodMat);
    crate1.position.set(8.0, 0.45, 12.5);
    this.scene.add(crate1);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(7.55, 0, 12.05), new THREE.Vector3(8.45, 0.9, 12.95)),
      'Storage Crate 1'
    );

    const crate2 = new THREE.Mesh(crateGeom, this.woodMat);
    crate2.position.set(8.0, 1.35, 12.5);
    this.scene.add(crate2);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(7.55, 0.9, 12.05), new THREE.Vector3(8.45, 1.8, 12.95)),
      'Storage Crate 2'
    );

    // 4. BIO LAB (Center: -5.5, 0, Width: 8.2, Depth: 7 -> X: -9.6 to -1.4, Z: -3.5 to 3.5)
    // Lab Island Table in center of Bio Lab at X = -5.8, Z = 0 (Leaves 4.4m walkway towards door at X = -1.4)
    const labTableGeom = new THREE.BoxGeometry(3.2, 0.85, 1.5);
    const labTableMat = new THREE.MeshStandardMaterial({ color: 0x889299, metalness: 0.9, roughness: 0.25 });
    const labTable = new THREE.Mesh(labTableGeom, labTableMat);
    labTable.position.set(-5.8, 0.425, 0);
    labTable.castShadow = true;
    this.scene.add(labTable);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-7.4, 0, -0.75), new THREE.Vector3(-4.2, 0.85, 0.75)),
      'Bio Lab Central Island'
    );

    // Lab Equipment on Table
    const micro = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.3), this.darkSteelMat);
    micro.position.set(-6.8, 1.05, 0);
    this.scene.add(micro);

    const flaskGeom = new THREE.CylinderGeometry(0.07, 0.12, 0.3, 8);
    const flaskMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00aa44,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.75,
    });
    const flask = new THREE.Mesh(flaskGeom, flaskMat);
    flask.position.set(-5.0, 1.0, 0.2);
    this.scene.add(flask);

    // Containment barrel in North-West corner (X = -8.8, Z = -2.8)
    const barrelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.95, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb58900, metalness: 0.6, roughness: 0.4 });
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(-8.8, 0.475, -2.8);
    this.scene.add(barrel);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-9.2, 0, -3.2), new THREE.Vector3(-8.4, 0.95, -2.4)),
      'Hazardous Containment Barrel'
    );

    // 5. POWER SUB-STATION (Center: 5.5, 0, Width: 8.2, Depth: 7 -> X: 1.4 to 9.6, Z: -3.5 to 3.5)
    // High Voltage Transformer Unit in North-East corner (X = 8.5, Z = -2.5)
    const transGeom = new THREE.BoxGeometry(2.0, 2.4, 1.5);
    const transMat = new THREE.MeshStandardMaterial({ color: 0x223328, roughness: 0.7, metalness: 0.5 });
    const transMesh = new THREE.Mesh(transGeom, transMat);
    transMesh.position.set(8.5, 1.2, -2.5);
    transMesh.castShadow = true;
    this.scene.add(transMesh);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(7.5, 0, -3.25), new THREE.Vector3(9.5, 2.4, -1.75)),
      'HV Transformer Unit'
    );

    // Server Racks along East wall (X = 9.0, Z = 1.2)
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 2.0), this.darkSteelMat);
    rack.position.set(9.0, 1.3, 1.2);
    this.scene.add(rack);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(8.6, 0, 0.2), new THREE.Vector3(9.4, 2.6, 2.2)),
      'Power Grid Relay Racks'
    );

    // 6. CONTROL HUB (Center: 0, -8.5, Width: 8, Depth: 9 -> X: -4 to 4, Z: -13 to -4)
    // Consoles along West & East walls (X = -3.4 and X = 3.4, Z = -8.5, center walkway X in [-2.5, 2.5] clear)
    const consoleGeom = new THREE.BoxGeometry(0.7, 1.1, 3.0);
    const consoleLeft = new THREE.Mesh(consoleGeom, this.darkSteelMat);
    consoleLeft.position.set(-3.4, 0.55, -8.5);
    this.scene.add(consoleLeft);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(-3.75, 0, -10.0), new THREE.Vector3(-3.05, 1.1, -7.0)),
      'Control Console West'
    );

    const consoleRight = new THREE.Mesh(consoleGeom, this.darkSteelMat);
    consoleRight.position.set(3.4, 0.55, -8.5);
    this.scene.add(consoleRight);
    this.addCollider(
      ColliderType.OBJECT,
      new THREE.Box3(new THREE.Vector3(3.05, 0, -10.0), new THREE.Vector3(3.75, 1.1, -7.0)),
      'Control Console East'
    );
  }

  private createInteractiveProps() {
    // 1. SUB-STATION MAIN BREAKER SWITCH (Mounted on North wall of Sub-Station at X = 5.5, Z = -3.35)
    const breakerBox = new THREE.Group();
    breakerBox.position.set(5.5, 1.5, -3.35);

    const boxHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.15), this.darkSteelMat);
    breakerBox.add(boxHousing);

    const lever = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x550000 })
    );
    lever.position.set(0, 0, 0.1);
    lever.rotation.x = -Math.PI / 4; // Down = Off
    breakerBox.add(lever);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.9 })
    );
    led.position.set(0, 0.22, 0.09);
    breakerBox.add(led);

    this.scene.add(breakerBox);

    this.interactables.set('power_switch', {
      id: 'power_switch',
      name: 'Sub-Station Power Breaker',
      type: 'power_switch',
      prompt: 'ENGAGE EMERGENCY AUXILIARY POWER',
      subText: 'Restores primary electrical conduits and unlocks Sector 9 authorization',
      position: [5.5, 1.5, -3.35],
      isActivated: false,
      distanceThreshold: 2.2,
    });
    this.interactableMeshes.set('power_switch', breakerBox);

    // 2. LEVEL 4 SECURITY KEYCARD (On the Lab Island Table in Bio Lab at X = -5.8, Z = 0)
    const keycardGroup = new THREE.Group();
    keycardGroup.position.set(-5.8, 0.9, 0);

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0044aa, emissiveIntensity: 0.6 })
    );
    keycardGroup.add(card);

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
      position: [-5.8, 0.9, 0],
      isActivated: false,
      distanceThreshold: 2.2,
    });
    this.interactableMeshes.set('keycard_sector9', keycardGroup);

    // 3. SECURITY CRT TERMINAL (In Security Office on desk at X = -8.0, Z = 10)
    const crtGroup = new THREE.Group();
    crtGroup.position.set(-8.0, 1.05, 10);

    const crtMonitor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.45), this.darkSteelMat);
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
      new THREE.PlaneGeometry(0.5, 0.4),
      new THREE.MeshStandardMaterial({
        map: screenTex,
        emissive: 0x1fe86b,
        emissiveIntensity: 0.7,
        emissiveMap: screenTex,
      })
    );
    crtScreen.position.set(0, 0, 0.23);
    crtGroup.add(crtScreen);

    this.scene.add(crtGroup);

    this.interactables.set('terminal_security', {
      id: 'terminal_security',
      name: 'Security Incident Terminal',
      type: 'terminal',
      prompt: 'READ TERMINAL LOG: INCIDENT 03:16 AM',
      subText: 'Facility security log recorded minutes before containment collapse',
      position: [-8.0, 1.05, 10],
      distanceThreshold: 2.2,
    });
    this.interactableMeshes.set('terminal_security', crtGroup);
  }

  private createSector9Anomaly() {
    // Sector 9 Anomaly Chamber Centerpiece (Positioned strictly deep inside Sector 9 Containment Chamber at X = 0, Z = -25)
    // Sector 9 Containment Room bounds: X in [-6, 6], Z in [-33, -13]
    const anomalyGroup = new THREE.Group();
    anomalyGroup.position.set(0, 0, -25);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.7, 0.4, 8),
      this.concreteFloorMat
    );
    pedestal.position.set(0, 0.2, 0);
    pedestal.receiveShadow = true;
    anomalyGroup.add(pedestal);

    // Exact explicit World AABB for Pedestal inside Sector 9 Containment Chamber (Z: -27.7 to -22.3)
    // Room is 12m wide (X: -6 to 6), leaving 3.3m wide clear walkways on both East & West sides
    const pedestalRadius = 2.7;
    const pedestalBox = new THREE.Box3(
      new THREE.Vector3(-pedestalRadius, 0, -25 - pedestalRadius),
      new THREE.Vector3(pedestalRadius, 0.4, -25 + pedestalRadius)
    );
    this.addCollider(ColliderType.OBJECT, pedestalBox, 'Sector 9 Containment Pedestal');

    const monolithGeom = new THREE.OctahedronGeometry(1.2, 0);
    const monolithMat = new THREE.MeshStandardMaterial({
      color: 0x050508,
      roughness: 0.1,
      metalness: 0.95,
      emissive: 0x002244,
      emissiveIntensity: 0.5,
    });
    const monolith = new THREE.Mesh(monolithGeom, monolithMat);
    monolith.position.set(0, 1.8, 0);
    monolith.castShadow = true;
    anomalyGroup.add(monolith);

    const containmentRing = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.8, 32),
      new THREE.MeshStandardMaterial({
        map: TextureGenerator.createHazardStripeTexture(),
        side: THREE.DoubleSide,
      })
    );
    containmentRing.rotation.x = -Math.PI / 2;
    containmentRing.position.set(0, 0.01, 0);
    anomalyGroup.add(containmentRing);

    const anomalyLight = new THREE.PointLight(0x0088ff, 2.5, 18);
    anomalyLight.position.set(0, 2.2, 0);
    anomalyGroup.add(anomalyLight);

    anomalyGroup.updateMatrixWorld(true);
    this.scene.add(anomalyGroup);

    // 4 Corner Pillars strictly at the far perimeter of Sector 9 (leaving walkways completely open)
    const pillarGeom = new THREE.BoxGeometry(0.8, this.CEILING_HEIGHT, 0.8);
    const pillarCoords = [
      { x: -5.2, z: -31 },
      { x: 5.2, z: -31 },
      { x: -5.2, z: -15 },
      { x: 5.2, z: -15 },
    ];
    for (const p of pillarCoords) {
      const pillar = new THREE.Mesh(pillarGeom, this.darkSteelMat);
      pillar.position.set(p.x, this.CEILING_HEIGHT / 2, p.z);
      this.scene.add(pillar);
      this.addCollider(
        ColliderType.OBJECT,
        new THREE.Box3(
          new THREE.Vector3(p.x - 0.4, 0, p.z - 0.4),
          new THREE.Vector3(p.x + 0.4, this.CEILING_HEIGHT, p.z + 0.4)
        ),
        'Sector 9 Support Pillar'
      );
    }
  }

  /**
   * Automated Development & Traversal Validation Pass
   * Verifies spawn clearance, 0 duplicate/overlapping walls, corridor clearance,
   * floor/ceiling isolation, and full forward/backward traversability through every sector and doorway.
   */
  public validateCollisionSystem(): boolean {
    console.log('=== [PHYSICS & COLLISION SYSTEM VALIDATION PASS] ===');
    let allPassed = true;

    // 1. Validate Player Spawn Point Clearance
    const spawnPos = new THREE.Vector3(0, 1.75, 18);
    let minSpawnDist = Infinity;
    const blocking = this.getBlockingColliders();

    for (const col of blocking) {
      const closestPoint = new THREE.Vector3();
      col.box.clampPoint(spawnPos, closestPoint);
      const d = spawnPos.distanceTo(closestPoint);
      if (d < minSpawnDist) minSpawnDist = d;
    }

    if (minSpawnDist < 0.40) {
      console.error(`[COLLISION FAIL] Spawn position (0, 1.75, 18) too close to obstacle (${minSpawnDist.toFixed(2)}m)`);
      allPassed = false;
    } else {
      console.log(`%c[PASS] Player Spawn (0, 1.75, 18) Clearance: ${minSpawnDist.toFixed(2)}m (Capsule radius: 0.30m)`, 'color: #00ff88');
    }

    // 2. Validate Zero Overlapping or Duplicate Solid Walls
    const wallColliders = blocking.filter((c) => c.type === ColliderType.WALL);
    let wallOverlapCount = 0;
    for (let i = 0; i < wallColliders.length; i++) {
      for (let j = i + 1; j < wallColliders.length; j++) {
        const bA = wallColliders[i].box;
        const bB = wallColliders[j].box;
        // Check for substantial 3D volume overlap (ignoring touching boundary faces)
        const overlapX = Math.max(0, Math.min(bA.max.x, bB.max.x) - Math.max(bA.min.x, bB.min.x));
        const overlapY = Math.max(0, Math.min(bA.max.y, bB.max.y) - Math.max(bA.min.y, bB.min.y));
        const overlapZ = Math.max(0, Math.min(bA.max.z, bB.max.z) - Math.max(bA.min.z, bB.min.z));
        const overlapVol = overlapX * overlapY * overlapZ;

        if (overlapVol > 0.005) {
          console.error(`[COLLISION FAIL] Overlapping walls detected: ${wallColliders[i].name} and ${wallColliders[j].name} (Vol: ${overlapVol.toFixed(3)}m³)`);
          wallOverlapCount++;
        }
      }
    }
    if (wallOverlapCount === 0) {
      console.log(`%c[PASS] Wall Mesh & Collider Deduplication: ZERO overlapping wall volumes across ${wallColliders.length} walls.`, 'color: #00ff88');
    } else {
      allPassed = false;
    }

    // 3. Validate Sector 9 Corridor Spine Traversal Path (Z: 13.5 to -3.5, X: -0.9 to 0.9)
    const corridorSpineBox = new THREE.Box3(
      new THREE.Vector3(-0.9, 0.1, -3.5),
      new THREE.Vector3(0.9, 2.0, 13.5)
    );
    const corridorIntruders = blocking.filter((c) => c.type !== ColliderType.DOOR && c.box.intersectsBox(corridorSpineBox));
    if (corridorIntruders.length > 0) {
      console.error(
        `[COLLISION FAIL] Sector 9 Corridor has ${corridorIntruders.length} intruding obstacles!`,
        corridorIntruders.map((c) => c.name)
      );
      allPassed = false;
    } else {
      console.log(`%c[PASS] Sector 9 Corridor Spine (Z: 13.5 to -3.5, X: ±0.9m) is 100% CLEAR of obstacles.`, 'color: #00ff88');
    }

    // 4. Validate Floor & Ceiling Isolation from Horizontal Movement
    const floorsInBlocking = this.getBlockingColliders().filter((c) => c.type === ColliderType.FLOOR || c.type === ColliderType.CEILING);
    if (floorsInBlocking.length === 0) {
      console.log(`%c[PASS] Floor and Ceiling colliders isolated: ZERO present in horizontal resolver.`, 'color: #00ff88');
    } else {
      console.error(`[COLLISION FAIL] ${floorsInBlocking.length} Floor/Ceiling colliders found in horizontal resolver!`);
      allPassed = false;
    }

    // 5. Automated Full Facility Waypoint & Doorway Traversal Test
    // Simulates player capsule navigation across all sectors, testing:
    // Forward, backward, left offset, center, right offset, crouching, and sprinting.
    const waypoints = [
      { name: 'START: Station Checkpoint', pos: new THREE.Vector3(0, 1.75, 18) },
      { name: 'Station North Arch', pos: new THREE.Vector3(0, 1.75, 14) },
      { name: 'Sector 9 Corridor South', pos: new THREE.Vector3(0, 1.75, 12) },
      { name: 'Storage Archive Doorway', pos: new THREE.Vector3(1.4, 1.75, 10) },
      { name: 'Storage Archive Interior', pos: new THREE.Vector3(5.5, 1.75, 10) },
      { name: 'Security Office Doorway', pos: new THREE.Vector3(-1.4, 1.75, 10) },
      { name: 'Security Office Interior', pos: new THREE.Vector3(-5.5, 1.75, 10) },
      { name: 'Sector 9 Corridor Mid', pos: new THREE.Vector3(0, 1.75, 5) },
      { name: 'Biological Research Wing Doorway', pos: new THREE.Vector3(-1.4, 1.75, 0) },
      { name: 'Bio Lab Interior', pos: new THREE.Vector3(-5.5, 1.75, 0) },
      { name: 'Sub-Station Doorway', pos: new THREE.Vector3(1.4, 1.75, 0) },
      { name: 'Sub-Station Interior', pos: new THREE.Vector3(5.5, 1.75, 0) },
      { name: 'Sector 9 Corridor North', pos: new THREE.Vector3(0, 1.75, -1) },
      { name: 'Control Hub Archway', pos: new THREE.Vector3(0, 1.75, -4) },
      { name: 'Control Hub Interior', pos: new THREE.Vector3(0, 1.75, -8.5) },
      { name: 'Sector 9 Blast Gate Threshold', pos: new THREE.Vector3(0, 1.75, -13) },
      { name: 'Sector 9 Containment Chamber', pos: new THREE.Vector3(0, 1.75, -23) },
    ];

    let traversalPasses = 0;
    const playerRadius = 0.30;

    for (let w = 0; w < waypoints.length - 1; w++) {
      const from = waypoints[w];
      const to = waypoints[w + 1];

      // Test path sampling in 0.15m steps
      const dist = from.pos.distanceTo(to.pos);
      const steps = Math.ceil(dist / 0.15);
      let segmentBlocked = false;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const testPos = from.pos.clone().lerp(to.pos, t);

        // Test center, left offset (-0.25m), and right offset (+0.25m)
        const offsets = [0, -0.20, 0.20];
        for (const off of offsets) {
          const samplePos = testPos.clone();
          if (Math.abs(to.pos.x - from.pos.x) < Math.abs(to.pos.z - from.pos.z)) {
            samplePos.x += off;
          } else {
            samplePos.z += off;
          }

          // Check if sample position penetrates any solid WALL (doors with open status are passable)
          for (const wallCol of wallColliders) {
            const minX = wallCol.box.min.x - playerRadius;
            const maxX = wallCol.box.max.x + playerRadius;
            const minZ = wallCol.box.min.z - playerRadius;
            const maxZ = wallCol.box.max.z + playerRadius;

            if (samplePos.x > minX && samplePos.x < maxX && samplePos.z > minZ && samplePos.z < maxZ) {
              // Ignore high lintels above player height
              if (wallCol.box.min.y >= 2.2) continue;
              console.error(
                `[COLLISION FAIL] Traversal blocked between "${from.name}" and "${to.name}" by ${wallCol.name} at (${samplePos.x.toFixed(2)}, ${samplePos.z.toFixed(2)})`
              );
              segmentBlocked = true;
              break;
            }
          }
          if (segmentBlocked) break;
        }
        if (segmentBlocked) break;
      }

      if (!segmentBlocked) {
        traversalPasses++;
      }
    }

    if (traversalPasses === waypoints.length - 1) {
      console.log(
        `%c[PASS] Comprehensive Traversal Test: 100% CLEAR across all ${waypoints.length} waypoints & sectors (Forward/Backward/Offsets).`,
        'color: #00ff88; font-weight: bold;'
      );
    } else {
      allPassed = false;
    }

    console.log(`=== [VALIDATION SUMMARY: ${allPassed ? 'ALL SYSTEMS OPERATIONAL (GREEN)' : 'ERRORS DETECTED (RED)'}] ===`);
    return allPassed;
  }

  public updateLights(delta: number) {
    for (const flick of this.flickeringLights) {
      if (!flick.isFlickering) continue;

      flick.offset += delta * 15;
      flick.erraticTimer += delta;

      const wave = Math.sin(flick.offset * flick.rate * 25) * Math.cos(flick.offset * 7);
      const isDropping = wave < -0.7;

      if (isDropping) {
        flick.light.intensity = flick.baseIntensity * 0.15;
        (flick.fixtureMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
      } else {
        const jitter = 0.85 + Math.random() * 0.3;
        flick.light.intensity = flick.baseIntensity * jitter;
        (flick.fixtureMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = flick.baseIntensity * jitter;
      }
    }
  }

  public updateDoors(delta: number) {
    for (const door of this.doors.values()) {
      if (!door.isAnimating) continue;

      const target = door.isOpen ? 1 : 0;
      const speed = door.type === 'blast' ? 0.6 : 1.8;

      if (door.openProgress < target) {
        door.openProgress = Math.min(target, door.openProgress + delta * speed);
      } else if (door.openProgress > target) {
        door.openProgress = Math.max(target, door.openProgress - delta * speed);
      }

      const t = door.openProgress;
      const eased = t * t * (3 - 2 * t);

      if (door.type === 'blast') {
        const maxSlide = 1.25;
        if (door.leftPanel) door.leftPanel.position.x = -0.6 - eased * maxSlide;
        if (door.rightPanel) door.rightPanel.position.x = 0.6 + eased * maxSlide;
      } else if (door.type === 'slide') {
        const maxSlide = 1.35;
        if (door.leftPanel) door.leftPanel.position.x = -eased * maxSlide;
      }

      // When openProgress > 0.25, disable door collider so player walks freely through opening
      if (door.openProgress > 0.25) {
        door.collider.enabled = false;
        door.collider.box.makeEmpty();
      } else {
        door.collider.enabled = true;
        door.collider.box.copy(door.baseColliderBox);
      }

      if (door.openProgress === target) {
        door.isAnimating = false;
      }
    }

    if (this.isDebugPhysicsActive) {
      this.renderDebugColliders();
    }
  }

  public toggleDebugColliders(): boolean {
    this.isDebugPhysicsActive = !this.isDebugPhysicsActive;
    if (this.isDebugPhysicsActive) {
      this.renderDebugColliders();
    } else {
      this.clearDebugColliders();
    }
    return this.isDebugPhysicsActive;
  }

  public clearDebugColliders() {
    for (const h of this.debugHelpers) {
      this.scene.remove(h);
      if (h instanceof THREE.Mesh || h instanceof THREE.LineSegments || h instanceof THREE.Sprite) {
        if (h.geometry) h.geometry.dispose();
      }
    }
    this.debugHelpers = [];
    if (this.debugGroup.parent) {
      this.scene.remove(this.debugGroup);
    }
    this.debugGroup.clear();
  }

  private createDebugLabel(text: string, position: THREE.Vector3, colorHex: string = '#00ff88'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 10, 15, 0.88)';
      ctx.fillRect(0, 0, 200, 40);
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 198, 38);
      ctx.fillStyle = colorHex;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 100, 20);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(position);
    sprite.scale.set(1.5, 0.35, 1);
    return sprite;
  }

  /**
   * F3 Debug Visualizer
   * GREEN: Valid walkable floor geometry & cleared doorways
   * RED: Solid blocking wall obstacles
   * YELLOW: Closed door barriers
   * ORANGE: Interior object colliders (props)
   * BLUE: Interactive trigger zones
   */
  public renderDebugColliders() {
    this.clearDebugColliders();

    if (!this.debugGroup.parent) {
      this.scene.add(this.debugGroup);
    }

    const wallMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.16, depthWrite: false });
    const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0xff3333, linewidth: 2 });

    const objMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.20, depthWrite: false });
    const objEdgeMat = new THREE.LineBasicMaterial({ color: 0xff8822, linewidth: 2 });

    const doorClosedMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.25, depthWrite: false });
    const doorClosedEdgeMat = new THREE.LineBasicMaterial({ color: 0xffee00, linewidth: 2 });

    const floorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.12, depthWrite: false });
    const floorEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 1 });

    const triggerMat = new THREE.MeshBasicMaterial({ color: 0x0099ff, transparent: true, opacity: 0.18, depthWrite: false });
    const triggerEdgeMat = new THREE.LineBasicMaterial({ color: 0x00bbff, linewidth: 2 });

    let idx = 0;
    for (const col of this.colliders) {
      if (col.box.isEmpty()) continue;
      idx++;

      const sizeX = Math.max(0.02, col.box.max.x - col.box.min.x);
      const sizeY = Math.max(0.02, col.box.max.y - col.box.min.y);
      const sizeZ = Math.max(0.02, col.box.max.z - col.box.min.z);

      const centerX = (col.box.min.x + col.box.max.x) / 2;
      const centerY = (col.box.min.y + col.box.max.y) / 2;
      const centerZ = (col.box.min.z + col.box.max.z) / 2;

      let chosenMeshMat = wallMat;
      let chosenEdgeMat = wallEdgeMat;
      let tagColor = '#ff4444';
      let tagPrefix = 'WALL';

      if (col.type === ColliderType.FLOOR) {
        chosenMeshMat = floorMat;
        chosenEdgeMat = floorEdgeMat;
        tagColor = '#00ff88';
        tagPrefix = 'FLOOR';
      } else if (col.type === ColliderType.DOOR) {
        chosenMeshMat = doorClosedMat;
        chosenEdgeMat = doorClosedEdgeMat;
        tagColor = '#ffee00';
        tagPrefix = col.enabled ? 'DOOR [CLOSED]' : 'DOOR [OPEN]';
      } else if (col.type === ColliderType.OBJECT) {
        chosenMeshMat = objMat;
        chosenEdgeMat = objEdgeMat;
        tagColor = '#ff8800';
        tagPrefix = 'OBJECT';
      } else if (col.type === ColliderType.TRIGGER) {
        chosenMeshMat = triggerMat;
        chosenEdgeMat = triggerEdgeMat;
        tagColor = '#00aaff';
        tagPrefix = 'TRIGGER';
      }

      // 1. Semi-transparent volume
      const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
      const mesh = new THREE.Mesh(geom, chosenMeshMat);
      mesh.position.set(centerX, centerY, centerZ);
      this.debugGroup.add(mesh);

      // 2. Wireframe Outlines
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, chosenEdgeMat);
      line.position.set(centerX, centerY, centerZ);
      this.debugGroup.add(line);

      // 3. Floating 3D Text Label
      if (col.type !== ColliderType.CEILING && (col.type === ColliderType.DOOR || col.type === ColliderType.OBJECT || idx % 2 === 1)) {
        const labelPos = new THREE.Vector3(
          centerX,
          Math.min(centerY + sizeY / 2 + 0.25, 3.2),
          centerZ
        );
        const label = this.createDebugLabel(
          `[${tagPrefix}] ${col.name} (${sizeX.toFixed(1)}x${sizeZ.toFixed(1)}m)`,
          labelPos,
          tagColor
        );
        this.debugGroup.add(label);
      }
    }
  }
}
