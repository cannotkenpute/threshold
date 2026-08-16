/**
 * THRESHOLD Multiplayer — Lobby state reconciliation (Phase 4).
 *
 * Merges REST-fetched lobby/member rows (via apiClient) with realtime
 * updates (RealtimeTransport: postgres_changes is authoritative, Presence is
 * used only for fast liveness) into one always-4-slot view for the UI, and
 * drives pre-match host migration when the host goes missing from Presence
 * (architecture doc §10 "Before Match").
 */

import { callApi } from './apiClient.js';
import { RealtimeTransport } from './RealtimeTransport.js';
import { getSupabaseClient } from './supabaseClient.js';

const HOST_MISSING_GRACE_MS = 5000;
const INACTIVE_STATES = new Set(['LEFT', 'KICKED']);
// Must stay comfortably under close_stale_multiplayer_lobbies' empty_grace_seconds
// (default 60s, see supabase/migrations/0005_cleanup_jobs.sql) -- that job closes any
// lobby whose members' last_seen_at goes stale, which silently invalidates its join
// code (INVALID_CODE / HTTP 400) even while everyone's still sitting in the lobby screen.
const HEARTBEAT_INTERVAL_MS = 20000;

/**
 * Pure reducer: members + host id -> a stable array of exactly `maxPlayers`
 * slots (host first, then remaining active members by joined_at, then empty
 * slots). Exported standalone so it's unit-testable without Supabase.
 */
export function buildLobbySlots(members, hostPlayerId, maxPlayers = 4) {
  const active = (members || []).filter((m) => !INACTIVE_STATES.has(m.member_state));
  const host = active.find((m) => m.player_id === hostPlayerId || m.is_host);
  const rest = active
    .filter((m) => m !== host)
    .slice()
    .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

  const ordered = host ? [host, ...rest] : rest;
  const slots = ordered.slice(0, maxPlayers).map((m) => ({
    empty: false,
    playerId: m.player_id,
    displayName: m.display_name || 'PLAYER',
    isHost: m.player_id === hostPlayerId,
    isReady: Boolean(m.is_ready),
    memberState: m.member_state,
  }));
  while (slots.length < maxPlayers) slots.push({ empty: true });
  return slots;
}

export class LobbyManager {
  constructor() {
    this.transport = new RealtimeTransport();
    this.lobby = null;
    this.members = [];
    this.localPlayerId = null;
    this._changeHandlers = new Set();
    this._presenceState = {};
    this._hostMissingTimer = null;
    this._unsubscribers = [];
    this._heartbeatTimer = null;
  }

  onChange(handler) {
    this._changeHandlers.add(handler);
    return () => this._changeHandlers.delete(handler);
  }

  _notify() {
    for (const handler of this._changeHandlers) handler(this);
  }

  get isHost() {
    return Boolean(this.lobby && this.localPlayerId && this.lobby.host_player_id === this.localPlayerId);
  }

  getSlots() {
    if (!this.lobby) return [];
    return buildLobbySlots(this.members, this.lobby.host_player_id, this.lobby.max_players || 4);
  }

  allNonHostReady() {
    return this.members
      .filter((m) => !INACTIVE_STATES.has(m.member_state) && m.player_id !== this.lobby?.host_player_id)
      .every((m) => m.is_ready);
  }

  /** Fetches current lobby+members and opens the realtime channel. */
  async join(lobbyId, localPlayerId) {
    this.localPlayerId = localPlayerId;
    const { lobby, members } = await callApi(`/lobbies/${lobbyId}`);
    this.lobby = lobby;
    this.members = members;
    this._notify();

    await this.transport.connectLobby(lobbyId);
    this.transport.track({ isReady: false });

    this._unsubscribers.push(
      this.transport.on('db:lobby_members', () => this._refetch()),
      this.transport.on('db:lobby', () => this._refetch()),
      this.transport.on('presence:sync', (state) => this._onPresenceSync(state))
    );

    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  // Same rationale as _migrateHost below: SECURITY DEFINER RPC, not proxied through an
  // API route. Failures are non-fatal -- the next tick (or any other lobby RPC, which
  // also touches last_seen_at) will catch the row back up.
  async _sendHeartbeat() {
    if (!this.lobby) return;
    try {
      const client = await getSupabaseClient();
      await client.rpc('record_member_heartbeat', { p_lobby_id: this.lobby.id });
    } catch (err) {
      // Ignored -- see above.
    }
  }

  async _refetch() {
    if (!this.lobby) return;
    try {
      const { lobby, members } = await callApi(`/lobbies/${this.lobby.id}`);
      this.lobby = lobby;
      this.members = members;
      this._notify();
    } catch (err) {
      // Lobby may have just closed (e.g. host left with no one else present);
      // leave state as last-known and let the UI's error path handle it.
    }
  }

  _onPresenceSync(state) {
    this._presenceState = state;
    const hostId = this.lobby?.host_player_id;
    const hostPresent = Boolean(hostId && state[hostId] && state[hostId].length > 0);

    if (!hostId || hostPresent) {
      if (this._hostMissingTimer) {
        clearTimeout(this._hostMissingTimer);
        this._hostMissingTimer = null;
      }
      return;
    }

    if (!this._hostMissingTimer) {
      this._hostMissingTimer = setTimeout(() => {
        this._hostMissingTimer = null;
        this._migrateHost();
      }, HOST_MISSING_GRACE_MS);
    }
  }

  // Not in the Vercel route list (architecture doc §38) — the RPC is
  // SECURITY DEFINER and already fully authorized for `authenticated`
  // callers via RLS, so this calls it directly through the browser's own
  // Supabase client rather than proxying through an API route.
  async _migrateHost() {
    if (!this.lobby) return;
    try {
      const client = await getSupabaseClient();
      await client.rpc('migrate_multiplayer_host', {
        p_lobby_id: this.lobby.id,
        p_new_host_id: null,
      });
    } catch (err) {
      // Another member may have already migrated; the next postgres_changes
      // event will reconcile local state regardless.
    }
  }

  setReady(isReady) {
    this.transport.track({ isReady });
  }

  async dispose() {
    if (this._hostMissingTimer) clearTimeout(this._hostMissingTimer);
    this._hostMissingTimer = null;
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
    for (const unsub of this._unsubscribers) unsub && unsub();
    this._unsubscribers = [];
    await this.transport.disconnectLobby();
    this.lobby = null;
    this.members = [];
  }
}
