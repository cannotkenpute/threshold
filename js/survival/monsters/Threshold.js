import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  minDuration: 20,
  maxDuration: 35,
  sightFearRate: 12.0,
  suppressRadius: 40,
};

/**
 * Threshold (cycle 10, event): a brief reality-collapse event. It suppresses nearby
 * environmental lighting, glitches the VHS post-process, and causes extreme Fear while
 * directly observed. It is non-colliding and tears itself down (restoring lighting/audio
 * side effects) when its duration elapses. The "at most once every two cycles" cadence is
 * enforced by the scheduler/event cap, not this class.
 */
export class Threshold extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.duration = this.cfg.minDuration + Math.random() * (this.cfg.maxDuration - this.cfg.minDuration);
    this.suppressionToken = null;
    this._cameraDir = new THREE.Vector3();
    this._toMonster = new THREE.Vector3();
  }

  async spawn(position) {
    await super.spawn(position);
    this.suppressionToken = `threshold-${this.id}`;
    return this;
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
    ).normalize();
    return this._cameraDir.dot(this._toMonster) > 0.4;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;

    // Suppress environmental lighting around the event (follows its position).
    if (this.context.lightManager && this.context.lightManager.suppressFixturesNear) {
      this.context.lightManager.suppressFixturesNear(this.object.position, this.cfg.suppressRadius, this.suppressionToken);
    }
    if (this.context.renderer && this.context.renderer.setVHSGlitch) {
      this.context.renderer.setVHSGlitch(2.4);
    }

    if (this.isObserved()) {
      this.modifySanity(-this.cfg.sightFearRate * delta);
    }

    if (this.age >= this.duration) {
      this.dispose();
    }
  }

  dispose() {
    if (this.suppressionToken && this.context.lightManager) {
      this.context.lightManager.releaseFixtureSuppression(this.suppressionToken);
      this.suppressionToken = null;
    }
    if (this.context.renderer && this.context.renderer.setVHSGlitch) {
      this.context.renderer.setVHSGlitch(0);
    }
    super.dispose();
  }
}
