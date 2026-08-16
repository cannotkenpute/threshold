import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 2.4,
  gazeFearRate: 7.0,
  proximityFearRate: 5.0,
  proximityRadius: 5.0,
  observationConeDegrees: 60,
};

/**
 * Watcher (cycle 1): a weeping-angel style threat. It only advances while the player is
 * NOT looking at it; being seen freezes it in place, but sustained eye contact drains
 * sanity. Getting close also drains sanity regardless of gaze.
 */
export class Watcher extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this._cameraDir = new THREE.Vector3();
    this._toMonster = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._hit = new THREE.Vector3();
  }

  isObserved() {
    const player = this.context.player;
    const camera = player && player.camera;
    if (!camera || !this.object) return false;

    camera.getWorldDirection(this._cameraDir);
    this._toMonster.set(
      this.object.position.x - camera.position.x,
      (this.object.position.y + 1) - camera.position.y,
      this.object.position.z - camera.position.z,
    );
    const dist = this._toMonster.length();
    if (dist < 0.001) return true;
    this._toMonster.normalize();

    const cone = Math.cos((this.cfg.observationConeDegrees * Math.PI) / 180);
    if (this._cameraDir.dot(this._toMonster) < cone) return false;

    // Line of sight against world colliders (skip if unavailable in a test harness).
    const colliders = (this.context.levelBuilder && this.context.levelBuilder.colliders) ||
      (player.levelBuilder && player.levelBuilder.colliders);
    if (!colliders) return true;
    this._ray.set(camera.position, this._toMonster);
    for (const box of colliders) {
      if (box && this._ray.intersectBox(box, this._hit) && camera.position.distanceTo(this._hit) < dist - 0.4) {
        return false;
      }
    }
    return true;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    const player = this.context.player;
    const dist = this.object.position.distanceTo(player.position);

    if (this.isObserved()) {
      // Frozen while observed; the act of watching it erodes the mind.
      this.modifySanity(-this.cfg.gazeFearRate * delta);
    } else {
      // Only creep closer while unobserved.
      const dx = player.position.x - this.object.position.x;
      const dz = player.position.z - this.object.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
        const step = Math.min(this.cfg.speed * delta, d);
        this.object.position.x += (dx / d) * step;
        this.object.position.z += (dz / d) * step;
        this.object.rotation.y = Math.atan2(dx, dz);
      }
      if (dist < this.cfg.proximityRadius) {
        this.modifySanity(-this.cfg.proximityFearRate * delta);
      }
    }
  }
}
