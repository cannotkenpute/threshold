import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 3.2,
  exposureToRepel: 1.5,
  exposureIncrementPerEncounter: 0.5,
  fearRate: 6.0,
  proximityRadius: 4.0,
};

/**
 * Grinner (cycle 4, night-only): a darkness dweller that is repelled by sustained
 * flashlight exposure. It closes in and drains sanity, but if the player keeps the
 * flashlight on it long enough it retreats (despawns). The required exposure is meant
 * to scale across encounters; this class uses the base threshold and leaves the
 * cross-encounter increment to the scheduler/encounter layer.
 */
export class Grinner extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.exposure = 0;
    this._cameraDir = new THREE.Vector3();
    this._toMonster = new THREE.Vector3();
  }

  // Is the player's flashlight currently trained on this monster?
  isFlashlit() {
    const player = this.context.player;
    if (!player || !player.isFlashlightOn || !this.object) return false;
    const camera = player.camera;
    if (!camera) return player.isFlashlightOn; // no camera: approximate by "on"
    camera.getWorldDirection(this._cameraDir);
    this._toMonster.set(
      this.object.position.x - camera.position.x,
      this.object.position.y - camera.position.y,
      this.object.position.z - camera.position.z,
    ).normalize();
    return this._cameraDir.dot(this._toMonster) > 0.25;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    const player = this.context.player;

    if (this.isFlashlit()) {
      this.exposure += delta;
      if (this.exposure >= this.cfg.exposureToRepel) {
        // Repelled: the Grinner retreats and is removed.
        this.dispose();
        return;
      }
    } else {
      this.exposure = Math.max(0, this.exposure - delta);
    }

    // Close the distance and erode sanity.
    const dx = player.position.x - this.object.position.x;
    const dz = player.position.z - this.object.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) {
      const step = Math.min(this.cfg.speed * delta, d);
      this.object.position.x += (dx / d) * step;
      this.object.position.z += (dz / d) * step;
      this.object.rotation.y = Math.atan2(dx, dz);
    }
    if (d <= this.cfg.proximityRadius) {
      this.modifySanity(-this.cfg.fearRate * delta);
    }
  }
}
