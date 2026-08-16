import { MultiplayerSurvivalState } from './MultiplayerSurvivalState.js';
import { MultiplayerInventory } from './MultiplayerInventory.js';
import { MultiplayerFearSync } from './MultiplayerFearSync.js';
import { MultiplayerMonsterSync } from './MultiplayerMonsterSync.js';
import { RemoteMonsterRenderer } from '../survival/network/RemoteMonsterRenderer.js';

/**
 * MatchAuthorityController — wires the Phase 8 host-authoritative Survival authority
 * together. Duck-typed transport ({ send, on }); no THREE at import (THREE is only used
 * by RemoteMonsterRenderer inside the browser).
 *
 * Host: owns a MultiplayerSurvivalState (canonical Hunger/Thirst/Fear/health/items) and
 *       the monster-snapshot / fear / inventory authority, all bound to the director.
 * Client: owns a RemoteMonsterRenderer and applies authoritative monster/fear state.
 */
export class MatchAuthorityController {
  constructor({ transport, selfId, isAuthority = false, scene = null, clock = null, onRemoteFear = null } = {}) {
    this.transport = transport;
    this.selfId = selfId === null ? null : String(selfId);
    this.isAuthority = Boolean(isAuthority);
    this.scene = scene;
    this.clock = clock && typeof clock.now === 'function' ? clock : { now: () => Date.now() };
    this.onRemoteFear = onRemoteFear;

    this.survivalState = this.isAuthority ? new MultiplayerSurvivalState({ clock: this.clock }) : null;
    this.renderer = !this.isAuthority && scene ? new RemoteMonsterRenderer({ scene }) : null;

    this.inventory = new MultiplayerInventory({
      transport, selfId: this.selfId, isAuthority: this.isAuthority, state: this.survivalState,
    });
    this.fearSync = new MultiplayerFearSync({
      transport, selfId: this.selfId, isAuthority: this.isAuthority, onFear: this.onRemoteFear,
    });
    this.monsterSync = null;
    this._director = null;
    this._started = false;
  }

  /** Bind to the host director (authority) or a client renderer, then start listening. */
  attach({ director = null, renderer = null } = {}) {
    if (this.isAuthority && director) this._director = director;
    if (!this.isAuthority && renderer) this.renderer = renderer;

    this.monsterSync = new MultiplayerMonsterSync({
      transport: this.transport,
      isAuthority: this.isAuthority,
      director: this._director,
      renderer: this.renderer,
      clock: this.clock,
    });

    this.inventory.start();
    this.fearSync.start();
    this.monsterSync.start();
    this._started = true;
    return this;
  }

  /** Host: register a player in the canonical Survival state. */
  registerPlayer(playerId, initialState = null) {
    return this.survivalState ? this.survivalState.registerPlayer(playerId, initialState) : null;
  }

  /** Drive from the game loop. Host emits monster snapshots on a cadence + ticks clock. */
  update(delta) {
    if (this.survivalState) this.survivalState.tick(delta);
    if (this.monsterSync && this.isAuthority) this.monsterSync.update(this.clock.now(), 200);
  }

  broadcastFear(playerId, fear) {
    this.fearSync.broadcastFear(playerId, fear);
  }

  /** Host: authoritative snapshot for host-migration / reconnect (Phase 10). */
  serializeSnapshot() {
    return {
      survival: this.survivalState ? this.survivalState.serializeSnapshot() : null,
      monsters: this.monsterSync && this.isAuthority ? this.monsterSync.adapter.serializeAuthorityState() : null,
    };
  }

  dispose() {
    this.inventory.dispose();
    this.fearSync.dispose();
    if (this.monsterSync) this.monsterSync.dispose();
    if (this.renderer) this.renderer.dispose();
    this._director = null;
    this._started = false;
  }
}
