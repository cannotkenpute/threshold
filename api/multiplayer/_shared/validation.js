/**
 * THRESHOLD Multiplayer — server-side request validation. Sections 5, 35, 36.
 */

export class ValidationError extends Error {}

export const JOIN_CODE_RE = /^[0-9]{5}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VISIBILITY_VALUES = Object.freeze(['PUBLIC', 'PRIVATE']);
export const REGION_VALUES = Object.freeze(['AUTO', 'US_EAST', 'US_WEST', 'EUROPE', 'ASIA', 'OCEANIA', 'SOUTH_AMERICA']);
export const DIFFICULTY_VALUES = Object.freeze(['NORMAL', 'HARD']);
export const GAME_MODE_VALUES = Object.freeze(['SURVIVAL', 'STORY']);

const MAX_PAGE_LIMIT = 50;
const DEFAULT_PAGE_LIMIT = 25;

export function isJoinCode(v) { return typeof v === 'string' && JOIN_CODE_RE.test(v); }
export function isUuid(v) { return typeof v === 'string' && UUID_RE.test(v); }

export function validateJoinCode(v) {
  if (!isJoinCode(v)) throw new ValidationError('code must be a 5-digit join code');
  return v;
}

export function validateVisibility(v) {
  if (v == null) return 'PUBLIC';
  if (!VISIBILITY_VALUES.includes(v)) throw new ValidationError('visibility must be PUBLIC or PRIVATE');
  return v;
}

export function validateRegion(v) {
  if (v == null) return 'AUTO';
  if (!REGION_VALUES.includes(v)) throw new ValidationError('region must be one of ' + REGION_VALUES.join(', '));
  return v;
}

export function validateDifficulty(v) {
  if (v == null) return null;
  if (!DIFFICULTY_VALUES.includes(v)) throw new ValidationError('difficulty must be NORMAL or HARD');
  return v;
}

export function validateMaxPlayers(v) {
  if (v == null) return 4;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) throw new ValidationError('maxPlayers must be an integer between 1 and 4');
  return n;
}

export function validateGameMode(v) {
  if (v == null) return 'SURVIVAL';
  if (!GAME_MODE_VALUES.includes(v)) throw new ValidationError('gameMode must be SURVIVAL or STORY');
  return v;
}

export function validateCreateLobbyBody(body) {
  body = body || {};
  return {
    visibility: validateVisibility(body.visibility),
    region: validateRegion(body.region),
    difficulty: validateDifficulty(body.difficulty),
    maxPlayers: validateMaxPlayers(body.maxPlayers),
    gameMode: validateGameMode(body.gameMode),
  };
}

export function validatePageLimit(v) {
  if (v == null) return DEFAULT_PAGE_LIMIT;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }
  return n;
}

export function validateIsReady(v) {
  if (typeof v !== 'boolean') throw new ValidationError('isReady must be a boolean');
  return v;
}
