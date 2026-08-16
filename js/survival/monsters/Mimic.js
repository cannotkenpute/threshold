import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  revealRadius: 2.2,
  revealFearSpike: 18.0,
  revealLinger: 2.5,
};

/**
 * Mimic (cycle 1): masquerades as a supply pickup, crouched and motionless. When the
 * player gets close it reveals, delivers a sudden Fear spike, then consumes itself.
 *
 * Note: full "replaces a real supply pickup" economy (the plan's 8% substitution) is the
 * encounter-scheduler / item-spawn layer's job. This class implements the in-world entity:
 * a disguised, stationary false-pickup that reveals on proximity and drains sanity.
 */
export class Mimic extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.revealed = false;
    this.revealTimer = 0;
  }

  async spawn(position) {
    await super.spawn(position);
    if (this.object && !this.disposed) {
      // Crouch into a small, low, "supply drop" silhouette.
      this.object.scale.setScalar(0.32);
      this.object.position.y = 0.08;
    }
    return this;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;

    if (!this.revealed) {
      const player = this.context.player;
      if (this.object.position.distanceTo(player.position) <= this.cfg.revealRadius) {
        this.reveal();
      }
    } else {
      this.revealTimer += delta;
      if (this.revealTimer >= this.cfg.revealLinger) this.dispose();
    }
  }

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.revealTimer = 0;
    if (this.object) {
      this.object.scale.setScalar(1.0);
      this.object.position.y = 0.9;
    }
    this.modifySanity(-this.cfg.revealFearSpike);
    if (this.context.audioManager && this.context.audioManager.playUI) {
      this.context.audioManager.playUI('click');
    }
  }
}
