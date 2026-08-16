import { EVENT } from './protocol.js';

/**
 * MultiplayerInventory — host-authoritative item pickup/use flow (Phase 8).
 * Duck-typed transport ({ send(type, payload), on(type, handler) }); no THREE / no DOM.
 * The host validates against a canonical MultiplayerSurvivalState and broadcasts
 * confirm/reject; clients request pickups and act on the authoritative result.
 */
export class MultiplayerInventory {
  constructor({ transport = null, selfId = null, isAuthority = false, state = null, onEvent = null } = {}) {
    this.transport = transport;
    this.selfId = selfId === null ? null : String(selfId);
    this.isAuthority = Boolean(isAuthority);
    this.state = state; // canonical MultiplayerSurvivalState (host only)
    this.onEvent = onEvent;
    this._unsubs = [];
  }

  start() {
    if (!this.transport || typeof this.transport.on !== 'function') return;
    this._unsubs.push(this.transport.on(EVENT.ITEM_PICKUP_REQUEST, (payload) => this._onPickup(payload)));
    this._unsubs.push(this.transport.on(EVENT.ITEM_USED, (payload) => this._onUse(payload)));
  }

  /** Client → host: ask to pick up an item. */
  requestPickup(itemId, capacity) {
    this._send(EVENT.ITEM_PICKUP_REQUEST, { itemId, capacity });
  }

  /** Client → host: ask to use/consume an item. */
  requestUse(itemId) {
    this._send(EVENT.ITEM_USED, { itemId });
  }

  _onPickup(payload) {
    if (!this.isAuthority || !this.state) return;
    const result = this.state.handlePickupRequest(payload.playerId, payload);
    const type = result.ok ? EVENT.ITEM_PICKUP_CONFIRMED : EVENT.ITEM_PICKUP_REJECTED;
    this._send(type, { ...result, playerId: payload.playerId });
    if (this.onEvent) this.onEvent(type, { ...result, playerId: payload.playerId });
  }

  _onUse(payload) {
    if (!this.isAuthority || !this.state) return;
    const result = this.state.handleUseRequest(payload.playerId, payload);
    if (this.onEvent) this.onEvent(EVENT.ITEM_USED, { ...result, playerId: payload.playerId });
  }

  _send(type, payload) {
    if (this.transport && typeof this.transport.send === 'function') {
      this.transport.send(type, payload);
    }
  }

  dispose() {
    if (this.transport && typeof this.transport.on === 'function') {
      // RealtimeTransport.on returns an unsubscribe function; call each.
    }
    for (const unsub of this._unsubs) {
      if (typeof unsub === 'function') unsub();
    }
    this._unsubs.length = 0;
  }
}
