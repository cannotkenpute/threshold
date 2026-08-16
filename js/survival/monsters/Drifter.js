import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  patrolSpeed: 2.6,
  chaseSpeed: 4.6,
  investigateRadius: 14,
  proximityRadius: 2.5,
  proximityFearRate: 6.0,
  repathInterval: 2.5,
  wanderRadius: 20,
};

/**
 * Drifter (cycle 2): patrols the maze, investigates nearby noise, and chases loud players.
 * Its target selection is driven by sensory events, and it navigates via the shared grid.
 */
export class Drifter extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.state = 'patrol'; // 'patrol' | 'investigate' | 'chase'
    this.target = null;
    this.repathTimer = 0;
    this._cell = null;
  }

  onSensoryEvent(event) {
    super.onSensoryEvent(event);
    if (!this.spawned || this.disposed || !this.object) return;
    const position = { x: event.position.x, y: event.position.y, z: event.position.z };

    if (event.type === 'player:sprint' || (event.type === 'player:interaction' && event.intensity >= 0.6)) {
      this.state = 'chase';
      this.target = position;
      this.path = [];
      this.repathTimer = 0;
    } else if (event.type === 'player:footstep' && this.state !== 'chase') {
      // Scale the effective detection range by the event's own intensity, so a crouching
      // player's quieter footsteps (lower intensity, see Player.js) are only noticed much
      // closer in -- this is what makes crouch-hiding an actual stealth mechanic rather
      // than just a slower walk cycle.
      const effectiveRadius = this.cfg.investigateRadius * Math.max(0, Math.min(1, event.intensity ?? 1));
      if (this.object.position.distanceTo(position) <= effectiveRadius) {
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
    const distToPlayer = this.object.position.distanceTo(player.position);
    const navigation = this.context.navigation;

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
        if (this.object.position.distanceTo(this.target) < 1.2) this.state = 'patrol';
      }
    } else {
      // Patrol: pick a fresh random walkable destination when idle or the timer elapses.
      if (!this.path.length || this.repathTimer >= this.cfg.repathInterval) {
        this.target = this.pickPatrolTarget();
        this.path = navigation.findPath(this.object.position, this.target);
        this.pathIndex = 0;
        this.repathTimer = 0;
      }
    }

    this.followPath(delta, this.state === 'chase' ? this.cfg.chaseSpeed : this.cfg.patrolSpeed);

    if (distToPlayer <= this.cfg.proximityRadius) {
      this.modifySanity(-this.cfg.proximityFearRate * delta);
    }
  }

  pickPatrolTarget() {
    const navigation = this.context.navigation;
    const origin = navigation.worldToCell(this.object.position);
    for (let i = 0; i < 12; i++) {
      const gx = origin.gx + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const gz = origin.gz + Math.floor(Math.random() * (this.cfg.wanderRadius * 2 + 1)) - this.cfg.wanderRadius;
      const world = navigation.cellToWorld(gx, gz, this.object.position.y);
      if (navigation.isWalkable(world)) return world;
    }
    return { x: this.context.player.position.x, y: this.object.position.y, z: this.context.player.position.z };
  }
}
