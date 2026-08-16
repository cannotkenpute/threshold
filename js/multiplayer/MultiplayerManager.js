/**
 * THRESHOLD Multiplayer — top-level coordinator (architecture doc §40).
 *
 * Owns player identity, the current lobby, and connection lifecycle; exposes
 * one state surface (isActive, isHost, lobby, players, connectionState) and
 * one set of action methods for the UI layer (MultiplayerUI.js) to call.
 * Delegates lobby-state reconciliation to LobbyManager and REST calls to
 * apiClient.
 */

import { callApi } from './apiClient.js';
import { LobbyManager } from './LobbyManager.js';
import { MatchManager } from './MatchManager.js';
import { ensureAnonymousSession } from './supabaseClient.js';

export const CONNECTION_STATES = {
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DEGRADED: 'DEGRADED',
  RECONNECTING: 'RECONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  FAILED: 'FAILED',
};

const TRANSPORT_STATUS_MAP = {
  SUBSCRIBED: CONNECTION_STATES.CONNECTED,
  CHANNEL_ERROR: CONNECTION_STATES.DEGRADED,
  TIMED_OUT: CONNECTION_STATES.RECONNECTING,
  CLOSED: CONNECTION_STATES.DISCONNECTED,
};

export class MultiplayerManager {
  constructor() {
    this.lobbyManager = null;
    this.matchManager = null;
    this.onMatchReady = null; // game engine sets this to enter Survival + set up authority
    this._unsubMatchStart = null;
    this._matchReadyWired = false;
    this.connectionState = CONNECTION_STATES.OFFLINE;
    this._changeHandlers = new Set();
    this._unsubLobby = null;
    this._unsubStatus = null;
  }

  onChange(handler) {
    this._changeHandlers.add(handler);
    return () => this._changeHandlers.delete(handler);
  }

  _notify() {
    for (const handler of this._changeHandlers) handler(this);
  }

  get isActive() {
    return Boolean(this.lobbyManager && this.lobbyManager.lobby);
  }

  get isHost() {
    return Boolean(this.lobbyManager && this.lobbyManager.isHost);
  }

  get lobby() {
    return this.lobbyManager ? this.lobbyManager.lobby : null;
  }

  get players() {
    return this.lobbyManager ? this.lobbyManager.getSlots() : [];
  }

  get canStart() {
    return Boolean(this.isHost && this.lobbyManager && this.lobbyManager.allNonHostReady());
  }

  async fetchPublicLobbies({ cursor, limit } = {}) {
    const query = new URLSearchParams();
    if (cursor) query.set('cursor', cursor);
    if (limit) query.set('limit', String(limit));
    const qs = query.toString();
    return callApi(`/lobbies${qs ? `?${qs}` : ''}`);
  }

  async createLobby({ visibility, region, difficulty, maxPlayers } = {}) {
    const result = await callApi('/lobbies/create', {
      method: 'POST',
      body: { visibility, region, difficulty, maxPlayers },
    });
    await this._enterLobby(result.lobby_id);
    return result;
  }

  async quickJoin({ region } = {}) {
    const result = await callApi('/lobbies/quick-join', { method: 'POST', body: { region } });
    await this._enterLobby(result.lobby_id);
    return result;
  }

  async joinByCode(code) {
    const result = await callApi('/join-code', { method: 'POST', body: { code } });
    await this._enterLobby(result.lobby_id);
    return result;
  }

  async joinLobby(lobbyId) {
    const result = await callApi(`/lobbies/${lobbyId}/join`, { method: 'POST' });
    await this._enterLobby(lobbyId);
    return result;
  }

  async setReady(isReady) {
    if (!this.lobby) return;
    await callApi(`/lobbies/${this.lobby.id}/ready`, { method: 'POST', body: { isReady } });
    this.lobbyManager.setReady(isReady);
  }

