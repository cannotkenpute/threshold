/**
 * THRESHOLD — Phase 10/11 logic tests. Run: node scripts/test/phase10_11.mjs
 * Pure-logic assertions; no network, no browser.
 */
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const mp = (p) => new URL('js/multiplayer/' + p, root);

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('  ok -', name); };

console.log('Phase 10 — protocol / dedup / sequence');
const proto = await import(mp('protocol.js'));
await t('buildEnvelope requires epoch for authoritative', () => {
  assert.throws(() => proto.buildEnvelope({ type: proto.EVENT.MONSTER_SNAPSHOT, senderId: 'a', seq: 1 }));
  const env = proto.buildEnvelope({ type: proto.EVENT.MONSTER_SNAPSHOT, senderId: 'a', seq: 1, authorityEpoch: 2 });
  assert.equal(env.authorityEpoch, 2);
});
await t('buildEnvelope requires eventId for critical', () => {
  assert.throws(() => proto.buildEnvelope({ type: proto.EVENT.MATCH_START, senderId: 'a', seq: 1, authorityEpoch: 1 }));
});
await t('validateEnvelope rejects stale epoch + wrong match', () => {
  const env = proto.buildEnvelope({ type: proto.EVENT.MONSTER_SNAPSHOT, matchId: 'm1', senderId: 'a', seq: 5, authorityEpoch: 1 });
  assert.equal(proto.validateEnvelope(env, { authorityEpoch: 2 }).ok, false);
  assert.equal(proto.validateEnvelope(env, { matchId: 'm2' }).ok, false);
  assert.equal(proto.validateEnvelope(env, { authorityEpoch: 1, matchId: 'm1' }).ok, true);
});
await t('SequenceGate discards out-of-order', () => {
  const g = new proto.SequenceGate();
  assert.equal(g.accept('a', 'player:transform', 10), true);
  assert.equal(g.accept('a', 'player:transform', 9), false);
  assert.equal(g.accept('a', 'player:transform', 11), true);
});
await t('CriticalEventDeduper suppresses duplicates', () => {
  const d = new proto.CriticalEventDeduper({ ttlMs: 1000 });
  assert.equal(d.seen('e1', 0), true);
  assert.equal(d.seen('e1', 10), false);
  assert.equal(d.seen('e1', 2000), true); // ttl expired -> treated fresh
});

console.log('Phase 10 — SnapshotBuffer');
const { SnapshotBuffer } = await import(mp('SnapshotBuffer.js'));
await t('keeps highest valid snapshot within epoch ceiling', () => {
  const b = new SnapshotBuffer({ capacity: 3 });
  b.add({ sequence: 1, authorityEpoch: 1 });
  b.add({ sequence: 3, authorityEpoch: 2 });
  b.add({ sequence: 2, authorityEpoch: 1 });
  assert.equal(b.getHighestValid().sequence, 3);
  assert.equal(b.getHighestValid({ maxEpoch: 1 }).sequence, 2);
  b.add({ sequence: 4, authorityEpoch: 2 }); // evicts seq 1
  assert.equal(b.size(), 3);
});

console.log('Phase 10 — NetworkClock');
const { NetworkClock } = await import(mp('NetworkClock.js'));
await t('offset estimate + monotonic seq', () => {
  const c = new NetworkClock();
  c.addSample(1000, 5000, 1040); // rtt 40 -> est offset ~ +3980
  assert.ok(Math.abs(c.offset - 3980) < 5);
  assert.equal(c.nextSeq('x'), 1);
  assert.equal(c.nextSeq('x'), 2);
});

console.log('Phase 10 — AuthorityManager');
const AM = await import(mp('AuthorityManager.js'));
await t('host emits heartbeat + snapshot on cadence', () => {
  const sent = [];
  const am = new AM.AuthorityManager({
    isAuthority: () => true, authorityEpoch: () => 1,
    send: (type) => sent.push(type),
    serializeSnapshot: () => ({ clock: 1 }),
  });
  am.start(0);
  am.update(0); am.update(1000); am.update(2000);
  assert.ok(sent.filter(s => s === 'authority:heartbeat').length >= 2);
  assert.ok(sent.includes('authority:snapshot'));
});
await t('non-host escalates SUSPECT then MIGRATING', () => {
  let epoch = 1;
  const am = new AM.AuthorityManager({
    isAuthority: () => false, authorityEpoch: () => epoch, send: () => {},
  });
  am.start(0);
  assert.equal(am.update(3000), AM.AUTHORITY_STATE.SUSPECT);
  assert.equal(am.update(5000), AM.AUTHORITY_STATE.MIGRATING);
  assert.equal(am.acceptAuthoritative(0), false); // stale epoch
  assert.equal(am.acceptAuthoritative(1), true);
});

