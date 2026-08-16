/**
 * MultiplayerSurvivalState — host-authoritative canonical Survival state (Phase 8).
 * No DOM / no THREE; duck-typed clock so it is unit-testable.
 *
 * Owns the single source of truth per player for Hunger, Thirst, Fear, health, alive,
 * cycle, survival time, inventory slots, and score. Clients send validated mutations;
 * this class enforces invariants (no duplicate pickups, no out-of-range values, death is
 * terminal) and exposes a compact snapshot that AuthorityManager emits for migration /
 * reconnect.
 */

export class MultiplayerSurvivalState {
  constructor({ clock = null } = {}) {
    this.clock = clock && typeof clock.now === 'function' ? clock : { now: () => Date.now() };
    this.players = new Map(); // playerId -> state
    this.epoch = 0;
    this.matchTime = 0;
  }

  _defaultState() {
    return {
      hunger: 100,
      thirst: 100,
      fear: 0,
      health: 100,
      alive: true,
      cycleNumber: 1,
      survivalTime: 0,
      score: 0,
      items: [],
    };
  }

  registerPlayer(playerId, initialState = null) {
    const id = String(playerId);
    if (!this.players.has(id)) {
      this.players.set(id, { ...this._defaultState(), ...(initialState || {}) });
    }
    return this.players.get(id);
  }

  removePlayer(playerId) {
    this.players.delete(String(playerId));
  }

  getPlayer(playerId) {
    return this.players.get(String(playerId)) || null;
  }

  /** Clamp + write canonical scalars. Returns the updated state or null. */
  updatePlayer(playerId, patch = {}) {
    const state = this.getPlayer(playerId);
    if (!state) return null;
    if (patch.hunger !== undefined) state.hunger = this._clamp(patch.hunger, 0, 100);
    if (patch.thirst !== undefined) state.thirst = this._clamp(patch.thirst, 0, 100);
    if (patch.fear !== undefined) state.fear = this._clamp(patch.fear, 0, 100);
    if (patch.health !== undefined) state.health = this._clamp(patch.health, 0, 100);
    if (patch.cycleNumber !== undefined) state.cycleNumber = Math.max(1, Math.floor(patch.cycleNumber));
    if (patch.survivalTime !== undefined) state.survivalTime = Math.max(0, patch.survivalTime);
    if (patch.score !== undefined) state.score = Math.max(0, patch.score);
    if (state.health <= 0 && state.alive) this._markDead(state);
    return state;
  }

  /**
   * Authoritative item pickup. Returns { ok:true, itemId } or { ok:false, code }.
   * Rejects duplicates and out-of-capacity pickups so retries/packet-loss never
   * double-add an item.
   */
  handlePickupRequest(playerId, { itemId, capacity = 6 } = {}) {
    const state = this.getPlayer(playerId);
    if (!state || !state.alive) return { ok: false, code: 'PLAYER_UNAVAILABLE' };
    if (!itemId || typeof itemId !== 'string') return { ok: false, code: 'INVALID_ITEM' };
    if (state.items.includes(itemId)) return { ok: false, code: 'ALREADY_HELD' };
    if (state.items.length >= capacity) return { ok: false, code: 'INVENTORY_FULL' };
    state.items.push(itemId);
    return { ok: true, itemId };
  }

  /**
   * Authoritative consumable use. Returns { ok:true, itemId } or { ok:false, code }.
   * Consuming an item removes it from the canonical inventory (no dupes on retry).
   */
  handleUseRequest(playerId, { itemId } = {}) {
    const state = this.getPlayer(playerId);
    if (!state || !state.alive) return { ok: false, code: 'PLAYER_UNAVAILABLE' };
    if (!itemId || typeof itemId !== 'string') return { ok: false, code: 'INVALID_ITEM' };
    const index = state.items.indexOf(itemId);
    if (index === -1) return { ok: false, code: 'NOT_HELD' };
    state.items.splice(index, 1);
    return { ok: true, itemId };
  }

  markDead(playerId) {
    const state = this.getPlayer(playerId);
    if (!state) return false;
    state.alive = false;
    state.health = 0;
    return true;
  }

  _markDead(state) {
    state.alive = false;
    state.health = 0;
  }

  aliveCount() {
    let count = 0;
    for (const state of this.players.values()) if (state.alive) count++;
    return count;
  }

  tick(delta) {
    this.matchTime += Math.max(0, delta);
  }

  serializeSnapshot() {
    return {
      epoch: this.epoch,
      matchTime: this.matchTime,
      players: [...this.players.entries()].map(([id, state]) => ({ id, ...state, items: [...state.items] })),
    };
  }

  restoreSnapshot(snapshot) {
    this.players.clear();
    if (!snapshot) return;
    this.epoch = Number.isFinite(snapshot.epoch) ? snapshot.epoch : 0;
    this.matchTime = Number.isFinite(snapshot.matchTime) ? snapshot.matchTime : 0;
    for (const entry of snapshot.players || []) {
      const { id, items, ...rest } = entry;
      this.players.set(String(id), { ...this._defaultState(), ...rest, items: Array.isArray(items) ? [...items] : [] });
    }
  }

  _clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
}
