#!/usr/bin/env node
/**
 * THRESHOLD lobby logic tests (pure Node, zero dependencies).
 * Exercises the pure functions behind Phase 3 (API validation, error-code
 * mapping) and Phase 4 (lobby slot reconciliation) without a live Supabase
 * connection.
 */

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const V = await import(pathToFileURL(path.join(ROOT, 'api', 'multiplayer', '_shared', 'validation.js')).href);
const R = await import(pathToFileURL(path.join(ROOT, 'api', 'multiplayer', '_shared', 'response.js')).href);
const L = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'LobbyManager.js')).href);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    process.exitCode = 1;
  }
}

// --- validation.js -----------------------------------------------------

test('validateVisibility accepts PUBLIC/PRIVATE, defaults to PUBLIC', () => {
  assert.equal(V.validateVisibility('PUBLIC'), 'PUBLIC');
  assert.equal(V.validateVisibility('PRIVATE'), 'PRIVATE');
  assert.equal(V.validateVisibility(undefined), 'PUBLIC');
  assert.throws(() => V.validateVisibility('SECRET'), V.ValidationError);
});

test('validateRegion accepts the 7 spec regions, defaults to AUTO', () => {
  for (const r of V.REGION_VALUES) assert.equal(V.validateRegion(r), r);
  assert.equal(V.validateRegion(undefined), 'AUTO');
  assert.throws(() => V.validateRegion('MOON'), V.ValidationError);
});

test('validateMaxPlayers enforces 1-4 integer range, defaults to 4', () => {
  assert.equal(V.validateMaxPlayers(undefined), 4);
  assert.equal(V.validateMaxPlayers(1), 1);
  assert.equal(V.validateMaxPlayers('3'), 3);
  assert.throws(() => V.validateMaxPlayers(0), V.ValidationError);
  assert.throws(() => V.validateMaxPlayers(5), V.ValidationError);
  assert.throws(() => V.validateMaxPlayers(2.5), V.ValidationError);
});

test('validateJoinCode requires exactly 5 digits, preserves leading zeros', () => {
  assert.equal(V.validateJoinCode('04217'), '04217');
  assert.throws(() => V.validateJoinCode('4217'), V.ValidationError);
  assert.throws(() => V.validateJoinCode('123456'), V.ValidationError);
  assert.throws(() => V.validateJoinCode('abcde'), V.ValidationError);
  assert.throws(() => V.validateJoinCode(48217), V.ValidationError);
});

test('validateIsReady requires a boolean', () => {
  assert.equal(V.validateIsReady(true), true);
  assert.equal(V.validateIsReady(false), false);
  assert.throws(() => V.validateIsReady('true'), V.ValidationError);
});

test('validatePageLimit enforces 1-50, defaults to 25', () => {
  assert.equal(V.validatePageLimit(undefined), 25);
  assert.equal(V.validatePageLimit('50'), 50);
  assert.throws(() => V.validatePageLimit(51), V.ValidationError);
  assert.throws(() => V.validatePageLimit(0), V.ValidationError);
});

test('validateCreateLobbyBody composes all field validators', () => {
  const body = V.validateCreateLobbyBody({ visibility: 'PRIVATE', region: 'EUROPE', maxPlayers: 2 });
  assert.deepEqual(body, { visibility: 'PRIVATE', region: 'EUROPE', difficulty: null, maxPlayers: 2 });
});

// --- response.js ---------------------------------------------------------

test('ERROR_STATUS covers every RPC error code from 0003_multiplayer_rpcs.sql', () => {
  const RPC_ERROR_CODES = [
    'LOBBY_NOT_FOUND', 'LOBBY_FULL', 'LOBBY_NOT_JOINABLE', 'ALREADY_MEMBER',
    'INVALID_CODE', 'VERSION_MISMATCH', 'NOT_MEMBER', 'NOT_HOST',
    'NOT_ALL_READY', 'INVALID_STATE', 'AUTH_REQUIRED', 'MATCH_NOT_FOUND',
  ];
  for (const code of RPC_ERROR_CODES) {
    assert.ok(code in R.ERROR_STATUS, `ERROR_STATUS missing ${code}`);
    assert.ok(R.ERROR_STATUS[code] >= 400 && R.ERROR_STATUS[code] < 500, `${code} should map to a 4xx status`);
  }
});

// --- LobbyManager.buildLobbySlots -----------------------------------------

test('buildLobbySlots always returns maxPlayers slots, empty-padded', () => {
  const slots = L.buildLobbySlots([], 'host-1', 4);
  assert.equal(slots.length, 4);
  assert.ok(slots.every((s) => s.empty === true));
});

test('buildLobbySlots orders host first, then members by joined_at', () => {
  const members = [
    { player_id: 'p2', display_name: 'P2', is_host: false, is_ready: false, member_state: 'CONNECTED', joined_at: '2026-01-01T00:02:00Z' },
    { player_id: 'host-1', display_name: 'HOST', is_host: true, is_ready: true, member_state: 'CONNECTED', joined_at: '2026-01-01T00:00:00Z' },
    { player_id: 'p3', display_name: 'P3', is_host: false, is_ready: true, member_state: 'CONNECTED', joined_at: '2026-01-01T00:01:00Z' },
  ];
  const slots = L.buildLobbySlots(members, 'host-1', 4);
  assert.equal(slots.length, 4);
  assert.equal(slots[0].playerId, 'host-1');
  assert.equal(slots[0].isHost, true);
  assert.equal(slots[1].playerId, 'p3');
  assert.equal(slots[2].playerId, 'p2');
  assert.equal(slots[3].empty, true);
});

test('buildLobbySlots excludes LEFT/KICKED members', () => {
  const members = [
    { player_id: 'host-1', display_name: 'HOST', is_host: true, is_ready: true, member_state: 'CONNECTED', joined_at: '2026-01-01T00:00:00Z' },
    { player_id: 'p2', display_name: 'GONE', is_host: false, is_ready: false, member_state: 'LEFT', joined_at: '2026-01-01T00:01:00Z' },
    { player_id: 'p3', display_name: 'KICKED', is_host: false, is_ready: false, member_state: 'KICKED', joined_at: '2026-01-01T00:02:00Z' },
  ];
  const slots = L.buildLobbySlots(members, 'host-1', 4);
  const activeIds = slots.filter((s) => !s.empty).map((s) => s.playerId);
  assert.deepEqual(activeIds, ['host-1']);
});

test('buildLobbySlots caps at maxPlayers even with more active members', () => {
  const members = Array.from({ length: 6 }, (_, i) => ({
    player_id: `p${i}`,
    display_name: `P${i}`,
    is_host: i === 0,
    is_ready: true,
    member_state: 'CONNECTED',
    joined_at: `2026-01-01T00:0${i}:00Z`,
  }));
  const slots = L.buildLobbySlots(members, 'p0', 4);
  assert.equal(slots.length, 4);
  assert.ok(slots.every((s) => !s.empty));
});

if (process.exitCode) {
  console.log('\nlobby-logic: FAILED');
  process.exit(1);
}
console.log(`\nlobby-logic: all ${passed} test(s) passed`);
