/**
 * THRESHOLD Multiplayer — MatchManager (Phase 5).
 *
 * Match-phase orchestrator: connects the per-match Realtime channel, computes
 * the deterministic spawn assignment from the server-issued random seed, runs
 * the LOADING -> PLAYING barrier (all members broadcast match:ready once their
 * local scene is built), and tears the match channel down on match:end.
 *
 * NO DOM; no THREE. Every dependency is duck-typed so Phase 3/4 classes slot
 * in without import coupling:
 *   supabase:     stored for Phase 8+ (result submission); unused today
 *   lobbyManager: { startMatch(lobbyId) -> matchInfo }  (optional convenience
 *                 when beginMatch is called without explicit matchInfo)
 *   clock:        { now() -> ms }
 *   transport:    { connectChannel(name, opts), broadcast(type, payload),
 *                   onMessage(type, handler), offMessage?(type, handler),
 *                   disconnectChannel?(name) | leaveChannel?(name) | closeChannel?(name) }
 *                 The transport owns envelope validation/durability
 *                 (match:end is a CRITICAL event per protocol.js).
 */

import { computeSpawnAssignment } from './MultiplayerPlayerSync.js';

/** Emitted event names. */
export const MATCH_EVENTS = ['ready', 'memberLoading', 'memberPlaying', 'ended', 'error'];

/** Rebroadcast period for our own match:ready until the barrier completes. */
const READY_REBROADCAST_MS = 2000;
/** Watchdog: warn (error event) if the barrier never completes. */
const LOADING_BARRIER_TIMEOUT_MS = 120000;

export class MatchManager {
  /**
   * @param {object} deps
   * @param {object|null} [deps.supabase]
   * @param {object|null} [deps.lobbyManager] duck { startMatch(lobbyId) }
   * @param {object|null} [deps.clock] duck { now() }
   * @param {object|null} [deps.transport] duck { connectChannel, broadcast, onMessage }
   * @param {string|null} [deps.selfId] our member id (filters own echoes)
   */
  constructor({ supabase = null, lobbyManager = null, clock = null, transport = null, selfId = null } = {}) {
    this.supabase = supabase;
    this.lobbyManager = lobbyManager;
    this.clock = clock && typeof clock.now === 'function' ? clock : { now: () => Date.now() };
    this.transport = transport ?? null;
    this.selfId = selfId === null ? null : String(selfId);

    /** @type {Map<string, Set<Function>>} event -> handlers */
    this._handlers = new Map(MATCH_EVENTS.map((e) => [e, new Set()]));
    /** Handlers we registered on the transport (for teardown). */
    this._matchHandlers = [];
    this._disposed = false;

    this._resetMatchState();
  }

  _resetMatchState() {
    this.matchId = null;
    this.lobbyId = null;
    /** Server-issued seed. STORED, not consumed: SurvivalState determinism lands in a later phase. */
    this.matchSeed = null;
    this.members = [];
    /** @type {Map<string, string>} memberId -> 'LOADING' | 'PLAYING' */
    this._memberStates = new Map();
    /** @type {Map<string, {x,z,yaw,index}>} memberId -> spawn */
    this._spawns = new Map();
    this._channelName = null;
    this._readyTimer = null;
    this._barrierTimer = null;
    this._allReady = false;
  }

  // --------------------------------------------------------------------------
  // Tiny on/off emitter
  // --------------------------------------------------------------------------

  /** Subscribe to one of MATCH_EVENTS. Returns an unsubscribe function. */
  on(event, handler) {
    const set = this._handlers.get(event);
    if (!set || typeof handler !== 'function') return () => {};
    set.add(handler);
    return () => set.delete(handler);
  }

  off(event, handler) {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
  }

