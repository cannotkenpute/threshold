import { EVENT } from './protocol.js';
import { MonsterAuthorityAdapter } from '../survival/network/MonsterAuthorityAdapter.js';

/**
 * MultiplayerMonsterSync — host-authoritative monster snapshot sync (Phase 8).
 * Duck-typed transport ({ send(type, payload), on(type, handler) }); no THREE / no DOM.
 * The host serializes its SurvivalMonsterDirector state and broadcasts it on a cadence;
 * non-host clients decode it and apply it to a RemoteMonsterRenderer.
 */
export class MultiplayerMonsterSync {
  constructor({ transport = null, isAuthority = false, director = null, renderer = null, clock = null } = {}) {
    this.transport = transport;
    this.isAuthority = Boolean(isAuthority);
    this.clock = clock && typeof clock.now === 'function' ? clock : { now: () => Date.now() };
    this.adapter = new MonsterAuthorityAdapter({
      director: this.isAuthority ? director : null,
      renderer: this.isAuthority ? null : renderer,
    });
    this._unsub = null;
    this._lastBroadcast = 0;
  }

  start() {
    if (!this.transport || typeof this.transport.on !== 'function') return;
    this._unsub = this.transport.on(EVENT.MONSTER_SNAPSHOT, (payload) => this._onSnapshot(payload));
  }

  /** Host: call each frame; broadcasts a snapshot on the given cadence (default 5 Hz). */
  update(now = this.clock.now(), intervalMs = 200) {
    if (!this.isAuthority) return;
    if (now - this._lastBroadcast >= intervalMs) {
      this._lastBroadcast = now;
      this.broadcastSnapshot();
    }
  }

  broadcastSnapshot() {
    const state = this.adapter.serializeAuthorityState();
    if (state) this._send(EVENT.MONSTER_SNAPSHOT, state);
  }

  _onSnapshot(payload) {
    if (this.isAuthority || !payload) return;
    this.adapter.applyAuthorityState(payload);
  }

  _send(type, payload) {
    if (this.transport && typeof this.transport.send === 'function') {
      this.transport.send(type, payload);
    }
  }

  dispose() {
    if (this._unsub && typeof this._unsub === 'function') this._unsub();
    this._unsub = null;
  }
}
