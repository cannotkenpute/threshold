let nextMonsterId = 1;

export class MonsterBase {
  constructor(type, context) {
    this.id = `${type}-${nextMonsterId++}`;
    this.type = type;
    this.context = context;
    this.asset = null;
    this.object = null;
    this.spawned = false;
    this.disposed = false;
    this.age = 0;
    this.path = [];
    this.pathIndex = 0;
    this.lastPosition = null;
    this.stuckTime = 0;
    this.lastSensorySequence = 0;
    // Passive monsters (e.g. summoned from the dev menu) still move and animate but never
    // erode the player's sanity -- see modifySanity() below.
    this.passive = false;
  }

  async spawn(position) {
    if (this.disposed) throw new Error('Cannot spawn a disposed monster');
    this.asset = await this.context.assetRegistry.createInstance(this.type);
    if (this.disposed) {
      this.asset.dispose();
      return this;
    }
    this.object = this.asset.object;
    this.object.position.set(position.x, position.y || 0, position.z);
    this.object.userData.monsterId = this.id;
    this.context.scene.add(this.object);
    this.lastPosition = this.object.position.clone();
    this.spawned = true;
    return this;
  }

  update(delta) {
    if (!this.spawned || this.disposed) return;
    this.age += delta;
    if (this.asset.mixer) this.asset.mixer.update(delta);
    else this.object.rotation.z = Math.sin(this.age * 1.7) * 0.012;

    const moved = this.object.position.distanceToSquared(this.lastPosition);
    if (moved < 0.0004) this.stuckTime += delta;
    else { this.stuckTime = 0; this.lastPosition.copy(this.object.position); }
    if (this.stuckTime > 2 && this.path.length) {
      this.pathIndex = Math.min(this.path.length - 1, this.pathIndex + 1);
      this.stuckTime = 0;
    }
  }

  onSensoryEvent(event) {
    this.lastSensorySequence = Math.max(this.lastSensorySequence, event.sequence || 0);
  }

  // Monsters modify Fear by changing sanity (Fear Factor = 100 - sanity). They only ever
  // drain it; the Safe Light system restores it. Clamped to [0, 100]. Never takeDamage().
  modifySanity(delta) {
    if (this.passive) return;
    const player = this.context && this.context.player;
    if (!player || typeof player.sanity !== 'number') return;
    player.sanity = Math.max(0, Math.min(100, player.sanity + delta));
  }

  // Advances this.object toward the next waypoint in this.path. Returns true while a path
  // is still being followed. Faces the direction of travel.
  followPath(delta, speed) {
    if (!this.object || !this.path || this.pathIndex >= this.path.length) return false;
    const target = this.path[this.pathIndex];
    const dx = target.x - this.object.position.x;
    const dz = target.z - this.object.position.z;
    const dist = Math.hypot(dx, dz);
    const step = speed * delta;
    if (dist <= 0.25 || dist <= step) {
      this.object.position.x = target.x;
      this.object.position.z = target.z;
      this.pathIndex++;
    } else {
      this.object.position.x += (dx / dist) * step;
      this.object.position.z += (dz / dist) * step;
      if (dist > 0.001) this.object.rotation.y = Math.atan2(dx, dz);
    }
    return this.pathIndex < this.path.length;
  }

  serializeSnapshot() {
    const position = this.object?.position || { x: 0, y: 0, z: 0 };
    const rotation = this.object?.rotation || { x: 0, y: 0, z: 0 };
    return {
      id: this.id,
      type: this.type,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      age: this.age,
      fallback: Boolean(this.asset?.fallback),
    };
  }

  applySnapshot(snapshot) {
    if (!snapshot || snapshot.type !== this.type || !this.object) return false;
    this.object.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    this.object.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z);
    this.age = Math.max(0, snapshot.age || 0);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.object?.parent) this.object.parent.remove(this.object);
    if (this.asset) this.asset.dispose();
    this.asset = null;
    this.object = null;
    this.spawned = false;
  }
}
