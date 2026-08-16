/**
 * THRESHOLD Multiplayer — Realtime transport (architecture doc §41).
 *
 * All Supabase Broadcast/Presence/postgres_changes calls for the lobby phase
 * go through this one abstraction rather than being scattered across
 * gameplay code. connectLobby() opens one private channel `lobby:<uuid>`
 * combining:
 *   - broadcast (lobby:* events, §14)
 *   - presence (connection liveness + ready state, keyed by player id)
 *   - postgres_changes on multiplayer_lobby_members / multiplayer_lobbies,
 *     scoped to this lobby — the authoritative source of truth; presence is
 *     only used for fast liveness detection (host-missing timeout, etc).
 *
 * Channel authorization is enforced server-side by RLS
 * (supabase/migrations/0004_realtime_authorization.sql) — only authenticated
 * active members of the lobby can subscribe/publish on its channel.
 *
 * connectMatch()/disconnectMatch() are stubbed: the match transport (player
 * transforms, monster snapshots) is Phase 5 scope.
 */

import { getSupabaseClient, ensureAnonymousSession } from './supabaseClient.js';

export class RealtimeTransport {
  constructor() {
    this._client = null;
    this.lobbyChannel = null;
    this.matchChannel = null;
    this.playerId = null;
    this._listeners = new Map(); // type -> Set(handler)
  }

  async _ensureClient() {
    if (!this._client) this._client = await getSupabaseClient();
    return this._client;
  }

  async connectLobby(lobbyId) {
    await this.disconnectMatch();
    await this.disconnectLobby();
    const client = await this._ensureClient();
    const session = await ensureAnonymousSession();
    this.playerId = session.user.id;

    const channel = client.channel(`lobby:${lobbyId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.playerId },
      },
    });

    channel.on('broadcast', { event: '*' }, ({ event, payload }) => this._emit(event, payload));
    channel.on('presence', { event: 'sync' }, () => this._emit('presence:sync', channel.presenceState()));
    channel.on('presence', { event: 'join' }, (p) => this._emit('presence:join', p));
    channel.on('presence', { event: 'leave' }, (p) => this._emit('presence:leave', p));
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'multiplayer_lobby_members', filter: `lobby_id=eq.${lobbyId}` },
      (payload) => this._emit('db:lobby_members', payload)
    );
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'multiplayer_lobbies', filter: `id=eq.${lobbyId}` },
      (payload) => this._emit('db:lobby', payload)
    );

    await new Promise((resolve, reject) => {
      let settled = false;
      channel.subscribe((status, err) => {
        this._emit('status', status);
        if (status === 'SUBSCRIBED' && !settled) {
          settled = true;
          resolve();
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
          settled = true;
          reject(err || new Error(`Realtime subscribe failed: ${status}`));
        }
      });
    });

    this.lobbyChannel = channel;
    return channel;
  }

  /** Broadcast a lobby-phase event (e.g. 'lobby:starting'). */
  send(type, payload) {
    if (!this.lobbyChannel) return;
    this.lobbyChannel.send({ type: 'broadcast', event: type, payload });
  }

  /** Update this player's Presence state (e.g. { displayName, isReady }). */
  track(state) {
    if (!this.lobbyChannel) return;
    this.lobbyChannel.track(state);
  }

  on(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
    return () => this._listeners.get(type)?.delete(handler);
  }

  _emit(type, payload) {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  async disconnectLobby() {
    if (!this.lobbyChannel) return;
    const client = await this._ensureClient();
    await client.removeChannel(this.lobbyChannel);
    this.lobbyChannel = null;
    this._listeners.clear();
  }

  async connectMatch(matchId) {
    await this.disconnectLobby();
    await this.disconnectMatch();
    const client = await this._ensureClient();
    const session = await ensureAnonymousSession();
    this.playerId = session.user.id;

    const channel = client.channel(`match:${matchId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.playerId },
      },
    });

    channel.on('broadcast', { event: '*' }, ({ event, payload }) => this._emit(event, payload));
    channel.on('presence', { event: 'sync' }, () => this._emit('presence:sync', channel.presenceState()));
    channel.on('presence', { event: 'join' }, (p) => this._emit('presence:join', p));
    channel.on('presence', { event: 'leave' }, (p) => this._emit('presence:leave', p));

    await new Promise((resolve, reject) => {
      let settled = false;
      channel.subscribe((status, err) => {
        this._emit('status', status);
        if (status === 'SUBSCRIBED' && !settled) {
          settled = true;
          resolve();
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
          settled = true;
          reject(err || new Error(`Match subscribe failed: ${status}`));
        }
      });
    });

    this.matchChannel = channel;
    return channel;
  }

  /** Broadcast a match-phase event on the match channel. */
  sendMatch(type, payload) {
    if (!this.matchChannel) return;
    this.matchChannel.send({ type: 'broadcast', event: type, payload });
  }

  async disconnectMatch() {
    if (!this.matchChannel) return;
    const client = await this._ensureClient();
    await client.removeChannel(this.matchChannel);
    this.matchChannel = null;
    this._listeners.clear();
  }

  /** Remove a listener previously registered with on(). */
  off(type, handler) {
    const set = this._listeners.get(type);
    if (set) set.delete(handler);
  }

  // --- MatchManager-compatible aliases -------------------------------------
  // MatchManager was written against a { connectChannel, broadcast, onMessage,
  // offMessage, disconnectChannel } transport; these aliases present that interface
  // over the same match channel so the two phases share one transport object.

  connectChannel(name, opts = {}) {
    const matchId = (opts && opts.matchId) || String(name).replace(/^match:/, '');
    return this.connectMatch(matchId);
  }

  broadcast(type, payload) {
    this.sendMatch(type, payload);
  }

  onMessage(type, handler) {
    return this.on(type, handler);
  }

  offMessage(type, handler) {
    this.off(type, handler);
  }

  async disconnectChannel() {
    await this.disconnectMatch();
  }
}
