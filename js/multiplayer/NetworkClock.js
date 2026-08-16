/**
 * THRESHOLD Multiplayer — NetworkClock (browser ESM).
 *
 * Monotonic local time + estimated offset toward an authority clock, plus
 * per-channel sequence generation. Never trust wall-clock for simulation. §42.
 */

const nowMono = (typeof performance !== 'undefined' && performance.now)
  ? () => performance.now()
  : () => Date.now();

export class NetworkClock {
  constructor() {
    this._offset = 0;          // ms to add to local mono to approximate authority time
    this._samples = [];        // recent offset samples for smoothing
    this._maxSamples = 8;
    this._seq = new Map();     // channelKey -> counter
  }

  /** Local monotonic milliseconds. */
  localTime() { return nowMono(); }

  /** Estimated shared game time in ms. */
  gameTime() { return nowMono() + this._offset; }

  /**
   * Feed a round-trip sample: when we sent a ping, the authority's stamped time,
   * and when we received the reply. Uses half-RTT to estimate offset.
   */
  addSample(sentLocal, authorityTime, recvLocal) {
    if (![sentLocal, authorityTime, recvLocal].every(Number.isFinite)) return;
    const rtt = Math.max(0, recvLocal - sentLocal);
    const estAuthorityAtRecv = authorityTime + rtt / 2;
    const offset = estAuthorityAtRecv - recvLocal;
    this._samples.push(offset);
    if (this._samples.length > this._maxSamples) this._samples.shift();
    // median offset is robust to jitter
    const sorted = [...this._samples].sort((a, b) => a - b);
    this._offset = sorted[Math.floor(sorted.length / 2)];
  }

  get offset() { return this._offset; }

  /** Monotonic per-channel sequence numbers. */
  nextSeq(channelKey = 'default') {
    const n = (this._seq.get(channelKey) || 0) + 1;
    this._seq.set(channelKey, n);
    return n;
  }

  resetSeq(channelKey) {
    if (channelKey) this._seq.delete(channelKey);
    else this._seq.clear();
  }
}
