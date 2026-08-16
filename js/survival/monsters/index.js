import { Watcher } from './Watcher.js';
import { Mimic } from './Mimic.js';
import { Drifter } from './Drifter.js';
import { Static } from './Static.js';
import { HollowMan } from './HollowMan.js';
import { Grinner } from './Grinner.js';
import { Surveyor } from './Surveyor.js';
import { CrawlingMass } from './CrawlingMass.js';
import { Echo } from './Echo.js';
import { Threshold } from './Threshold.js';

// Maps a monster type key (see CONFIG.SURVIVAL.MONSTERS.TYPES) to its concrete class.
// Every implemented type is listed; SurvivalMonsterDirector falls back to MonsterBase for
// any type missing here, so an unlisted type still debug-spawns as an inert entity.
export const MONSTER_CLASSES = {
  watcher: Watcher,
  mimic: Mimic,
  drifter: Drifter,
  static: Static,
  hollow_man: HollowMan,
  grinner: Grinner,
  surveyor: Surveyor,
  crawling_mass: CrawlingMass,
  echo: Echo,
  threshold: Threshold,
};
