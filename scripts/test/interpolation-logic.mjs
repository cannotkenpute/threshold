#!/usr/bin/env node
/**
 * THRESHOLD multiplayer interpolation tests (pure Node, zero dependencies).
 * Exercises Phase 5 entity-interpolation + spawn-assignment logic:
 *   js/multiplayer/SnapshotBuffer.js
 *   js/multiplayer/NetworkInterpolation.js
 *   computeSpawnAssignment from js/multiplayer/MultiplayerPlayerSync.js
 * (MultiplayerPlayerSync reads globalThis.THREE lazily inside methods only,
 * so importing it here never touches browser APIs.)
 */

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SB = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'SnapshotBuffer.js')).href);
const NI = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'NetworkInterpolation.js')).href);
const MPS = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'MultiplayerPlayerSync.js')).href);
const PROTO = await import(pathToFileURL(path.join(ROOT, 'js', 'multiplayer', 'protocol.js')).href);

const BUFFER_MS = PROTO.INTERPOLATION.BUFFER_MS; // 125
const MAX_EXTRAP = PROTO.INTERPOLATION.MAX_EXTRAPOLATION_MS; // 250

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

function near(actual, expected, eps = 1e-6, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `${label}: expected ${expected} (+/-${eps}), got ${actual}`
  );
}

const s = (x, yaw = 0) => ({ x, y: 0, z: 0, yaw });

// ---------------------------------------------------------------------------
// SnapshotBuffer
// ---------------------------------------------------------------------------

test('empty buffer sampleAt returns null', () => {
  const b = new SB.SnapshotBuffer();
  assert.equal(b.sampleAt(1000), null);
  assert.equal(b.size(), 0);
});

test('out-of-order and duplicate-timestamp pushes are rejected', () => {
  const b = new SB.SnapshotBuffer();
  assert.equal(b.push(100, s(1)), true);
  assert.equal(b.push(90, s(2)), false); // older than newest
  assert.equal(b.push(100, s(3)), false); // duplicate timestamp
  assert.equal(b.size(), 1);
  const out = b.sampleAt(5000);
  near(out.x, 1, 1e-9, 'held x');
});

test('non-finite samples and timestamps are rejected', () => {
  const b = new SB.SnapshotBuffer();
  assert.equal(b.push(100, s(1)), true);
  assert.equal(b.push(200, { x: NaN, y: 0, z: 0, yaw: 0 }), false);
  assert.equal(b.push(Infinity, s(2)), false);
  assert.equal(b.push(300, null), false);
  assert.equal(b.size(), 1);
});

test('single-sample buffer clamp-holds at any render time', () => {
  const b = new SB.SnapshotBuffer();
  b.push(1000, { x: 5, y: 2, z: -3, yaw: 1.2 });
  for (const t of [0, 1000, 5000]) {
    const out = b.sampleAt(t);
    near(out.x, 5, 1e-9, `x@${t}`);
    near(out.yaw, 1.2, 1e-9, `yaw@${t}`);
  }
});

test('capacity 32 evicts oldest (ring drop-oldest)', () => {
  const b = new SB.SnapshotBuffer();
  for (let i = 0; i < 40; i++) {
    assert.equal(b.push(i * 10, s(i)), true, `push ${i}`);
  }
  assert.equal(b.size(), 32);
  assert.equal(b.newestTime(), 390);
  // Oldest retained sample is t=80 (40 - 32 = 8 dropped: t=0..70).
  near(b.sampleAt(0).x, 8, 1e-9, 'clamp-hold oldest retained');
  near(b.sampleAt(80).x, 8, 1e-9, 'exact at oldest retained');
});

test('exact bracketing interpolation math (alpha blend)', () => {
  const b = new SB.SnapshotBuffer();
  b.push(0, { x: 0, y: 10, z: -4, yaw: 0 });
  b.push(100, { x: 10, y: 20, z: 4, yaw: 0.6 });
  const mid = b.sampleAt(50); // alpha 0.5
  near(mid.x, 5, 1e-9, 'x');
  near(mid.y, 15, 1e-9, 'y');
  near(mid.z, 0, 1e-9, 'z');
  near(mid.yaw, 0.3, 1e-9, 'yaw');
  const q = b.sampleAt(25); // alpha 0.25
  near(q.x, 2.5, 1e-9, 'x@0.25');
  near(q.yaw, 0.15, 1e-9, 'yaw@0.25');
  // Exact endpoint hits.
  near(b.sampleAt(0).x, 0, 1e-9, 'x@t0');
  near(b.sampleAt(100).x, 10, 1e-9, 'x@t1');
});

