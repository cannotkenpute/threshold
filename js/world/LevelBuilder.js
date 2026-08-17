/**
 * 1980s Backrooms Multi-Level World & Chunk Streaming Generator
 * Level 1: "The Yellow Sector" (Infinite Mustard Wallpaper Maze)
 * Level 2: "The Subterranean Complex" (Infinite Parking Garage with Procedural 1980s Cars & Directional Signage)
 * Level 3: "The Desert Freeway" (Infinite Four-Lane Highway Through a Night Desert)
 */

import { CONFIG } from '../config.js';

export class LevelBuilder {
  constructor(scene, lightManager, shiftingSpace) {
    this.scene = scene;
    this.lightManager = lightManager;
    this.shiftingSpace = shiftingSpace;

    this.currentLevel = 1;
    this.CHUNK_SIZE = 24.0;
    this.STREAM_RADIUS = 2; // 5x5 chunk active grid around player (120m x 120m)
    this.UNLOAD_RADIUS = 3; // Distance > 3 unloads distant chunks
    this.CHUNKS_PER_FRAME_BUDGET = 2; // Time-slice cap for incremental streaming (buildFullLevel force path is exempt)

    // Pending chunk-generation queue for the time-sliced streaming path (persists across frames)
    this.pendingChunkQueue = [];

    // Re-rolled per buildFullLevel() call: reseeds the Level 1 room-region maze
    // (landmark chunks are hand-authored and never read this, so they never move)
    this.levelSeed = Math.random() * 10000;
    this.regionCache = new Map(); // memoized per-macro-block region grids, keyed by "mbx_mbz"

    this.activeChunks = new Map(); // Key: `${cx}_${cz}` -> Chunk data
    this.chunkLifecycleListeners = new Set();
    this.notifiedChunkKeys = new Set();
    this.colliders = []; // Global bounding boxes for collision
    this.spatialGrid = new Map(); // Spatial partition for O(1) collision lookups
    this.interactiveObjects = []; // Interactive items/triggers
    this.interactiveVersion = 0; // bumped on every add/remove; Player uses it to invalidate its raycast-mesh cache
    this.floodedZones = []; // Zones that trigger wet footstep audio

    // Alloc-free collision queries: reused result array + monotonically increasing stamp
    // used to dedup boxes that appear in multiple spatial-grid cells.
    this._nearbyCollidersScratch = [];
    this._queryStamp = 0;
    // Scratch camera direction for the wallpaper LOD pass (no per-call allocation).
    this._lodCamDir = new THREE.Vector3();

    this.materials = this.createTexturesAndMaterials();
    this.carModelsCache = new Map();
    this.gasCanModel = null;
    this.crowbarModel = null;
    this.highwayRoadModel = null;
    this.highwayLightModel = null;
    this.desertGasStationModel = null;
    this.desertConvenienceStoreModel = null;
    this.convenienceStoreKeyModel = null;
    this.isConvenienceStoreUnlocked = false;
    this.hasConvenienceStoreKeyCollected = false;
    this.gasStationWalkablePerimeter = {
      minX: 12.0,
      maxX: 42.0,
      minZ: -734.0,
      maxZ: -704.0
    };
    this.cityMapModel = null;
    this.initCarAssets();
    this.initGasCanAsset();
    this.initCrowbarAsset();
    this.initHighwayRoadAsset();
    this.initDesertRoadsideLandmarkAssets();
    this.lastPlayerCX = null;
    this.lastPlayerCZ = null;
    this.wallpaperWallMeshes = [];
    this.lodFrameCounter = 0;

    // Survival Mode: set by main.js on launch. Gates ration_pack/canteen_water into the
    // Level 1 item-spawn roll pool and applies the day/night-cycle-driven scarcity multiplier.
    this.survivalMode = false;
    this.survivalScarcityMultiplier = 1.0;
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
    if (typeof THREE.GLTFLoader === 'undefined') return;
    const loader = new THREE.GLTFLoader();

    loader.load('./assets/models/desert_freeway_road/simple-road_extracted/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      this.highwayRoadModel = gltf.scene;
      console.log('[DesertFreeway] Sketchfab road loaded successfully.');
    }, undefined, (err) => {
      console.warn('[DesertFreeway] Failed to load Sketchfab road:', err);
    });

