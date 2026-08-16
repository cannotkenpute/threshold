#!/usr/bin/env node
/**
 * THRESHOLD multiplayer logic tests (pure Node, zero dependencies).
 * Exercises js/multiplayer/protocol.js — the shared browser/server module —
 * so both sides of the wire are validated against one implementation.
 */

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'protocol.js')).href);

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

test('version constants', () => {
  assert.equal(P.PROTOCOL_VERSION, 1);
  assert.equal(P.GAME_VERSION, '0.1.0');
});

test('isProtocolCompatible accepts matching version in all shapes', () => {
  assert.equal(P.isProtocolCompatible(1), true);
  assert.equal(P.isProtocolCompatible({ v: 1 }), true);
  assert.equal(P.isProtocolCompatible({ protocolVersion: 1 }), true);
});

test('isProtocolCompatible rejects mismatched/garbage versions', () => {
  assert.equal(P.isProtocolCompatible(2), false);
  assert.equal(P.isProtocolCompatible(0), false);
  assert.equal(P.isProtocolCompatible(-1), false);
  assert.equal(P.isProtocolCompatible(1.5), false);
  assert.equal(P.isProtocolCompatible(undefined), false);
  assert.equal(P.isProtocolCompatible(null), false);
  assert.equal(P.isProtocolCompatible('1'), false);
  assert.equal(P.isProtocolCompatible({}), false);
});

test('envelope fields match the §15 spec', () => {
  assert.deepEqual(P.ENVELOPE_FIELDS, [
    'v', 'type', 'matchId', 'senderId', 'authorityEpoch', 'seq', 'sentAt', 'payload',
  ]);
});

test('critical events include lifecycle, items, players, authority, monsters', () => {
  for (const t of [
    'match:start', 'match:end', 'item:pickup_confirmed', 'item:used',
    'player:downed', 'player:revived', 'player:died', 'host:changed',
    'authority:migration_complete', 'monster:spawn', 'monster:attack', 'monster:despawn',
  ]) {
    assert.ok(P.CRITICAL_EVENT_TYPES.includes(t), `missing critical event ${t}`);
  }
});

test('replaceable state types match spec', () => {
  for (const t of [
    'player:transform', 'player:flashlight', 'player:animation',
    'monster:snapshot', 'fear:sync', 'authority:heartbeat',
  ]) {
    assert.ok(P.REPLACEABLE_STATE_TYPES.includes(t), `missing replaceable type ${t}`);
  }
});

test('no event type is both critical and replaceable', () => {
  const critical = new Set(P.CRITICAL_EVENT_TYPES);
  for (const t of P.REPLACEABLE_STATE_TYPES) {
    assert.ok(!critical.has(t), `${t} is both critical and replaceable`);
  }
});

test('update rates match spec', () => {
  assert.equal(P.UPDATE_RATES_HZ.PLAYER_TRANSFORM, 12);
  assert.equal(P.UPDATE_RATES_HZ.MONSTER_SNAPSHOT, 8);
  assert.equal(P.UPDATE_RATES_HZ.AUTHORITY_HEARTBEAT, 1);
  assert.equal(P.UPDATE_RATES_HZ.SNAPSHOT_CACHE, 0.5);
});

test('interpolation + session limits match spec', () => {
  assert.equal(P.INTERPOLATION.BUFFER_MS, 125);
  assert.equal(P.INTERPOLATION.MAX_EXTRAPOLATION_MS, 250);
  assert.equal(P.MAX_PLAYERS, 4);
  assert.equal(P.RECONNECT_WINDOW_MS, 60000);
});

test('heartbeats stay alive across the reconnect window', () => {
  const heartbeatIntervalMs = 1000 / P.UPDATE_RATES_HZ.AUTHORITY_HEARTBEAT;
  assert.ok(heartbeatIntervalMs * 3 < P.RECONNECT_WINDOW_MS);
});

if (process.exitCode) {
  console.log('\nmultiplayer-logic: FAILED');
  process.exit(1);
}
console.log(`\nmultiplayer-logic: all ${passed} test(s) passed`);