console.log('Phase 10 — HostMigration');
const HM = await import(mp('HostMigration.js'));
await t('election picks oldest connected, excludes lost host', () => {
  const members = [
    { playerId: 'host', joinedAt: 1, connected: false, state: 'DISCONNECTED' },
    { playerId: 'p2', joinedAt: 3, connected: true, state: 'PLAYING' },
    { playerId: 'p3', joinedAt: 2, connected: true, state: 'PLAYING' },
  ];
  assert.equal(HM.electNextHost(members, { excludePlayerId: 'host' }), 'p3');
});
await t('winner promotes: bumps epoch, restores snapshot, broadcasts', async () => {
  const sent = [];
  let epoch = 4, authId = 'host', resumed = false, restored = null;
  const hm = new HM.HostMigration({
    selfId: () => 'p3',
    getMembers: () => ([{ playerId: 'p3', joinedAt: 2, connected: true, state: 'PLAYING' }]),
    getEpoch: () => epoch, setEpoch: (e) => { epoch = e; },
    getAuthorityId: () => authId, setAuthorityId: (id) => { authId = id; },
    getBestSnapshot: () => ({ sequence: 88, authorityEpoch: 4 }),
    restoreFromSnapshot: (s) => { restored = s; },
    send: (type, payload) => sent.push({ type, payload }),
    pauseSimulation: () => {}, resumeSimulation: () => { resumed = true; },
  });
  hm.begin({ lostHostId: 'host', waitForReconnect: false });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(epoch, 5);
  assert.equal(authId, 'p3');
  assert.equal(restored.sequence, 88);
  assert.equal(resumed, true);
  assert.ok(sent.some(m => m.type === 'authority:migration_complete'));
  assert.ok(sent.some(m => m.type === 'host:changed'));
});

console.log('Phase 10 — ReconnectController');
const RC = await import(mp('ReconnectController.js'));
await t('expires after window; restores + grace on sync', () => {
  const d = new proto.CriticalEventDeduper({ ttlMs: 10000 });
  let restoredState = null;
  const rc = new RC.ReconnectController({
    deduper: d,
    restorePlayerState: (s) => { restoredState = s; },
  });
  rc.onDisconnected(0);
  assert.equal(rc.update(59000), RC.RECONNECT_STATE.DISCONNECTED);
  const rc2 = new RC.ReconnectController({ deduper: d });
  rc2.onDisconnected(0);
  assert.equal(rc2.update(60000), RC.RECONNECT_STATE.EXPIRED);
  // fresh controller restores and applies grace
  const rc3 = new RC.ReconnectController({ deduper: new proto.CriticalEventDeduper(), restorePlayerState: (s) => { restoredState = s; } });
  rc3.onDisconnected(0);
  const res = rc3.applyMatchSync({ self: { id: 'me' }, processedEventIds: ['x1'] }, 1000);
  assert.equal(res.restored, true);
  assert.equal(restoredState.id, 'me');
  assert.equal(rc3.isProtected(1000), true);
  assert.equal(rc3.isProtected(1000 + 10001), false);
});

console.log('Phase 11 — ClientValidation');
const CV = await import(mp('ClientValidation.js'));
await t('rejects teleport, accepts normal movement', () => {
  const prev = { position: [0, 0, 0], t: 0 };
  const jump = { position: [100, 0, 0], t: 100 };
  const walk = { position: [0.2, 0, 0], t: 100 };
  assert.equal(CV.validateTransform(prev, jump).ok, false);
  assert.equal(CV.validateTransform(prev, walk).ok, true);
});
await t('interact distance + inventory shape', () => {
  assert.equal(CV.validateInteract([0, 0, 0], [10, 0, 0]).ok, false);
  assert.equal(CV.validateInteract([0, 0, 0], [1, 0, 0]).ok, true);
  assert.equal(CV.validateInventory([{ id: 'battery', count: 2 }, null]).ok, true);
  assert.equal(CV.validateInventory([{ id: 'x', count: -1 }]).ok, false);
});