    loader.load('./assets/models/desert_freeway_lights/street-lights_extracted/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      this.highwayLightModel = gltf.scene.getObjectByName('polySurface109') || gltf.scene;
      console.log('[DesertFreeway] Sketchfab highway lights loaded successfully.');
    }, undefined, (err) => {
      console.warn('[DesertFreeway] Failed to load Sketchfab highway lights:', err);
    });
  }

  initDesertRoadsideLandmarkAssets() {
    if (typeof THREE.GLTFLoader === 'undefined') return;
    const loader = new THREE.GLTFLoader();

    loader.load('./assets/models/desert_gas_station/retro-gas-station_extracted/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      this.desertGasStationModel = gltf.scene;
      console.log('[DesertFreeway] Sketchfab gas station loaded successfully.');
    }, undefined, (err) => {
      console.warn('[DesertFreeway] Failed to load Sketchfab gas station:', err);
    });

    loader.load('./assets/models/desert_convenience_store/psx-store_extracted/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      this.desertConvenienceStoreModel = gltf.scene;
      console.log('[DesertFreeway] Sketchfab convenience store loaded successfully.');
    }, undefined, (err) => {
      console.warn('[DesertFreeway] Failed to load Sketchfab convenience store:', err);
    });

    loader.load('./assets/models/convenience_store_key/antique-old-key_extracted/scene.gltf', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      this.convenienceStoreKeyModel = gltf.scene;
      console.log('[DesertFreeway] Sketchfab convenience-store key loaded successfully.');
    }, undefined, (err) => {
      console.warn('[DesertFreeway] Failed to load Sketchfab convenience-store key:', err);
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
          this.clearAllWorld();
        }
      }, undefined, (err) => {
        console.warn(`Could not load car model ${path}:`, err);
      });
    });
  }

  createTexturesAndMaterials() {
    const texLoader = new THREE.TextureLoader();

    // 1. Authentic Backrooms Wallpaper Textures (High-Res 512x512 with normal map & Low-Res 128x128 LOD)
    const wallTexHigh = texLoader.load('./assets/textures/backrooms-wallpaper.jpg');
    wallTexHigh.wrapS = THREE.RepeatWrapping;
    wallTexHigh.wrapT = THREE.RepeatWrapping;
    wallTexHigh.repeat.set(1.5, 1.2);
    wallTexHigh.encoding = THREE.sRGBEncoding;

    const wallNormalHigh = texLoader.load('./assets/textures/backrooms-wallpaper-normal.jpg');
    wallNormalHigh.wrapS = THREE.RepeatWrapping;
    wallNormalHigh.wrapT = THREE.RepeatWrapping;
    wallNormalHigh.repeat.set(1.5, 1.2);

    // Low-Res LOD Texture for off-screen / distant / peripheral walls
    const wallTexLow = texLoader.load('./assets/textures/backrooms-wallpaper-low.jpg');
    wallTexLow.wrapS = THREE.RepeatWrapping;
    wallTexLow.wrapT = THREE.RepeatWrapping;
    wallTexLow.repeat.set(1.5, 1.2);
    wallTexLow.encoding = THREE.sRGBEncoding;

    // 2. Authentic Level 1 Carpet Textures (Albedo, 3D Normal Map & Roughness)
    const carpetAlbedo = texLoader.load('./assets/textures/carpet_texture.jpg');
    carpetAlbedo.wrapS = THREE.RepeatWrapping;
    carpetAlbedo.wrapT = THREE.RepeatWrapping;
    carpetAlbedo.repeat.set(24, 24);
    carpetAlbedo.encoding = THREE.sRGBEncoding;

    const carpetNormal = texLoader.load('./assets/textures/carpet_normal.jpg');
    carpetNormal.wrapS = THREE.RepeatWrapping;
    carpetNormal.wrapT = THREE.RepeatWrapping;
    carpetNormal.repeat.set(24, 24);

    const carpetRoughness = texLoader.load('./assets/textures/carpet_roughness.jpg');
    carpetRoughness.wrapS = THREE.RepeatWrapping;
    carpetRoughness.wrapT = THREE.RepeatWrapping;
    carpetRoughness.repeat.set(24, 24);

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

    // 8. Level 3 Four-Lane Weathered Freeway Texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const ctxR = roadCanvas.getContext('2d');
    ctxR.fillStyle = '#181b1d';
    ctxR.fillRect(0, 0, 512, 512);

    // Asphalt noise grain
    for (let i = 0; i < 6000; i++) {
      ctxR.fillStyle = Math.random() > 0.5 ? '#131517' : '#222629';
      ctxR.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // Solid white outer shoulder lines
    ctxR.fillStyle = '#c5d0d8';
    ctxR.fillRect(22, 0, 7, 512);
    ctxR.fillRect(483, 0, 7, 512);

    // Broken white lane dividers for two lanes in each direction
    ctxR.fillStyle = '#d5dbdc';
    for (let y = 16; y < 512; y += 64) {
      ctxR.fillRect(132, y, 5, 36);
      ctxR.fillRect(375, y, 5, 36);
    }

    // Solid yellow lines border the concrete median.
    ctxR.fillStyle = '#d2ad2e';
    ctxR.fillRect(239, 0, 6, 512);
    ctxR.fillRect(267, 0, 6, 512);
    const highwayRoadTex = new THREE.CanvasTexture(roadCanvas);
    highwayRoadTex.wrapS = THREE.RepeatWrapping;
    highwayRoadTex.wrapT = THREE.RepeatWrapping;
    highwayRoadTex.repeat.set(1, 2);

    // 9. Desert Sand & Gravel Shoulder Texture
    const desertCanvas = document.createElement('canvas');
    desertCanvas.width = 256;
    desertCanvas.height = 256;
    const ctxF = desertCanvas.getContext('2d');
    ctxF.fillStyle = '#8f6f43';
    ctxF.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      ctxF.fillStyle = Math.random() > 0.5 ? '#715536' : '#aa8650';
      ctxF.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
    const desertGroundTex = new THREE.CanvasTexture(desertCanvas);
    desertGroundTex.wrapS = THREE.RepeatWrapping;
    desertGroundTex.wrapT = THREE.RepeatWrapping;
    desertGroundTex.repeat.set(3, 3);

    // 10. 1980s Retro Car Paint Colors
    const carPaints = [
      new THREE.MeshPhongMaterial({ color: 0x732020, shininess: 40, specular: 0x555555 }), // Burgundy
      new THREE.MeshPhongMaterial({ color: 0x243a59, shininess: 40, specular: 0x555555 }), // Faded Navy
      new THREE.MeshPhongMaterial({ color: 0x75684a, shininess: 30, specular: 0x444444 }), // Mustard Beige
      new THREE.MeshPhongMaterial({ color: 0x2d4732, shininess: 35, specular: 0x444444 }), // Forest Green
      new THREE.MeshPhongMaterial({ color: 0x595c5e, shininess: 25, specular: 0x333333 }), // Primer Grey
      new THREE.MeshPhongMaterial({ color: 0x8a7238, shininess: 35, specular: 0x555555 })  // Ochre Gold
    ];

    return {
      wallpaper: new THREE.MeshPhongMaterial({
        map: wallTexHigh,
        normalMap: wallNormalHigh,
        normalScale: new THREE.Vector2(0.8, 0.8),
        shininess: 2,
        specular: 0x111111
      }),
      wallpaperLow: new THREE.MeshPhongMaterial({
        map: wallTexLow,
        shininess: 1,
        specular: 0x050505
      }),
      carpet: new THREE.MeshPhongMaterial({
        map: carpetAlbedo,
        normalMap: carpetNormal,
        normalScale: new THREE.Vector2(1.2, 1.2),
        shininess: 3,
        specular: 0x111111
      }),
      wetCarpet: new THREE.MeshPhongMaterial({
        map: carpetAlbedo,
        normalMap: carpetNormal,
        normalScale: new THREE.Vector2(1.8, 1.8),
        color: 0x3d3420,
        shininess: 24,
        specular: 0x444444
      }),
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

      // Level 3 Highway Materials
      highwayRoad: new THREE.MeshPhongMaterial({ map: highwayRoadTex, shininess: 12, specular: 0x333333 }),
      desertGround: new THREE.MeshPhongMaterial({ map: desertGroundTex, shininess: 1 }),
      desertRock: new THREE.MeshLambertMaterial({ color: 0x5f4935 }),
      cactus: new THREE.MeshLambertMaterial({ color: 0x294b32 }),
      treeBark: new THREE.MeshLambertMaterial({ color: 0x181410 }),
      guardrail: new THREE.MeshPhongMaterial({ color: 0x58646b, shininess: 40, specular: 0x777777 }),
      highwaySignGreen: new THREE.MeshLambertMaterial({ color: 0x0c3d1e }),

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

  // Master build entry point for Level 1. `forcedSeed` lets multiplayer Survival matches
  // pass the host-issued match seed so every client's hashF()-driven maze (see below) comes
  // out identical -- without it each client would independently roll its own Math.random()
  // layout and players would be standing in physically different mazes despite sharing one
  // match session. Reduced into the same ~[0, 10000) range buildFullLevel has always used;
  // hashF's `* 0.6180339887` golden-ratio hash relies on levelSeed being that small, not the
  // full-precision 53-bit match seed.
  buildFullLevel(forcedSeed = null) {
    this.currentLevel = 1;
    this.levelSeed = forcedSeed !== null && forcedSeed !== undefined
      ? Number(forcedSeed) % 10000
      : Math.random() * 10000; // new maze layout every run; landmarks are unaffected
    this.regionCache.clear();
    this.clearAllWorld();
    this.update(new THREE.Vector3(0, 1.65, 20), true);
  }

  // Switch to Level 2 (Parking Garage) or Level 3 (The Desert Freeway)
  switchLevel(levelNumber, playerPos = new THREE.Vector3(0, 1.65, 0)) {
    this.currentLevel = levelNumber;
    this.clearAllWorld();

    if (this.currentLevel === 3) {
      this.createArtificialSky(playerPos);
    } else {
      this.removeArtificialSky();
    }

    // Level 3 is an isolated desert freeway; urban infrastructure never carries over.
    if (this.cityMapModel && this.scene.children.includes(this.cityMapModel)) {
      this.scene.remove(this.cityMapModel);
    }

    this.update(playerPos, true);
  }

  createArtificialSky(playerPos) {
    this.removeArtificialSky();

    const skyGroup = new THREE.Group();
    const pX = playerPos ? playerPos.x : 0;
    const pZ = playerPos ? playerPos.z : 0;
    skyGroup.position.set(pX, 0, pZ);

    // 1. Vast Hemispherical Sky Dome with Subtle Grid & Horizon Haze (Artificial Anomaly Sky)
    const skyDomeGeo = new THREE.SphereGeometry(280, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      color: 0x4a6572,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    skyDome.name = 'ArtificialSkyDome';
    skyGroup.add(skyDome);

    // 2. Artificial Glowing Sun Sphere (Simulated Anomaly Luminary)
    const sunGroup = new THREE.Group();
    sunGroup.name = 'ArtificialSunGroup';
    // Position sun high in the southern sky
    sunGroup.position.set(50, 140, -180);

    // Core blazing sun sphere
    const sunGeo = new THREE.SphereGeometry(14, 20, 20);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
      depthWrite: false,
      fog: false
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);

    // Outer solar corona / glow halo
    const coronaGeo = new THREE.SphereGeometry(22, 16, 16);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffd277,
      transparent: true,
      opacity: 0.38,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    sunGroup.add(coronaMesh);

    skyGroup.add(sunGroup);

    this.scene.add(skyGroup);
    this.artificialSkyGroup = skyGroup;
  }

  removeArtificialSky() {
    if (this.artificialSkyGroup) {
      this.scene.remove(this.artificialSkyGroup);
      this.artificialSkyGroup = null;
    }
  }

  clearAllWorld() {
    this.removeArtificialSky();
    const keys = Array.from(this.activeChunks.keys());
    for (let i = 0; i < keys.length; i++) {
      this.removeChunk(keys[i]);
    }
    this.activeChunks.clear();
    this.notifiedChunkKeys.clear();
    this.colliders.length = 0;
    this.spatialGrid.clear();
    this.interactiveObjects.length = 0;
    this.interactiveVersion++;
    this.floodedZones.length = 0;
    this.wallpaperWallMeshes.length = 0;
    this.pendingChunkQueue.length = 0;
    this.lastPlayerCX = null;
    this.lastPlayerCZ = null;
    if (this.lightManager && this.lightManager.resetSuppressions) this.lightManager.resetSuppressions();

    if (this.currentLevel !== 3 && this.cityMapModel) {
      this.scene.remove(this.cityMapModel);
    }
  }

  // Dispatches to the correct per-level chunk generator. Shared by the forced
  // full-load path and the time-sliced incremental streaming drain below.
  generateChunkForLevel(cx, cz) {
    const key = `${cx}_${cz}`;
    try {
      if (this.currentLevel === 3) {
        this.generateHighwayChunk(cx, cz);
      } else if (this.currentLevel === 2) {
        this.generateParkingGarageChunk(cx, cz);
      } else {
        this.generateChunk(cx, cz);
      }
      this.notifyChunkLoaded(key);
    } catch (err) {
      // A throw mid-generation would otherwise propagate out of update() and kill the whole
      // render loop -- the frame never reaches render(), and because WebGL doesn't preserve the
      // drawing buffer the canvas goes black. Contain it to the one bad chunk instead.
      console.error(`[LevelBuilder] Chunk ${key} failed to generate:`, err);
      // Register a placeholder so the failed chunk isn't re-queued and retried every frame.
      if (!this.activeChunks.has(key)) {
        this.activeChunks.set(key, {
          key, cx, cz, meshes: [], colliders: [], lights: [], interactive: [], flooded: [], failed: true
        });
      }
      this.notifyChunkLoaded(key);
    }
  }

  onChunkLifecycle(listener) {
    if (typeof listener !== 'function') throw new TypeError('Chunk lifecycle listener must be a function');
    this.chunkLifecycleListeners.add(listener);
    return () => this.chunkLifecycleListeners.delete(listener);
  }

  emitChunkLifecycle(type, chunk) {
    const event = Object.freeze({ type, key: chunk.key, cx: chunk.cx, cz: chunk.cz, chunk });
    for (const listener of this.chunkLifecycleListeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[LevelBuilder] Chunk lifecycle listener failed:', error);
      }
    }
  }

  notifyChunkLoaded(key) {
    if (this.notifiedChunkKeys.has(key)) return;
    const chunk = this.activeChunks.get(key);
    if (!chunk) return;
    this.notifiedChunkKeys.add(key);
    this.emitChunkLifecycle('loaded', chunk);
  }

  // Generates queued chunks until the frame's wall-clock budget is spent, closest-to-player
  // first. Re-sorts by current distance every drain so priority stays accurate as the player
  // keeps moving, and re-validates range at generation time so a chunk the player has since
  // sprinted away from is skipped instead of being generated only to be unloaded on the very
  // next update. A time budget (instead of a fixed chunk count) smooths streaming: one heavy
  // parking-garage chunk with a dozen cars can take longer than two simple maze chunks.
  drainPendingChunkQueue(currentCX, currentCZ) {
    if (this.pendingChunkQueue.length === 0) return;

    const streamRadiusX = this.currentLevel === 3 ? 1 : this.STREAM_RADIUS;
    const streamRadiusZ = this.STREAM_RADIUS;

    this.pendingChunkQueue.sort((a, b) => {
      const da = Math.max(Math.abs(a.cx - currentCX), Math.abs(a.cz - currentCZ));
      const db = Math.max(Math.abs(b.cx - currentCX), Math.abs(b.cz - currentCZ));
      return da - db;
    });

    const budgetMs = CONFIG.PERF.CHUNK_FRAME_BUDGET_MS;
    const deadline = performance.now() + budgetMs;
    let i = 0;
    while (i < this.pendingChunkQueue.length) {
      // Budget check happens before starting each chunk; an in-progress chunk always runs
      // to completion (generation is synchronous), and at least one chunk is attempted
      // per drain when anything is in range so the queue can never stall.
      if (performance.now() > deadline && i > 0) break;

      const entry = this.pendingChunkQueue[i];

      // Already generated (e.g. queued twice before its turn came up) -- drop silently.
      if (this.activeChunks.has(entry.key)) {
        this.pendingChunkQueue.splice(i, 1);
        continue;
      }

      const distX = Math.abs(entry.cx - currentCX);
      const distZ = Math.abs(entry.cz - currentCZ);
      const inRange = distX <= streamRadiusX && distZ <= streamRadiusZ;
      if (!inRange) {
        this.pendingChunkQueue.splice(i, 1);
        continue;
      }

      this.generateChunkForLevel(entry.cx, entry.cz);
      this.pendingChunkQueue.splice(i, 1);
    }
  }

  // --- DYNAMIC PROCEDURAL STREAMING UPDATE ---
  update(playerPos, force = false) {
    if (!playerPos) return;

    const currentCX = Math.round(playerPos.x / this.CHUNK_SIZE);
    const currentCZ = Math.round(playerPos.z / this.CHUNK_SIZE);

    if (this.currentLevel === 3 && this.artificialSkyGroup) {
      this.artificialSkyGroup.position.set(playerPos.x, 0, playerPos.z);
    }

    const crossedChunk = force || currentCX !== this.lastPlayerCX || currentCZ !== this.lastPlayerCZ;

    if (!crossedChunk) {
      // Keep draining the pending queue even when the player hasn't crossed into a new chunk this
      // frame, so time-sliced generation makes progress every frame instead of only on boundary-crosses.
      this.drainPendingChunkQueue(currentCX, currentCZ);
      return;
    }

    this.lastPlayerCX = currentCX;
    this.lastPlayerCZ = currentCZ;

    // The freeway is corridor-shaped, so it only needs one desert chunk on each side.
    const streamRadiusX = this.currentLevel === 3 ? 1 : this.STREAM_RADIUS;
    const streamRadiusZ = this.STREAM_RADIUS;

    if (force) {
      // One-time synchronous full load (level start / mode launch): the player has just clicked a
      // menu button and isn't in control yet, so a single guaranteed synchronous load is the right
      // tradeoff here -- better than spawning into missing geometry. Deliberately NOT time-sliced.
      for (let dx = -streamRadiusX; dx <= streamRadiusX; dx++) {
        for (let dz = -streamRadiusZ; dz <= streamRadiusZ; dz++) {
          const cx = currentCX + dx;
          const cz = currentCZ + dz;
          const key = `${cx}_${cz}`;
          if (!this.activeChunks.has(key)) {
            this.generateChunkForLevel(cx, cz);
          }
        }
      }
      // Discard any stale queue entries from before this forced rebuild (e.g. level restart).
      this.pendingChunkQueue.length = 0;
    } else {
      // Ongoing-movement streaming: queue not-yet-active, not-already-queued chunks in range instead
      // of generating them all synchronously; drainPendingChunkQueue() below spreads the work
      // across frames at CHUNKS_PER_FRAME_BUDGET per call.
      for (let dx = -streamRadiusX; dx <= streamRadiusX; dx++) {
        for (let dz = -streamRadiusZ; dz <= streamRadiusZ; dz++) {
          const cx = currentCX + dx;
          const cz = currentCZ + dz;
          const key = `${cx}_${cz}`;
          if (this.activeChunks.has(key)) continue;
          if (this.pendingChunkQueue.some(e => e.key === key)) continue;
          this.pendingChunkQueue.push({ key, cx, cz });
        }
      }
    }

    // 2. Unload chunks beyond UNLOAD_RADIUS (preserve origin lab chunks in Level 1)
    const keysToRemove = [];
    for (let [key, chunk] of this.activeChunks.entries()) {
      if (this.currentLevel === 1 && (key === '0_1' || key === '0_0')) continue;
      const distX = Math.abs(chunk.cx - currentCX);
      const distZ = Math.abs(chunk.cz - currentCZ);
      const shouldUnload = this.currentLevel === 3
        ? distX > streamRadiusX || distZ > streamRadiusZ
        : Math.max(distX, distZ) > this.UNLOAD_RADIUS;
      if (shouldUnload) {
        keysToRemove.push(key);
      }
    }
    for (let i = 0; i < keysToRemove.length; i++) {
      this.removeChunk(keysToRemove[i]);
      // A chunk that was queued for generation but has now scrolled out of range and been
      // unloaded (shouldn't normally coexist, but guards against edge cases) should not linger.
      const removedKey = keysToRemove[i];
      const qi = this.pendingChunkQueue.findIndex(e => e.key === removedKey);
      if (qi !== -1) this.pendingChunkQueue.splice(qi, 1);
    }

    if (!force) {
      this.drainPendingChunkQueue(currentCX, currentCZ);
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
      this.pushInteractive(spawnCarInteractive);
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
      this.pushInteractive(lockedCarObj);
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
  // LEVEL 3: INFINITE DESERT FREEWAY PROCEDURAL GENERATOR (Route 9 Anomaly)
  // =========================================================================
  createPRNG(seed) {
    let state = Math.trunc(seed) >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

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
      interactive: [],
      flooded: []
    };

    const prng = this.createPRNG(cx * 1337 + cz * 7919 + 333);

    // 1. Four-Lane divided freeway surface
    if (cx === 0) {
      const roadGeo = new THREE.PlaneGeometry(24.0, this.CHUNK_SIZE);
      const roadMesh = new THREE.Mesh(roadGeo, this.materials.highwayRoad);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(centerX, 0.01, centerZ);
      roadMesh.receiveShadow = true;
      this.scene.add(roadMesh);
      chunkData.meshes.push(roadMesh);

      // Sketchfab road segment overlays the procedural surface when available.
      [-6.05, 6.05].forEach((roadX, index) => {
        const roadAsset = this.createFittedHighwayRoadAsset(roadX, centerZ, index === 0 ? 0 : Math.PI);
        if (!roadAsset) return;
        this.scene.add(roadAsset);
        chunkData.meshes.push(roadAsset);
      });

      // Sand and gravel shoulders blend the freeway into the desert.
      [-14.0, 14.0].forEach(sx => {
        const shoulderGeo = new THREE.PlaneGeometry(4.0, this.CHUNK_SIZE);
        const shoulder = new THREE.Mesh(shoulderGeo, this.materials.desertGround);
        shoulder.rotation.x = -Math.PI / 2;
        shoulder.position.set(centerX + sx, 0.0, centerZ);
        shoulder.receiveShadow = true;
        this.scene.add(shoulder);
        chunkData.meshes.push(shoulder);
      });

      // Low concrete median divides opposing traffic lanes.
      const median = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.42, this.CHUNK_SIZE),
        new THREE.MeshPhongMaterial({ color: 0x77736a, shininess: 4 })
      );
      median.position.set(0, 0.21, centerZ);
      this.scene.add(median);
      chunkData.meshes.push(median);
      const medianCollider = new THREE.Box3().setFromObject(median);
      this.registerCollider(medianCollider);
      chunkData.colliders.push(medianCollider);

      // The station row leaves a wide opening in the east guardrail for its driveway.
      const isNearStation = Math.abs(cz - (-30)) <= 1;
      const guardrailXs = isNearStation ? [-12.35] : [-12.35, 12.35];
      guardrailXs.forEach((railX) => {
        const rIdx = railX < 0 ? 0 : 1;
        const railGroup = new THREE.Group();
        railGroup.position.set(railX, 0.45, centerZ);

        // Continuous beam
        const beamGeo = new THREE.BoxGeometry(0.2, 0.5, this.CHUNK_SIZE);
        const beam = new THREE.Mesh(beamGeo, this.materials.guardrail);
        beam.castShadow = false;
        railGroup.add(beam);

        // Support I-beam posts every 6m
        for (let pz = -this.CHUNK_SIZE / 2 + 3; pz < this.CHUNK_SIZE / 2; pz += 6) {
          const postGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
          const post = new THREE.Mesh(postGeo, this.materials.guardrail);
          post.position.set(rIdx === 0 ? -0.1 : 0.1, -0.2, pz);
          railGroup.add(post);

          // Small amber/red reflector stud on guardrail post
          const refGeo = new THREE.BoxGeometry(0.04, 0.12, 0.06);
          const refMat = new THREE.MeshBasicMaterial({ color: rIdx === 0 ? 0xffcc22 : 0xee3322 });
          const refMesh = new THREE.Mesh(refGeo, refMat);
          refMesh.position.set(rIdx === 0 ? 0.12 : -0.12, 0.0, pz);
          railGroup.add(refMesh);
        }

        this.scene.add(railGroup);
        chunkData.meshes.push(railGroup);

        const box = new THREE.Box3().setFromObject(railGroup);
        this.registerCollider(box);
        chunkData.colliders.push(box);
      });

      // 3. Sparse wooden utility poles crossing the open desert.
      if (Math.abs(cz % 2) === 0) {
        const poleGroup = new THREE.Group();
        poleGroup.position.set(centerX - 17.0, 0, centerZ);

        // Tall wooden pole
        const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 11, 8);
        const pole = new THREE.Mesh(poleGeo, this.materials.treeBark);
        pole.position.y = 5.5;
        pole.castShadow = false;
        poleGroup.add(pole);

        // Crossarm beam
        const crossGeo = new THREE.BoxGeometry(2.8, 0.2, 0.2);
        const cross = new THREE.Mesh(crossGeo, this.materials.treeBark);
        cross.position.set(0, 10.2, 0);
        poleGroup.add(cross);

        // Ceramic insulators
        [-1.1, 0, 1.1].forEach(ix => {
          const insGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 6);
          const insMat = new THREE.MeshLambertMaterial({ color: 0x2e4036 });
          const ins = new THREE.Mesh(insGeo, insMat);
          ins.position.set(ix, 10.4, 0);
          poleGroup.add(ins);
        });

        // Drooping power lines running along Z
        const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, this.CHUNK_SIZE, 6);
        cableGeo.rotateX(Math.PI / 2);
        const cableMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.set(0, 10.0, 0);
        poleGroup.add(cable);

        this.scene.add(poleGroup);
        chunkData.meshes.push(poleGroup);
      }

      // 4. Repeating Sketchfab highway lights with sodium-vapor illumination.
      if (Math.abs(cz % 2) === 0) {
        [-13.7, 13.7].forEach((lightX, index) => {
          const streetGroup = this.createHighwayLightAsset(
            centerX + lightX,
            centerZ,
            index === 0 ? Math.PI / 2 : -Math.PI / 2
          ) || this.createProceduralHighwayLight(
            centerX + lightX,
            centerZ,
            index === 0 ? 1 : -1
          );

          this.scene.add(streetGroup);
          chunkData.meshes.push(streetGroup);

          const isFailing = prng() < 0.2;
          const lampX = centerX + (index === 0 ? -10.8 : 10.8);
          const streetLight = this.lightManager.createFluorescentFixture(lampX, 8.8, centerZ, {
            color: 0xffa13a,
            intensity: isFailing ? 1.15 : 2.35,
            distance: 30.0,
            isFailing
          });
          chunkData.lights.push(streetLight);
        });
      }

      // 5. Repeating Highway Mile Marker Posts
      const markerGroup = new THREE.Group();
      markerGroup.position.set(centerX + 11.2, 0.5, centerZ + 6.0);
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
      const post = new THREE.Mesh(postGeo, this.materials.metal);
      markerGroup.add(post);

      const signBoardGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
      const signBoardMat = new THREE.MeshLambertMaterial({ color: 0x0a4020 });
      const signBoard = new THREE.Mesh(signBoardGeo, signBoardMat);
      signBoard.position.set(0, 0.35, 0);
      markerGroup.add(signBoard);

      this.scene.add(markerGroup);
      chunkData.meshes.push(markerGroup);
    } else {
      // 6. Endless desert flanks (cx <= -1 and cx >= 1) — Open walkable void without invisible blocking colliders
      const desertGround = new THREE.Mesh(
        new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE),
        this.materials.desertGround
      );
      desertGround.rotation.x = -Math.PI / 2;
      desertGround.position.set(centerX, -0.03, centerZ);
      this.scene.add(desertGround);
      chunkData.meshes.push(desertGround);

      // Keep the full area around and beyond the store 100% collision-free
      const isGasStationParcel = cx >= 1 && Math.abs(cz + 30) <= 2;
      const duneCount = isGasStationParcel ? 0 : 2 + Math.floor(prng() * 2);
      for (let i = 0; i < duneCount; i++) {
        const dune = new THREE.Mesh(
          new THREE.SphereGeometry(1, 10, 6),
          this.materials.desertGround
        );
        const duneWidth = 3.5 + prng() * 5.5;
        dune.scale.set(duneWidth, 0.65 + prng() * 0.8, 2.5 + prng() * 4.0);
        dune.position.set(
          centerX + (prng() - 0.5) * 19,
          -0.45,
          centerZ + (prng() - 0.5) * 20
        );
        dune.rotation.y = prng() * Math.PI;
        this.scene.add(dune);
        chunkData.meshes.push(dune);
      }

      // Visual desert props (rocks / cacti) without extraneous collision boxes
      const propCount = isGasStationParcel ? 0 : 1 + Math.floor(prng() * 2);
      for (let i = 0; i < propCount; i++) {
        const px = centerX + (prng() - 0.5) * 19;
        const pz = centerZ + (prng() - 0.5) * 20;

        if (prng() > 0.42) {
          const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.7 + prng() * 1.0, 0),
            this.materials.desertRock
          );
          rock.scale.set(1.3 + prng(), 0.55 + prng() * 0.45, 0.9 + prng());
          rock.position.set(px, 0.45, pz);
          rock.rotation.set(prng(), prng() * Math.PI, prng() * 0.4);
          rock.castShadow = false;
          this.scene.add(rock);
          chunkData.meshes.push(rock);
        } else {
          const cactus = this.createDesertCactus(px, pz, 1.8 + prng() * 2.4);
          this.scene.add(cactus);
          chunkData.meshes.push(cactus);
        }
      }
    }

    // 7. Landmark: roadside gas station, 720m / about five minutes from spawn.
    if (cx === 0 && cz === -30) {
      this.createDesertGasStationLandmark(chunkData, centerZ);
    }

    // 8. Landmark: Abandoned State Highway Patrol Cruiser (cx: 0, cz: -3)
    else if (cx === 0 && cz === -3) {
      const policeX = centerX - 6.5;
      const policeZ = centerZ;
      this.createProceduralCar(
        chunkData,
        policeX,
        policeZ,
        Math.PI / 7,
        'police',
        this.materials.carPaints[0],
        prng
      );

      // Flashing Emergency Red & Blue Roof Strobes
      const redStrobe = new THREE.PointLight(0xff1111, 4.0, 30);
      redStrobe.position.set(policeX - 0.3, 1.85, policeZ);
      const blueStrobe = new THREE.PointLight(0x1144ff, 3.5, 30);
      blueStrobe.position.set(policeX + 0.3, 1.85, policeZ);
      this.scene.add(redStrobe, blueStrobe);
      chunkData.meshes.push(redStrobe, blueStrobe);

      // Interactive Police Radio Dispatch Tape
      this.createItemPickupToChunk(
        chunkData,
        policeX + 0.8,
        0.95,
        policeZ,
        'police_radio_tape',
        'State Highway Patrol Dispatch Cassette (Unit 412)'
      );
    }

    // 9. Landmark: Creepy Overhead Gantry Highway Sign (cx: 0, cz: 0)
    else if (cx === 0 && cz === 0) {
      const signGroup = new THREE.Group();
      signGroup.position.set(0, 5.8, centerZ);

      // Big retro green highway sign
      const boardGeo = new THREE.BoxGeometry(9.0, 2.4, 0.3);
      const board = new THREE.Mesh(boardGeo, this.materials.highwaySignGreen);
      board.castShadow = true;
      signGroup.add(board);

      // Gantry steel truss legs
      [-4.6, 4.6].forEach(gx => {
        const legGeo = new THREE.CylinderGeometry(0.2, 0.2, 6.2, 8);
        const leg = new THREE.Mesh(legGeo, this.materials.metal);
        leg.position.set(gx, -2.8, 0);
        signGroup.add(leg);
      });

      this.scene.add(signGroup);
      chunkData.meshes.push(signGroup);
    }

    // 10. Landmark: Eerie Rusted Roadside Billboard (cx: 0, cz: -6)
    else if (cx === 0 && cz === -6) {
      const billGroup = new THREE.Group();
      billGroup.position.set(centerX + 12.0, 0, centerZ);

      // Billboard panel
      const panelGeo = new THREE.BoxGeometry(8.0, 4.0, 0.3);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x221a14, roughness: 0.9 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(0, 6.0, 0);
      panel.rotation.y = -Math.PI / 8;
      billGroup.add(panel);

      // Support stilts
      [-3.0, 3.0].forEach(sx => {
        const stiltGeo = new THREE.CylinderGeometry(0.2, 0.25, 7.0, 6);
        const stilt = new THREE.Mesh(stiltGeo, this.materials.treeBark);
        stilt.position.set(sx, 3.5, 0);
        billGroup.add(stilt);
      });

      this.scene.add(billGroup);
      chunkData.meshes.push(billGroup);
    }

    // 11. Procedural Abandoned Civilian Cars along Highway Shoulder
    else if (cx === 0 && prng() > 0.55) {
      const side = prng() > 0.5 ? 1 : -1;
      const carX = centerX + side * (6.0 + prng() * 1.5);
      const carZ = centerZ + (prng() - 0.5) * 14.0;
      const carType = prng() > 0.6 ? 'muscle' : (prng() > 0.3 ? 'taxi' : 'sedan');
      const paintIdx = Math.floor(prng() * this.materials.carPaints.length);
      const slightAngle = (prng() - 0.5) * 0.4 + (side > 0 ? 0 : Math.PI);

      this.createProceduralCar(
        chunkData,
        carX,
        carZ,
        slightAngle,
        carType,
        this.materials.carPaints[paintIdx],
        prng
      );
    }

    // 12. Roadside Survival Items
    if (prng() > 0.45) {
      const sx = centerX + (prng() > 0.5 ? 11.0 : -11.0) + (prng() - 0.5) * 1.0;
      const sz = centerZ + (prng() - 0.5) * 16.0;
      const itemRoll = prng();
      const itemType = itemRoll > 0.6 ? 'battery' : (itemRoll > 0.3 ? 'almond_water' : 'medkit');
      const itemName = itemType === 'battery' ? 'Flashlight Alkaline Battery' : (itemType === 'almond_water' ? 'Unmarked Bottle ("Almond Water")' : 'Emergency First Aid Kit');
      this.createItemPickupToChunk(chunkData, sx, 0.05, sz, itemType, itemName);
    }

    this.activeChunks.set(key, chunkData);
  }

  createDesertGasStationLandmark(chunkData, centerZ) {
    // 1. Asphalt Forecourt Slab
    const forecourt = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshPhongMaterial({ color: 0x242628, shininess: 3 })
    );
    forecourt.rotation.x = -Math.PI / 2;
    forecourt.position.set(24.0, 0.015, centerZ);
    forecourt.receiveShadow = true;
    this.scene.add(forecourt);
    chunkData.meshes.push(forecourt);

    // 2. Scaled-up Full-Scale Gas Station + 24-Hour Store Landmark (28m x 7.5m x 24m)
    const stationX = 25.0;
    const stationZ = centerZ;
    const gasStation = this.createFittedRoadsideAsset(
      this.desertGasStationModel,
      stationX,
      stationZ,
      28.0,
      7.5,
      24.0,
      -Math.PI / 2
    ) || this.createProceduralGasStation(stationX, stationZ);
    this.scene.add(gasStation);
    chunkData.meshes.push(gasStation);

    // 3. Interior Store Checkout Counter & Tape Placement
    const tapeX = stationX + 2.5;
    const tapeZ = stationZ + 1.2;
    const tapeDisplay = new THREE.Group();
    tapeDisplay.position.set(tapeX, 0, tapeZ);

    const displayBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.84, 0.8),
      new THREE.MeshPhongMaterial({ color: 0x483526, shininess: 8 })
    );
    displayBase.position.y = 0.42;
    tapeDisplay.add(displayBase);

    const displayTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.08, 0.95),
      new THREE.MeshPhongMaterial({ color: 0x766048, shininess: 18 })
    );
    displayTop.position.y = 0.88;
    tapeDisplay.add(displayTop);

    // Overhead warm interior inspection spotlight
    const tapeLight = new THREE.PointLight(0xffbd67, 1.6, 7.0, 1.2);
    tapeLight.position.y = 2.4;
    tapeDisplay.add(tapeLight);

    this.scene.add(tapeDisplay);
    chunkData.meshes.push(tapeDisplay);

    // Dr. Samuel Reed's Audio Cassette Tape resting prominently on the counter
    this.createItemPickupToChunk(
      chunkData,
      tapeX,
      0.95,
      tapeZ,
      'highway_reed_store_tape',
      'Dr. Samuel Reed Roadside Store Recording'
    );

    // 4. Large Vintage "LAST STOP: GAS / FOOD" Roadside Neon Pole Sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 384;
    signCanvas.height = 224;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#7d1f17';
    ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
    ctx.strokeStyle = '#e7d8ac';
    ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, signCanvas.width - 24, signCanvas.height - 24);
    ctx.fillStyle = '#f1dfae';
    ctx.textAlign = 'center';
    ctx.font = 'bold 70px monospace';
    ctx.fillText('LAST STOP', 192, 94);
    ctx.font = 'bold 45px monospace';
    ctx.fillText('GAS  FOOD', 192, 166);
    const signTexture = new THREE.CanvasTexture(signCanvas);

    const sign = new THREE.Group();
    sign.position.set(14.5, 0, centerZ + 8.5);
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 7.0, 8),
      this.materials.metal
    );
    signPole.position.y = 3.5;
    sign.add(signPole);
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.2, 0.22),
      new THREE.MeshBasicMaterial({ map: signTexture })
    );
    signBoard.position.y = 6.8;
    signBoard.rotation.y = Math.PI / 2;
    sign.add(signBoard);
    this.scene.add(sign);
    chunkData.meshes.push(sign);

    // 5. Accurate Building & Canopy Colliders
    gasStation.updateMatrixWorld(true);
    const stationBounds = new THREE.Box3().setFromObject(gasStation);
    const bMinX = stationBounds.min.x;
    const bMaxX = stationBounds.max.x;
    const bMinZ = stationBounds.min.z;
    const bMaxZ = stationBounds.max.z;
    const bHeight = Math.max(5.5, stationBounds.max.y);
    const wallThick = 0.85;

    // Building exterior walls (leaving the front customer entrance open)
    const storeWallColliders = [
      // East (Rear) Building Wall
      new THREE.Box3(
        new THREE.Vector3(bMaxX - wallThick, 0, bMinZ - 0.2),
        new THREE.Vector3(bMaxX + wallThick, bHeight + 2.0, bMaxZ + 0.2)
      ),
      // North Wall
      new THREE.Box3(
        new THREE.Vector3(stationX - 0.2, 0, bMinZ - wallThick),
        new THREE.Vector3(bMaxX + 0.2, bHeight + 2.0, bMinZ + wallThick)
      ),
      // South Wall
      new THREE.Box3(
        new THREE.Vector3(stationX - 0.2, 0, bMaxZ - wallThick),
        new THREE.Vector3(bMaxX + 0.2, bHeight + 2.0, bMaxZ + wallThick)
      ),
      // Front Wall - Left Section
      new THREE.Box3(
        new THREE.Vector3(stationX - wallThick, 0, bMinZ - 0.2),
        new THREE.Vector3(stationX + wallThick, bHeight + 2.0, stationZ - 1.5)
      ),
      // Front Wall - Right Section
      new THREE.Box3(
        new THREE.Vector3(stationX - wallThick, 0, stationZ + 1.5),
        new THREE.Vector3(stationX + wallThick, bHeight + 2.0, bMaxZ + 0.2)
      )
    ];

    storeWallColliders.forEach((collider) => {
      collider.collisionRole = 'store_wall';
      this.registerCollider(collider);
      chunkData.colliders.push(collider);
    });

    // Gas Pump Island Colliders (along X: 18.5..20.5)
    [-4.5, 4.5].forEach((pzOffset) => {
      const pumpCollider = new THREE.Box3(
        new THREE.Vector3(18.5, 0, centerZ + pzOffset - 0.8),
        new THREE.Vector3(20.5, 2.2, centerZ + pzOffset + 0.8)
      );
      this.registerCollider(pumpCollider);
      chunkData.colliders.push(pumpCollider);
    });

    // 6. Overhead Gas Station Canopy Illumination
    [centerZ - 5.5, centerZ + 5.5].forEach((z, index) => {
      const fixture = this.lightManager.createFluorescentFixture(19.5, 5.2, z, {
        color: 0xffd27a,
        intensity: index === 0 ? 2.5 : 2.0,
        distance: 28,
        isFailing: index === 1
      });
      chunkData.lights.push(fixture);
    });
  }

  createFittedRoadsideAsset(source, x, z, maxWidth, maxHeight, maxDepth, rotationY = 0) {
    if (!source) return null;

    const clone = source.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });

    const oriented = new THREE.Group();
    oriented.rotation.y = rotationY;
    oriented.add(clone);
    oriented.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(oriented);
    const size = box.getSize(new THREE.Vector3());
    if (size.x <= 0.0001 || size.y <= 0.0001 || size.z <= 0.0001) return null;

    const center = box.getCenter(new THREE.Vector3());
    oriented.position.set(-center.x, -box.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(oriented);
    wrapper.scale.setScalar(Math.min(maxWidth / size.x, maxHeight / size.y, maxDepth / size.z));
    wrapper.position.set(x, 0.025, z);
    return wrapper;
  }

  createProceduralGasStation(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const concrete = new THREE.MeshPhongMaterial({ color: 0xb6aa8e, shininess: 4 });
    const red = new THREE.MeshPhongMaterial({ color: 0x7d1f17, shininess: 12 });
    const wall = new THREE.MeshPhongMaterial({ color: 0xc5b797, shininess: 3 });

    // Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.55, 12), concrete);
    canopy.position.set(-5.0, 5.2, 0);
    group.add(canopy);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.6, 12.2), red);
    fascia.position.set(-5.0, 5.4, 0);
    group.add(fascia);

    // Columns
    [-10.0, 0.0].forEach((px) => {
      [-4.5, 4.5].forEach((pz) => {
        const column = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.0, 0.35), concrete);
        column.position.set(px, 2.5, pz);
        group.add(column);
      });
    });

    // Pumps
    [-3.5, 3.5].forEach((pz) => {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.9), red);
      pump.position.set(-5.0, 0.9, pz);
      group.add(pump);
    });

    // Integrated Rear Store Building
    const building = new THREE.Mesh(new THREE.BoxGeometry(12, 5.0, 16), wall);
    building.position.set(5.0, 2.5, 0);
    group.add(building);

    return group;
  }

  createFittedHighwayRoadAsset(x, z, rotationY = 0) {
    if (!this.highwayRoadModel) return null;

    const clone = this.highwayRoadModel.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = false;
      }
    });

    const oriented = new THREE.Group();
    oriented.rotation.y = rotationY;
    oriented.add(clone);
    oriented.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(oriented);
    let size = box.getSize(new THREE.Vector3());
    if (size.x > size.z) {
      oriented.rotation.y += Math.PI / 2;
      oriented.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(oriented);
      size = box.getSize(new THREE.Vector3());
    }
    if (size.x <= 0.0001 || size.z <= 0.0001) return null;

    const center = box.getCenter(new THREE.Vector3());
    oriented.position.set(-center.x, -box.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(oriented);
    const widthScale = 11.7 / size.x;
    const lengthScale = this.CHUNK_SIZE / size.z;
    wrapper.scale.set(widthScale, Math.min(widthScale, lengthScale), lengthScale);
    wrapper.position.set(x, 0.025, z);
    return wrapper;
  }

  createHighwayLightAsset(x, z, rotationY = 0) {
    if (!this.highwayLightModel) return null;

    this.highwayLightModel.updateWorldMatrix(true, true);
    const clone = this.highwayLightModel.clone(true);
    this.highwayLightModel.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    clone.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(clone);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    if (initialSize.y <= 0.0001) return null;

    clone.scale.multiplyScalar(9.5 / initialSize.y);
    clone.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    clone.position.x -= scaledCenter.x;
    clone.position.y -= scaledBox.min.y;
    clone.position.z -= scaledCenter.z;
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });

    const wrapper = new THREE.Group();
    wrapper.position.set(x, 0, z);
    wrapper.rotation.y = rotationY;
    wrapper.add(clone);
    return wrapper;
  }

  createProceduralHighwayLight(x, z, roadDirection) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const poleHeight = 9.0;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, poleHeight, 8),
      this.materials.metal
    );
    pole.position.y = poleHeight / 2;
    group.add(pole);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.12, 0.12),
      this.materials.metal
    );
    arm.position.set(roadDirection * 1.3, 8.8, 0);
    group.add(arm);

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.22, 0.4),
      this.materials.exitSignHousing
    );
    lamp.position.set(roadDirection * 2.55, 8.7, 0);
    group.add(lamp);
    return group;
  }

  createDesertCactus(x, z, height) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, height, 8),
      this.materials.cactus
    );
    trunk.position.y = height / 2;
    trunk.castShadow = false;
    group.add(trunk);

    [-1, 1].forEach((side, index) => {
      const armHeight = height * (index === 0 ? 0.42 : 0.32);
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, armHeight, 7),
        this.materials.cactus
      );
      arm.position.set(side * 0.38, height * (index === 0 ? 0.52 : 0.65), 0);
      group.add(arm);

      const connector = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.55, 7),
        this.materials.cactus
      );
      connector.rotation.z = Math.PI / 2;
      connector.position.set(side * 0.22, arm.position.y - armHeight / 2 + 0.08, 0);
      group.add(connector);
    });

    return group;
  }

  // =========================================================================
  // LEVEL 1: PROCEDURAL CHUNKS & STORY LANDMARKS
  // =========================================================================
  // Deterministic, seedable hash -> [0, 1). Same inputs always produce the same output for a
  // given this.levelSeed, so two chunks that both query the same cell always agree.
  hashF(a, b, c, d) {
    const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + d * 269.5 + this.levelSeed * 0.6180339887) * 43758.5453;
    return s - Math.floor(s);
  }

  // Room-region assignment via seeded multi-source weighted flood-fill (a "grassfire"
  // transform), computed once per macro block (8x8 cells = 32m x 32m) and cached. K seed
  // rooms claim the block's 64 cells by expanding outward one step at a time, cheapest
  // cumulative distance first; a cell can ONLY be claimed by spreading from an already-claimed
  // neighboring cell of that same region. That is what makes every region a single connected
  // blob *by construction* -- there is no distance formula that could ever hand an isolated,
  // disconnected pocket of cells to a region several rooms away, the way naive nearest-seed
  // Voronoi can. (Weighted Euclidean-distance Voronoi was tried first and empirically produced
  // exactly that kind of fragmentation -- small orphaned islands walled off from their own
  // room -- which is what reads in-game as a wall connected to nothing.)
  //
  // Because this whole computation is a pure function of (this.levelSeed, mbx, mbz) with no
  // external/mutable state, any two chunks that border each other independently compute an
  // identical region grid for the macro block(s) they share -- so a wall is placed on a
  // boundary if and only if both sides agree the regions differ, which is what guarantees zero
  // gaps (neighbors never disagree about an edge) on top of zero fragmentation.
  getMacroBlockRegions(mbx, mbz) {
    const key = `${mbx}_${mbz}`;
    const cached = this.regionCache.get(key);
    if (cached) return cached;

    const MB = 8;
    const K = 3 + Math.floor(this.hashF(mbx, mbz, 91.7, 0) * 4); // 3..6 rooms per block

    // Two seed rolls can legitimately hash to the same integer cell (only 64 cells, up to 6
    // draws) -- if that happens, skip the duplicate. Two ids racing to expand from the exact
    // same origin cell is what actually caused the fragmentation empirically observed while
    // developing this: their near-identical distances tie-break unpredictably cell by cell,
    // interleaving both ids into scattered patches instead of clean regions.
    const seedX = [], seedZ = [], weight = [];
    const usedCoords = new Set();
    for (let k = 0; k < K; k++) {
      const sx = Math.min(MB - 1, Math.floor(this.hashF(mbx, mbz, k, 1) * MB));
      const sz = Math.min(MB - 1, Math.floor(this.hashF(mbx, mbz, k, 2) * MB));
      const coordKey = `${sx}_${sz}`;
      if (usedCoords.has(coordKey)) continue;
      usedCoords.add(coordKey);
      seedX.push(sx);
      seedZ.push(sz);
      weight.push(0.6 + this.hashF(mbx, mbz, k, 3) * 0.8); // 0.6..1.4 -> varied room sizes
    }
    const actualK = seedX.length;

    const owner = [];
    const dist = [];
    for (let x = 0; x < MB; x++) {
      owner.push(new Array(MB).fill(-1));
      dist.push(new Array(MB).fill(Infinity));
    }

    let frontier = [];
    for (let k = 0; k < actualK; k++) {
      owner[seedX[k]][seedZ[k]] = k;
      dist[seedX[k]][seedZ[k]] = 0;
      frontier.push({ x: seedX[k], z: seedZ[k], id: k, d: 0 });
    }

    // Multi-source Dijkstra with lazy deletion: always expand the globally cheapest frontier
    // entry next (true shortest-path order, not just "some" order), and discard stale entries
    // whose cell was already claimed more cheaply by a different room in the meantime -- without
    // that check, a stale entry could keep propagating an outdated/overwritten id.
    const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (frontier.length > 0) {
      let bestI = 0;
      for (let i = 1; i < frontier.length; i++) {
        if (frontier[i].d < frontier[bestI].d) bestI = i;
      }
      const cur = frontier.splice(bestI, 1)[0];
      if (cur.d > dist[cur.x][cur.z]) continue; // stale: a cheaper claim already won this cell
      const stepCost = 1.0 / weight[cur.id]; // heavier-weighted rooms expand cheaper => bigger

      for (const [dx, dz] of STEPS) {
        const nx = cur.x + dx, nz = cur.z + dz;
        if (nx < 0 || nx >= MB || nz < 0 || nz >= MB) continue;
        const nd = cur.d + stepCost;
        if (nd < dist[nx][nz]) {
          dist[nx][nz] = nd;
          owner[nx][nz] = cur.id;
          frontier.push({ x: nx, z: nz, id: cur.id, d: nd });
        }
      }
    }

    const block = { owner, weight };
    this.regionCache.set(key, block);
    return block;
  }

  getRoomInfo(gx, gz) {
    const MB = 8;
    const mbx = Math.floor(gx / MB);
    const mbz = Math.floor(gz / MB);
    const lx = ((gx % MB) + MB) % MB;
    const lz = ((gz % MB) + MB) % MB;

    const block = this.getMacroBlockRegions(mbx, mbz);
    const regionIdx = block.owner[lx][lz];
    return { id: `${mbx}_${mbz}_R${regionIdx}`, weight: block.weight[regionIdx] };
  }

  getRoomId(gx, gz) {
    return this.getRoomInfo(gx, gz).id;
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

        const isLargeRoom = this.getRoomInfo(gx, gz).weight > 1.0;

        // Short freestanding partitions create alcoves without closing the room's long sightlines.
        // Every stub must be flush against a real wall corner on at least one end -- if neither
        // corner of its candidate edge has an adjacent wall to anchor to, it is skipped rather
        // than floating disconnected in open space.
        if (isLargeRoom && currentRoom === northRoom && globalHash(gx, gz, 727) > 0.9) {
          const stubLength = Math.min(cellSize, 1.5 + globalHash(gx, gz, 728) * 1.1);
          const westAnchor = currentRoom !== westRoom;
          const eastAnchor = currentRoom !== this.getRoomId(gx + 1, gz);
          if (westAnchor) {
            this.addSolidWallToChunk(chunkData, (minX + c * cellSize) + stubLength / 2, wallHeight / 2, minZ + r * cellSize, stubLength, wallHeight, 0.3, this.materials.wallpaper);
          } else if (eastAnchor) {
            this.addSolidWallToChunk(chunkData, (minX + (c + 1) * cellSize) - stubLength / 2, wallHeight / 2, minZ + r * cellSize, stubLength, wallHeight, 0.3, this.materials.wallpaper);
          }
        }
        if (isLargeRoom && currentRoom === westRoom && globalHash(gx, gz, 737) > 0.9) {
          const stubLength = Math.min(cellSize, 1.5 + globalHash(gx, gz, 738) * 1.1);
          const northAnchor = currentRoom !== northRoom;
          const southAnchor = currentRoom !== this.getRoomId(gx, gz + 1);
          if (northAnchor) {
            this.addSolidWallToChunk(chunkData, minX + c * cellSize, wallHeight / 2, (minZ + r * cellSize) + stubLength / 2, 0.3, wallHeight, stubLength, this.materials.wallpaper);
          } else if (southAnchor) {
            this.addSolidWallToChunk(chunkData, minX + c * cellSize, wallHeight / 2, (minZ + (r + 1) * cellSize) - stubLength / 2, 0.3, wallHeight, stubLength, this.materials.wallpaper);
          }
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
    // Survival Mode gates this with a day/night-cycle-driven scarcity multiplier. The multiplier
    // itself DECREASES with cycle number (1.00 down toward a 0.10 floor), matching the design
    // doc's "Base Spawn Chance x Difficulty Multiplier" formula, so it must scale the spawn
    // CHANCE directly, not the threshold: baseline spawn chance is (1 - 0.35) = 0.65 at cycle 1
    // (multiplier 1.0, reproducing story mode's exact rate), and a lower multiplier raises the
    // threshold so fewer chunks roll a drop as a run goes on.
    const itemRoll = prng();
    const scarcityMultiplier = this.survivalMode ? (this.survivalScarcityMultiplier || 1.0) : 1.0;
    const spawnThreshold = this.survivalMode ? (1.0 - 0.65 * scarcityMultiplier) : 0.35;
    if (itemRoll > spawnThreshold) {
      const dropCount = (itemRoll > 0.8) ? 3 : ((itemRoll > 0.55) ? 2 : 1);
      for (let i = 0; i < dropCount; i++) {
        const sx = minX + 3.0 + prng() * 18.0;
        const sz = minZ + 3.0 + prng() * 18.0;
        const roll = prng();
        let type, name;
        if (this.survivalMode) {
          // Wider Survival Mode pool: battery / almond_water / medkit / ration_pack / canteen_water
          if (roll > 0.75) { type = 'battery'; name = 'Flashlight Alkaline Battery'; }
          else if (roll > 0.55) { type = 'almond_water'; name = 'Unmarked Bottle ("Almond Water")'; }
          else if (roll > 0.4) { type = 'medkit'; name = 'Emergency First Aid Kit'; }
          else if (roll > 0.2) { type = 'ration_pack'; name = 'DSA Field Ration Pack'; }
          else { type = 'canteen_water'; name = 'Military Canteen'; }
        } else {
          type = roll > 0.6 ? 'battery' : (roll > 0.28 ? 'almond_water' : 'medkit');
          name = type === 'battery' ? 'Flashlight Alkaline Battery' : (type === 'almond_water' ? 'Unmarked Bottle ("Almond Water")' : 'Emergency First Aid Kit');
        }
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

    // Rear wall opens into the Level 5 laboratory through the security airlock.
    const securityDoorWidth = 1.8;
    const rearWallZ = 20 + l / 2;
    const rearSegmentWidth = (w - securityDoorWidth) / 2;
    this.addSolidWallToChunk(chunkData, -(securityDoorWidth + rearSegmentWidth) / 2, h / 2, rearWallZ, rearSegmentWidth, h, 0.4, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, (securityDoorWidth + rearSegmentWidth) / 2, h / 2, rearWallZ, rearSegmentWidth, h, 0.4, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, 0, 2.85, rearWallZ, securityDoorWidth, 0.7, 0.4, this.materials.labWall);

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
    this.pushInteractive(compItem);
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
    const secDoorFrame = new THREE.Group();
    const framePostGeo = new THREE.BoxGeometry(0.2, 2.5, 0.4);
    const frameBeamGeo = new THREE.BoxGeometry(securityDoorWidth, 0.2, 0.4);
    const leftFramePost = new THREE.Mesh(framePostGeo, this.materials.metal);
    leftFramePost.position.set(-0.8, 1.25, 0);
    const rightFramePost = new THREE.Mesh(framePostGeo, this.materials.metal);
    rightFramePost.position.set(0.8, 1.25, 0);
    const frameBeam = new THREE.Mesh(frameBeamGeo, this.materials.metal);
    frameBeam.position.set(0, 2.4, 0);
    secDoorFrame.add(leftFramePost, rightFramePost, frameBeam);
    secDoorFrame.position.set(0, 0, rearWallZ - 0.1);
    this.scene.add(secDoorFrame);
    chunkData.meshes.push(secDoorFrame);

    const secDoorPanelGeo = new THREE.BoxGeometry(1.4, 2.3, 0.15);
    const secDoorPanel = new THREE.Mesh(secDoorPanelGeo, this.materials.steelDoor);
    secDoorPanel.position.set(0, 1.15, rearWallZ - 0.1);
    this.scene.add(secDoorPanel);
    chunkData.meshes.push(secDoorPanel);

    const secDoorCollider = new THREE.Box3().setFromObject(secDoorPanel);
    this.registerCollider(secDoorCollider);
    chunkData.colliders.push(secDoorCollider);

    // Electronic Keypad Next to Door
    const keypadGeo = new THREE.BoxGeometry(0.18, 0.3, 0.08);
    const keypadMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
    const keypad = new THREE.Mesh(keypadGeo, keypadMat);
    keypad.position.set(1.1, 1.4, rearWallZ - 0.15);
    this.scene.add(keypad);
    chunkData.meshes.push(keypad);

    const keyLedGeo = new THREE.CircleGeometry(0.02, 8);
    const keyLedMat = new THREE.MeshBasicMaterial({ color: 0xff2222 }); // Red locked LED
    const keyLed = new THREE.Mesh(keyLedGeo, keyLedMat);
    keyLed.position.set(1.1, 1.48, rearWallZ - 0.2);
    keyLed.rotation.y = Math.PI;
    this.scene.add(keyLed);
    chunkData.meshes.push(keyLed);

    const lockedDoorItem = {
      mesh: secDoorPanel,
      type: 'locked_lab_door',
      name: 'Security Airlock Door [ACCESS RESTRICTED - CLEARANCE LEVEL 5]',
      action: 'try_locked_door',
      unlocked: false,
      keyLedMaterial: keyLedMat,
      doorCollider: secDoorCollider
    };
    this.pushInteractive(lockedDoorItem);
    chunkData.interactive.push(lockedDoorItem);

    // --- LARGE DEPARTMENT OF SPATIAL ANOMALY SEAL ON REAR WALL ---
    const sealTexLoader = new THREE.TextureLoader();
    const sealTexture = sealTexLoader.load('./assets/textures/department_seal_transparent.png');
    sealTexture.encoding = THREE.sRGBEncoding;

    const sealGroup = new THREE.Group();
    // Positioned prominently on the rear wall to the right of the Level 5 door & keypad
    sealGroup.position.set(2.8, 1.65, rearWallZ - 0.205);
    sealGroup.rotation.y = Math.PI; // Face forward into starting room

    // 3D Dark Bronze / Brass Backing Medallion Base
    const plaqueGeo = new THREE.CylinderGeometry(1.02, 1.05, 0.04, 36);
    plaqueGeo.rotateX(Math.PI / 2);
    const plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x221a10,
      metalness: 0.75,
      roughness: 0.35
    });
    const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaqueMesh.position.z = -0.015;
    sealGroup.add(plaqueMesh);

    // High-Resolution Transparent Seal Decal / Medallion Face
    const sealGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const sealMat = new THREE.MeshStandardMaterial({
      map: sealTexture,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.35,
      metalness: 0.55
    });
    const sealMesh = new THREE.Mesh(sealGeo, sealMat);
    sealMesh.position.z = 0.008;
    sealGroup.add(sealMesh);

    this.scene.add(sealGroup);
    chunkData.meshes.push(sealGroup);

    // Dedicated subtle accent spotlight illuminating the seal
    const sealLight = new THREE.PointLight(0xfff0d0, 0.6, 6.0, 1.8);
    sealLight.position.set(2.8, 2.3, rearWallZ - 0.85);
    this.scene.add(sealLight);
    chunkData.lights.push(sealLight);

    const sealItem = {
      mesh: sealMesh,
      type: 'department_seal',
      name: 'Department of Spatial Anomaly Seal ["OBSERVE • CONTAIN • UNDERSTAND"]',
      action: 'examine_seal'
    };
    this.pushInteractive(sealItem);
    chunkData.interactive.push(sealItem);

    this.buildLevelFiveLaboratory(chunkData, rearWallZ, h);

    // Starting Room Lights (Balanced soft laboratory lighting)
    const l1 = this.lightManager.createFluorescentFixture(0, 3.0, 22, { color: 0xc8d4d8, intensity: 0.75, distance: 14.0 });
    const l2 = this.lightManager.createFluorescentFixture(0, 3.0, 16, { color: 0xc8d4d8, intensity: 0.75, distance: 14.0 });
    chunkData.lights.push(l1, l2);

    // Initial Tether Rope Model
    const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, 24, 8);
    const ropeMesh = new THREE.Mesh(ropeGeo, this.materials.rope);
    ropeMesh.position.set(0, 0.08, 12);
    this.scene.add(ropeMesh);
    chunkData.meshes.push(ropeMesh);

    const solidWallGeo = new THREE.BoxGeometry(2.4, 2.8, 0.3);
    const solidWall = new THREE.Mesh(solidWallGeo, this.materials.wallpaper);
    solidWall.position.set(0, 1.4, 13.0);
    this.scene.add(solidWall);
    chunkData.meshes.push(solidWall);

    const sealedEntranceCollider = new THREE.Box3().setFromObject(solidWall);
    this.shiftingSpace.registerEntrance(portalFrame, solidWall, ropeMesh, () => {
      this.registerCollider(sealedEntranceCollider);
      chunkData.colliders.push(sealedEntranceCollider);
    });
  }

  buildLevelFiveLaboratory(chunkData, frontZ, height) {
    const width = 14;
    const length = 16;
    const centerZ = frontZ + length / 2;
    const rearZ = frontZ + length;

    const floorGeo = new THREE.PlaneGeometry(width, length);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, this.materials.labFloor);
    floor.position.set(0, 0, centerZ);
    this.scene.add(floor);
    chunkData.meshes.push(floor);

    const ceilingGeo = new THREE.PlaneGeometry(width, length);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceiling = new THREE.Mesh(ceilingGeo, this.materials.ceiling);
    ceiling.position.set(0, height, centerZ);
    this.scene.add(ceiling);
    chunkData.meshes.push(ceiling);

    this.addSolidWallToChunk(chunkData, -width / 2, height / 2, centerZ, 0.4, height, length, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, width / 2, height / 2, centerZ, 0.4, height, length, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, 0, height / 2, rearZ, width, height, 0.4, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, -6.5, height / 2, frontZ, 1.0, height, 0.4, this.materials.labWall);
    this.addSolidWallToChunk(chunkData, 6.5, height / 2, frontZ, 1.0, height, 0.4, this.materials.labWall);

    // Collision-safe work surfaces leave a clear central path from the airlock.
    this.createTableToChunk(chunkData, -4.7, 0, frontZ + 7.0, 3.2, 1.2, 0.78);
    this.createTableToChunk(chunkData, 4.7, 0, frontZ + 7.0, 3.2, 1.2, 0.78);
    this.createTableToChunk(chunkData, 0, 0, frontZ + 12.0, 3.0, 1.25, 0.78);

    // Supervisor Kenneth Vaughn Resignation Letter resting on top of the central desk
    const letterGroup = new THREE.Group();
    letterGroup.position.set(0.0, 0.835, frontZ + 12.0);
    letterGroup.rotation.y = 0.08;

    // Manila folder backing
    const folderGeo = new THREE.BoxGeometry(0.46, 0.006, 0.60);
    const folderMat = new THREE.MeshPhongMaterial({ color: 0xc9964e, roughness: 0.8 });
    const folder = new THREE.Mesh(folderGeo, folderMat);
    folder.position.y = 0.003;
    letterGroup.add(folder);

    // Letter stationary paper
    const letterGeo = new THREE.BoxGeometry(0.40, 0.005, 0.52);
    const letterMat = new THREE.MeshPhongMaterial({ color: 0xfffaeb, shininess: 8 });
    const letterPaper = new THREE.Mesh(letterGeo, letterMat);
    letterPaper.position.y = 0.008;
    letterGroup.add(letterPaper);

    // Red "CLASSIFIED" stamp header
    const stampGeo = new THREE.PlaneGeometry(0.26, 0.045);
    const stampMat = new THREE.MeshBasicMaterial({ color: 0xb52222, side: THREE.DoubleSide });
    const stamp = new THREE.Mesh(stampGeo, stampMat);
    stamp.rotation.x = -Math.PI / 2;
    stamp.position.set(0, 0.012, -0.19);
    letterGroup.add(stamp);

    // Ink text lines simulating official typed resignation document
    const inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1a18, side: THREE.DoubleSide });
    [-0.11, -0.05, 0.01, 0.07, 0.13, 0.19].forEach((zOffset) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.018), inkMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.012, zOffset);
      letterGroup.add(line);
    });

    this.scene.add(letterGroup);
    chunkData.meshes.push(letterGroup);

    // Dedicated subtle inspection light over the desk
    const deskSpot = new THREE.PointLight(0xfff0d0, 1.2, 5.0);
    deskSpot.position.set(0, 2.2, frontZ + 12.0);
    this.scene.add(deskSpot);
    chunkData.meshes.push(deskSpot);

    // Interactive object proxy for reading the letter
    const letterItem = {
      mesh: letterPaper,
      type: 'vaughn_resignation',
      name: 'Document — Supervisor Kenneth Vaughn (Resignation Letter)',
      action: 'read_resignation_letter'
    };
    this.pushInteractive(letterItem);
    chunkData.interactive.push(letterItem);

    // Rear containment tank provides a strong visual focal point from the doorway.
    const tankGlassMat = new THREE.MeshPhongMaterial({
      color: 0x87b8aa,
      transparent: true,
      opacity: 0.32,
      shininess: 80,
      specular: 0xaaffee,
      side: THREE.DoubleSide
    });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 2.25, 20, 1, true), tankGlassMat);
    tank.position.set(0, 1.2, rearZ - 1.35);
    this.scene.add(tank);
    chunkData.meshes.push(tank);

    const tankBase = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.18, 20), this.materials.metal);
    tankBase.position.set(0, 0.09, rearZ - 1.35);
    const tankCap = tankBase.clone();
    tankCap.position.y = 2.31;
    this.scene.add(tankBase, tankCap);
    chunkData.meshes.push(tankBase, tankCap);

    const specimenMat = new THREE.MeshBasicMaterial({ color: 0x76ff9b, transparent: true, opacity: 0.65 });
    const specimen = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), specimenMat);
    specimen.scale.set(0.7, 1.8, 0.7);
    specimen.position.set(0, 1.18, rearZ - 1.35);
    this.scene.add(specimen);
    chunkData.meshes.push(specimen);

    // Handwritten research note taped to the front of the containment glass.
    const noteGroup = new THREE.Group();
    noteGroup.position.set(0.34, 1.48, rearZ - 2.075);
    noteGroup.rotation.z = -0.07;

    const notePaperMat = new THREE.MeshPhongMaterial({
      color: 0xe9dfbd,
      shininess: 2,
      side: THREE.DoubleSide
    });
    const notePaper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), notePaperMat);
    noteGroup.add(notePaper);

    const noteInkMat = new THREE.MeshBasicMaterial({ color: 0x35372f, side: THREE.DoubleSide });
    [-0.08, -0.025, 0.03, 0.085].forEach((y, index) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(index === 0 ? 0.22 : 0.26, 0.012), noteInkMat);
      line.position.set(index === 0 ? -0.025 : 0, y, -0.002);
      noteGroup.add(line);
    });

    const tape = new THREE.Mesh(
      new THREE.PlaneGeometry(0.13, 0.055),
      new THREE.MeshBasicMaterial({ color: 0xc7b786, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
    );
    tape.position.set(0, 0.225, -0.003);
    noteGroup.add(tape);

    this.scene.add(noteGroup);
    chunkData.meshes.push(noteGroup);

    const containmentNoteItem = {
      mesh: tank,
      type: 'containment_note',
      name: 'Containment Tube — Note Affixed to Glass',
      action: 'read_lab_note'
    };
    this.pushInteractive(containmentNoteItem);
    chunkData.interactive.push(containmentNoteItem);

    const tankCollider = new THREE.Box3().setFromObject(tankBase).union(new THREE.Box3().setFromObject(tank));
    this.registerCollider(tankCollider);
    chunkData.colliders.push(tankCollider);

    // Hardwired lab panels and storage remain visible even if the external model fails.
    [-5.8, 5.8].forEach((x) => {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.15, 0.65), this.materials.metal);
      cabinet.position.set(x, 1.075, rearZ - 0.65);
      this.scene.add(cabinet);
      chunkData.meshes.push(cabinet);
      const cabinetCollider = new THREE.Box3().setFromObject(cabinet);
      this.registerCollider(cabinetCollider);
      chunkData.colliders.push(cabinetCollider);
    });

    [frontZ + 3.0, frontZ + 8.0, frontZ + 13.0].forEach((z, index) => {
      const fixture = this.lightManager.createFluorescentFixture(0, height - 0.15, z, {
        color: 0xc9e8df,
        intensity: index === 2 ? 1.15 : 0.9,
        distance: 13.0,
        isFailing: index === 1
      });
      if (index === 1) fixture.group.rotation.y = Math.PI / 2;
      chunkData.lights.push(fixture);
    });

    this.loadSketchfabLaboratoryProps(chunkData, frontZ);
  }

  loadSketchfabLaboratoryProps(chunkData, frontZ) {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('[Laboratory] GLTFLoader unavailable; using procedural lab props only.');
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load('./assets/models/laboratory_extracted/scene.gltf', (gltf) => {
      if (this.currentLevel !== 1 || this.activeChunks.get(chunkData.key) !== chunkData) return;

      gltf.scene.updateMatrixWorld(true);
      const props = [
        { name: 'fridge', x: -5.7, y: 0, z: frontZ + 12.7, height: 2.05, rotationY: Math.PI / 2, collider: true },
        { name: 'stool', x: 4.4, y: 0, z: frontZ + 8.4, height: 0.58, rotationY: -0.35, collider: true },
        { name: 'chair', x: 5.3, y: 0, z: frontZ + 10.8, height: 0.95, rotationY: -Math.PI / 2, collider: true },
        { name: 'round_bin', x: 5.9, y: 0, z: frontZ + 13.7, height: 0.52, rotationY: 0, collider: true },
        { name: 'equipment', x: -4.7, y: 0.82, z: frontZ + 7.0, height: 0.42, rotationY: 0 },
        { name: 'Beaker', x: -5.55, y: 0.82, z: frontZ + 6.8, height: 0.27, rotationY: 0.25 },
        { name: 'smallBeaker', x: -3.95, y: 0.82, z: frontZ + 7.1, height: 0.18, rotationY: -0.2 },
        { name: 'Monitor', x: 4.7, y: 0.82, z: frontZ + 7.25, height: 0.5, rotationY: Math.PI },
        { name: 'keyboard', x: 4.7, y: 0.82, z: frontZ + 6.7, height: 0.07, rotationY: Math.PI },
        { name: 'Mouse', x: 5.55, y: 0.82, z: frontZ + 6.7, height: 0.045, rotationY: Math.PI }
      ];

      props.forEach((prop) => this.placeSketchfabPropToChunk(chunkData, gltf.scene, prop));
      console.log('[Laboratory] Sketchfab props loaded successfully.');
    }, undefined, (err) => {
      console.warn('[Laboratory] Failed to load Sketchfab laboratory assets:', err);
    });
  }

  placeSketchfabPropToChunk(chunkData, sourceScene, prop) {
    const source = sourceScene.getObjectByName(prop.name);
    if (!source) return;

    source.updateWorldMatrix(true, true);
    const clone = source.clone(true);
    source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    clone.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(clone);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    if (!Number.isFinite(initialSize.y) || initialSize.y <= 0.0001) return;

    clone.scale.multiplyScalar(prop.height / initialSize.y);
    clone.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    clone.position.x -= scaledCenter.x;
    clone.position.y -= scaledBox.min.y;
    clone.position.z -= scaledCenter.z;

    const wrapper = new THREE.Group();
    wrapper.position.set(prop.x, prop.y, prop.z);
    wrapper.rotation.y = prop.rotationY || 0;
    wrapper.add(clone);
    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.scene.add(wrapper);
    chunkData.meshes.push(wrapper);

    if (prop.collider) {
      wrapper.updateMatrixWorld(true);
      const collider = new THREE.Box3().setFromObject(wrapper);
      this.registerCollider(collider);
      chunkData.colliders.push(collider);
    }
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
    this.pushInteractive(doorItem);
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
    this.pushInteractive(exitItem);
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
  // Order-independent swap-remove: none of these global lists are order-sensitive, so
  // replacing the removed slot with the last element (O(1)) beats indexOf+splice (O(n))
  // across thousands of colliders during multi-chunk unload bursts.
  _swapRemove(arr, item) {
    const idx = arr.indexOf(item);
    if (idx !== -1) {
      arr[idx] = arr[arr.length - 1];
      arr.pop();
    }
  }

  removeChunk(key) {
    const chunk = this.activeChunks.get(key);
    if (!chunk) return;

    if (this.notifiedChunkKeys.delete(key)) this.emitChunkLifecycle('unloading', chunk);

    chunk.meshes.forEach(m => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach(mt => mt.dispose());
        else m.material.dispose();
      }
    });

    chunk.colliders.forEach(box => {
      this._swapRemove(this.colliders, box);

      const minCX = Math.floor(box.min.x / 4.0);
      const maxCX = Math.floor(box.max.x / 4.0);
      const minCZ = Math.floor(box.min.z / 4.0);
      const maxCZ = Math.floor(box.max.z / 4.0);
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const bKey = `${cx}_${cz}`;
          const list = this.spatialGrid.get(bKey);
          if (list) {
            this._swapRemove(list, box);
          }
        }
      }
    });

    chunk.lights.forEach(l => {
      this.scene.remove(l.group);
      // Dispose fixture casing/tube geometry + materials (unique per fixture) -- without
      // this, long streaming sessions steadily leaked GPU memory.
      l.group.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material && child.material.dispose) child.material.dispose();
        }
      });
      this._swapRemove(this.lightManager.lights, l);
    });

    chunk.interactive.forEach(item => {
      this._swapRemove(this.interactiveObjects, item);
    });
    this.interactiveVersion++;

    chunk.flooded.forEach(zone => {
      this._swapRemove(this.floodedZones, zone);
    });

    if (chunk.wallpaperWalls) {
      chunk.wallpaperWalls.forEach(w => {
        this._swapRemove(this.wallpaperWallMeshes, w);
      });
    }

    this.activeChunks.delete(key);
  }

  // --- COLLISION SPATIAL HASH & REGISTRATION ---
  pushInteractive(item) {
    this.interactiveObjects.push(item);
    this.interactiveVersion++;
  }

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

  unregisterCollider(box) {
    if (!box) return;

    const index = this.colliders.indexOf(box);
    if (index !== -1) this.colliders.splice(index, 1);

    const minCX = Math.floor(box.min.x / 4.0);
    const maxCX = Math.floor(box.max.x / 4.0);
    const minCZ = Math.floor(box.min.z / 4.0);
    const maxCZ = Math.floor(box.max.z / 4.0);
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = `${cx}_${cz}`;
        const list = this.spatialGrid.get(key);
        if (!list) continue;
        const gridIndex = list.indexOf(box);
        if (gridIndex !== -1) list.splice(gridIndex, 1);
      }
    }
  }

  getNearbyColliders(pos) {
    const cx = Math.floor(pos.x / 4.0);
    const cz = Math.floor(pos.z / 4.0);
    // Reused result array + stamp-based dedup: boxes spanning multiple grid cells would
    // otherwise be pushed (and intersection-tested by the player) several times per query,
    // and allocating a fresh array per call fed the GC at 120 physics steps per second.
    const nearby = this._nearbyCollidersScratch;
    nearby.length = 0;
    const stamp = ++this._queryStamp;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cx + dx}_${cz + dz}`;
        const list = this.spatialGrid.get(key);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const box = list[i];
          if (box._qs === stamp) continue;
          box._qs = stamp;
          nearby.push(box);
        }
      }
    }
    return nearby;
  }

  isPositionWalkable(pos, radius = 0.4, height = 1.8) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return false;
    const nearby = this.getNearbyColliders(pos);
    for (let i = 0; i < nearby.length; i++) {
      const box = nearby[i];
      if (!box || box.max.y <= 0.05 || box.min.y >= height) continue;
      if (
        pos.x + radius > box.min.x && pos.x - radius < box.max.x &&
        pos.z + radius > box.min.z && pos.z - radius < box.max.z
      ) return false;
    }
    return true;
  }

  // --- CHUNK HELPER BUILDERS ---
  addSolidWallToChunk(chunk, x, y, z, w, h, d, material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const wall = new THREE.Mesh(geo, material);
    wall.position.set(x, y, z);
    this.scene.add(wall);
    chunk.meshes.push(wall);

    if (material === this.materials.wallpaper || material === this.materials.wallpaperLow) {
      wall.isWallpaperWall = true;
      this.wallpaperWallMeshes.push(wall);
      if (!chunk.wallpaperWalls) chunk.wallpaperWalls = [];
      chunk.wallpaperWalls.push(wall);
    }

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
      lintel.isWallpaperWall = true;
      this.wallpaperWallMeshes.push(lintel);
      if (!chunk.wallpaperWalls) chunk.wallpaperWalls = [];
      chunk.wallpaperWalls.push(lintel);
    } else {
      this.addSolidWallToChunk(chunk, x, y, z - length / 2 + postWidth / 2, thickness, height, postWidth, this.materials.wallpaper);
      this.addSolidWallToChunk(chunk, x, y, z + length / 2 - postWidth / 2, thickness, height, postWidth, this.materials.wallpaper);
      const lintelGeo = new THREE.BoxGeometry(thickness, lintelHeight, doorWidth);
      const lintel = new THREE.Mesh(lintelGeo, this.materials.wallpaper);
      lintel.position.set(x, height - lintelHeight / 2, z);
      this.scene.add(lintel);
      chunk.meshes.push(lintel);
      lintel.isWallpaperWall = true;
      this.wallpaperWallMeshes.push(lintel);
      if (!chunk.wallpaperWalls) chunk.wallpaperWalls = [];
      chunk.wallpaperWalls.push(lintel);
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
    pillar.isWallpaperWall = true;
    this.wallpaperWallMeshes.push(pillar);
    if (!chunk.wallpaperWalls) chunk.wallpaperWalls = [];
    chunk.wallpaperWalls.push(pillar);

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
    chunk.meshes.push(crate);

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
    } else if (type === 'convenience_store_key') {
      const keyVisual = new THREE.Group();
      if (this.convenienceStoreKeyModel) {
        const keyClone = this.convenienceStoreKeyModel.clone(true);
        keyClone.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = true;
          }
        });
        keyClone.updateMatrixWorld(true);
        let keyBox = new THREE.Box3().setFromObject(keyClone);
        const keySize = keyBox.getSize(new THREE.Vector3());
        const largestDimension = Math.max(keySize.x, keySize.y, keySize.z);
        if (largestDimension > 0.0001) keyClone.scale.multiplyScalar(0.24 / largestDimension);
        keyClone.updateMatrixWorld(true);
        keyBox = new THREE.Box3().setFromObject(keyClone);
        const keyCenter = keyBox.getCenter(new THREE.Vector3());
        keyClone.position.x -= keyCenter.x;
        keyClone.position.y -= keyBox.min.y;
        keyClone.position.z -= keyCenter.z;
        keyVisual.add(keyClone);
      } else {
        const brass = new THREE.MeshPhongMaterial({ color: 0xa77a2a, shininess: 70, specular: 0xffd77a });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 7, 16), brass);
        ring.rotation.x = Math.PI / 2;
        keyVisual.add(ring);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.025), brass);
        shaft.position.x = 0.13;
        keyVisual.add(shaft);
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.06), brass);
        tooth.position.set(0.2, 0, 0.02);
        keyVisual.add(tooth);
      }
      keyVisual.rotation.y = 0.35;
      keyVisual.position.y = 0.015;
      group.add(keyVisual);

      const keyHitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      keyHitbox.position.y = 0.15;
      group.add(keyHitbox);

      const keyGlow = new THREE.PointLight(0xffbd58, 1.2, 4.5, 1.4);
      keyGlow.position.y = 0.25;
      group.add(keyGlow);
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
      const tapeMaterial = type === 'highway_reed_store_tape'
        ? new THREE.MeshPhongMaterial({ color: 0x2f2925, emissive: 0x100704, shininess: 18 })
        : this.materials.tape;
      const tapeMesh = new THREE.Mesh(tapeGeo, tapeMaterial);
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

      if (type === 'highway_reed_store_tape') {
        const marker = new THREE.Mesh(
          new THREE.RingGeometry(0.18, 0.25, 24),
          new THREE.MeshBasicMaterial({ color: 0xff9b42, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.004;
        group.add(marker);
        group.scale.setScalar(1.45);
      }
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
    this.pushInteractive(itemObj);
    chunk.interactive.push(itemObj);
    return group;
  }

  // --- DYNAMIC WALLPAPER VIEW-DEPENDENT LOD MANAGER ---
  updateWallpaperLOD(camera) {
    if (this.currentLevel !== 1 || !camera || this.wallpaperWallMeshes.length === 0) return;

    this.lodFrameCounter = (this.lodFrameCounter + 1) % 3;
    if (this.lodFrameCounter !== 0) return;

    const camPos = camera.position;
    const camDir = this._lodCamDir;
    camera.getWorldDirection(camDir);

    const highResDistSq = 16.0 * 16.0; // 16 meters for crisp high-resolution wallpaper in view
    const fovCosThreshold = 0.20; // In-view forward cone (~78 degrees)

    for (let i = 0; i < this.wallpaperWallMeshes.length; i++) {
      const wall = this.wallpaperWallMeshes[i];
      if (!wall || !wall.parent) continue;

      const dx = wall.position.x - camPos.x;
      const dz = wall.position.z - camPos.z;
      const distSq = dx * dx + dz * dz;

      let isDirectlyInView = false;
      if (distSq < highResDistSq) {
        if (distSq < 3.8 * 3.8) {
          // Immediately adjacent walls (player touching or next to wall)
          isDirectlyInView = true;
        } else {
          // Check if wall is within the camera's forward viewing cone
          const invDist = 1.0 / Math.sqrt(distSq);
          const dirX = dx * invDist;
          const dirZ = dz * invDist;
          const dot = dirX * camDir.x + dirZ * camDir.z;
          if (dot > fovCosThreshold) {
            isDirectlyInView = true;
          }
        }
      }

      const targetMat = isDirectlyInView ? this.materials.wallpaper : this.materials.wallpaperLow;
      if (wall.material !== targetMat) {
        wall.material = targetMat;
      }
    }
  }
}
