/**
 * 1980s Backrooms Multi-Level World & Chunk Streaming Generator
 * Level 1: "The Yellow Sector" (Infinite Mustard Wallpaper Maze)
 * Level 2: "The Subterranean Complex" (Infinite Parking Garage with Procedural 1980s Cars & Directional Signage)
 */

export class LevelBuilder {
  constructor(scene, lightManager, shiftingSpace) {
    this.scene = scene;
    this.lightManager = lightManager;
    this.shiftingSpace = shiftingSpace;

    this.currentLevel = 1; // 1 = Level 1 Yellow Sector, 2 = Level 2 Parking Garage
    this.CHUNK_SIZE = 24.0;
    this.STREAM_RADIUS = 2; // 5x5 chunk active grid around player (120m x 120m)
    this.UNLOAD_RADIUS = 3; // Distance > 3 unloads distant chunks

    this.activeChunks = new Map(); // Key: `${cx}_${cz}` -> Chunk data
    this.colliders = []; // Global bounding boxes for collision
    this.spatialGrid = new Map(); // Spatial partition for O(1) collision lookups
    this.interactiveObjects = []; // Interactive items/triggers
    this.floodedZones = []; // Zones that trigger wet footstep audio

    this.materials = this.createTexturesAndMaterials();
    this.carModelsCache = new Map();
    this.gasCanModel = null;
    this.crowbarModel = null;
    this.highwayRoadModel = null;
    this.cityMapModel = null;
    this.initCarAssets();
    this.initGasCanAsset();
    this.initCrowbarAsset();
    this.initHighwayRoadAsset();
    this.initCityInfrastructureMapAsset();
    this.lastPlayerCX = null;
    this.lastPlayerCZ = null;
  }

