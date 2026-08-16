import { MonsterBase } from '../MonsterBase.js';
import { MONSTER_CONFIG } from '../MonsterConfig.js';

const DEFAULTS = {
  spreadInterval: 90,
  maxCellFraction: 0.15,
  fearRate: 4.0,
  cellRadius: 1.5,
};

const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Crawling Mass (cycle 6, environmental): a static, spreading hazard keyed by world cell.
 * Every spreadInterval it claims an adjacent walkable cell, capped at maxCellFraction of
 * the active walkable cells and never on the player's current cell. The claimed set is
 * exposed as `blockedCells` for other systems (player movement, monster pathfinding) to
 * treat as blocked; this class itself drains sanity while the player is within range.
 */
export class CrawlingMass extends MonsterBase {
  constructor(type, context) {
    super(type, context);
    this.cfg = { ...DEFAULTS, ...(MONSTER_CONFIG.TYPES[type] || {}) };
    this.blockedCells = new Set();
    this.spreadTimer = 0;
    this._markers = [];
  }

  async spawn(position) {
    await super.spawn(position);
    const cell = this.context.navigation.worldToCell(position);
    this.blockedCells.add(`${cell.gx}:${cell.gz}`);
    this.spawnMarker(cell.gx, cell.gz);
    return this;
  }

  update(delta) {
    super.update(delta);
    if (!this.spawned || !this.object) return;
    this.spreadTimer += delta;
    if (this.spreadTimer >= this.cfg.spreadInterval) {
      this.spreadTimer = 0;
      this.spread();
    }

    // Fear while the player is on/near a claimed cell.
    const player = this.context.player;
    if (this.isNearClaimed(player.position)) {
      this.modifySanity(-this.cfg.fearRate * delta);
    }
  }

  spread() {
    const navigation = this.context.navigation;
    const activeCells = navigation.cells ? navigation.cells.size : 0;
    const maxCells = Math.max(1, Math.floor(activeCells * this.cfg.maxCellFraction));
    if (this.blockedCells.size >= maxCells) return;

    const playerCell = navigation.worldToCell(this.context.player.position);
    const playerKey = `${playerCell.gx}:${playerCell.gz}`;

    for (const key of [...this.blockedCells]) {
      const [gx, gz] = key.split(':').map(Number);
      for (const [dx, dz] of CARDINAL) {
        const nx = gx + dx;
        const nz = gz + dz;
        const nKey = `${nx}:${nz}`;
        if (this.blockedCells.has(nKey)) continue;
        if (nKey === playerKey) continue;
        const cell = navigation.cells && navigation.cells.get(nKey);
        if (!cell || !cell.walkable) continue;
        // Route preservation: refuse a claim that would seal its chunk.
        if (!this.preservesRoutes(nKey)) continue;
        this.blockedCells.add(nKey);
        this.spawnMarker(nx, nz);
        return;
      }
    }
  }

  preservesRoutes(candidateKey) {
    const navigation = this.context.navigation;
    if (!navigation || typeof navigation.hasRouteThroughChunk !== 'function') return true;
    const candidate = new Set(this.blockedCells);
    candidate.add(candidateKey);
    const [gx, gz] = candidateKey.split(':').map(Number);
    const world = navigation.cellToWorld(gx, gz);
    const lb = this.context.levelBuilder || navigation.levelBuilder;
    const chunkSize = (lb && lb.CHUNK_SIZE) || 24;
    const chunkKey = `${Math.round(world.x / chunkSize)}_${Math.round(world.z / chunkSize)}`;
    return navigation.hasRouteThroughChunk(chunkKey, candidate);
  }

  isNearClaimed(position) {
    const cell = this.context.navigation.worldToCell(position);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (this.blockedCells.has(`${cell.gx + dx}:${cell.gz + dz}`)) return true;
      }
    }
    return false;
  }

  spawnMarker(gx, gz) {
    if (!this.context.scene) return;
    const world = this.context.navigation.cellToWorld(gx, gz, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a0a0a });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(this.cfg.cellRadius, 8), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(world.x, 0.02, world.z);
    mesh.userData.crawlingMass = this.id;
    this.context.scene.add(mesh);
    this._markers.push(mesh);
  }

  dispose() {
    if (this.context.scene) {
      for (const mesh of this._markers) this.context.scene.remove(mesh);
    }
    this._markers.length = 0;
    this.blockedCells.clear();
    super.dispose();
  }
}