  _emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`MatchManager: '${event}' handler threw`, err);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Transport plumbing
  // --------------------------------------------------------------------------

  /**
   * Subscribe to any match-channel message type (the transport validates
   * envelopes before handlers run). Returns an unsubscribe function.
   */
  onMatchEvent(type, handler) {
    if (this._disposed || typeof type !== 'string' || typeof handler !== 'function') return () => {};
    if (!this.transport || typeof this.transport.onMessage !== 'function') return () => {};
    const fn = (msg, meta) => handler(msg, meta);
    this.transport.onMessage(type, fn);
    const record = { type, fn };
    this._matchHandlers.push(record);
    return () => {
      if (this.transport && typeof this.transport.offMessage === 'function') {
        this.transport.offMessage(type, fn);
      }
      const i = this._matchHandlers.indexOf(record);
      if (i !== -1) this._matchHandlers.splice(i, 1);
    };
  }

  /** Normalize handler args into { senderId, matchId, payload }. */
  _unwrap(msg, meta) {
    if (msg && typeof msg === 'object' && msg.payload !== undefined) {
      return {
        senderId: msg.senderId !== undefined ? msg.senderId : meta && meta.senderId,
        matchId: msg.matchId !== undefined ? msg.matchId : meta && meta.matchId,
        payload: msg.payload,
      };
    }
    return {
      senderId: meta && meta.senderId !== undefined ? meta.senderId : msg && msg.senderId,
      matchId: meta && meta.matchId !== undefined ? meta.matchId : msg && msg.matchId,
      payload: msg,
    };
  }

  _broadcast(type, payload) {
    if (!this.transport || typeof this.transport.broadcast !== 'function') return;
    this.transport.broadcast(type, payload);
  }

  // --------------------------------------------------------------------------
  // Match lifecycle
  // --------------------------------------------------------------------------

  /** Coerce member entries (ids or {playerId|player_id|id} objects) to id strings. */
  _extractMemberIds(list) {
    if (!Array.isArray(list)) return [];
    const ids = [];
    for (const m of list) {
      let id = m;
      if (m && typeof m === 'object') id = m.playerId !== undefined ? m.playerId : m.player_id !== undefined ? m.player_id : m.id;
      if (id !== undefined && id !== null) ids.push(String(id));
    }
    return [...new Set(ids)];
  }

  /**
   * Begin a match.
   *
   * @param {string} lobbyId
   * @param {object|null} [matchInfo] from start_multiplayer_match RPC:
   *        { matchId | match_id, randomSeed | random_seed, members[] }.
   *        When omitted, lobbyManager.startMatch(lobbyId) is tried (duck call).
   * @returns {Promise<boolean>} true when the match channel is connected and
   *          the loading barrier is armed.
   * Emits: memberLoading (per member), error, later ready/ended.
   */
  async beginMatch(lobbyId, matchInfo = null) {
    if (this._disposed) {
      this._emit('error', { code: 'DISPOSED' });
      return false;
    }
    if (this.matchId) {
      this._emit('error', { code: 'ALREADY_IN_MATCH', matchId: this.matchId });
      return false;
    }

    let info = matchInfo;
    if (!info && this.lobbyManager && typeof this.lobbyManager.startMatch === 'function') {
      try {
        info = await this.lobbyManager.startMatch(lobbyId);
      } catch (err) {
        this._emit('error', { code: 'START_MATCH_FAILED', error: String((err && err.message) || err) });
        return false;
      }
    }
    if (!info || info.ok === false) {
      this._emit('error', { code: 'INVALID_MATCH_INFO', reason: info && info.code ? info.code : 'no matchInfo and lobbyManager.startMatch unavailable' });
      return false;
    }

    const matchId = info.matchId !== undefined ? info.matchId : info.match_id;
    const seedRaw = info.randomSeed !== undefined ? info.randomSeed : info.random_seed !== undefined ? info.random_seed : 0;
    const memberIds = this._extractMemberIds(
      info.members || info.memberIds || info.member_ids ||
        (this.lobbyManager && (typeof this.lobbyManager.getMembers === 'function'
          ? this.lobbyManager.getMembers()
          : this.lobbyManager.members)) || []
    );

    if (matchId === undefined || matchId === null || memberIds.length === 0) {
      this._emit('error', { code: 'INVALID_MATCH_INFO', reason: 'missing matchId or members' });
      return false;
    }

    this.lobbyId = lobbyId !== undefined && lobbyId !== null ? String(lobbyId) : null;
    this.matchId = String(matchId);
    this.matchSeed = Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : 0;
    this.members = memberIds;
    for (const id of memberIds) {
      this._memberStates.set(id, 'LOADING');
      this._spawns.set(id, computeSpawnAssignment(id, memberIds, this.matchSeed));
      this._emit('memberLoading', { matchId: this.matchId, memberId: id });
    }

    this._channelName = `match:${this.matchId}`;
    try {
      const res = this.transport && typeof this.transport.connectChannel === 'function'
        ? this.transport.connectChannel(this._channelName, { selfId: this.selfId, matchId: this.matchId })
        : null;
      if (res && typeof res.then === 'function') await res;
    } catch (err) {
      this._emit('error', { code: 'CONNECT_FAILED', error: String((err && err.message) || err) });
      this._teardown(false, null, 'connect-failed');
      return false;
    }

    this.onMatchEvent('match:ready', (msg, meta) => this._onMatchReady(msg, meta));
    this.onMatchEvent('match:end', (msg, meta) => this._onMatchEnd(msg, meta));

    this._barrierTimer = setTimeout(() => {
      if (!this._allReady && this.matchId) {
        this._emit('error', { code: 'LOADING_BARRIER_TIMEOUT', matchId: this.matchId, pending: this.pendingMembers() });
      }
    }, LOADING_BARRIER_TIMEOUT_MS);
    if (typeof this._barrierTimer.unref === 'function') this._barrierTimer.unref();

    return true;
  }

  /**
   * Report that OUR local scene finished loading: broadcasts match:ready
   * (rebroadcast every READY_REBROADCAST_MS until everyone is ready —
   * Realtime broadcast is lossy) and marks us PLAYING locally.
   */
  markPlaying() {
    if (!this.matchId || this._allReady) return this;
    this._broadcast('match:ready', { phase: 'PLAYING', at: this.clock.now() });
    if (this.selfId !== null) this._markMemberPlaying(this.selfId);
    if (!this._readyTimer) {
      this._readyTimer = setInterval(() => {
        if (!this.matchId || this._allReady) {
          this._clearReadyTimer();
          return;
        }
        this._broadcast('match:ready', { phase: 'PLAYING', at: this.clock.now() });
      }, READY_REBROADCAST_MS);
      if (typeof this._readyTimer.unref === 'function') this._readyTimer.unref();
    }
    return this;
  }

  _onMatchReady(msg, meta) {
    if (this._disposed || !this.matchId) return;
    const { senderId, payload } = this._unwrap(msg, meta);
    if (senderId === undefined || senderId === null) return;
    if (payload && typeof payload === 'object' && payload.phase === 'PLAYING') {
      this._markMemberPlaying(String(senderId));
    }
  }

  _markMemberPlaying(memberId) {
    const id = String(memberId);
    const state = this._memberStates.get(id);
    if (state === undefined || state === 'PLAYING') return;
    this._memberStates.set(id, 'PLAYING');
    this._emit('memberPlaying', { matchId: this.matchId, memberId: id });
    if (!this._allReady && this.pendingMembers().length === 0) this._onAllReady();
  }

  _onAllReady() {
    this._allReady = true;
    this._clearReadyTimer();
    if (this._barrierTimer) {
      clearTimeout(this._barrierTimer);
      this._barrierTimer = null;
    }
    const spawns = {};
    for (const [id, spawn] of this._spawns) spawns[id] = spawn;
    this._emit('ready', {
      matchId: this.matchId,
      members: [...this.members],
      spawns,
      seed: this.matchSeed,
    });
  }

  _onMatchEnd(msg, meta) {
    if (this._disposed || !this.matchId) return;
    const { matchId, payload } = this._unwrap(msg, meta);
    if (matchId !== undefined && matchId !== null && String(matchId) !== this.matchId) return;
    const result = payload && typeof payload === 'object' && payload.result !== undefined ? payload.result : null;
    this._teardown(true, result, 'remote');
  }

  /**
   * Gracefully end the match: broadcast match:end (CRITICAL event — the
   * transport handles durability/replay), tear down the match channel (NOT
   * the transport itself — the caller owns it), emit 'ended'. Idempotent.
   */
  endMatch(result = null) {
    if (!this.matchId) return this;
    this._broadcast('match:end', { result: result === undefined ? null : result, at: this.clock.now() });
    this._teardown(true, result, 'local');
    return this;
  }

  _teardown(emitEnded, result, reason) {
    const matchId = this.matchId;
    this._clearReadyTimer();
    if (this._barrierTimer) {
      clearTimeout(this._barrierTimer);
      this._barrierTimer = null;
    }
    this._unregisterMatchHandlers();
    this._disconnectChannel();
    this._resetMatchState();
    if (emitEnded && matchId !== null) {
      this._emit('ended', { matchId, result: result === undefined ? null : result, reason });
    }
  }

  _clearReadyTimer() {
    if (this._readyTimer) {
      clearInterval(this._readyTimer);
      this._readyTimer = null;
    }
  }

  _unregisterMatchHandlers() {
    if (this.transport && typeof this.transport.offMessage === 'function') {
      for (const { type, fn } of this._matchHandlers) this.transport.offMessage(type, fn);
    }
    this._matchHandlers.length = 0;
  }

  _disconnectChannel() {
    if (!this.transport || !this._channelName) return;
    const name = this._channelName;
    for (const method of ['disconnectChannel', 'leaveChannel', 'closeChannel']) {
      if (typeof this.transport[method] === 'function') {
        try {
          this.transport[method](name);
        } catch (err) {
          console.error(`MatchManager: ${method}(${name}) threw`, err);
        }
        return;
      }
    }
    // Transport exposes no channel disconnect: nothing we can do safely here.
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /** Members still LOADING (empty array == everyone playing). */
  pendingMembers() {
    const pending = [];
    for (const [id, state] of this._memberStates) {
      if (state !== 'PLAYING') pending.push(id);
    }
    return pending;
  }

  /** Our deterministic spawn for this match, or null. */
  getSpawnFor(playerId) {
    if (!this.matchId) return null;
    return this._spawns.get(String(playerId)) || null;
  }

  /** Live copy of member -> LOADING/PLAYING (for UI). */
  getMemberStates() {
    const out = {};
    for (const [id, state] of this._memberStates) out[id] = state;
    return out;
  }

  get channelName() {
    return this._channelName;
  }

  get isActive() {
    return this.matchId !== null;
  }

  /**
   * Silent teardown (no match:end broadcast, no 'ended' event): clears every
   * timer and transport listener, disconnects the match channel. Idempotent.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._clearReadyTimer();
    if (this._barrierTimer) {
      clearTimeout(this._barrierTimer);
      this._barrierTimer = null;
    }
    this._unregisterMatchHandlers();
    this._disconnectChannel();
    this._resetMatchState();
  }
}
