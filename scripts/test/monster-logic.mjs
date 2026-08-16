#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EncounterScheduler, createSeededRandom } from '../../js/survival/EncounterScheduler.js';
import { getRoamingCap, getUnlockedMonsterTypes } from '../../js/survival/MonsterConfig.js';
import { SensoryEventBus } from '../../js/survival/SensoryEventBus.js';
import { SurvivalNavigationGrid } from '../../js/survival/SurvivalNavigationGrid.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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

test('seeded random is deterministic', () => {
  const a = createSeededRandom(1984);
  const b = createSeededRandom(1984);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('unlock cycles and roaming caps match the implementation plan', () => {
  assert.deepEqual(getUnlockedMonsterTypes(1, false).sort(), ['mimic', 'watcher']);
  assert.ok(getUnlockedMonsterTypes(6, true).includes('crawling_mass'));
  assert.ok(!getUnlockedMonsterTypes(9, true).includes('threshold'));
  assert.equal(getRoamingCap(1), 1);
  assert.equal(getRoamingCap(4), 2);
  assert.equal(getRoamingCap(8), 3);
});

test('encounter scheduler respects interval, distance, and visibility rejection', () => {
  const scheduler = new EncounterScheduler(42);
  const context = {
    cycleNumber: 1,
    isNight: false,
    players: [{ id: 'p1', position: { x: 0, y: 0, z: 0 } }],
    activeCounts: {},
    isWalkable: () => true,
    isVisible: () => false,
  };
  assert.equal(scheduler.update(4.9, context), null);
  const request = scheduler.update(0.1, context);
  assert.ok(request);
  const distance = Math.hypot(request.position.x, request.position.z);
  assert.ok(distance >= 16 && distance <= 38);

  const blocked = new EncounterScheduler(42);
  assert.equal(blocked.update(5, { ...context, isVisible: () => true }), null);
});

test('sensory events are sequenced, immutable snapshots', () => {
  const bus = new SensoryEventBus(16);
  bus.setGameTime(12.5);
  const position = { x: 1, y: 2, z: 3 };
  const event = bus.emit('player:footstep', { position, intensity: 0.5 });
  position.x = 99;
  assert.equal(event.sequence, 1);
  assert.equal(event.gameTime, 12.5);
  assert.equal(event.position.x, 1);
  assert.throws(() => bus.emit('monster:invalid', {}));
});

test('navigation indexes chunks, avoids blockers, and removes unloaded cells', () => {
  let listener = null;
  const chunk = {
    key: '0_0', cx: 0, cz: 0,
    colliders: [{ min: { x: -0.4, y: 0, z: -0.4 }, max: { x: 0.4, y: 2, z: 0.4 } }],
  };
  const levelBuilder = {
    CHUNK_SIZE: 4,
    activeChunks: new Map([[chunk.key, chunk]]),
    onChunkLifecycle(fn) { listener = fn; return () => { listener = null; }; },
  };
  const grid = new SurvivalNavigationGrid(levelBuilder, { cellSize: 1, maxNodes: 100 });
  grid.start();
  assert.equal(grid.isWalkable({ x: 0, z: 0 }), false);
  assert.equal(grid.isWalkable({ x: -2, z: 0 }), true);
  assert.ok(grid.findPath({ x: -2, z: 0 }, { x: 2, z: 0 }).length > 0);
  assert.equal(grid.hasRouteThroughChunk('0_0'), true);
  listener({ type: 'unloading', chunk });
  assert.equal(grid.cells.size, 0);
  grid.dispose();
});

test('shared monster runtime never applies direct health damage', () => {
  const survivalDir = path.join(ROOT, 'js', 'survival');
  const files = fs.readdirSync(survivalDir).filter((name) => name.endsWith('.js'));
  for (const file of files) {
    const source = fs.readFileSync(path.join(survivalDir, file), 'utf8');
    assert.ok(!source.includes('.takeDamage('), `${file} calls takeDamage directly`);
  }
});

if (process.exitCode) {
  console.log('\nmonster-logic: FAILED');
  process.exit(1);
}
console.log(`\nmonster-logic: all ${passed} test(s) passed`);
