import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 2.8,
  investigateRadius: 16,
  proximityFearRate: 5.0,
  proximityRadius: 2.5,
  repathInterval: 3.0,
  wanderRadius: 20,
};

/**
 * Surveyor (cycle 6): a methodical searcher. It patrols, remembers the last-known player
 * position from any noise, and periodically returns to check it, escalating to a chase on
 * loud sprinting. It never interacts with Story Mode doors (no door logic lives here).
 */
export class Surveyor extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.state = 'patrol'; // 'patrol' | 'investigate' | 'chase'
    this.target = null;
    this.lastKnownPlayer = null;
    this.repathTimer = 0;
  }

  onSensoryEvent(event) {
    super.onSensoryEvent(event);
    if (!this.spawned || this.disposed || !this.object) return;
    const position = { x: event.position.x, y: event.position.y, z: event.position.z };

    if (event.type === 'player:sprint') {
      this.state = 'chase';
      this.target = position;
      this.path = [];
      this.repathTimer = 0;
    } else if (event.type === 'player:footstep' || event.type === 'player:interaction' || event.type === 'player:item_collected') {
      this.lastKnownPlayer = position;
      // See Drifter.js: intensity-scaled radius makes a crouching player's quieter
      // footsteps only noticeable much closer in, rewarding "run and hide."
      const effectiveRadius = this.cfg.investigateRadius * Math.max(0, Math.min(1, event.intensity ?? 1));
      if (this.state === 'patrol' && this.object.position.distanceTo(position) <= effectiveRadius) {
        this.state = 'investigate';
        this.target = position;
        this.path = [];
        this.repathTimer = 0;
      }
    }
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    const player = this.context.player;
    const navigation = this.context.navigation;
    const distToPlayer = this.object.position.distanceTo(player.position);

    this.repathTimer += delta;

    if (this.state === 'chase') {
      if (!this.path.length || this.repathTimer >= this.cfg.repathInterval) {
        this.path = navigation.findPath(this.object.position, player.position);
        this.pathIndex = 0;
        this.repathTimer = 0;
      }
    } else if (this.state === 'investigate') {
      if (!this.path.length) {
        this.path = navigation.findPath(this.object.position, this.target);
        this.pathIndex = 0;
        if (!this.path.length) this.state = 'patrol';
      } else if (this.repathTimer >= this.cfg.repathInterval) {
        this.repathTimer = 0;
        if (this.object.position.distanceTo(this.target) < 1.5) this.state = 'patrol';
      }
    } else {
      // Patrol; if we have a remembered player position and are otherwise idle, go check it.
      if (!this.path.length || this.repathTimer >= this.cfg.repathInterval) {
        if (this.lastKnownPlayer && Math.random() < 0.4) {
          this.target = this.lastKnownPlayer;
          this.state = 'investigate';
        } else {
          this.target = this.pickWanderTarget();
        }
        this.path = navigation.findPath(this.object.position, this.target);
        this.pathIndex = 0;
        this.repathTimer = 0;
      }
    }

    this.followPath(delta, this.cfg.speed);

    if (distToPlayer <= this.cfg.proximityRadius) {
      this.modifySanity(-this.cfg.proximityFearRate * delta);
    }
  }

  pickWanderTarget() {
    const navigation = this.context.navigation;
    const origin = navigation.worldToCell(this.object.position);
    for (let i = 0; i < 12; i++) {
      const gx = origin.gx + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const gz = origin.gz + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const world = navigation.cellToWorld(gx, gz, this.object.position.y);
      if (navigation.isWalkable(world)) return world;
    }
    return { x: this.object.position.x, y: this.object.position.y, z: this.object.position.z };
  }
}
