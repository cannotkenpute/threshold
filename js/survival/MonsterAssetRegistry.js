import { MONSTER_CONFIG, isMonsterType } from './MonsterConfig.js';

const FALLBACK_COLORS = {
  watcher: 0x111111,
  mimic: 0x5a241c,
  drifter: 0x4b493d,
  hollow_man: 0xb29b45,
  static: 0x080812,
  grinner: 0xe6e0c8,
  surveyor: 0x3c4938,
  crawling_mass: 0x702b2b,
  echo: 0x211b2c,
  threshold: 0x5d0712,
};

function cloneMaterial(material, mode) {
  const clone = material.clone();
  clone.flatShading = true;
  clone.precision = 'mediump';
  if (mode === 'shadow') {
    clone.color?.setHex(0x050508);
    clone.emissive?.setHex(0x010103);
    clone.roughness = 1;
    clone.metalness = 0;
  }
  clone.needsUpdate = true;
  return clone;
}

export class MonsterAssetRegistry {
  constructor(options = {}) {
    this.manifestRoot = options.manifestRoot || MONSTER_CONFIG.MANIFEST_ROOT;
    this.loaderFactory = options.loaderFactory || (() => new THREE.GLTFLoader());
    this.records = new Map();
    this.instances = new Set();
  }

  getState(type) {
    const record = this.records.get(type);
    return record ? { status: record.status, error: record.error || null, refs: record.refs || 0 } : {
      status: 'idle', error: null, refs: 0,
    };
  }

  async load(type) {
    if (!isMonsterType(type)) throw new Error(`Unknown monster type: ${String(type)}`);
    const existing = this.records.get(type);
    if (existing?.status === 'ready') return existing;
    if (existing?.promise) return existing.promise;

    const record = { status: 'loading', error: null, refs: 0, promise: null };
    record.promise = this.loadRecord(type, record);
    this.records.set(type, record);
    return record.promise;
  }

  async loadRecord(type, record) {
    try {
      const base = `${this.manifestRoot}/${type}`;
      const response = await fetch(`${base}/runtime-manifest.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
      const manifest = await response.json();
      if (manifest.id !== type || !manifest.model?.file) throw new Error('Runtime manifest is invalid');
      const modelUrl = `${base}/${manifest.model.file}`;
      const loader = this.loaderFactory();
      const gltf = await new Promise((resolve, reject) => loader.load(modelUrl, resolve, undefined, reject));
      Object.assign(record, {
        status: 'ready',
        manifest,
        sourceScene: gltf.scene,
        animations: gltf.animations || [],
        promise: null,
      });
      return record;
    } catch (error) {
      record.status = 'error';
      record.error = error instanceof Error ? error : new Error(String(error));
      record.promise = null;
      throw record.error;
    }
  }

  async createInstance(type) {
    let record;
    try {
      record = await this.load(type);
    } catch (error) {
      console.warn(`[MonsterAssetRegistry] ${type} failed to load; using procedural fallback.`, error);
      return this.createFallbackInstance(type, error);
    }

    const cloneFn = THREE.SkeletonUtils && THREE.SkeletonUtils.clone
      ? THREE.SkeletonUtils.clone
      : (object) => object.clone(true);
    const object = cloneFn(record.sourceScene);
    const ownedMaterials = new Set();
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = Boolean(record.manifest.runtime?.castShadow);
      child.receiveShadow = Boolean(record.manifest.runtime?.receiveShadow);
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const clone = cloneMaterial(material, record.manifest.runtime?.materialMode);
          ownedMaterials.add(clone);
          return clone;
        });
      } else if (child.material) {
        child.material = cloneMaterial(child.material, record.manifest.runtime?.materialMode);
        ownedMaterials.add(child.material);
      }
    });

    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const targetHeight = record.manifest.model.targetHeight || Math.max(0.01, size.y);
    const scale = targetHeight / Math.max(0.01, size.y);
    object.scale.multiplyScalar(scale);
    object.updateMatrixWorld(true);
    const normalizedBounds = new THREE.Box3().setFromObject(object);
    object.position.y -= normalizedBounds.min.y;
    object.userData.monsterType = type;

    const mixer = record.animations.length ? new THREE.AnimationMixer(object) : null;
    if (mixer && record.animations[0]) mixer.clipAction(record.animations[0]).play();
    const instance = {
      type,
      object,
      mixer,
      manifest: record.manifest,
      fallback: false,
      ownedMaterials,
      dispose: () => this.disposeInstance(instance),
    };
    record.refs++;
    this.instances.add(instance);
    return instance;
  }

  createFallbackInstance(type, error = null) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: FALLBACK_COLORS[type] || 0x111111 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.6, 6), material);
    body.position.y = 0.9;
    group.add(body);
    group.userData.monsterType = type;
    group.userData.assetError = error ? error.message : null;
    const instance = {
      type,
      object: group,
      mixer: null,
      manifest: null,
      fallback: true,
      ownedMaterials: new Set([material]),
      ownedGeometries: new Set([body.geometry]),
      dispose: () => this.disposeInstance(instance),
    };
    this.instances.add(instance);
    return instance;
  }

  disposeInstance(instance) {
    if (!instance || !this.instances.delete(instance)) return;
    if (instance.mixer) {
      instance.mixer.stopAllAction();
      instance.mixer.uncacheRoot(instance.object);
    }
    for (const material of instance.ownedMaterials || []) material.dispose();
    for (const geometry of instance.ownedGeometries || []) geometry.dispose();
    const record = this.records.get(instance.type);
    if (record?.status === 'ready') record.refs = Math.max(0, record.refs - 1);
  }

  dispose() {
    for (const instance of [...this.instances]) this.disposeInstance(instance);
    const textures = new Set();
    const materials = new Set();
    const geometries = new Set();
    for (const record of this.records.values()) {
      if (record.status !== 'ready' || record.refs > 0) continue;
      record.sourceScene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.geometry) geometries.add(child.geometry);
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of list) {
          if (!material) continue;
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    this.records.clear();
  }
}
