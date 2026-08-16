/**
 * THRESHOLD Multiplayer — SnapshotBuffer (browser ESM).
 *
 * Ring buffer of authority recovery snapshots kept by every client so that on
 * host loss a new host can resume from the highest valid cached snapshot. §10.
 */
export class SnapshotBuffer {
  constructor({ capacity = 16 } = {}) {
    this.capacity = Math.max(2, capacity);
    this._items = []; // ascending by sequence
  }

  /**
   * Insert a snapshot. Snapshots must include { sequence, authorityEpoch, ... }.
   * Out-of-order inserts are placed correctly; duplicates by sequence are ignored.
   */
  add(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.sequence)) return false;
    if (this._items.some(s => s.sequence === snapshot.sequence)) return false;
    this._items.push(snapshot);
    this._items.sort((a, b) => a.sequence - b.sequence);
    while (this._items.length > this.capacity) this._items.shift();
    return true;
  }

  /** Highest snapshot at or below an epoch ceiling (defaults to any). */
  getHighestValid({ maxEpoch = Infinity } = {}) {
    for (let i = this._items.length - 1; i >= 0; i--) {
      const s = this._items[i];
      if ((s.authorityEpoch ?? 0) <= maxEpoch) return s;
    }
    return null;
  }

  latest() { return this._items.length ? this._items[this._items.length - 1] : null; }
  size() { return this._items.length; }
  clear() { this._items = []; }
}