console.log('Phase 11 — Metrics + Logger redaction');
const { Metrics } = await import(mp('Metrics.js'));
await t('metrics counters/timers snapshot', () => {
  const m = new Metrics();
  m.inc('joins'); m.inc('joins', 2); m.gauge('lobbies', 5); m.observe('ai', 2); m.observe('ai', 4);
  const s = m.snapshot();
  assert.equal(s.counters.joins, 3);
  assert.equal(s.gauges.lobbies, 5);
  assert.equal(s.timers.ai.avgMs, 3);
});
const { redact } = await import(mp('Logger.js'));
await t('redacts JWT, pg url, secret keys, secret-named fields', () => {
  const out = redact({
    password: 'hunter2',
    note: 'token eyJabcdef.ghijklmn.opqrstuv here',
    db: 'postgres://user:pw@host:6543/postgres',
    sk: 'sb_secret_ABC123',
  });
  assert.equal(out.password, '[REDACTED]');
  assert.ok(out.note.includes('[REDACTED_JWT]'));
  assert.ok(out.db.includes('[REDACTED_PG_URL]'));
  assert.ok(out.sk.includes('[REDACTED_KEY]'));
});

console.log('Phase 11 — server rate limit / validation / errors');
const ap = (p) => new URL('api/multiplayer/_shared/' + p, root);
const { checkRateLimit } = await import(ap('rateLimit.js'));
await t('rate limiter blocks after max, cooldown applies', () => {
  const store = new Map();
  let last;
  for (let i = 0; i < 3; i++) last = checkRateLimit('ip', { maxAttempts: 3, windowMs: 1000, cooldownMs: 5000, store, now: 0 });
  assert.equal(last.allowed, true);
  const blocked = checkRateLimit('ip', { maxAttempts: 3, windowMs: 1000, cooldownMs: 5000, store, now: 0 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});
const v = await import(ap('validation.js'));
await t('join code + region + create-lobby body + page limit', () => {
  assert.equal(v.isJoinCode('04217'), true);
  assert.equal(v.isJoinCode('4217'), false);
  assert.equal(v.isUuid('9be47c60-f621-4abb-a682-34d8d8b3c51a'), true);
  assert.throws(() => v.validateJoinCode('bad'), v.ValidationError);
  assert.throws(() => v.validateCreateLobbyBody({ maxPlayers: 9 }), v.ValidationError);
  assert.deepEqual(v.validateCreateLobbyBody({}), { visibility: 'PUBLIC', region: 'AUTO', difficulty: null, maxPlayers: 4 });
  assert.throws(() => v.validatePageLimit('999'), v.ValidationError);
  assert.equal(v.validatePageLimit(undefined), 25);
});
const { statusForCode } = await import(ap('errors.js'));
await t('statusForCode maps codes to HTTP status', () => {
  assert.equal(statusForCode('LOBBY_FULL'), 409);
  assert.equal(statusForCode('RATE_LIMITED'), 429);
  assert.equal(statusForCode('NOT_HOST'), 403);
});

console.log('Phase 11 — API route modules load cleanly');
const routeFiles = [
  'join-code.js', 'lobbies/create.js', 'lobbies/index.js', 'lobbies/quick-join.js',
  'lobbies/[lobbyId]/index.js', 'lobbies/[lobbyId]/join.js', 'lobbies/[lobbyId]/leave.js',
  'lobbies/[lobbyId]/ready.js', 'lobbies/[lobbyId]/start.js',
];
for (const rf of routeFiles) {
  await t(`imports without error: api/multiplayer/${rf}`, async () => {
    const mod = await import(new URL('api/multiplayer/' + rf, root));
    assert.equal(typeof mod.default, 'function');
  });
}

console.log('\\nAll ' + passed + ' Phase 10/11 tests passed.');