  initGasCanAsset() {
    if (typeof THREE.ColladaLoader !== 'undefined') {
      const colladaLoader = new THREE.ColladaLoader();
      const texLoader = new THREE.TextureLoader();
      
      const albedoTex = texLoader.load('./assets/models/gas_can/textures/DefaultMaterial_albedo.jpeg');
      const normalTex = texLoader.load('./assets/models/gas_can/textures/DefaultMaterial_normal.png');
      const roughTex = texLoader.load('./assets/models/gas_can/textures/DefaultMaterial_roughness.jpeg');

      colladaLoader.load('./assets/models/gas_can/source/model/model.dae', (collada) => {
        const dae = collada.scene;
        // Scaled to realistic portable metal jerrycan dimensions (~0.45m height)
        dae.scale.set(0.0013, 0.0013, 0.0013);
        dae.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
              map: albedoTex,
              normalMap: normalTex,
              roughnessMap: roughTex,
              roughness: 0.6,
              metalness: 0.2
            });
          }
        });
        this.gasCanModel = dae;
      }, undefined, (err) => {
        console.warn("Could not load gas can collada model:", err);
      });
    }
  }

  initCrowbarAsset() {
    if (typeof THREE.FBXLoader === 'undefined') return;
    const fbxLoader = new THREE.FBXLoader();
    const texLoader = new THREE.TextureLoader();

    const baseColor = texLoader.load('./assets/models/crowbar/source/CrowBar/Texture/CrowBar_ModelMaya_BaseColor.jpg');
    const normalTex = texLoader.load('./assets/models/crowbar/source/CrowBar/Texture/CrowBar_ModelMaya_Normal.jpg');
    const roughTex  = texLoader.load('./assets/models/crowbar/source/CrowBar/Texture/CrowBar_ModelMaya_Roughness.jpg');
    const metalTex  = texLoader.load('./assets/models/crowbar/source/CrowBar/Texture/CrowBar_ModelMaya_Metallic.jpg');

    fbxLoader.load('./assets/models/crowbar/source/CrowBar/CrowBar.fbx', (fbx) => {
      fbx.scale.set(0.009, 0.009, 0.009);
      fbx.rotation.z = Math.PI / 2;
      fbx.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            map: baseColor,
            normalMap: normalTex,
            roughnessMap: roughTex,
            metalnessMap: metalTex,
            roughness: 0.5,
            metalness: 0.85
          });
        }
      });
      console.log('[CrowBar] FBX loaded successfully');
      this.crowbarModel = fbx;
    }, undefined, (err) => {
      console.warn('[CrowBar] Failed to load FBX:', err);
    });
  }

  initHighwayRoadAsset() {
    if (typeof THREE.OBJLoader === 'undefined') return;
    const objLoader = new THREE.OBJLoader();
    const texLoader = new THREE.TextureLoader();

    const baseColor = texLoader.load('./assets/models/highway_road/Scene_-_Root_baseColor.jpg');
    const normalTex = texLoader.load('./assets/models/highway_road/Scene_-_Root_normal_norm.jpg');
    const roughTex  = texLoader.load('./assets/models/highway_road/Scene_-_Root_metallicRoughness_rough.jpg');
    const metalTex  = texLoader.load('./assets/models/highway_road/Scene_-_Root_metallicRoughness_metal.jpg');

    baseColor.wrapS = THREE.RepeatWrapping;
    baseColor.wrapT = THREE.RepeatWrapping;

    objLoader.load('./assets/models/highway_road/highway_road.obj', (obj) => {
      // Scaled to real-world highway proportion relative to player (3.8m lane width)
      obj.scale.set(0.035, 0.035, 0.035);
      obj.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = new THREE.MeshStandardMaterial({
            map: baseColor,
            normalMap: normalTex,
            roughnessMap: roughTex,
            metalnessMap: metalTex,
            roughness: 0.85,
            metalness: 0.15
          });
        }
      });
      console.log('[Highway_Road] OBJ loaded successfully');
      this.highwayRoadModel = obj;
    }, undefined, (err) => {
      console.warn('[Highway_Road] Failed to load OBJ:', err);
    });
  }

  initCityInfrastructureMapAsset() {
    if (typeof THREE.OBJLoader === 'undefined' || typeof THREE.MTLLoader === 'undefined') return;
    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath('./assets/models/city_infrastructure/');
    mtlLoader.load('city_map.mtl', (materials) => {
      materials.preload();
      const objLoader = new THREE.OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath('./assets/models/city_infrastructure/');
      objLoader.load('city_map.obj', (obj) => {
        // Scaled to real-world highway proportion relative to player (3.8m lane width)
        obj.scale.set(0.035, 0.035, 0.035);
        obj.position.set(0, 0, 0);
        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        console.log('[CityInfrastructureMap] 3D Map Loaded successfully');
        this.cityMapModel = obj;
        if (this.currentLevel === 3 && !this.scene.children.includes(this.cityMapModel)) {
          this.scene.add(this.cityMapModel);
        }
      }, undefined, (err) => {
        console.warn('[CityInfrastructureMap] Error loading OBJ:', err);
      });
    }, undefined, (err) => {
      console.warn('[CityInfrastructureMap] Error loading MTL:', err);
    });
  }

  initCarAssets() {
    if (typeof THREE.FBXLoader === 'undefined') return;
    const fbxLoader = new THREE.FBXLoader();
    const texLoader = new THREE.TextureLoader();

    // Car Texture Variations
    const textureFiles = [
      './assets/textures/cars/CompactCar_Texture_Black.png',
      './assets/textures/cars/CompactCar_Texture_Blue.png',
      './assets/textures/cars/CompactCar_Texture_Brown.png',
      './assets/textures/cars/CompactCar_Texture_Gray.png',
      './assets/textures/cars/CompactCar_Texture_Green.png',
      './assets/textures/cars/CompactCar_Texture_Muscle_Blue.png',
      './assets/textures/cars/CompactCar_Texture_Muscle_Orange.png',
      './assets/textures/cars/CompactCar_Texture_Muscle_Red.png',
      './assets/textures/cars/CompactCar_Texture_Orange.png',
      './assets/textures/cars/CompactCar_Texture_Police.png',
      './assets/textures/cars/CompactCar_Texture_Red.png',
      './assets/textures/cars/CompactCar_Texture_Taxi.png',
      './assets/textures/cars/CompactCar_Texture_White.png',
      './assets/textures/cars/CompactCar_Texture_Yellow.png'
    ];

    this.carTexturesCache = textureFiles.map(path => texLoader.load(path));

    // Car Model Types
    const carTypes = [
      { key: 'sedan', path: './assets/models/cars/FunCar_01.fbx' },
      { key: 'muscle', path: './assets/models/cars/FunCar_Muscle_01.fbx' },
      { key: 'police', path: './assets/models/cars/FunCar_Police_01.fbx' },
      { key: 'taxi', path: './assets/models/cars/FunCar_Taxi_01.fbx' }
    ];

    let loadedCount = 0;
    carTypes.forEach(({ key, path }) => {
      fbxLoader.load(path, (fbx) => {
        fbx.scale.set(0.011, 0.011, 0.011);
        this.carModelsCache.set(key, fbx);
        loadedCount++;
        // As soon as FBX cars load, re-stream Level 2 chunks so the menu pan populates with 3D cars
        if (this.currentLevel === 2 && loadedCount === 1) {
          this.activeChunks.forEach((chunk) => {
            chunk.meshes.forEach(m => this.scene.remove(m));
          });
          this.activeChunks.clear();
        }
      }, undefined, (err) => {
        console.warn(`Could not load car model ${path}:`, err);
      });
    });
  }

  createTexturesAndMaterials() {
    // 1. Procedural Yellow Damask / Grid Wallpaper Texture (Level 1)
    const wallpaperCanvas = document.createElement('canvas');
    wallpaperCanvas.width = 256;
    wallpaperCanvas.height = 256;
    const ctxW = wallpaperCanvas.getContext('2d');
    ctxW.fillStyle = '#c9b360';
    ctxW.fillRect(0, 0, 256, 256);

    // Subtle wallpaper diamond pattern & vertical seam lines
    ctxW.strokeStyle = '#b09d52';
    ctxW.lineWidth = 2;
    for (let x = 0; x < 256; x += 32) {
      for (let y = 0; y < 256; y += 32) {
        ctxW.strokeRect(x + 4, y + 4, 24, 24);
      }
    }
    // Age stains & moisture patches
    ctxW.fillStyle = 'rgba(120, 100, 40, 0.15)';
    ctxW.beginPath();
    ctxW.arc(180, 70, 40, 0, Math.PI * 2);
    ctxW.fill();
    ctxW.beginPath();
    ctxW.arc(60, 190, 50, 0, Math.PI * 2);
    ctxW.fill();

    const wallTex = new THREE.CanvasTexture(wallpaperCanvas);
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 1.5);

    // 2. Damp Carpet Texture (Level 1)
    const carpetCanvas = document.createElement('canvas');
    carpetCanvas.width = 256;
    carpetCanvas.height = 256;
    const ctxC = carpetCanvas.getContext('2d');
    ctxC.fillStyle = '#6e5f3a';
    ctxC.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      ctxC.fillStyle = Math.random() > 0.5 ? '#594d2e' : '#7d6d43';
      ctxC.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const carpetTex = new THREE.CanvasTexture(carpetCanvas);
    carpetTex.wrapS = THREE.RepeatWrapping;
    carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(4, 4);

    // 3. Acoustic Ceiling Tile Texture (Level 1)
    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 256;
    ceilingCanvas.height = 256;
    const ctxCeil = ceilingCanvas.getContext('2d');
    ctxCeil.fillStyle = '#dcd5c0';
    ctxCeil.fillRect(0, 0, 256, 256);
    ctxCeil.strokeStyle = '#999280';
    ctxCeil.lineWidth = 3;
    ctxCeil.strokeRect(0, 0, 256, 256);
    ctxCeil.strokeRect(128, 0, 128, 256);
    ctxCeil.strokeRect(0, 128, 256, 128);
    const ceilingTex = new THREE.CanvasTexture(ceilingCanvas);
    ceilingTex.wrapS = THREE.RepeatWrapping;
    ceilingTex.wrapT = THREE.RepeatWrapping;
    ceilingTex.repeat.set(3, 3);

    // 4. Lab Concrete Tile Texture
    const labCanvas = document.createElement('canvas');
    labCanvas.width = 256;
    labCanvas.height = 256;
    const ctxL = labCanvas.getContext('2d');
    ctxL.fillStyle = '#3a4240';
    ctxL.fillRect(0, 0, 256, 256);
    ctxL.strokeStyle = '#222826';
    ctxL.lineWidth = 4;
    ctxL.strokeRect(0, 0, 256, 256);
    const labTex = new THREE.CanvasTexture(labCanvas);
    labTex.wrapS = THREE.RepeatWrapping;
    labTex.wrapT = THREE.RepeatWrapping;
    labTex.repeat.set(3, 3);

    // 5. Level 2 Stained Concrete & Parking Asphalt Texture
    const garageFloorCanvas = document.createElement('canvas');
    garageFloorCanvas.width = 512;
    garageFloorCanvas.height = 512;
    const ctxG = garageFloorCanvas.getContext('2d');
    ctxG.fillStyle = '#26292b';
    ctxG.fillRect(0, 0, 512, 512);
    // Concrete speckles & tire skid marks
    for (let i = 0; i < 6000; i++) {
      ctxG.fillStyle = Math.random() > 0.5 ? '#1c1e20' : '#323639';
      ctxG.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // Oil stains
    ctxG.fillStyle = 'rgba(10, 10, 10, 0.45)';
    ctxG.beginPath();
    ctxG.arc(140, 220, 50, 0, Math.PI * 2);
    ctxG.arc(380, 160, 65, 0, Math.PI * 2);
    ctxG.fill();

    // Yellow Parking Bay Line Markings
    ctxG.strokeStyle = '#d4b33b';
    ctxG.lineWidth = 10;
    ctxG.strokeRect(16, 16, 480, 480);
    ctxG.beginPath();
    ctxG.moveTo(256, 16);
    ctxG.lineTo(256, 496);
    ctxG.stroke();

    const garageFloorTex = new THREE.CanvasTexture(garageFloorCanvas);
    garageFloorTex.wrapS = THREE.RepeatWrapping;
    garageFloorTex.wrapT = THREE.RepeatWrapping;
    garageFloorTex.repeat.set(2, 2);

    // 6. Level 2 Rough Concrete Ceiling / Beams Texture
    const garageCeilCanvas = document.createElement('canvas');
    garageCeilCanvas.width = 256;
    garageCeilCanvas.height = 256;
    const ctxGC = garageCeilCanvas.getContext('2d');
    ctxGC.fillStyle = '#2d3133';
    ctxGC.fillRect(0, 0, 256, 256);
    ctxGC.strokeStyle = '#1d2021';
    ctxGC.lineWidth = 6;
    ctxGC.strokeRect(0, 0, 256, 256);
    ctxGC.strokeRect(64, 0, 128, 256);
    const garageCeilTex = new THREE.CanvasTexture(garageCeilCanvas);
    garageCeilTex.wrapS = THREE.RepeatWrapping;
    garageCeilTex.wrapT = THREE.RepeatWrapping;
    garageCeilTex.repeat.set(2, 2);

    // 7. Level 2 Concrete Pillar Texture with Hazard Striping
    const pillarCanvas = document.createElement('canvas');
    pillarCanvas.width = 256;
    pillarCanvas.height = 256;
    const ctxP = pillarCanvas.getContext('2d');
    ctxP.fillStyle = '#44494c';
    ctxP.fillRect(0, 0, 256, 256);
    // Yellow & Black hazard stripes at base
    ctxP.fillStyle = '#f0c020';
    ctxP.fillRect(0, 180, 256, 76);
    ctxP.fillStyle = '#111111';
    for (let x = -50; x < 350; x += 40) {
      ctxP.beginPath();
      ctxP.moveTo(x, 256);
      ctxP.lineTo(x + 24, 256);
      ctxP.lineTo(x + 50, 180);
      ctxP.lineTo(x + 26, 180);
      ctxP.fill();
    }
    const pillarTex = new THREE.CanvasTexture(pillarCanvas);

    // 8. 1980s Retro Car Paint Colors
    const carPaints = [
      new THREE.MeshPhongMaterial({ color: 0x732020, shininess: 40, specular: 0x555555 }), // Burgundy
      new THREE.MeshPhongMaterial({ color: 0x243a59, shininess: 40, specular: 0x555555 }), // Faded Navy
      new THREE.MeshPhongMaterial({ color: 0x75684a, shininess: 30, specular: 0x444444 }), // Mustard Beige
      new THREE.MeshPhongMaterial({ color: 0x2d4732, shininess: 35, specular: 0x444444 }), // Forest Green
      new THREE.MeshPhongMaterial({ color: 0x595c5e, shininess: 25, specular: 0x333333 }), // Primer Grey
      new THREE.MeshPhongMaterial({ color: 0x8a7238, shininess: 35, specular: 0x555555 })  // Ochre Gold
    ];

    return {
      wallpaper: new THREE.MeshPhongMaterial({ map: wallTex, shininess: 2, specular: 0x111111 }),
      carpet: new THREE.MeshPhongMaterial({ map: carpetTex, shininess: 1, specular: 0x080808 }),
      wetCarpet: new THREE.MeshPhongMaterial({ map: carpetTex, color: 0x3d3520, shininess: 16, specular: 0x333333 }),
      ceiling: new THREE.MeshPhongMaterial({ map: ceilingTex, shininess: 2, specular: 0x111111 }),
      labFloor: new THREE.MeshPhongMaterial({ map: labTex, shininess: 8, specular: 0x222222 }),
      labWall: new THREE.MeshPhongMaterial({ color: 0x485250, shininess: 4, specular: 0x111111 }),
      metal: new THREE.MeshPhongMaterial({ color: 0x555c58, shininess: 20, specular: 0x444444 }),
      steelDoor: new THREE.MeshPhongMaterial({ color: 0x333835, shininess: 15, specular: 0x333333 }),
      table: new THREE.MeshPhongMaterial({ color: 0x736348, shininess: 6, specular: 0x222222 }),
      tape: new THREE.MeshPhongMaterial({ color: 0x1f1f1f, shininess: 10 }),
      rope: new THREE.MeshPhongMaterial({ color: 0xc4a36e, shininess: 2 }),
      cautionTape: (() => {
        const cTex = new THREE.TextureLoader().load('./assets/textures/caution_tape.png');
        cTex.wrapS = THREE.RepeatWrapping;
        cTex.wrapT = THREE.RepeatWrapping;
        cTex.repeat.set(6, 1);
        return new THREE.MeshBasicMaterial({ map: cTex, side: THREE.DoubleSide, transparent: true });
      })(),
      waterSurface: new THREE.MeshPhongMaterial({ color: 0x47523d, transparent: true, opacity: 0.65, shininess: 40, specular: 0x667755 }),

      // Level 2 Specific Materials
      garageFloor: new THREE.MeshPhongMaterial({ map: garageFloorTex, shininess: 6, specular: 0x222222 }),
      garageCeiling: new THREE.MeshPhongMaterial({ map: garageCeilTex, shininess: 3, specular: 0x111111 }),
      garagePillar: new THREE.MeshPhongMaterial({ map: pillarTex, shininess: 4, specular: 0x222222 }),
      garagePipes: new THREE.MeshPhongMaterial({ color: 0x3d4447, shininess: 25, specular: 0x555555 }),
      carTire: new THREE.MeshPhongMaterial({ color: 0x141414, shininess: 5 }),
      carGlass: new THREE.MeshPhongMaterial({ color: 0x1a2428, shininess: 60, transparent: true, opacity: 0.85 }),
      carBumper: new THREE.MeshPhongMaterial({ color: 0x82888c, shininess: 50, specular: 0xaaaaaa }),
      carHeadlight: new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
      carTaillight: new THREE.MeshBasicMaterial({ color: 0xcc2211 }),
      exitSignGreen: new THREE.MeshBasicMaterial({ color: 0x22ee66 }),
      exitSignHousing: new THREE.MeshPhongMaterial({ color: 0x111612, shininess: 20 }),
      carPaints
    };
  }

  // Master build entry point for Level 1
  buildFullLevel() {
    this.currentLevel = 1;
    this.clearAllWorld();
    this.update(new THREE.Vector3(0, 1.65, 20), true);
  }

  // Switch to Level 2 (Parking Garage) or Level 3 (The Dark Highway)
  switchLevel(levelNumber, playerPos = new THREE.Vector3(0, 1.65, 0)) {
    this.currentLevel = levelNumber;
    this.clearAllWorld();

    if (levelNumber === 3) {
      if (this.cityMapModel && !this.scene.children.includes(this.cityMapModel)) {
        this.scene.add(this.cityMapModel);
      }
    } else {
      if (this.cityMapModel && this.scene.children.includes(this.cityMapModel)) {
        this.scene.remove(this.cityMapModel);
      }
    }

    this.update(playerPos, true);
  }

  clearAllWorld() {
    for (let [key] of this.activeChunks) {
      this.removeChunk(key);
    }
    this.activeChunks.clear();
    this.colliders.length = 0;
    this.spatialGrid.clear();
    this.interactiveObjects.length = 0;
    this.floodedZones.length = 0;
    this.lastPlayerCX = null;
    this.lastPlayerCZ = null;

    if (this.currentLevel !== 3 && this.cityMapModel) {
      this.scene.remove(this.cityMapModel);
    }
  }

  // --- DYNAMIC PROCEDURAL STREAMING UPDATE ---
  update(playerPos, force = false) {
    if (!playerPos) return;

    const currentCX = Math.round(playerPos.x / this.CHUNK_SIZE);
    const currentCZ = Math.round(playerPos.z / this.CHUNK_SIZE);

    if (!force && currentCX === this.lastPlayerCX && currentCZ === this.lastPlayerCZ) {
      return;
    }

    this.lastPlayerCX = currentCX;
    this.lastPlayerCZ = currentCZ;

    // 1. Generate active chunks in STREAM_RADIUS
    for (let dx = -this.STREAM_RADIUS; dx <= this.STREAM_RADIUS; dx++) {
      for (let dz = -this.STREAM_RADIUS; dz <= this.STREAM_RADIUS; dz++) {
        const cx = currentCX + dx;
        const cz = currentCZ + dz;
        const key = `${cx}_${cz}`;
        if (!this.activeChunks.has(key)) {
          if (this.currentLevel === 3) {
            this.generateHighwayChunk(cx, cz);
          } else if (this.currentLevel === 2) {
            this.generateParkingGarageChunk(cx, cz);
          } else {
            this.generateChunk(cx, cz);
          }
        }
      }
    }

    // 2. Unload chunks beyond UNLOAD_RADIUS (preserve origin lab chunks in Level 1)
    for (let [key, chunk] of this.activeChunks.entries()) {
      if (this.currentLevel === 1 && (key === '0_1' || key === '0_0')) continue;
      const dist = Math.max(Math.abs(chunk.cx - currentCX), Math.abs(chunk.cz - currentCZ));
      if (dist > this.UNLOAD_RADIUS) {
        this.removeChunk(key);
      }
    }
  }

  // =========================================================================
  // LEVEL 2: INFINITE PARKING GARAGE PROCEDURAL GENERATOR
  // =========================================================================
  generateParkingGarageChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    const centerX = cx * this.CHUNK_SIZE;
    const centerZ = cz * this.CHUNK_SIZE;
    const garageHeight = 2.8; // Low subterranean ceiling

    const chunkData = {
      key,
      cx,
      cz,
      meshes: [],
      colliders: [],
      lights: [],
      interactive: [],
      flooded: []
    };

    // Deterministic Seeded PRNG
    let seed = Math.abs(Math.sin(cx * 43.123 + cz * 91.713 + 543.21) * 75432.123);
    const prng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // 1. Concrete Floor & Ceiling ($24m \times 24m$)
    const floorGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 4, 4);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, this.materials.garageFloor);
    floorMesh.position.set(centerX, 0, centerZ);
    this.scene.add(floorMesh);
    chunkData.meshes.push(floorMesh);

    const ceilGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 4, 4);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMesh = new THREE.Mesh(ceilGeo, this.materials.garageCeiling);
    ceilMesh.position.set(centerX, garageHeight, centerZ);
    this.scene.add(ceilMesh);
    chunkData.meshes.push(ceilMesh);

    // 2. Heavy Square Concrete Pillars (4 pillars per chunk arranged at 8m grid)
    const pillarPositions = [
      [centerX - 6, centerZ - 6],
      [centerX + 6, centerZ - 6],
      [centerX - 6, centerZ + 6],
      [centerX + 6, centerZ + 6]
    ];

    pillarPositions.forEach(([px, pz]) => {
      const pillarGeo = new THREE.BoxGeometry(1.2, garageHeight, 1.2);
      const pillar = new THREE.Mesh(pillarGeo, this.materials.garagePillar);
      pillar.position.set(px, garageHeight / 2, pz);
      this.scene.add(pillar);
      chunkData.meshes.push(pillar);

      const box = new THREE.Box3().setFromObject(pillar);
      this.registerCollider(box);
      chunkData.colliders.push(box);
    });

    // 3. Overhead Drainage & Ventilation Pipes
    const pipeCount = 2;
    for (let i = 0; i < pipeCount; i++) {
      const isX = (i % 2 === 0);
      const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, this.CHUNK_SIZE, 8);
      if (isX) pipeGeo.rotateZ(Math.PI / 2);
      else pipeGeo.rotateX(Math.PI / 2);

      const pipeMesh = new THREE.Mesh(pipeGeo, this.materials.garagePipes);
      pipeMesh.position.set(
        isX ? centerX : centerX - 4 + i * 8,
        garageHeight - 0.25,
        isX ? centerZ - 4 + i * 8 : centerZ
      );
      this.scene.add(pipeMesh);
      chunkData.meshes.push(pipeMesh);
    }

    // 4. Procedural 1980s Cars & Guaranteed Landmark Objects
    if (cx === 0 && cz === 0) {
      // Guaranteed car right next to Level 2 spawn point with Dr. Evelyn Mercer Audio Cassette on hood
      const spawnCarX = centerX + 4.5;
      const spawnCarZ = centerZ - 2.5;
      this.createProceduralCar(
        chunkData,
        spawnCarX,
        spawnCarZ,
        -Math.PI / 2,
        'sedan',
        this.materials.carPaints[0], // Burgundy
        prng
      );

      // Cassette Tape clearly on the hood of the car
      this.createItemPickupToChunk(
        chunkData,
        spawnCarX - 1.2,
        0.95,
        spawnCarZ,
        'garage_mercer_tape',
        'Dr. Evelyn Mercer Expedition Log (Garage Sub-Level 02)'
      );

      // Interactive Car Body hitbox for starting the engine / driving cutscene
      const carHitboxGeo = new THREE.BoxGeometry(5.0, 1.8, 2.6);
      const carHitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const carHitboxMesh = new THREE.Mesh(carHitboxGeo, carHitboxMat);
      carHitboxMesh.position.set(spawnCarX, 0.9, spawnCarZ);
      this.scene.add(carHitboxMesh);
      chunkData.meshes.push(carHitboxMesh);

      const spawnCarInteractive = {
        mesh: carHitboxMesh,
        type: 'spawn_car_cutscene',
        name: 'Sedan Vehicle — [E] ENTER & START ENGINE',
        worldPos: new THREE.Vector3(spawnCarX, 0.9, spawnCarZ)
      };
      this.interactiveObjects.push(spawnCarInteractive);
      chunkData.interactive.push(spawnCarInteractive);
    } else if (cx === -1 && cz === -1) {
      // Landmark Gas Can placed beside an abandoned car and support pillar
      const canX = centerX - 4.2;
      const canZ = centerZ + 2.8;
      this.createItemPickupToChunk(
        chunkData,
        canX,
        0.05,
        canZ,
        'gas_can',
        'Emergency Fuel Canister [GAS CAN]'
      );
    } else if (cx === 1 && cz === -1) {
      // 1. Maintenance Tool Crate Table at (20.0, 0, -26.0)
      const crateGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a3622, roughness: 0.9 });
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(20.0, 0.4, -26.0);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
      chunkData.meshes.push(crate);

      // Crate solid collider
      const crateBox = new THREE.Box3().setFromObject(crate);
      this.registerCollider(crateBox);
      chunkData.colliders.push(crateBox);

      // 2. Dedicated Overhead Inspection Light pointing directly at the crate & crowbar
      const toolLight = new THREE.PointLight(0xffeedd, 3.5, 12);
      toolLight.position.set(20.0, 2.3, -26.0);
      this.scene.add(toolLight);
      chunkData.meshes.push(toolLight);

      // 3. Steel Crowbar placed directly on top of the crate (Y = 0.82)
      this.createItemPickupToChunk(
        chunkData,
        20.0,
        0.82,
        -26.0,
        'crow_bar',
        'Steel Crowbar'
      );
    } else if (cx === 1 && cz === 0) {
      // ESCAPE VEHICLE — a locked car the player can jimmy with the crowbar and fuel with gas
      const escCarX = centerX - 5.0;
      const escCarZ = centerZ + 2.0;
      this.createProceduralCar(
        chunkData,
        escCarX,
        escCarZ,
        Math.PI / 2,
        'muscle',
        this.materials.carPaints[2], // Dark colour
        prng
      );

      // Interactable locked door hitbox positioned at driver's door
      const doorGeo = new THREE.BoxGeometry(0.8, 1.4, 1.4);
      const doorMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.position.set(escCarX - 1.0, 0.7, escCarZ);
      this.scene.add(doorMesh);
      chunkData.meshes.push(doorMesh);

      const lockedCarObj = {
        mesh: doorMesh,
        type: 'locked_car',
        name: 'Locked Car Door — [Use Crowbar to Jimmy]',
        worldPos: new THREE.Vector3(escCarX - 1.0, 0.7, escCarZ),
        unlocked: false,
        fueled: false,
      };
      this.interactiveObjects.push(lockedCarObj);
      chunkData.interactive.push(lockedCarObj);
    }

    const carSlots = [
      { x: centerX - 6, z: centerZ, rot: 0 },
      { x: centerX + 6, z: centerZ, rot: Math.PI },
      { x: centerX, z: centerZ - 6, rot: Math.PI / 2 },
      { x: centerX, z: centerZ + 6, rot: -Math.PI / 2 }
    ];

    carSlots.forEach(slot => {
      if (cx === 0 && cz === 0 && Math.abs(slot.x - (centerX + 6)) < 2) return; // Don't overlap guaranteed spawn car
      if (prng() > 0.45) {
        const carTypeRoll = prng();
        const carType = carTypeRoll > 0.75 ? 'police' : (carTypeRoll > 0.5 ? 'taxi' : (carTypeRoll > 0.25 ? 'muscle' : 'sedan'));
        const colorIdx = Math.floor(prng() * this.materials.carPaints.length);
        const paintMat = this.materials.carPaints[colorIdx];
        const slightAngle = (prng() - 0.5) * 0.2; // Crooked parking

        this.createProceduralCar(
          chunkData,
          slot.x + (prng() - 0.5) * 0.8,
          slot.z + (prng() - 0.5) * 0.8,
          slot.rot + slightAngle,
          carType,
          paintMat,
          prng
        );
      }
    });

    // 5. Overhead Directional Signage ("EXIT ➔" leading in infinite paradoxical loops)
    if (prng() > 0.4) {
      const signX = centerX + (prng() > 0.5 ? 4.0 : -4.0);
      const signZ = centerZ + (prng() > 0.5 ? 4.0 : -4.0);
      const signRot = Math.floor(prng() * 4) * (Math.PI / 2);
      this.createOverheadExitSign(chunkData, signX, garageHeight - 0.4, signZ, signRot);
    }

    // 6. Fluorescent Ceiling Grid Fixtures
    const lightPositions = [
      [centerX - 6, centerZ],
      [centerX + 6, centerZ],
      [centerX, centerZ - 6],
      [centerX, centerZ + 6]
    ];
    lightPositions.forEach(([lx, lz]) => {
      const isFailing = prng() < 0.3;
      const l = this.lightManager.createFluorescentFixture(lx, garageHeight - 0.1, lz, {
        color: 0xe0e8d8, // Cold underground industrial tone
        intensity: isFailing ? 0.9 : 1.4,
        isFailing
      });
      chunkData.lights.push(l);
    });

    // 7. Supply Pickups (Batteries, Almond Water, Medkits scattered in stalls & on hoods)
    const garageItemRoll = prng();
    if (garageItemRoll > 0.35) {
      const dropCount = garageItemRoll > 0.75 ? 3 : (garageItemRoll > 0.55 ? 2 : 1);
      for (let i = 0; i < dropCount; i++) {
        const sx = centerX + (prng() - 0.5) * 18.0;
        const sz = centerZ + (prng() - 0.5) * 18.0;
        const roll = prng();
        const type = roll > 0.55 ? 'battery' : (roll > 0.25 ? 'almond_water' : 'medkit');
        const name = type === 'battery' ? 'Flashlight Alkaline Battery' : (type === 'almond_water' ? 'Unmarked Bottle ("Almond Water")' : 'Emergency First Aid Kit');
        this.createItemPickupToChunk(chunkData, sx, 0.05, sz, type, name);
      }
    }

    this.activeChunks.set(key, chunkData);
  }

  // --- 3D CAR MODEL INSTANTIATOR FROM ASSETS ---
  createProceduralCar(chunkData, x, z, rotationY, carType, paintMat, prng) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Pick Car Model Key
    let modelKey = 'sedan';
    if (carType === 'muscle' || carType === 'van') modelKey = 'muscle';
    else if (carType === 'police') modelKey = 'police';
    else if (carType === 'taxi') modelKey = 'taxi';

    const cachedFBX = this.carModelsCache.get(modelKey) || this.carModelsCache.get('sedan');
    let carMeshLoaded = false;

    if (cachedFBX) {
      const carClone = cachedFBX.clone();
      
      // Select appropriate vintage texture
      let carTex = null;
      if (this.carTexturesCache.length > 0) {
        if (modelKey === 'police') {
          carTex = this.carTexturesCache.find(t => t.image && t.image.src && t.image.src.includes('Police')) || this.carTexturesCache[9];
        } else if (modelKey === 'taxi') {
          carTex = this.carTexturesCache.find(t => t.image && t.image.src && t.image.src.includes('Taxi')) || this.carTexturesCache[11];
        } else {
          const randTexIdx = Math.floor(prng() * this.carTexturesCache.length);
          carTex = this.carTexturesCache[randTexIdx];
        }
      }

      carClone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (carTex) {
            child.material = new THREE.MeshPhongMaterial({ map: carTex, shininess: 25, specular: 0x444444 });
          } else {
            child.material = paintMat;
          }
        }
      });

      group.add(carClone);
      carMeshLoaded = true;
    }

    // High quality procedural geometry fallback if FBX is still parsing
    if (!carMeshLoaded) {
      const bodyLength = 4.2, bodyWidth = 1.8, bodyHeight = 0.65;
      const chassisGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
      const chassis = new THREE.Mesh(chassisGeo, paintMat);
      chassis.position.y = 0.35 + bodyHeight / 2;
      group.add(chassis);

      const cabinGeo = new THREE.BoxGeometry(bodyWidth * 0.9, 0.55, 2.2);
      const cabin = new THREE.Mesh(cabinGeo, paintMat);
      cabin.position.set(0, 0.35 + bodyHeight + 0.25, -0.2);
      group.add(cabin);

      const glassGeo = new THREE.BoxGeometry(bodyWidth * 0.92, 0.5, 2.1);
      const glass = new THREE.Mesh(glassGeo, this.materials.carGlass);
      glass.position.copy(cabin.position);
      group.add(glass);
    }

    this.scene.add(group);
    chunkData.meshes.push(group);

    // Solid Collider Box (2.0m width x 1.6m height x 4.6m length)
    const boxGeo = new THREE.BoxGeometry(1.9, 1.5, 4.4);
    const boxMesh = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    boxMesh.position.set(x, 0.75, z);
    boxMesh.rotation.y = rotationY;
    
    const box = new THREE.Box3().setFromObject(boxMesh);
    this.registerCollider(box);
    chunkData.colliders.push(box);

    return group;
  }

  // --- OVERHEAD EXIT SIGN ---
  createOverheadExitSign(chunkData, x, y, z, rotY) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // Housing box
    const houseGeo = new THREE.BoxGeometry(1.2, 0.5, 0.2);
    const housing = new THREE.Mesh(houseGeo, this.materials.exitSignHousing);
    group.add(housing);

    // Glowing Green Backlit Face ("EXIT ➔")
    const faceGeo = new THREE.PlaneGeometry(1.1, 0.4);
    const face = new THREE.Mesh(faceGeo, this.materials.exitSignGreen);
    face.position.z = 0.105;
    group.add(face);

    // Hanging chains
    const chainGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6);
    const chainL = new THREE.Mesh(chainGeo, this.materials.metal);
    this.scene.add(group);
    chunkData.meshes.push(group);
  }

  // =========================================================================
  // LEVEL 3: THE DARK HIGHWAY PROCEDURAL GENERATOR (Highway_Road.usdz)
  // =========================================================================
  generateHighwayChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    const centerX = cx * this.CHUNK_SIZE;
    const centerZ = cz * this.CHUNK_SIZE;

    const chunkData = {
      key,
      cx,
      cz,
      meshes: [],
      colliders: [],
      lights: [],
      interactive: []
    };

    const prng = this.createPRNG(cx * 1337 + cz * 7919 + 333);

    // 1. 3D Highway Road Surface (From Highway_Road.usdz model or PBR fallback)
    if (this.highwayRoadModel && Math.abs(cx) <= 1) {
      const roadClone = this.highwayRoadModel.clone();
      roadClone.position.set(centerX, 0, centerZ);
      this.scene.add(roadClone);
      chunkData.meshes.push(roadClone);
    } else {
      // Asphalt slab underlay
      const roadGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 4, 4);
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x14181a,
        roughness: 0.85,
        metalness: 0.1
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(centerX, 0, centerZ);
      roadMesh.receiveShadow = true;
      this.scene.add(roadMesh);
      chunkData.meshes.push(roadMesh);
    }

    // Roadside gravel/dirt terrain shoulders on sides
    if (cx === -1 || cx === 1) {
      const shoulderGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE);
      const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x0a100c, roughness: 0.95 });
      const shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(centerX, -0.02, centerZ);
      this.scene.add(shoulder);
      chunkData.meshes.push(shoulder);
    }

    // 2. Highway Metal Guardrails (at X = -10.5 and X = +10.5 along highway)
    if (cx === 0) {
      const railMat = new THREE.MeshStandardMaterial({ color: 0x5a666e, metalness: 0.8, roughness: 0.35 });
      
      [-10.5, 10.5].forEach(railX => {
        const railGeo = new THREE.BoxGeometry(0.25, 0.7, this.CHUNK_SIZE);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(railX, 0.45, centerZ);
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.scene.add(rail);
        chunkData.meshes.push(rail);

        // Solid collider for guardrails
        const box = new THREE.Box3().setFromObject(rail);
        this.registerCollider(box);
        chunkData.colliders.push(box);
      });
    }

    // 3. Telegraph / Utility Poles with crossbeams every 2 chunks
    if (cx === 0 && Math.abs(cz % 2) === 0) {
      const poleGroup = new THREE.Group();
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x241e17, roughness: 0.9 });
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 10, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(-12.5, 5.0, centerZ);
      poleGroup.add(pole);

      // Crossbar
      const barGeo = new THREE.BoxGeometry(2.4, 0.2, 0.2);
      const bar = new THREE.Mesh(barGeo, poleMat);
      bar.position.set(-12.5, 9.2, centerZ);
      poleGroup.add(bar);

      this.scene.add(poleGroup);
      chunkData.meshes.push(poleGroup);
    }

    // 4. Dark Pine Forest Silhouettes on outer edges
    if (cx <= -1 || cx >= 1) {
      const treeCount = 4 + Math.floor(prng() * 4);
      const treeMat = new THREE.MeshBasicMaterial({ color: 0x050a06 });
      for (let i = 0; i < treeCount; i++) {
        const tx = centerX + (prng() - 0.5) * 20;
        const tz = centerZ + (prng() - 0.5) * 20;
        const treeH = 10 + prng() * 8;
        const treeGeo = new THREE.ConeGeometry(3.5, treeH, 5);
        const tree = new THREE.Mesh(treeGeo, treeMat);
        tree.position.set(tx, treeH / 2, tz);
        this.scene.add(tree);
        chunkData.meshes.push(tree);
      }
    }

    // 5. Streetlights / Sodium Vapor Ambience
    if (cx === 0 && Math.abs(cz % 3) === 0) {
      const streetLight = this.lightManager.createFluorescentFixture(centerX + 9.5, 8.5, centerZ, {
        color: 0xffaa44, // Amber sodium-vapor highway tone
        intensity: 2.2,
        isFailing: prng() < 0.25
      });
      chunkData.lights.push(streetLight);
    }

    // 6. Landmark: Abandoned Highway Patrol Cruiser (cx: 0, cz: -3)
    if (cx === 0 && cz === -3) {
      const policeX = centerX - 6.5;
      const policeZ = centerZ;
      this.createProceduralCar(
        chunkData,
        policeX,
        policeZ,
        Math.PI / 6,
        'police',
        this.materials.carPaints[0],
        prng
      );

      // Flashing emergency roof strobe light
      const strobe = new THREE.PointLight(0xff2222, 3.5, 25);
      strobe.position.set(policeX, 1.8, policeZ);
      this.scene.add(strobe);
      chunkData.meshes.push(strobe);

      // Interactive Police Radio recording
      this.createItemPickupToChunk(
        chunkData,
        policeX + 0.8,
        0.95,
        policeZ,
        'police_radio_tape',
        'State Highway Patrol Dispatch Cassette (Unit 412)'
      );
    }

    // 7. Landmark: Highway Start Overhead Sign (cx: 0, cz: 0)
    else if (cx === 0 && cz === 0) {
      const signGroup = new THREE.Group();
      signGroup.position.set(0, 5.5, centerZ);

      // Big green highway sign
      const boardGeo = new THREE.BoxGeometry(8.0, 2.2, 0.25);
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x0d4722, roughness: 0.6 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      signGroup.add(board);

      // Gantry support legs
      const legGeo = new THREE.CylinderGeometry(0.18, 0.18, 6.0, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x4a555a, metalness: 0.8 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-4.2, -2.5, 0);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(4.2, -2.5, 0);
      signGroup.add(legL, legR);

      this.scene.add(signGroup);
      chunkData.meshes.push(signGroup);
    }

    // 8. Procedural Abandoned Cars along the Highway
    else if (cx === 0 && prng() > 0.6) {
      const side = prng() > 0.5 ? 1 : -1;
      const carX = centerX + side * (6.0 + prng() * 2.0);
      const carZ = centerZ + (prng() - 0.5) * 12.0;
      const carType = prng() > 0.6 ? 'muscle' : (prng() > 0.3 ? 'taxi' : 'sedan');
      const paintIdx = Math.floor(prng() * this.materials.carPaints.length);
      this.createProceduralCar(
        chunkData,
        carX,
        carZ,
        (prng() - 0.5) * 0.4 + (side > 0 ? 0 : Math.PI),
        carType,
        this.materials.carPaints[paintIdx],
        prng
      );
    }

    // 9. Scattered Supply Drops
    if (prng() > 0.4) {
      const sx = centerX + (prng() - 0.5) * 14.0;
      const sz = centerZ + (prng() - 0.5) * 18.0;
      const itemRoll = prng();
      const itemType = itemRoll > 0.6 ? 'battery' : (itemRoll > 0.3 ? 'almond_water' : 'medkit');
      const itemName = itemType === 'battery' ? 'Flashlight Alkaline Battery' : (itemType === 'almond_water' ? 'Unmarked Bottle ("Almond Water")' : 'Emergency First Aid Kit');
      this.createItemPickupToChunk(chunkData, sx, 0.05, sz, itemType, itemName);
    }

    this.activeChunks.set(key, chunkData);
  }

  // =========================================================================
  // LEVEL 1: PROCEDURAL CHUNKS & STORY LANDMARKS
  // =========================================================================
  // Deterministic Macro-Partition System for Small, Medium, Large, and Extra-Large Connected Rooms
  getRoomId(gx, gz) {
    const MB = 8; // Macro block size: 8x8 cells (32m x 32m)
    const mbx = Math.floor(gx / MB);
    const mbz = Math.floor(gz / MB);
    const lx = ((gx % MB) + MB) % MB; // 0..7
    const lz = ((gz % MB) + MB) % MB; // 0..7

    // Deterministic seed per macro block
    const s = Math.abs(Math.sin(mbx * 127.1 + mbz * 311.7 + 42.0) * 43758.5453);
    const template = Math.floor(s * 1000) % 4;

    if (template === 0) {
      // Template 0: 1 Extra-Large Room (4x4), 1 Large Room (3x3), 2 Medium Rooms (2x2), Small Rooms
      if (lx < 4 && lz < 4) return `${mbx}_${mbz}_XL_0`;
      if (lx >= 5 && lz >= 5) return `${mbx}_${mbz}_L_0`;
      if (lx >= 4 && lz < 2) return `${mbx}_${mbz}_M_0`;
      if (lx >= 4 && lz >= 2 && lz < 4) return `${mbx}_${mbz}_M_1`;
      if (lx < 3 && lz >= 5) return `${mbx}_${mbz}_L_1`;
      if (lx < 4 && lz >= 4 && lz < 6) return `${mbx}_${mbz}_M_2`;
      return `${mbx}_${mbz}_S_${lx}_${lz}`;
    } else if (template === 1) {
      // Template 1: 2 Large Rooms (3x3), 4 Medium Rooms (2x2), Small Rooms
      if (lx < 3 && lz < 3) return `${mbx}_${mbz}_L_0`;
      if (lx >= 5 && lz < 3) return `${mbx}_${mbz}_L_1`;
      if (lx >= 3 && lx < 5 && lz < 2) return `${mbx}_${mbz}_M_0`;
      if (lx < 4 && lz >= 4 && lz < 6) return `${mbx}_${mbz}_M_1`;
      if (lx >= 4 && lz >= 4 && lz < 6) return `${mbx}_${mbz}_M_2`;
      if (lx >= 4 && lz >= 6) return `${mbx}_${mbz}_M_3`;
      if (lx < 4 && lz >= 6) return `${mbx}_${mbz}_M_4`;
      return `${mbx}_${mbz}_S_${lx}_${lz}`;
    } else if (template === 2) {
      // Template 2: Center Extra-Large Room (4x4: lx 2..5, lz 2..5), surrounding Medium & Small Rooms
      if (lx >= 2 && lx <= 5 && lz >= 2 && lz <= 5) return `${mbx}_${mbz}_XL_0`;
      if (lx < 2 && lz < 4) return `${mbx}_${mbz}_M_0`;
      if (lx > 5 && lz < 4) return `${mbx}_${mbz}_M_1`;
      if (lx < 2 && lz >= 4) return `${mbx}_${mbz}_M_2`;
      if (lx > 5 && lz >= 4) return `${mbx}_${mbz}_M_3`;
      if (lz < 2) return `${mbx}_${mbz}_M_4_${Math.floor(lx / 2)}`;
      return `${mbx}_${mbz}_S_${lx}_${lz}`;
    } else {
      // Template 3: 2 Extra-Large Rooms (4x4), 4 Medium Rooms (2x2)
      if (lx < 4 && lz < 4) return `${mbx}_${mbz}_XL_0`;
      if (lx >= 4 && lz >= 4) return `${mbx}_${mbz}_XL_1`;
      if (lx >= 4 && lz < 4) return `${mbx}_${mbz}_M_0_${Math.floor((lx - 4) / 2)}_${Math.floor(lz / 2)}`;
      return `${mbx}_${mbz}_M_1_${Math.floor(lx / 2)}_${Math.floor((lz - 4) / 2)}`;
    }
  }

  // Determine if a horizontal wall segment between (gx, gz) and (gx, gz - 1) is the single doorway opening
  isHDoorway(gx, gz) {
    const r1 = this.getRoomId(gx, gz);
    const r2 = this.getRoomId(gx, gz - 1);
    if (r1 === r2) return false;

    // Find the full continuous span of this shared room boundary (strictly bounded to max 8 cells)
    let minX = gx;
    let count = 0;
    while (count < 8 && this.getRoomId(minX - 1, gz) === r1 && this.getRoomId(minX - 1, gz - 1) === r2) {
      minX--;
      count++;
    }
    let maxX = gx;
    count = 0;
    while (count < 8 && this.getRoomId(maxX + 1, gz) === r1 && this.getRoomId(maxX + 1, gz - 1) === r2) {
      maxX++;
      count++;
    }

    const span = maxX - minX + 1;
    if (span >= 5) {
      return gx === minX + Math.floor(span / 3) || gx === minX + Math.floor((span * 2) / 3);
    }

    return gx === minX + Math.floor((span - 1) / 2);
  }

  // Determine if a vertical wall segment between (gx, gz) and (gx - 1, gz) is the single doorway opening
  isVDoorway(gx, gz) {
    const r1 = this.getRoomId(gx, gz);
    const r2 = this.getRoomId(gx - 1, gz);
    if (r1 === r2) return false;

    // Find the full continuous span of this shared room boundary (strictly bounded to max 8 cells)
    let minZ = gz;
    let count = 0;
    while (count < 8 && this.getRoomId(gx, minZ - 1) === r1 && this.getRoomId(gx - 1, minZ - 1) === r2) {
      minZ--;
      count++;
    }
    let maxZ = gz;
    count = 0;
    while (count < 8 && this.getRoomId(gx, maxZ + 1) === r1 && this.getRoomId(gx - 1, maxZ + 1) === r2) {
      maxZ++;
      count++;
    }

    const span = maxZ - minZ + 1;
    if (span >= 5) {
      return gz === minZ + Math.floor(span / 3) || gz === minZ + Math.floor((span * 2) / 3);
    }

    return gz === minZ + Math.floor((span - 1) / 2);
  }

  generateChunk(cx, cz) {
    const key = `${cx}_${cz}`;
    const centerX = cx * this.CHUNK_SIZE;
    const centerZ = cz * this.CHUNK_SIZE;
    const wallHeight = 3.0;

    const chunkData = {
      key,
      cx,
      cz,
      meshes: [],
      colliders: [],
      lights: [],
      interactive: [],
      flooded: []
    };

    // Special Landmark Chunks
    if (cx === 0 && cz === 1) {
      this.buildOriginFacilityChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 0 && cz === 0) {
      this.buildGatewayChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 0 && cz === -1) {
      this.buildCampAlphaChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 1 && cz === -2) {
      this.buildFloodedAnomalyChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === -1 && cz === -3) {
      this.buildMaintenanceCacheChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 0 && cz === -5) {
      this.buildObservationRoomChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 0 && cz === -6) {
      this.buildSteelDoorChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    } else if (cx === 0 && cz === -7) {
      this.buildLevel2ExitChunk(chunkData, centerX, centerZ);
      this.activeChunks.set(key, chunkData);
      return;
    }

    if (cz > 0) {
      this.activeChunks.set(key, chunkData);
      return;
    }

    let seed = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453);
    const prng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const isFlooded = Math.sin(cx * 0.7) + Math.cos(cz * 0.7) > 0.65;
    const floorMat = isFlooded ? this.materials.wetCarpet : this.materials.carpet;

    const floorGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 6, 6);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(centerX, 0, centerZ);
    this.scene.add(floorMesh);
    chunkData.meshes.push(floorMesh);

    const ceilGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 6, 6);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMesh = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceilMesh.position.set(centerX, wallHeight, centerZ);
    this.scene.add(ceilMesh);
    chunkData.meshes.push(ceilMesh);

    if (isFlooded) {
      const floodGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE);
      floodGeo.rotateX(-Math.PI / 2);
      const floodMesh = new THREE.Mesh(floodGeo, this.materials.waterSurface);
      floodMesh.position.set(centerX, 0.04, centerZ);
      this.scene.add(floodMesh);
      chunkData.meshes.push(floodMesh);

      const zone = {
        minX: centerX - this.CHUNK_SIZE / 2, maxX: centerX + this.CHUNK_SIZE / 2,
        minZ: centerZ - this.CHUNK_SIZE / 2, maxZ: centerZ + this.CHUNK_SIZE / 2
      };
      this.floodedZones.push(zone);
      chunkData.flooded.push(zone);
    }

    const cells = 6;
    const cellSize = 4.0;
    const minX = centerX - this.CHUNK_SIZE / 2;
    const minZ = centerZ - this.CHUNK_SIZE / 2;

    const baseGX = cx * cells;
    const baseGZ = cz * cells;

    // Helper: Deterministic PRNG for global coordinates
    const globalHash = (gx, gz, seedOffset = 0) => {
      const s = Math.sin(gx * 127.1 + gz * 311.7 + seedOffset * 53.3) * 43758.5453;
      return s - Math.floor(s);
    };

    // Iterate through every cell in the 6x6 chunk grid
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const gx = baseGX + c;
        const gz = baseGZ + r;
        const cellCenterX = minX + c * cellSize + cellSize / 2;
        const cellCenterZ = minZ + r * cellSize + cellSize / 2;

        const currentRoom = this.getRoomId(gx, gz);
        const northRoom = this.getRoomId(gx, gz - 1);
        const westRoom = this.getRoomId(gx - 1, gz);

        // Room boundaries mix narrow doorframes with the broad, offset openings typical of Level 0.
        if (currentRoom !== northRoom) {
          const wx = cellCenterX;
          const wz = minZ + r * cellSize;
          const isDoor = this.isHDoorway(gx, gz);

          if (isDoor) {
            const style = globalHash(gx, gz, 707);
            if (style < 0.22) {
              this.addDoorwayWallToChunk(chunkData, wx, wallHeight / 2, wz, cellSize, wallHeight, 0.3, 'x');
            } else {
              const openingWidth = 2.3 + globalHash(gx, gz, 708) * 0.8;
              const openingOffset = (globalHash(gx, gz, 709) - 0.5) * 0.5;
              this.addBackroomsOpeningToChunk(chunkData, wx, wallHeight / 2, wz, cellSize, wallHeight, 0.3, 'x', openingWidth, openingOffset);
            }
          } else {
            this.addSolidWallToChunk(chunkData, wx, wallHeight / 2, wz, cellSize, wallHeight, 0.3, this.materials.wallpaper);
          }
        }

        // 2. Vertical Wall (West edge: between (gx, gz) and (gx - 1, gz))
        if (currentRoom !== westRoom) {
          const wx = minX + c * cellSize;
          const wz = cellCenterZ;
          const isDoor = this.isVDoorway(gx, gz);

          if (isDoor) {
            const style = globalHash(gx, gz, 717);
            if (style < 0.22) {
              this.addDoorwayWallToChunk(chunkData, wx, wallHeight / 2, wz, cellSize, wallHeight, 0.3, 'z');
            } else {
              const openingWidth = 2.3 + globalHash(gx, gz, 718) * 0.8;
              const openingOffset = (globalHash(gx, gz, 719) - 0.5) * 0.5;
              this.addBackroomsOpeningToChunk(chunkData, wx, wallHeight / 2, wz, cellSize, wallHeight, 0.3, 'z', openingWidth, openingOffset);
            }
          } else {
            this.addSolidWallToChunk(chunkData, wx, wallHeight / 2, wz, 0.3, wallHeight, cellSize, this.materials.wallpaper);
          }
        }

        const isLargeRoom = currentRoom.includes('_L_') || currentRoom.includes('_XL_');

        // Short freestanding partitions create alcoves without closing the room's long sightlines.
        if (isLargeRoom && currentRoom === northRoom && globalHash(gx, gz, 727) > 0.9) {
          const stubLength = 1.5 + globalHash(gx, gz, 728) * 1.1;
          const offset = (globalHash(gx, gz, 729) - 0.5) * (cellSize - stubLength);
          this.addSolidWallToChunk(chunkData, cellCenterX + offset, wallHeight / 2, minZ + r * cellSize, stubLength, wallHeight, 0.3, this.materials.wallpaper);
        }
        if (isLargeRoom && currentRoom === westRoom && globalHash(gx, gz, 737) > 0.9) {
          const stubLength = 1.5 + globalHash(gx, gz, 738) * 1.1;
          const offset = (globalHash(gx, gz, 739) - 0.5) * (cellSize - stubLength);
          this.addSolidWallToChunk(chunkData, minX + c * cellSize, wallHeight / 2, cellCenterZ + offset, 0.3, wallHeight, stubLength, this.materials.wallpaper);
        }

        // Repeated square columns anchor the larger chambers without making a uniform office grid.
        if (c > 0 && r > 0) {
          const nwRoom = this.getRoomId(gx - 1, gz - 1);
          const nRoom = northRoom;
          const wRoom = westRoom;
          if (isLargeRoom && currentRoom === nwRoom && currentRoom === nRoom && currentRoom === wRoom && globalHash(gx, gz, 747) > 0.48) {
            this.createPillarToChunk(chunkData, minX + c * cellSize, wallHeight / 2, minZ + r * cellSize, 0.72, wallHeight, 0.72);
          }
        }
      }
    }

    // Dense, slightly offset fluorescent rows reinforce the repeating Level 0 ceiling grid.
    const lightPositions = [
      [minX + 4, minZ + 5],
      [minX + 12, minZ + 5],
      [minX + 20, minZ + 5],
      [minX + 4, minZ + 17],
      [minX + 12, minZ + 17],
      [minX + 20, minZ + 17]
    ];
    lightPositions.forEach(([lx, lz], idx) => {
      const isFailing = globalHash(cx + idx, cz, 606) < 0.25;
      const lightObj = this.lightManager.createFluorescentFixture(lx, wallHeight - 0.1, lz, {
        color: isFlooded ? 0xffdf80 : 0xffe8a3,
        intensity: isFailing ? 1.0 : 1.6,
        isFailing
      });
      if (idx % 2 === 1) lightObj.group.rotation.y = Math.PI / 2;
      chunkData.lights.push(lightObj);
    });

    // 5. Random Supply Pickup Scatters (Frequent 1980s supply drops)
    const itemRoll = prng();
    if (itemRoll > 0.35) {
      const dropCount = (itemRoll > 0.8) ? 3 : ((itemRoll > 0.55) ? 2 : 1);
      for (let i = 0; i < dropCount; i++) {
        const sx = minX + 3.0 + prng() * 18.0;
        const sz = minZ + 3.0 + prng() * 18.0;
        const roll = prng();
        const type = roll > 0.6 ? 'battery' : (roll > 0.28 ? 'almond_water' : 'medkit');
        const name = type === 'battery' ? 'Flashlight Alkaline Battery' : (type === 'almond_water' ? 'Unmarked Bottle ("Almond Water")' : 'Emergency First Aid Kit');
        this.createItemPickupToChunk(chunkData, sx, 0.05, sz, type, name);
      }
    }

    this.activeChunks.set(key, chunkData);
  }

  // --- STORY LANDMARK CHUNKS ---
  buildOriginFacilityChunk(chunkData, cx, cz) {
    const w = 12, l = 14, h = 3.2;

    const floorGeo = new THREE.PlaneGeometry(w, l);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, this.materials.labFloor);
    floor.position.set(0, 0, 20);
    this.scene.add(floor);
    chunkData.meshes.push(floor);

    const ceilGeo = new THREE.PlaneGeometry(w, l);
    ceilGeo.rotateX(Math.PI / 2);
    const ceil = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceil.position.set(0, h, 20);
    this.scene.add(ceil);
    chunkData.meshes.push(ceil);

    // Outer Room Walls
    this.addSolidWallToChunk(chunkData, -w / 2, h / 2, 20, 0.4, h, l, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, w / 2, h / 2, 20, 0.4, h, l, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, 0, h / 2, 20 + l / 2, w, h, 0.4, this.materials.labWall);

    // Front Wall with Gateway Entrance
    this.addSolidWallToChunk(chunkData, -3.6, h / 2, 13.0, 4.8, h, 0.4, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, 3.6, h / 2, 13.0, 4.8, h, 0.4, this.materials.labWall);
    const lintelGeo = new THREE.BoxGeometry(2.4, 0.6, 0.4);
    const lintel = new THREE.Mesh(lintelGeo, this.materials.labWall);
    lintel.position.set(0, h - 0.3, 13.0);
    this.scene.add(lintel);
    chunkData.meshes.push(lintel);

    // Gateway Portal Arch Frame
    const portalFrameGeo = new THREE.BoxGeometry(2.8, 3.0, 0.6);
    const portalFrame = new THREE.Mesh(portalFrameGeo, this.materials.metal);
    portalFrame.position.set(0, 1.5, 13.0);
    this.scene.add(portalFrame);
    chunkData.meshes.push(portalFrame);

    // Yellow Hazard Sign above Gateway
    const signGeo = new THREE.BoxGeometry(2.0, 0.4, 0.1);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 2.7, 13.35);
    this.scene.add(signMesh);
    chunkData.meshes.push(signMesh);

    // Floor Winch Anchor Mechanism
    const winchGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
    const winchMesh = new THREE.Mesh(winchGeo, this.materials.metal);
    winchMesh.position.set(1.4, 0.25, 13.8);
    this.scene.add(winchMesh);
    chunkData.meshes.push(winchMesh);

    // --- DECORATIONS: CAUTION TAPE BANNERS ---
    const tapeGeo1 = new THREE.PlaneGeometry(3.6, 0.16);
    const tape1 = new THREE.Mesh(tapeGeo1, this.materials.cautionTape);
    tape1.position.set(-3.2, 1.2, 13.4);
    tape1.rotation.z = -0.06;
    const tapeGeo2 = new THREE.PlaneGeometry(3.6, 0.16);
    const tape2 = new THREE.Mesh(tapeGeo2, this.materials.cautionTape);
    tape2.position.set(3.2, 1.2, 13.4);
    tape2.rotation.z = 0.06;
    this.scene.add(tape1, tape2);
    chunkData.meshes.push(tape1, tape2);

    // --- DECORATIONS: 1980s LAB WORKSTATION WITH INTEGRATED 3D COMPUTER TERMINAL ---
    const deskGroup = this.createTableToChunk(chunkData, -4.2, 0, 22.2, 2.4, 1.4, 0.76);

    // Level 5 access card left beside the terminal keyboard.
    this.createItemPickupToChunk(
      chunkData,
      -5.02,
      0.805,
      22.15,
      'security_keycard',
      'Level 5 Security Keycard'
    );
    
    // Interactive proxy collider for the single computer workstation
    const monitorGeo = new THREE.BoxGeometry(0.9, 0.7, 0.9);
    const monitorMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    const monitorProxy = new THREE.Mesh(monitorGeo, monitorMat);
    monitorProxy.position.set(0, 1.1, 0);
    deskGroup.add(monitorProxy);

    // Load detailed 3D FBX Computer Model attached directly to desk
    if (typeof THREE.FBXLoader !== 'undefined') {
      const fbxLoader = new THREE.FBXLoader();
      const textureLoader = new THREE.TextureLoader();
      
      const compTexture = textureLoader.load('./assets/models/computer/textures/Computer.png');
      const kbTexture = textureLoader.load('./assets/models/computer/textures/Keyboard.png');

      fbxLoader.load('./assets/models/computer/source/Computer.fbx', (fbx) => {
        // Mount directly on top of the desk
        fbx.position.set(0, 0.76, 0.08);
        fbx.scale.set(0.0055, 0.0055, 0.0055);
        fbx.rotation.set(0, Math.PI, 0);

        fbx.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.name && child.name.toLowerCase().includes('keyboard')) {
              child.material = new THREE.MeshPhongMaterial({ map: kbTexture, shininess: 15 });
            } else {
              child.material = new THREE.MeshPhongMaterial({ map: compTexture, shininess: 20 });
            }
          }
        });

        deskGroup.add(fbx);
      }, undefined, (err) => {
        console.warn("Could not load FBX computer model:", err);
      });
    }

    // Glowing Green Terminal Screen overlay aligned to CRT monitor glass
    const screenGeo = new THREE.PlaneGeometry(0.24, 0.19);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.04, -0.14);
    deskGroup.add(screen);

    // Single Computer Terminal Interactive Examination
    const compItem = {
      mesh: monitorProxy,
      type: 'computer_terminal',
      name: 'Mainframe Terminal [DTE-04 TELEMETRY]',
      action: 'examine_computer'
    };
    this.interactiveObjects.push(compItem);
    chunkData.interactive.push(compItem);

    // --- DECORATIONS: SERVER RACK UNITS ---
    [-4.5, 4.5].forEach(sx => {
      const rackGeo = new THREE.BoxGeometry(1.0, 2.6, 0.9);
      const rackMat = new THREE.MeshPhongMaterial({ color: 0x222625, shininess: 20 });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(sx, 1.3, 17.5);
      this.scene.add(rack);
      chunkData.meshes.push(rack);

      const rBox = new THREE.Box3().setFromObject(rack);
      this.registerCollider(rBox);
      chunkData.colliders.push(rBox);

      // Blinking status LEDs on rack
      const ledGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x33ff55 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(sx > 0 ? sx - 0.46 : sx + 0.46, 2.0, 17.5);
      this.scene.add(led);
      chunkData.meshes.push(led);
    });

    // --- SECOND DOOR: LOCKED FACILITY ACCESS DOOR ---
    const secDoorFrameGeo = new THREE.BoxGeometry(1.8, 2.5, 0.4);
    const secDoorFrame = new THREE.Mesh(secDoorFrameGeo, this.materials.metal);
    secDoorFrame.position.set(0, 1.25, 20 + l / 2 - 0.1);
    this.scene.add(secDoorFrame);
    chunkData.meshes.push(secDoorFrame);

    const secDoorPanelGeo = new THREE.BoxGeometry(1.4, 2.3, 0.15);
    const secDoorPanel = new THREE.Mesh(secDoorPanelGeo, this.materials.steelDoor);
    secDoorPanel.position.set(0, 1.15, 20 + l / 2 - 0.1);
    this.scene.add(secDoorPanel);
    chunkData.meshes.push(secDoorPanel);

    // Electronic Keypad Next to Door
    const keypadGeo = new THREE.BoxGeometry(0.18, 0.3, 0.08);
    const keypadMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
    const keypad = new THREE.Mesh(keypadGeo, keypadMat);
    keypad.position.set(1.1, 1.4, 20 + l / 2 - 0.15);
    this.scene.add(keypad);
    chunkData.meshes.push(keypad);

    const keyLedGeo = new THREE.CircleGeometry(0.02, 8);
    const keyLedMat = new THREE.MeshBasicMaterial({ color: 0xff2222 }); // Red locked LED
    const keyLed = new THREE.Mesh(keyLedGeo, keyLedMat);
    keyLed.position.set(1.1, 1.48, 20 + l / 2 - 0.2);
    keyLed.rotation.y = Math.PI;
    this.scene.add(keyLed);
    chunkData.meshes.push(keyLed);

    const lockedDoorItem = {
      mesh: secDoorPanel,
      type: 'locked_lab_door',
      name: 'Security Airlock Door [ACCESS RESTRICTED - CLEARANCE LEVEL 5]',
      action: 'try_locked_door',
      unlocked: false,
      keyLedMaterial: keyLedMat
    };
    this.interactiveObjects.push(lockedDoorItem);
    chunkData.interactive.push(lockedDoorItem);

    // Starting Room Lights (Balanced soft laboratory lighting)
    const l1 = this.lightManager.createFluorescentFixture(0, 3.0, 22, { color: 0xc8d4d8, intensity: 0.75, distance: 14.0 });
    const l2 = this.lightManager.createFluorescentFixture(0, 3.0, 16, { color: 0xc8d4d8, intensity: 0.75, distance: 14.0 });
    chunkData.lights.push(l1, l2);

    // Initial Tether Rope Model
    const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, 24, 8);
    ropeGeo.rotateX(Math.PI / 2);
    const ropeMesh = new THREE.Mesh(ropeGeo, this.materials.rope);
    ropeMesh.position.set(0, 0.08, 12);
    this.scene.add(ropeMesh);
    chunkData.meshes.push(ropeMesh);

    const solidWallGeo = new THREE.BoxGeometry(2.4, 2.8, 0.3);
    const solidWall = new THREE.Mesh(solidWallGeo, this.materials.wallpaper);
    solidWall.position.set(0, 1.4, 13.0);
    this.scene.add(solidWall);
    chunkData.meshes.push(solidWall);

    this.shiftingSpace.registerEntrance(portalFrame, solidWall, ropeMesh);
  }

  buildGatewayChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    this.addDoorwayWallToChunk(chunkData, -4.0, 1.5, 0, 24, 3.0, 0.3, 'z');
    this.addDoorwayWallToChunk(chunkData, 4.0, 1.5, 0, 24, 3.0, 0.3, 'z');

    const l1 = this.lightManager.createFluorescentFixture(0, 2.9, 6, { color: 0xecd896, intensity: 0.85, distance: 14.0 });
    const l2 = this.lightManager.createFluorescentFixture(0, 2.9, -6, { color: 0xecd896, intensity: 0.85, distance: 14.0 });
    chunkData.lights.push(l1, l2);

    this.createItemPickupToChunk(chunkData, 1.8, 0.12, 4.0, 'battery', 'Flashlight Alkaline Battery');
  }

  buildCampAlphaChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    this.createTableToChunk(chunkData, 0, 0, -32, 2.2, 0.9, 0.75);
    this.createItemPickupToChunk(chunkData, -0.5, 0.8, -32, 'mercer_01', 'Dr. Mercer Expedition Log 01 (Cassette Tape)');
    this.createItemPickupToChunk(chunkData, 0.5, 0.8, -32, 'battery', 'Flashlight Alkaline Battery');
    this.createItemPickupToChunk(chunkData, 0.0, 0.8, -31.8, 'almond_water', 'Unmarked Bottle ("Almond Water")');

    const l = this.lightManager.createFluorescentFixture(0, 2.9, -32, { color: 0xffe8a3, intensity: 1.6 });
    chunkData.lights.push(l);
  }

  buildFloodedAnomalyChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, true);

    this.createCrateToChunk(chunkData, 20, 0, -48, 1.4, 0.8, 1.4);
    this.createItemPickupToChunk(chunkData, 20, 0.85, -48, 'reed_notes', 'Dr. Samuel Reed Anomaly Notebook');

    const l = this.lightManager.createFluorescentFixture(20, 2.9, -48, { color: 0xffdf80, intensity: 1.6, isFailing: true });
    chunkData.lights.push(l);
  }

  buildMaintenanceCacheChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    this.createTableToChunk(chunkData, -20, 0, -72, 1.8, 0.8, 0.75);
    this.createItemPickupToChunk(chunkData, -20, 0.8, -72, 'cole_tape', 'Daniel Cole Audio Log (Tape Reel #2)');
    this.createItemPickupToChunk(chunkData, -19.4, 0.8, -72, 'medkit', 'Emergency First Aid Kit');

    const l = this.lightManager.createFluorescentFixture(-20, 2.9, -72, { color: 0xffe8a3, intensity: 1.6 });
    chunkData.lights.push(l);
  }

  buildObservationRoomChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    this.createTableToChunk(chunkData, -2.5, 0, -120, 1.8, 1.0, 0.75);
    this.createItemPickupToChunk(chunkData, -2.5, 0.8, -120, 'park_notes', 'Dr. Helen Park Biological Samples Log');
    this.createItemPickupToChunk(chunkData, 0, 1.5, -122, 'wall_warning', 'Observation Room Wall Markings ("DO NOT TRUST")');

    const l = this.lightManager.createFluorescentFixture(0, 2.9, -120, { color: 0xffe8a3, intensity: 1.4 });
    chunkData.lights.push(l);
  }

  buildSteelDoorChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    this.addSolidWallToChunk(chunkData, -3.0, 1.5, -144, 0.3, 3.0, 24, this.materials.wallpaper);
    this.addSolidWallToChunk(chunkData, 3.0, 1.5, -144, 0.3, 3.0, 24, this.materials.wallpaper);

    const doorFrameGeo = new THREE.BoxGeometry(2.6, 2.8, 0.5);
    const doorFrame = new THREE.Mesh(doorFrameGeo, this.materials.metal);
    doorFrame.position.set(0, 1.4, -144);
    this.scene.add(doorFrame);
    chunkData.meshes.push(doorFrame);

    const doorPanelGeo = new THREE.BoxGeometry(2.0, 2.5, 0.18);
    const doorPanel = new THREE.Mesh(doorPanelGeo, this.materials.steelDoor);
    doorPanel.position.set(0, 1.3, -144);
    this.scene.add(doorPanel);
    chunkData.meshes.push(doorPanel);

    const doorItem = {
      mesh: doorPanel,
      type: 'maintenance_door',
      name: 'Heavy Steel Maintenance Door',
      action: 'slam_and_escape'
    };
    this.interactiveObjects.push(doorItem);
    chunkData.interactive.push(doorItem);

    const l = this.lightManager.createFluorescentFixture(0, 2.9, -138, { color: 0xffe8a3, intensity: 1.6, isFailing: true });
    chunkData.lights.push(l);
  }

  buildLevel2ExitChunk(chunkData, cx, cz) {
    this.buildChunkFloorAndCeiling(chunkData, cx, cz, false);

    const overTable = this.createTableToChunk(chunkData, 0, 0, -164, 2.2, 0.9, 0.75);
    overTable.rotation.z = 0.45;
    this.createItemPickupToChunk(chunkData, 0.3, 0.1, -163.5, 'mercer_final', 'Dr. Evelyn Mercer Final Expedition Log (Cassette Tape)');

    const exitDoorGeo = new THREE.BoxGeometry(2.4, 2.6, 0.3);
    const exitDoor = new THREE.Mesh(exitDoorGeo, this.materials.metal);
    exitDoor.position.set(0, 1.3, -172);
    this.scene.add(exitDoor);
    chunkData.meshes.push(exitDoor);

    const exitItem = {
      mesh: exitDoor,
      type: 'level2_exit',
      name: 'Doorway ("LEVEL 2? / DON\'T GO BACK")',
      action: 'finish_level'
    };
    this.interactiveObjects.push(exitItem);
    chunkData.interactive.push(exitItem);

    const l = this.lightManager.createFluorescentFixture(0, 2.9, -168, { color: 0xffe8a3, intensity: 1.6 });
    chunkData.lights.push(l);
  }

  buildChunkFloorAndCeiling(chunkData, cx, cz, isFlooded = false) {
    const floorMat = isFlooded ? this.materials.wetCarpet : this.materials.carpet;
    const floorGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 6, 6);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(cx, 0, cz);
    this.scene.add(floorMesh);
    chunkData.meshes.push(floorMesh);

    const ceilGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE, 6, 6);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMesh = new THREE.Mesh(ceilGeo, this.materials.ceiling);
    ceilMesh.position.set(cx, 3.0, cz);
    this.scene.add(ceilMesh);
    chunkData.meshes.push(ceilMesh);

    if (isFlooded) {
      const floodGeo = new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE);
      floodGeo.rotateX(-Math.PI / 2);
      const floodMesh = new THREE.Mesh(floodGeo, this.materials.waterSurface);
      floodMesh.position.set(cx, 0.04, cz);
      this.scene.add(floodMesh);
      chunkData.meshes.push(floodMesh);

      const zone = {
        minX: cx - this.CHUNK_SIZE / 2, maxX: cx + this.CHUNK_SIZE / 2,
        minZ: cz - this.CHUNK_SIZE / 2, maxZ: cz + this.CHUNK_SIZE / 2
      };
      this.floodedZones.push(zone);
      chunkData.flooded.push(zone);
    }
  }

  // --- UNLOAD CHUNK & CLEANUP ---
  removeChunk(key) {
    const chunk = this.activeChunks.get(key);
    if (!chunk) return;

    chunk.meshes.forEach(m => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    });

    chunk.colliders.forEach(box => {
      const idx = this.colliders.indexOf(box);
      if (idx !== -1) this.colliders.splice(idx, 1);

      const minCX = Math.floor(box.min.x / 4.0);
      const maxCX = Math.floor(box.max.x / 4.0);
      const minCZ = Math.floor(box.min.z / 4.0);
      const maxCZ = Math.floor(box.max.z / 4.0);
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const bKey = `${cx}_${cz}`;
          const list = this.spatialGrid.get(bKey);
          if (list) {
            const bIdx = list.indexOf(box);
            if (bIdx !== -1) list.splice(bIdx, 1);
          }
        }
      }
    });

    chunk.lights.forEach(l => {
      this.scene.remove(l.group);
      const lIdx = this.lightManager.lights.indexOf(l);
      if (lIdx !== -1) this.lightManager.lights.splice(lIdx, 1);
    });

    chunk.interactive.forEach(item => {
      const itIdx = this.interactiveObjects.indexOf(item);
      if (itIdx !== -1) this.interactiveObjects.splice(itIdx, 1);
    });

    chunk.flooded.forEach(zone => {
      const zIdx = this.floodedZones.indexOf(zone);
      if (zIdx !== -1) this.floodedZones.splice(zIdx, 1);
    });

    this.activeChunks.delete(key);
  }

  // --- COLLISION SPATIAL HASH & REGISTRATION ---
  registerCollider(box) {
    this.colliders.push(box);
    const minCX = Math.floor(box.min.x / 4.0);
    const maxCX = Math.floor(box.max.x / 4.0);
    const minCZ = Math.floor(box.min.z / 4.0);
    const maxCZ = Math.floor(box.max.z / 4.0);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = `${cx}_${cz}`;
        if (!this.spatialGrid.has(key)) {
          this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push(box);
      }
    }
  }

  getNearbyColliders(pos) {
    const cx = Math.floor(pos.x / 4.0);
    const cz = Math.floor(pos.z / 4.0);
    const nearby = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx}_${cz + dz}`;
        const list = this.spatialGrid.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            nearby.push(list[i]);
          }
        }
      }
    }
    return nearby;
  }

  // --- CHUNK HELPER BUILDERS ---
  addSolidWallToChunk(chunk, x, y, z, w, h, d, material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const wall = new THREE.Mesh(geo, material);
    wall.position.set(x, y, z);
    this.scene.add(wall);
    chunk.meshes.push(wall);

    const box = new THREE.Box3().setFromObject(wall);
    this.registerCollider(box);
    chunk.colliders.push(box);
    return wall;
  }

  addDoorwayWallToChunk(chunk, x, y, z, length, height, thickness, orientation = 'x') {
    const doorWidth = 1.8;
    const postWidth = (length - doorWidth) / 2;
    const doorHeight = 2.4;
    const lintelHeight = height - doorHeight;

    if (orientation === 'x') {
      this.addSolidWallToChunk(chunk, x - length / 2 + postWidth / 2, y, z, postWidth, height, thickness, this.materials.wallpaper);
      this.addSolidWallToChunk(chunk, x + length / 2 - postWidth / 2, y, z, postWidth, height, thickness, this.materials.wallpaper);
      const lintelGeo = new THREE.BoxGeometry(doorWidth, lintelHeight, thickness);
      const lintel = new THREE.Mesh(lintelGeo, this.materials.wallpaper);
      lintel.position.set(x, height - lintelHeight / 2, z);
      this.scene.add(lintel);
      chunk.meshes.push(lintel);
    } else {
      this.addSolidWallToChunk(chunk, x, y, z - length / 2 + postWidth / 2, thickness, height, postWidth, this.materials.wallpaper);
      this.addSolidWallToChunk(chunk, x, y, z + length / 2 - postWidth / 2, thickness, height, postWidth, this.materials.wallpaper);
      const lintelGeo = new THREE.BoxGeometry(thickness, lintelHeight, doorWidth);
      const lintel = new THREE.Mesh(lintelGeo, this.materials.wallpaper);
      lintel.position.set(x, height - lintelHeight / 2, z);
      this.scene.add(lintel);
      chunk.meshes.push(lintel);
    }
  }

  addBackroomsOpeningToChunk(chunk, x, y, z, length, height, thickness, orientation, openingWidth, openingOffset = 0) {
    const available = Math.max(0, length - openingWidth);
    const maxOffset = Math.max(0, available / 2 - 0.15);
    const offset = Math.max(-maxOffset, Math.min(maxOffset, openingOffset));
    const firstLength = available / 2 + offset;
    const secondLength = available / 2 - offset;

    if (orientation === 'x') {
      if (firstLength > 0.1) {
        this.addSolidWallToChunk(chunk, x - length / 2 + firstLength / 2, y, z, firstLength, height, thickness, this.materials.wallpaper);
      }
      if (secondLength > 0.1) {
        this.addSolidWallToChunk(chunk, x + length / 2 - secondLength / 2, y, z, secondLength, height, thickness, this.materials.wallpaper);
      }
    } else {
      if (firstLength > 0.1) {
        this.addSolidWallToChunk(chunk, x, y, z - length / 2 + firstLength / 2, thickness, height, firstLength, this.materials.wallpaper);
      }
      if (secondLength > 0.1) {
        this.addSolidWallToChunk(chunk, x, y, z + length / 2 - secondLength / 2, thickness, height, secondLength, this.materials.wallpaper);
      }
    }
  }

  createPillarToChunk(chunk, x, y, z, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const pillar = new THREE.Mesh(geo, this.materials.wallpaper);
    pillar.position.set(x, y, z);
    this.scene.add(pillar);
    chunk.meshes.push(pillar);

    const box = new THREE.Box3().setFromObject(pillar);
    this.registerCollider(box);
    chunk.colliders.push(box);
    return pillar;
  }

  createTableToChunk(chunk, x, y, z, w, d, h) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const topGeo = new THREE.BoxGeometry(w, 0.08, d);
    const topMesh = new THREE.Mesh(topGeo, this.materials.table);
    topMesh.position.y = h;
    group.add(topMesh);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, h, 6);
    const legMat = this.materials.metal;
    const offsets = [
      [-w / 2 + 0.1, -d / 2 + 0.1],
      [w / 2 - 0.1, -d / 2 + 0.1],
      [-w / 2 + 0.1, d / 2 - 0.1],
      [w / 2 - 0.1, d / 2 - 0.1]
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(ox, h / 2, oz);
      group.add(leg);
    });

    this.scene.add(group);
    chunk.meshes.push(group);

    const box = new THREE.Box3().setFromObject(group);
    this.registerCollider(box);
    chunk.colliders.push(box);
    return group;
  }

  createCrateToChunk(chunk, x, y, z, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const crate = new THREE.Mesh(geo, this.materials.table);
    crate.position.set(x, y + h / 2, z);
    this.scene.add(crate);
    chunkData.meshes.push(crate);

    const box = new THREE.Box3().setFromObject(crate);
    this.registerCollider(box);
    chunk.colliders.push(box);
    return crate;
  }

  createItemPickupToChunk(chunk, x, y, z, type, name) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (type === 'battery') {
      // 1980s Cylindrical Flashlight D-Cell Alkaline Battery (Gold & Black)
      const battBodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
      const battBodyMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 25 });
      const battBody = new THREE.Mesh(battBodyGeo, battBodyMat);
      battBody.position.y = 0.06;
      group.add(battBody);

      // Gold Top Ring
      const topGeo = new THREE.CylinderGeometry(0.0405, 0.0405, 0.035, 12);
      const topMat = new THREE.MeshPhongMaterial({ color: 0xd4af37, shininess: 60, specular: 0xffeeaa });
      const topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.y = 0.105;
      group.add(topMesh);

      // Positive Nub
      const nubGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.015, 8);
      const nub = new THREE.Mesh(nubGeo, topMat);
      nub.position.y = 0.128;
      group.add(nub);
    } else if (type === 'security_keycard') {
      const cardMat = new THREE.MeshPhongMaterial({ color: 0xd8e5df, shininess: 55 });
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.11), cardMat);
      card.position.y = 0.008;
      group.add(card);

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1b3340 });
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.025), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.015, -0.025);
      group.add(stripe);

      const clearanceMat = new THREE.MeshBasicMaterial({ color: 0xc62828 });
      const clearanceMark = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), clearanceMat);
      clearanceMark.rotation.x = -Math.PI / 2;
      clearanceMark.position.set(0.052, 0.016, 0.022);
      group.add(clearanceMark);

      group.rotation.y = -0.22;
    } else if (type === 'almond_water') {
      // Vintage Glass Bottle with Vintage Label & Metallic Cap
      const bottleGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.18, 12);
      const bottleMat = new THREE.MeshPhongMaterial({ color: 0x6b8e6b, transparent: true, opacity: 0.85, shininess: 80, specular: 0xffffff });
      const bottle = new THREE.Mesh(bottleGeo, bottleMat);
      bottle.position.y = 0.09;
      group.add(bottle);

      // Label Band
      const labelGeo = new THREE.CylinderGeometry(0.046, 0.048, 0.08, 12);
      const labelMat = new THREE.MeshBasicMaterial({ color: 0xf5eed7 });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.y = 0.09;
      group.add(label);

      // Metal Cap
      const capGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8);
      const capMat = new THREE.MeshPhongMaterial({ color: 0xc4c4c4, shininess: 50 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.19;
      group.add(cap);
    } else if (type === 'medkit') {
      // 1980s Red Cross Medical Tin Box
      const boxGeo = new THREE.BoxGeometry(0.28, 0.14, 0.20);
      const boxMat = new THREE.MeshPhongMaterial({ color: 0xe8e4dc, shininess: 30 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 0.07;
      group.add(box);

      // Red Cross Decal on Top
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xcc1111 });
      const bar1 = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.025), crossMat);
      bar1.rotateX(-Math.PI / 2);
      bar1.position.set(0, 0.141, 0);
      const bar2 = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.08), crossMat);
      bar2.rotateX(-Math.PI / 2);
      bar2.position.set(0, 0.141, 0);
      group.add(bar1, bar2);
    } else if (type === 'gas_can') {
      if (this.gasCanModel) {
        const canClone = this.gasCanModel.clone();
        canClone.position.y = 0;
        group.add(canClone);
      } else {
        // Red Gas Can Jerrycan fallback
        const canGeo = new THREE.BoxGeometry(0.35, 0.42, 0.22);
        const canMat = new THREE.MeshPhongMaterial({ color: 0xcc2211, shininess: 30 });
        const can = new THREE.Mesh(canGeo, canMat);
        can.position.y = 0.21;
        group.add(can);

        // Handle
        const hGeo = new THREE.BoxGeometry(0.04, 0.08, 0.18);
        const hMesh = new THREE.Mesh(hGeo, canMat);
        hMesh.position.set(0, 0.44, 0);
        group.add(hMesh);

        // Spout
        const spGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8);
        const spMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
        const sp = new THREE.Mesh(spGeo, spMat);
        sp.position.set(0.12, 0.44, -0.05);
        sp.rotateZ(-0.4);
        group.add(sp);
      }
    } else if (type === 'crow_bar') {
      // 1. High-Detail Forged Steel Crowbar with Red High-Visibility Grip
      const crowbarGroup = new THREE.Group();
      
      // Main Hexagonal Steel Shaft
      const shaftGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.9, 6);
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x6a7b8c, roughness: 0.35, metalness: 0.85 });
      const shaft = new THREE.Mesh(shaftGeo, steelMat);
      shaft.rotation.z = Math.PI / 2;
      shaft.castShadow = true;
      crowbarGroup.add(shaft);

      // Red High-Visibility Middle Grip Sleeve
      const gripGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.45, 6);
      const gripMat = new THREE.MeshStandardMaterial({ color: 0xcc2211, roughness: 0.5, metalness: 0.1 });
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.rotation.z = Math.PI / 2;
      crowbarGroup.add(grip);

      // Curved Pry Hook Claw
      const hookGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.22, 6);
      const hook = new THREE.Mesh(hookGeo, steelMat);
      hook.rotation.z = Math.PI / 3.2;
      hook.position.set(0.48, 0.09, 0);
      hook.castShadow = true;
      crowbarGroup.add(hook);

      // Chisel Wedge Tip at bottom end
      const tipGeo = new THREE.BoxGeometry(0.08, 0.012, 0.04);
      const tip = new THREE.Mesh(tipGeo, steelMat);
      tip.position.set(-0.47, 0, 0);
      crowbarGroup.add(tip);

      // Raycast Target Box for easy interaction
      const hitboxGeo = new THREE.BoxGeometry(1.2, 0.5, 0.5);
      const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
      crowbarGroup.add(hitbox);

      // If FBX is loaded, overlay it as well
      if (this.crowbarModel) {
        const barClone = this.crowbarModel.clone();
        barClone.position.set(0, 0, 0);
        crowbarGroup.add(barClone);
      }

      crowbarGroup.position.y = 0.04;
      group.add(crowbarGroup);
    } else if (type.includes('tape') || type.includes('mercer') || type.includes('cole')) {
      // 1980s Microcassette Body (Black plastic shell with cream/white label & spool holes)
      const tapeGeo = new THREE.BoxGeometry(0.26, 0.05, 0.17);
      const tapeMesh = new THREE.Mesh(tapeGeo, this.materials.tape);
      tapeMesh.position.y = 0.025;
      group.add(tapeMesh);

      // White/Cream Paper Label on Top
      const labelGeo = new THREE.PlaneGeometry(0.22, 0.13);
      labelGeo.rotateX(-Math.PI / 2);
      const labelMat = new THREE.MeshBasicMaterial({ color: 0xfbf8e6 });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.set(0, 0.052, 0);
      group.add(label);

      // Red/Black Handwritten Title Line on Label
      const lineGeo = new THREE.PlaneGeometry(0.18, 0.02);
      lineGeo.rotateX(-Math.PI / 2);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xaa2222 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.053, -0.03);
      group.add(line);
    } else {
      const paperGeo = new THREE.PlaneGeometry(0.3, 0.35);
      paperGeo.rotateX(-Math.PI / 2);
      const paperMesh = new THREE.Mesh(paperGeo, new THREE.MeshBasicMaterial({ color: 0xefe8d0 }));
      paperMesh.position.y = 0.01;
      group.add(paperMesh);
    }

    this.scene.add(group);
    chunk.meshes.push(group);

    const itemObj = {
      mesh: group,
      type,
      name,
      worldPos: new THREE.Vector3(x, y, z)
    };
    this.interactiveObjects.push(itemObj);
    chunk.interactive.push(itemObj);
    return group;
  }
}
