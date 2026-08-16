import { MONSTER_CONFIG, getRoamingCap, getUnlockedMonsterTypes } from './MonsterConfig.js';

export function createSeededRandom(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class EncounterScheduler {
  constructor(seed = 1, config = MONSTER_CONFIG) {
    this.config = config;
    this.random = createSeededRandom(seed);
    this.elapsed = 0;
    this.cooldown = 0;
  }

  reset(seed = 1) {
    this.random = createSeededRandom(seed);
    this.elapsed = 0;
    this.cooldown = 0;
  }

  update(delta, context) {
    this.elapsed += Math.max(0, delta);
    this.cooldown = Math.max(0, this.cooldown - Math.max(0, delta));
    if (this.elapsed < this.config.SCHEDULER_INTERVAL) return null;
    this.elapsed %= this.config.SCHEDULER_INTERVAL;
    if (this.cooldown > 0) return null;

    const cycleNumber = Math.max(1, context.cycleNumber || 1);
    const isNight = Boolean(context.isNight);
    const counts = context.activeCounts || {};
    const roamingCount = Object.entries(counts).reduce((sum, [type, count]) => {
      return sum + (this.config.TYPES[type]?.category === 'roaming' ? count : 0);
    }, 0);
    const unlocked = getUnlockedMonsterTypes(cycleNumber, isNight).filter((type) => {
      const category = this.config.TYPES[type].category;
      if (category === 'roaming' && roamingCount >= getRoamingCap(cycleNumber)) return false;
      if (category === 'mimic' && (counts[type] || 0) >= 2) return false;
      if (category === 'environmental' && (counts[type] || 0) >= 2) return false;
      if (category === 'event' && (counts[type] || 0) >= 1) return false;
      return true;
    });
    if (!unlocked.length || !context.players || !context.players.length) return null;

    const weighted = unlocked.map((type) => ({
      type,
      weight: this.config.TYPES[type].weight * (isNight ? 2 : 1),
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.random() * totalWeight;
    let type = weighted[weighted.length - 1].type;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) { type = entry.type; break; }
    }

    const player = context.players[Math.floor(this.random() * context.players.length)];
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.random() * Math.PI * 2;
      const distance = this.config.SPAWN_DISTANCE_MIN +
        this.random() * (this.config.SPAWN_DISTANCE_MAX - this.config.SPAWN_DISTANCE_MIN);
      const position = {
        x: player.position.x + Math.cos(angle) * distance,
        y: 0,
        z: player.position.z + Math.sin(angle) * distance,
      };
      if (context.isWalkable && !context.isWalkable(position)) continue;
      if (context.isVisible && context.isVisible(position, player)) continue;
      this.cooldown = isNight ? this.config.NIGHT_COOLDOWN : this.config.DAY_COOLDOWN;
      return { type, position, targetPlayerId: player.id || 'local' };
    }
    return null;
  }
}