test('extrapolation uses tracked velocity beyond the newest sample', () => {
  const b = new SB.SnapshotBuffer();
  b.push(0, s(0));
  b.push(100, s(10)); // velocity 0.1/ms
  near(b.sampleAt(200).x, 20, 1e-6, 'extrapolated +100ms'); // beyond newest by 100ms
  near(b.sampleAt(150).x, 15, 1e-6, 'extrapolated +50ms');
});

test('extrapolation clamps at MAX_EXTRAPOLATION_MS then holds', () => {
  const b = new SB.SnapshotBuffer();
  b.push(0, s(0));
  b.push(100, s(10)); // velocity 0.1/ms, newest t=100 x=10
  // Beyond newest by exactly MAX_EXTRAPOLATION_MS (250): 10 + 0.1*250 = 35.
  near(b.sampleAt(350).x, 35, 1e-6, 'clamped at cap');
  // Far beyond: still the capped value (clamp-hold).
  near(b.sampleAt(5000).x, 35, 1e-6, 'hold beyond cap');
  near(b.sampleAt(1e9).x, 35, 1e-6, 'hold at absurd t');
});

test('extrapolated yaw follows shortest-arc angular velocity, capped', () => {
  const b = new SB.SnapshotBuffer();
  b.push(0, s(0, 0));
  b.push(100, s(0, 0.5)); // +0.5 rad / 100ms
  near(b.sampleAt(150).yaw, 0.75, 1e-6, 'yaw extrapolated +50ms');
  // Beyond cap: 250ms past newest -> 0.5 + 0.005*250 = 1.75, then hold.
  near(b.sampleAt(350).yaw, 1.75, 1e-6, 'yaw clamped');
  near(b.sampleAt(900).yaw, 1.75, 1e-6, 'yaw held');
});

test('shortest-arc yaw: 350deg -> 10deg blends through 0deg', () => {
  const b = new SB.SnapshotBuffer();
  const deg = (d) => (d * Math.PI) / 180;
  b.push(0, s(0, deg(350)));
  b.push(100, s(0, deg(10)));
  const mid = b.sampleAt(50);
  // The long way would land near +/-180deg; the shortest arc lands near 0deg.
  assert.ok(Math.abs(mid.yaw) < 1e-6, `expected yaw near 0, got ${mid.yaw}`);
  // Quarter-way: 355deg == -5deg.
  const quarter = b.sampleAt(25);
  near(quarter.yaw, deg(-5), 1e-6, 'yaw@0.25');
});

test('shortest-arc yaw wraps through +/-PI when that is shorter', () => {
  const b = new SB.SnapshotBuffer();
  b.push(0, s(0, 3.0));
  b.push(100, s(0, -3.0)); // shortest arc is +0.283 through +PI
  const mid = b.sampleAt(50);
  // +PI and -PI are the same direction; the buffer normalizes to [-PI, PI).
  assert.ok(
    Math.abs(Math.abs(mid.yaw) - Math.PI) < 1e-6,
    `expected yaw near +/-PI, got ${mid.yaw}`
  );
});

test('clamp-hold when render time precedes the oldest sample', () => {
  const b = new SB.SnapshotBuffer();
  b.push(100, s(1));
  b.push(200, s(2));
  near(b.sampleAt(-1000).x, 1, 1e-9, 'held oldest');
  near(b.sampleAt(100).x, 1, 1e-9, 'exact at oldest');
});

// ---------------------------------------------------------------------------
// NetworkInterpolation
// ---------------------------------------------------------------------------

test('entity lifecycle: addEntity/hasEntity/removeEntity/clear', () => {
  const ni = new NI.NetworkInterpolation();
  ni.addEntity('a');
  assert.equal(ni.hasEntity('a'), true);
  assert.equal(ni.hasEntity('b'), false);
  ni.onSample('b', 0, s(1)); // auto-register on first sample
  assert.equal(ni.hasEntity('b'), true);
  assert.equal(ni.removeEntity('a'), true);
  assert.equal(ni.hasEntity('a'), false);
  ni.clear();
  assert.equal(ni.hasEntity('b'), false);
});

test('render delay: interpolate(now) reads BUFFER_MS in the past', () => {
  const ni = new NI.NetworkInterpolation();
  // Samples every 100ms from t=0..1000, x = t/100.
  for (let t = 0; t <= 1000; t += 100) ni.onSample('e', t, s(t / 100));
  // interpolate(625): render time 625 - 125 = 500 -> exact mid-buffer sample x=5.
  const exact = ni.interpolate(625).get('e');
  near(exact.x, 5, 1e-9, 'exact mid-buffer hit');
  // interpolate(675): render time 550 -> halfway between samples 500 (x=5) and 600 (x=6).
  const half = ni.interpolate(675).get('e');
  near(half.x, 5.5, 1e-9, 'bracket blend behind newest');
  // Without the delay (interpolate(1000) reading t=1000) we would sit on the
  // newest sample; with it we stay 125ms behind: interpolate(1125) -> t=1000.
  near(ni.interpolate(1125).get('e').x, 10, 1e-9, 'delayed newest');
});

