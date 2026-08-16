import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 2.8,
  revealRadius: 12,
  revealFearRate: 5.0,
  proximityFearRate: 6.0,
  proximityRadius: 3.0,
  wanderRadius: 16,
};

/**
 * Hollow Man (cycle 4): reads as a normal figure at a distance, then reveals itself
 * once the player gets close and gives chase. The longer it stays revealed and near,
 * the faster sanity erodes.
 */
export class HollowMan extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.revealed = false;
    this.wanderTarget = null;
    this.repathTimer = 0;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    const player = this.context.player;
    const dist = this.object.position.distanceTo(player.position);

    if (!this.revealed && dist <= this.cfg.revealRadius) {
      this.revealed = true;
    }

    if (this.revealed) {
      // Chase and erode sanity.
      const dx = player.position.x - this.object.position.x;
      const dz = player.position.z - this.object.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
        const step = Math.min(this.cfg.speed * delta, d);
        this.object.position.x += (dx / d) * step;
        this.object.position.z += (dz / d) * step;
        this.object.rotation.y = Math.atan2(dx, dz);
      }
      const fearRate = dist <= this.cfg.proximityRadius ? this.cfg.proximityFearRate : this.cfg.revealFearRate;
      this.modifySanity(-fearRate * delta);
    } else {
      // Wander like a distant, aimless figure.
      this.repathTimer += delta;
      if (!this.wanderTarget || this.repathTimer >= 4) {
        this.repathTimer = 0;
        this.wanderTarget = this.pickWanderTarget();
      }
      const dx = this.wanderTarget.x - this.object.position.x;
      const dz = this.wanderTarget.z - this.object.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) {
        const step = Math.min(this.cfg.speed * 0.5 * delta, d);
        this.object.position.x += (dx / d) * step;
        this.object.position.z += (dz / d) * step;
        this.object.rotation.y = Math.atan2(dx, dz);
      }
    }
  }

  pickWanderTarget() {
    const nav = this.context.navigation;
    const origin = nav.worldToCell(this.object.position);
    for (let i = 0; i < 10; i++) {
      const gx = origin.gx + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const gz = origin.gz + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const world = nav.cellToWorld(gx, gz, this.object.position.y);
      if (nav.isWalkable(world)) return world;
    }
    return { x: this.object.position.x, y: this.object.position.y, z: this.object.position.z };
  }
}
