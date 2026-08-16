/**
 * THRESHOLD Multiplayer — machine-readable error codes. Section 56.
 * UI converts codes to human text; APIs return { error: { code, message } }.
 */
export const ERROR_CODES = Object.freeze({
  LOBBY_NOT_FOUND: 'Lobby not found.',
  LOBBY_FULL: 'This lobby is full.',
  LOBBY_CLOSED: 'This lobby is closed.',
  LOBBY_STARTING: 'This lobby has already started.',
  LOBBY_NOT_JOINABLE: 'This lobby cannot be joined right now.',
  ALREADY_MEMBER: 'You are already in this lobby.',
  INVALID_CODE: 'That join code is not valid.',
  RATE_LIMITED: 'Too many attempts. Try again shortly.',
  VERSION_MISMATCH: 'Version mismatch. Refresh THRESHOLD to continue.',
  NOT_LOBBY_MEMBER: 'You are not a member of this lobby.',
  NOT_MEMBER: 'You are not a member of this lobby.',
  NOT_HOST: 'Only the host can do that.',
  NOT_ALL_READY: 'All players must be ready to start.',
  INVALID_STATE: 'The request was invalid.',
  PLAYER_KICKED: 'You have been removed from this lobby.',
  REALTIME_CONNECTION_FAILED: 'Realtime connection failed.',
  MATCH_NOT_FOUND: 'Match not found.',
  RECONNECT_EXPIRED: 'Your reconnect window has expired.',
  UNAUTHENTICATED: 'You must be signed in to do that.',
  AUTH_REQUIRED: 'You must be signed in to do that.',
  VALIDATION_ERROR: 'The request was invalid.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  BAD_REQUEST: 'The request was invalid.',
  INTERNAL: 'Something went wrong. Please try again.',
});

/** HTTP status per machine-readable code. Every RPC error code from
 * 0003_multiplayer_rpcs.sql maps to a 4xx (client-caused) status. */
export const ERROR_STATUS = Object.freeze({
  UNAUTHENTICATED: 401,
  AUTH_REQUIRED: 401,
  NOT_HOST: 403,
  NOT_LOBBY_MEMBER: 403,
  NOT_MEMBER: 403,
  PLAYER_KICKED: 403,
  LOBBY_NOT_FOUND: 404,
  MATCH_NOT_FOUND: 404,
  LOBBY_FULL: 409,
  LOBBY_CLOSED: 409,
  LOBBY_STARTING: 409,
  LOBBY_NOT_JOINABLE: 409,
  ALREADY_MEMBER: 409,
  NOT_ALL_READY: 409,
  VERSION_MISMATCH: 409,
  RECONNECT_EXPIRED: 409,
  INVALID_CODE: 400,
  INVALID_STATE: 400,
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
  UNKNOWN_ERROR: 500,
  INTERNAL: 500,
});

export function statusForCode(code) {
  return ERROR_STATUS[code] || 400;
}
