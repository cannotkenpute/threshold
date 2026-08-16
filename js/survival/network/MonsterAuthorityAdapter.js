import { encodeSnapshotList, decodeSnapshotList } from './MonsterSnapshotCodec.js';

/**
 * MonsterAuthorityAdapter — glue between the authoritative host's SurvivalMonsterDirector
 * and a remote client's RemoteMonsterRenderer. Duck-typed: pass a director on the host, a
 * renderer on the client. Pure (no DOM / no THREE) and unit-testable.
 */
export class MonsterAuthorityAdapter {
  constructor({ director = null, renderer = null } = {}) {
    this.director = director;
    this.renderer = renderer;
  }

  /** Host: produce a compact wire payload of the current authoritative monster state. */
  serializeAuthorityState() {
    if (!this.director) return null;
    const snapshots = [];
    const monsters = this.director.monsters || new Map();
    for (const monster of monsters.values()) {
      const snapshot = typeof monster.serializeSnapshot === 'function'
        ? monster.serializeSnapshot()
        : monster;
      if (snapshot) snapshots.push(snapshot);
    }
    return {
      gameTime: this.director.gameTime || 0,
      monsters: encodeSnapshotList(snapshots),
    };
  }

  /** Client: decode + apply an authoritative payload to the remote renderer. */
  applyAuthorityState(state) {
    if (!this.renderer || !state) return;
    const snapshots = decodeSnapshotList(state.monsters);
    this.renderer.applySnapshotList(snapshots);
  }
}
