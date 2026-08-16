#!/usr/bin/env node

import assert from 'node:assert/strict';
import { encodeSnapshot, decodeSnapshot, validateSnapshot } from '../../js/survival/network/MonsterSnapshotCodec.js';
import { MonsterAuthorityAdapter } from '../../js/survival/network/MonsterAuthorityAdapter.js';
import { MultiplayerSurvivalState } from '../../js/multiplayer/MultiplayerSurvivalState.js';

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    process.exitCode = 1;
  }
}

test('monster snapshot codec round-trips losslessly', () => {
  const snapshot = {
    id: 'watcher-1',
    type: 'watcher',
    position: { x: 12.345, y: 0, z: -4.5 },
    rotation: { x: 0, y: 1.57, z: 0 },
    age: 3.25,
    fallback: false,
  };
  const decoded = decodeSnapshot(encodeSnapshot(snapshot));
  assert.equal(decoded.id, 'watcher-1');
  assert.equal(decoded.type, 'watcher');
  assert.equal(decoded.position.x, 12.345);
  assert.equal(decoded.rotation.y, 1.57);
  assert.equal(decoded.age, 3.25);
  assert.equal(decoded.fallback, false);
});

test('monster snapshot codec rejects unknown types', () => {
  const bad = { id: 'x-1', type: 'not_a_monster', position: { x: 0, y: 0, z: 0 } };
  assert.equal(validateSnapshot(bad).ok, false);
  assert.equal(validateSnapshot(bad).reason, 'unknown_type');
});

test('monster authority adapter host serializes + client applies', () => {
  const director = {
    gameTime: 42,
    monsters: new Map([
      ['watcher-1', { serializeSnapshot: () => ({ id: 'watcher-1', type: 'watcher', position: { x: 1, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0 }, age: 1, fallback: false }) }],
    ]),
  };
  const applied = [];
  const renderer = { applySnapshotList: (list) => applied.push(...list) };
  const hostAdapter = new MonsterAuthorityAdapter({ director });
  const clientAdapter = new MonsterAuthorityAdapter({ renderer });

  const state = hostAdapter.serializeAuthorityState();
  assert.equal(state.gameTime, 42);
  assert.equal(state.monsters.length, 1);

  clientAdapter.applyAuthorityState(state);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].id, 'watcher-1');
  assert.equal(applied[0].position.x, 1);
});

test('canonical survival state rejects duplicate pickups', () => {
  const state = new MultiplayerSurvivalState();
  state.registerPlayer('p1');
  assert.equal(state.handlePickupRequest('p1', { itemId: 'battery', capacity: 3 }).ok, true);
  // Retry (packet loss / duplicate) must NOT double-add.
  assert.equal(state.handlePickupRequest('p1', { itemId: 'battery', capacity: 3 }).ok, false);
  assert.equal(state.handlePickupRequest('p1', { itemId: 'battery', capacity: 3 }).code, 'ALREADY_HELD');
  assert.equal(state.getPlayer('p1').items.length, 1);
});

test('canonical survival state enforces capacity + use consumption', () => {
  const state = new MultiplayerSurvivalState();
  state.registerPlayer('p1');
  state.handlePickupRequest('p1', { itemId: 'a', capacity: 2 });
  state.handlePickupRequest('p1', { itemId: 'b', capacity: 2 });
  assert.equal(state.handlePickupRequest('p1', { itemId: 'c', capacity: 2 }).code, 'INVENTORY_FULL');

  assert.equal(state.handleUseRequest('p1', { itemId: 'a' }).ok, true);
  assert.equal(state.handleUseRequest('p1', { itemId: 'a' }).code, 'NOT_HELD');
  assert.deepEqual(state.getPlayer('p1').items, ['b']);
});

test('canonical survival state snapshot round-trips', () => {
  const state = new MultiplayerSurvivalState();
  state.registerPlayer('p1', { hunger: 30, fear: 65, items: ['battery'] });
  state.epoch = 3;
  state.matchTime = 120;

  const restored = new MultiplayerSurvivalState();
  restored.restoreSnapshot(state.serializeSnapshot());
  assert.equal(restored.epoch, 3);
  assert.equal(restored.matchTime, 120);
  assert.equal(restored.getPlayer('p1').hunger, 30);
  assert.equal(restored.getPlayer('p1').fear, 65);
  assert.deepEqual(restored.getPlayer('p1').items, ['battery']);
});

if (process.exitCode) {
  console.log('\nauthority-logic: FAILED');
  process.exit(1);
}
console.log(`\nauthority-logic: all ${passed} test(s) passed`);
