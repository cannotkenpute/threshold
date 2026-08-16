import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 1.4,
  suppressRadius: 9,
  vhsRadius: 7,
  flashlightDrainRate: 4.0,
  proximityRadius: 6,
  proximityFearRate: 3.5,
  burstInterval: 4,
};

/**
 * Static (cycle 2): an environmental hazard rather than a pursuer. It drifts near the
 * player and emits interference: local light fixture failures, VHS glitch on the
 * renderer, extra flashlight drain, and periodic radio distortion bursts.
 */
export class Static extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.suppressionToken = null;
    this.burstTimer = 0;
    this.wanderTarget = null;
  }

  async spawn(position) {
    await super.spawn(position);
    this.suppressionToken = `static-${this.id}`;
    return this;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    const player = this.context.player;
    const dist = this.object.position.distanceTo(player.position);

    this.wander(delta);

    // Re-anchor fixture suppression around the drifting monster. The same token releases
    // the previous set before applying the new one, so counts never drift.
    if (this.context.lightManager && this.context.lightManager.suppressFixturesNear) {
      this.context.lightManager.suppressFixturesNear(this.object.position, this.cfg.suppressRadius, this.suppressionToken);
    }

    if (this.context.renderer && this.context.renderer.setVHSGlitch) {
      this.context.renderer.setVHSGlitch(dist <= this.cfg.vhsRadius ? 1.6 : 0);
    }

    if (dist <= this.cfg.proximityRadius && !this.passive) {
      if (player.isFlashlightOn && typeof player.batteryLevel === 'number') {
        player.batteryLevel = Math.max(0, player.batteryLevel - this.cfg.flashlightDrainRate * delta);
      }
      this.modifySanity(-this.cfg.proximityFearRate * delta);
    }

    this.burstTimer += delta;
    if (this.burstTimer >= this.cfg.burstInterval) {
      this.burstTimer = 0;
      if (this.context.audioManager && this.context.audioManager.playVHSGlitchBurst) {
        this.context.audioManager.playVHSGlitchBurst(0.6);
      }
    }
  }

  wander(delta) {
    const navigation = this.context.navigation;
    if (!this.wanderTarget || this.object.position.distanceTo(this.wanderTarget) < 0.8) {
      const origin = navigation.worldToCell(this.object.position);
      const gx = origin.gx + Math.floor(Math.random() * 7) - 3;
      const gz = origin.gz + Math.floor(Math.random() * 7) - 3;
      const world = navigation.cellToWorld(gx, gz, this.object.position.y);
      this.wanderTarget = navigation.isWalkable(world) ? world : this.object.position.clone();
    }
    const dx = this.wanderTarget.x - this.object.position.x;
    const dz = this.wanderTarget.z - this.object.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) {
      const step = Math.min(this.cfg.speed * delta, d);
      this.object.position.x += (dx / d) * step;
      this.object.position.z += (dz / d) * step;
      this.object.rotation.y = Math.atan2(dx, dz);
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