  async startMatch() {
    if (!this.lobby) throw new Error('No active lobby.');
    if (!this.isHost) throw new Error('Only the host can start a match.');
    if (!this.lobbyManager || !this.lobbyManager.transport) throw new Error('Lobby transport unavailable.');

    const matchInfo = await callApi(`/lobbies/${this.lobby.id}/start`, { method: 'POST' });

    // Broadcast the match start to non-host members FIRST, while the lobby channel is
    // still open (beginMatch below closes it to open the match channel).
    this.lobbyManager.transport.send('match:start', this._normalizeMatchInfo(matchInfo));

    // Wire the match-phase orchestrator onto the same Realtime transport (which now
    // exposes connectChannel/broadcast/onMessage) and begin the match + loading barrier.
    this.matchManager = new MatchManager({
      transport: this.lobbyManager.transport,
      selfId: this.lobbyManager.localPlayerId,
      lobbyManager: { startMatch: () => matchInfo },
    });
    const ok = await this.matchManager.beginMatch(this.lobby.id, matchInfo);
    if (ok) this._wireMatchReady();
    return { ok, matchInfo };
  }

  _normalizeMatchInfo(info) {
    return {
      matchId: info.matchId !== undefined ? info.matchId : info.match_id,
      randomSeed: info.randomSeed !== undefined ? info.randomSeed : info.random_seed,
      members: info.members || info.memberIds || info.member_ids || [],
    };
  }

  _wireMatchReady() {
    if (!this.matchManager || this._matchReadyWired) return;
    this._matchReadyWired = true;
    this.matchManager.on('ready', ({ matchId, members, spawns, seed }) => {
      if (this.onMatchReady) {
        this.onMatchReady({
          matchId, members, spawns, seed,
          selfId: this.lobbyManager ? this.lobbyManager.localPlayerId : null,
          isAuthority: this.isHost,
          transport: this.matchTransport,
        });
      }
    });
  }

  async _joinMatchFromBroadcast(matchInfo) {
    if (this.isHost) return; // host already started the match directly
    if (this.matchManager || !this.lobbyManager) return;
    this.matchManager = new MatchManager({
      transport: this.lobbyManager.transport,
      selfId: this.lobbyManager.localPlayerId,
    });
    const ok = await this.matchManager.beginMatch(this.lobby.id, this._normalizeMatchInfo(matchInfo));
    if (ok) this._wireMatchReady();
  }

  /** Host/authority transport used by Phase 8's Survival authority wiring. */
  get matchTransport() {
    return this.lobbyManager ? this.lobbyManager.transport : null;
  }

  async leaveLobby() {
    if (!this.lobby) return;
    const lobbyId = this.lobby.id;
    try {
      await callApi(`/lobbies/${lobbyId}/leave`, { method: 'POST' });
    } finally {
      await this._exitLobby();
    }
  }

  async _enterLobby(lobbyId) {
    const session = await ensureAnonymousSession();
    this.connectionState = CONNECTION_STATES.CONNECTING;
    this._notify();

    const lobbyManager = new LobbyManager();
    this._unsubStatus = lobbyManager.transport.on('status', (status) => this._onTransportStatus(status));

    try {
      await lobbyManager.join(lobbyId, session.user.id);
    } catch (err) {
      this.connectionState = CONNECTION_STATES.FAILED;
      this._notify();
      throw err;
    }

    this.lobbyManager = lobbyManager;
    this._unsubLobby = lobbyManager.onChange(() => this._notify());
    this._unsubMatchStart = lobbyManager.transport.on('match:start', (payload) => {
      this._joinMatchFromBroadcast(payload).catch((err) => console.warn('Join match failed:', err));
    });
    this.connectionState = CONNECTION_STATES.CONNECTED;
    this._notify();
  }

  async _exitLobby() {
    if (this._unsubLobby) this._unsubLobby();
    if (this._unsubStatus) this._unsubStatus();
    if (this._unsubMatchStart) this._unsubMatchStart();
    this._unsubLobby = null;
    this._unsubStatus = null;
    this._unsubMatchStart = null;
    if (this.matchManager) { this.matchManager.dispose(); this.matchManager = null; }
    this._matchReadyWired = false;
    if (this.lobbyManager) await this.lobbyManager.dispose();
    this.lobbyManager = null;
    this.connectionState = CONNECTION_STATES.OFFLINE;
    this._notify();
  }

  _onTransportStatus(status) {
    const mapped = TRANSPORT_STATUS_MAP[status];
    if (!mapped) return;
    this.connectionState = mapped;
    this._notify();
  }
}
