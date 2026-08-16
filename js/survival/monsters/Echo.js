import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  speed: 3.0,
  profileWindow: 300,
  interceptRadius: 2.0,
  fearRate: 6.0,
  repathInterval: 4.0,
};

/**
 * Echo (cycle 8): maintains a rolling profile of the player's repeated route cells and
 * points of interest, then positions itself to intercept the most-visited location. It is
 * match-memory only and never stores identifying data.
 */
export class Echo extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    // cellKey -> { count, lastSeen }
    this.profile = new Map();
    this.interceptTarget = null;
    this.repathTimer = 0;
    this.gameTime = 0;
  }

  onSensoryEvent(event) {
    super.onSensoryEvent(event);
    if (!this.spawned || this.disposed) return;
    if (event.type === 'player:route_cell' || event.type === 'player:interaction' || event.type === 'player:item_collected') {
      const cell = this.context.navigation.worldToCell(event.position);
      const key = `${cell.gx}:${cell.gz}`;
      const entry = this.profile.get(key) || { count: 0, lastSeen: 0 };
      entry.count += 1;
      entry.lastSeen = event.gameTime || this.gameTime;
      this.profile.set(key, entry);
    }
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    this.gameTime += delta;
    const player = this.context.player;
    const navigation = this.context.navigation;
    const distToPlayer = this.object.position.distanceTo(player.position);

    this.repathTimer += delta;
    if (!this.interceptTarget || this.repathTimer >= this.cfg.repathInterval) {
      this.interceptTarget = this.strongestRouteCell();
      this.path = navigation.findPath(this.object.position, this.interceptTarget);
      this.pathIndex = 0;
      this.repathTimer = 0;
    }

    this.followPath(delta, this.cfg.speed);

    if (distToPlayer <= this.cfg.interceptRadius) {
      this.modifySanity(-this.cfg.fearRate * delta);
    }
  }

  // Returns the world position of the most-repeated (still in-window) route cell.
  strongestRouteCell() {
    this.pruneProfile();
    let best = null;
    let bestCount = 0;
    for (const [key, entry] of this.profile) {
      if (entry.count > bestCount) {
        bestCount = entry.count;
        best = key;
      }
    }
    if (!best) {
      return { x: this.context.player.position.x, y: this.object.position.y, z: this.context.player.position.z };
    }
    const [gx, gz] = best.split(':').map(Number);
    return this.context.navigation.cellToWorld(gx, gz, this.object.position.y);
  }

  pruneProfile() {
    const cutoff = this.gameTime - this.cfg.profileWindow;
    for (const [key, entry] of this.profile) {
      if (entry.lastSeen < cutoff) this.profile.delete(key);
    }
  }
}
