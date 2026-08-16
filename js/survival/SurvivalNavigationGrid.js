import { MONSTER_CONFIG } from './MonsterConfig.js';

function keyFor(gx, gz) {
  return `${gx}:${gz}`;
}

function heuristic(ax, az, bx, bz) {
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

export class SurvivalNavigationGrid {
  constructor(levelBuilder, options = {}) {
    this.levelBuilder = levelBuilder;
    this.cellSize = options.cellSize || MONSTER_CONFIG.NAV_CELL_SIZE;
    this.maxNodes = options.maxNodes || MONSTER_CONFIG.NAV_MAX_NODES;
    this.agentRadius = options.agentRadius || 0.4;
    this.agentHeight = options.agentHeight || 1.8;
    this.cells = new Map();
    this.chunkCells = new Map();
    this.unsubscribe = null;
  }

  start() {
    if (this.unsubscribe) return;
    for (const chunk of this.levelBuilder.activeChunks.values()) this.addChunk(chunk);
    this.unsubscribe = this.levelBuilder.onChunkLifecycle((event) => {
      if (event.type === 'loaded') this.addChunk(event.chunk);
      else if (event.type === 'unloading') this.removeChunk(event.chunk.key);
    });
  }

  worldToCell(position) {
    return {
      gx: Math.round(position.x / this.cellSize),
      gz: Math.round(position.z / this.cellSize),
    };
  }

  cellToWorld(gx, gz, y = 0) {
    return { x: gx * this.cellSize, y, z: gz * this.cellSize };
  }

  addChunk(chunk) {
    if (!chunk || this.chunkCells.has(chunk.key)) return;
    const half = this.levelBuilder.CHUNK_SIZE / 2;
    const minX = chunk.cx * this.levelBuilder.CHUNK_SIZE - half;
    const maxX = minX + this.levelBuilder.CHUNK_SIZE;
    const minZ = chunk.cz * this.levelBuilder.CHUNK_SIZE - half;
    const maxZ = minZ + this.levelBuilder.CHUNK_SIZE;
    const minGX = Math.ceil(minX / this.cellSize);
    const maxGX = Math.floor(maxX / this.cellSize);
    const minGZ = Math.ceil(minZ / this.cellSize);
    const maxGZ = Math.floor(maxZ / this.cellSize);
    const owned = new Set();

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gz = minGZ; gz <= maxGZ; gz++) {
        const x = gx * this.cellSize;
        const z = gz * this.cellSize;
        const blocked = (chunk.colliders || []).some((box) => {
          if (!box || !box.min || !box.max || box.max.y <= 0.05 || box.min.y >= this.agentHeight) return false;
          return x + this.agentRadius > box.min.x && x - this.agentRadius < box.max.x &&
            z + this.agentRadius > box.min.z && z - this.agentRadius < box.max.z;
        });
        const key = keyFor(gx, gz);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = { gx, gz, walkable: true, owners: new Map() };
          this.cells.set(key, cell);
        }
        cell.owners.set(chunk.key, !blocked);
        cell.walkable = [...cell.owners.values()].every(Boolean);
        owned.add(key);
      }
    }
    this.chunkCells.set(chunk.key, owned);
  }

  removeChunk(chunkKey) {
    const owned = this.chunkCells.get(chunkKey);
    if (!owned) return;
    for (const key of owned) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      cell.owners.delete(chunkKey);
      if (cell.owners.size === 0) this.cells.delete(key);
      else cell.walkable = [...cell.owners.values()].every(Boolean);
    }
    this.chunkCells.delete(chunkKey);
  }

  isWalkable(position, blockedKeys = null) {
    const { gx, gz } = this.worldToCell(position);
    const key = keyFor(gx, gz);
    return Boolean(this.cells.get(key)?.walkable) && !(blockedKeys && blockedKeys.has(key));
  }

  findNearestWalkable(position, radiusCells = 6) {
    const origin = this.worldToCell(position);
    for (let radius = 0; radius <= radiusCells; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const gx = origin.gx + dx;
          const gz = origin.gz + dz;
          if (this.cells.get(keyFor(gx, gz))?.walkable) return this.cellToWorld(gx, gz, position.y || 0);
        }
      }
    }
    return null;
  }

  findPath(startPosition, endPosition, options = {}) {
    const start = this.worldToCell(startPosition);
    const goal = this.worldToCell(endPosition);
    const startKey = keyFor(start.gx, start.gz);
    const goalKey = keyFor(goal.gx, goal.gz);
    const blocked = options.blockedKeys || null;
    const nodeLimit = Math.min(this.maxNodes, options.maxNodes || this.maxNodes);
    if (!this.cells.get(startKey)?.walkable || !this.cells.get(goalKey)?.walkable) return [];

    const open = [{ ...start, key: startKey, g: 0, f: heuristic(start.gx, start.gz, goal.gx, goal.gz) }];
    const openByKey = new Map([[startKey, open[0]]]);
    const cameFrom = new Map();
    const closed = new Set();
    let visited = 0;

    while (open.length && visited++ < nodeLimit) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIndex].f) bestIndex = i;
      const current = open.splice(bestIndex, 1)[0];
      openByKey.delete(current.key);
      if (current.key === goalKey) {
        const path = [];
        let key = goalKey;
        while (key) {
          const cell = this.cells.get(key);
          if (!cell) break;
          path.push(this.cellToWorld(cell.gx, cell.gz, startPosition.y || 0));
          key = cameFrom.get(key);
        }
        return path.reverse();
      }
      closed.add(current.key);

      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const gx = current.gx + dx;
        const gz = current.gz + dz;
        const key = keyFor(gx, gz);
        const cell = this.cells.get(key);
        if (!cell?.walkable || closed.has(key) || (blocked && blocked.has(key))) continue;
        const g = current.g + 1;
        const existing = openByKey.get(key);
        if (existing && g >= existing.g) continue;
        cameFrom.set(key, current.key);
        const next = { gx, gz, key, g, f: g + heuristic(gx, gz, goal.gx, goal.gz) };
        if (existing) Object.assign(existing, next);
        else { open.push(next); openByKey.set(key, next); }
      }
    }
    return [];
  }

  hasRouteThroughChunk(chunkKey, blockedKeys = new Set()) {
    const owned = this.chunkCells.get(chunkKey);
    if (!owned || !owned.size) return false;
    const cells = [];
    for (const key of owned) {
      const cell = this.cells.get(key);
      if (cell?.walkable && !blockedKeys.has(key)) cells.push(cell);
    }
    if (!cells.length) return false;
    const minGX = Math.min(...cells.map((cell) => cell.gx));
    const maxGX = Math.max(...cells.map((cell) => cell.gx));
    const minGZ = Math.min(...cells.map((cell) => cell.gz));
    const maxGZ = Math.max(...cells.map((cell) => cell.gz));
    const traversable = new Set(cells.map((cell) => keyFor(cell.gx, cell.gz)));

    const connects = (starts, isGoal) => {
      const queue = starts.slice();
      const visited = new Set(queue);
      while (queue.length) {
        const key = queue.shift();
        const cell = this.cells.get(key);
        if (cell && isGoal(cell)) return true;
        if (!cell) continue;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = keyFor(cell.gx + dx, cell.gz + dz);
          if (!traversable.has(next) || visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
      return false;
    };
    const left = cells.filter((cell) => cell.gx === minGX).map((cell) => keyFor(cell.gx, cell.gz));
    const top = cells.filter((cell) => cell.gz === minGZ).map((cell) => keyFor(cell.gx, cell.gz));
    return connects(left, (cell) => cell.gx === maxGX) || connects(top, (cell) => cell.gz === maxGZ);
  }

  dispose() {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.cells.clear();
    this.chunkCells.clear();
  }
}
