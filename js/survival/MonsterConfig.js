import { CONFIG } from '../config.js';

export const MONSTER_CONFIG = CONFIG.SURVIVAL.MONSTERS;
export const MONSTER_TYPES = Object.freeze(Object.keys(MONSTER_CONFIG.TYPES));

export function isMonsterType(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(MONSTER_CONFIG.TYPES, type);
}

export function getUnlockedMonsterTypes(cycleNumber, isNight = false) {
  return MONSTER_TYPES.filter((type) => {
    const definition = MONSTER_CONFIG.TYPES[type];
    return definition.unlockCycle <= cycleNumber && (!definition.nightOnly || isNight);
  });
}

export function getRoamingCap(cycleNumber) {
  if (cycleNumber >= 8) return 3;
  if (cycleNumber >= 4) return 2;
  return 1;
}