test('getStats reports per-entity sample count and extrapolating flag', () => {
  const ni = new NI.NetworkInterpolation();
  for (let t = 0; t <= 1000; t += 100) ni.onSample('e', t, s(t / 100));
  ni.onSample('e2', 0, s(7));
  const fresh = ni.getStats(1000); // render time 875 <= newest 1000
  assert.equal(fresh.e.sampleCount, 11);
  assert.equal(fresh.e.extrapolating, false);
  const stale = ni.getStats(2000); // render time 1875 > newest 1000
  assert.equal(stale.e.sampleCount, 11);
  assert.equal(stale.e.extrapolating, true);
  assert.equal(stale.e2.sampleCount, 1);
});

test('buffer inside NetworkInterpolation still rejects out-of-order samples', () => {
  const ni = new NI.NetworkInterpolation();
  ni.onSample('e', 100, s(1));
  ni.onSample('e', 50, s(99)); // rejected
  const out = ni.interpolate(225).get('e'); // render time 100 -> the single sample
  near(out.x, 1, 1e-9, 'rejected out-of-order');
  assert.equal(ni.getStats(350).e.sampleCount, 1);
});

// ---------------------------------------------------------------------------
// computeSpawnAssignment
// ---------------------------------------------------------------------------

const MEMBERS = ['cc3d1e00-0000-4000-8000-000000000003', 'aa1e0000-0000-4000-8000-000000000001', 'bb2f2000-0000-4000-8000-000000000002', 'dd4c4f00-0000-4000-8000-000000000004'];
const SEED = 12345;

function assignmentMap(memberIds, seed) {
  const map = {};
  for (const id of memberIds) map[id] = MPS.computeSpawnAssignment(id, memberIds, seed);
  return map;
}

test('spawn assignment: same seed + members -> identical mapping', () => {
  assert.deepEqual(assignmentMap(MEMBERS, SEED), assignmentMap(MEMBERS, SEED));
});

test('spawn assignment: invariant to input member order shuffles', () => {
  const baseline = assignmentMap(MEMBERS, SEED);
  const shuffled = assignmentMap([...MEMBERS].reverse(), SEED);
  assert.deepEqual(shuffled, baseline);
  const rotated = assignmentMap([MEMBERS[2], MEMBERS[0], MEMBERS[3], MEMBERS[1]], SEED);
  assert.deepEqual(rotated, baseline);
});

test('spawn assignment: 4 members -> 4 distinct points, 2-4m apart', () => {
  const map = assignmentMap(MEMBERS, SEED);
  const points = Object.values(map).map((a) => ({ x: a.x, z: a.z }));
  const unique = new Set(points.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`));
  assert.equal(unique.size, 4, 'expected 4 distinct spawn points');
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z);
      assert.ok(d >= 2 && d <= 4, `pair ${i}-${j} distance ${d.toFixed(2)}m outside 2-4m`);
    }
  }
});

test('spawn assignment: seed rotates the point set deterministically', () => {
  const a = assignmentMap(MEMBERS, SEED);
  const b = assignmentMap(MEMBERS, SEED + 1);
  assert.notDeepEqual(a, b);
  assert.deepEqual(assignmentMap(MEMBERS, SEED + 1), assignmentMap([...MEMBERS].reverse(), SEED + 1));
});

test('spawn assignment: non-member and degenerate inputs', () => {
  assert.equal(MPS.computeSpawnAssignment('not-a-member', MEMBERS, SEED), null);
  assert.equal(MPS.computeSpawnAssignment(MEMBERS[0], [], SEED), null);
  assert.equal(MPS.computeSpawnAssignment(undefined, MEMBERS, SEED), null);
});

test('spawn assignment returns finite facing-center yaw', () => {
  const a = MPS.computeSpawnAssignment(MEMBERS[0], MEMBERS, SEED);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.yaw));
  assert.ok(a.yaw >= -Math.PI && a.yaw <= Math.PI);
  assert.ok(Number.isInteger(a.index) && a.index >= 0 && a.index <= 3);
});

if (process.exitCode) {
  console.log('\ninterpolation-logic: FAILED');
  process.exit(1);
}
console.log(`\ninterpolation-logic: all ${passed} test(s) passed`);
