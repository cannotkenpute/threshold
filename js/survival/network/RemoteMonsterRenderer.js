/**
 * RemoteMonsterRenderer — client-side view of authoritative monster state.
 * Duck-typed (no THREE at import; THREE is read from the global inside methods) so it can
 * be instantiated in tests, but it only does real work in the browser. Maintains one
 * placeholder visual per remote monster id and updates it from decoded snapshots.
 */

const TYPE_COLORS = {
  watcher: 0x111111, mimic: 0x5a241c, drifter: 0x4b493d, static: 0x080812,
  hollow_man: 0xb29b45, grinner: 0xe6e0c8, surveyor: 0x3c4938,
  crawling_mass: 0x702b2b, echo: 0x211b2c, threshold: 0x5d0712,
};

export class RemoteMonsterRenderer {
  constructor({ scene = null, assetRegistry = null } = {}) {
    this.scene = scene;
    this.assetRegistry = assetRegistry;
    this.objects = new Map(); // id -> object
  }

  _ensureObject(snapshot) {
    let object = this.objects.get(snapshot.id);
    if (!object && this.scene) {
      object = this._createPlaceholder(snapshot.type);
      object.userData.remoteMonsterId = snapshot.id;
      this.scene.add(object);
      this.objects.set(snapshot.id, object);
    }
    return object;
  }

  _createPlaceholder(type) {
    const Group = (typeof THREE !== 'undefined') && THREE.Group;
    if (!Group) return { position: { set() {} }, rotation: { set() {} }, userData: {} };
    const group = new THREE.Group();
    const color = TYPE_COLORS[type] || 0x111111;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 1.6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.y = 0.8;
    group.add(mesh);
    return group;
  }

  applySnapshot(snapshot) {
    const object = this._ensureObject(snapshot);
    if (!object) return;
    object.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    object.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z);
  }

  applySnapshotList(snapshots) {
    const seen = new Set();
    for (const snapshot of snapshots || []) {
      seen.add(snapshot.id);
      this.applySnapshot(snapshot);
    }
    // Remove any remote object no longer present in the authoritative list.
    for (const id of [...this.objects.keys()]) {
      if (!seen.has(id)) this.despawn(id);
    }
  }

  despawn(id) {
    const object = this.objects.get(id);
    if (object) {
      if (this.scene && typeof this.scene.remove === 'function') this.scene.remove(object);
      this.objects.delete(id);
    }
  }

  clear() {
    for (const id of [...this.objects.keys()]) this.despawn(id);
  }

  getActiveIds() {
    return [...this.objects.keys()];
  }

  dispose() {
    this.clear();
    this.scene = null;
    this.assetRegistry = null;
  }
}
