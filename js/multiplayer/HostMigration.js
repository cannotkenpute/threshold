/**
 * THRESHOLD Multiplayer — HostMigration (browser ESM). Section 10 "During Match".
 *
 * Deterministic host election + epoch bump + resume-from-snapshot. Side-effecting
 * pieces (server epoch bump, transport broadcast, sim pause/resume, snapshot restore)
 * are injected so this is unit-testable and transport-agnostic.
 */

/**
 * Pure election: oldest connected, non-kicked, non-left member wins.
 * members: [{ playerId, joinedAt, connected, state }]
 */
export function electNextHost(members, options) {
  const excludePlayerId = (options && options.excludePlayerId) || null;
  const eligible = (members || []).filter(function (m) {
    return m && m.connected && m.playerId && m.playerId !== excludePlayerId &&
      m.state !== 'LEFT' && m.state !== 'KICKED' && m.state !== 'DISCONNECTED';
  });
  if (eligible.length === 0) return null;
  eligible.sort(function (a, b) {
    const ta = Number(a.joinedAt) || 0;
    const tb = Number(b.joinedAt) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.playerId).localeCompare(String(b.playerId));
  });
  return eligible[0].playerId;
}

export class HostMigration {
  constructor(deps) {
    this.d = deps;
    this.onEvent = deps.onEvent || function () {};
    this.reconnectGraceMs = (deps.timings && deps.timings.hostReconnectGraceMs) || 5000;
    this._inProgress = false;
    this._graceTimer = null;
  }

  get inProgress() { return this._inProgress; }

  begin(params) {
    params = params || {};
    const lostHostId = params.lostHostId;
    const now = params.now == null ? Date.now() : params.now;
    const waitForReconnect = params.waitForReconnect !== false;
    if (this._inProgress) return;
    this._inProgress = true;
    this.onEvent('migration:start', { lostHostId: lostHostId, at: now });
    this.d.pauseSimulation();
    this.d.send('authority:migration_start', { lostHostId: lostHostId, at: now }, { replaceable: true });

    const self = this;
    const run = function () { self._elect({ lostHostId: lostHostId }); };
    if (waitForReconnect && typeof setTimeout === 'function') {
      this._graceTimer = setTimeout(run, this.reconnectGraceMs);
    } else {
      run();
    }
  }

  cancelIfHostReturned(hostId) {
    if (!this._inProgress) return false;
    if (hostId && hostId === this.d.getAuthorityId()) {
      this._clearTimer();
      this._inProgress = false;
      this.d.resumeSimulation();
      this.onEvent('migration:cancelled', { hostId: hostId });
      return true;
    }
    return false;
  }

  async _elect(params) {
    this._clearTimer();
    const lostHostId = params.lostHostId;
    const winner = electNextHost(this.d.getMembers(), { excludePlayerId: lostHostId });
    if (!winner) {
      this._inProgress = false;
      this.onEvent('migration:failed', { reason: 'no_eligible_host' });
      return;
    }
    if (winner !== this.d.selfId()) {
      this._inProgress = false;
      this.onEvent('migration:deferred', { winner: winner });
      return;
    }

    let epoch = this.d.getEpoch() + 1;
    try {
      if (this.d.commitEpoch) {
        const committed = await this.d.commitEpoch(epoch);
        if (Number.isFinite(committed)) epoch = committed;
      }
    } catch (err) {
      this._inProgress = false;
      this.onEvent('migration:failed', { reason: 'commit_failed', error: String(err && err.message || err) });
      return;
    }

    this.d.setEpoch(epoch);
    this.d.setAuthorityId(winner);

    const snap = this.d.getBestSnapshot();
    if (snap) this.d.restoreFromSnapshot(snap);

    this.d.send('authority:migration_complete', {
      authorityEpoch: epoch,
      authorityPlayerId: winner,
      snapshotSequence: snap ? snap.sequence : null,
    }, { authorityEpoch: epoch, eventId: 'mig-' + epoch + '-' + winner });

    this.d.send('host:changed', { hostId: winner, epoch: epoch }, { eventId: 'host-' + epoch + '-' + winner });

    this._inProgress = false;
    this.d.resumeSimulation();
    this.onEvent('migration:complete', { winner: winner, epoch: epoch, restored: !!snap });
  }

  _clearTimer() {
    if (this._graceTimer && typeof clearTimeout === 'function') clearTimeout(this._graceTimer);
    this._graceTimer = null;
  }
}
