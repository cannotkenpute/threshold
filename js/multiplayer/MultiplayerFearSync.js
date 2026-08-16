import { EVENT } from './protocol.js';

/**
 * MultiplayerFearSync — host-authoritative canonical Fear sync (Phase 8).
 * Duck-typed transport ({ send(type, payload), on(type, handler) }); no THREE / no DOM.
 * The host broadcasts FEAR_SYNC for each player; non-host clients apply it via onFear.
 */
export class MultiplayerFearSync {
  constructor({ transport = null, selfId = null, isAuthority = false, onFear = null } = {}) {
    this.transport = transport;
    this.selfId = selfId === null ? null : String(selfId);
    this.isAuthority = Boolean(isAuthority);
    this.onFear = onFear;
    this._unsub = null;
  }

  start() {
    if (!this.transport || typeof this.transport.on !== 'function') return;
    this._unsub = this.transport.on(EVENT.FEAR_SYNC, (payload) => this._onFear(payload));
  }

  /** Host → broadcast canonical fear for a player. */
  broadcastFear(playerId, fear) {
    if (!this.isAuthority) return;
    this._send(EVENT.FEAR_SYNC, { playerId, fear });
  }

  _onFear(payload) {
    if (!payload || !this.onFear) return;
    if (payload.playerId === this.selfId) return; // ignore our own echo
    this.onFear(payload.playerId, Number(payload.fear) || 0);
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
