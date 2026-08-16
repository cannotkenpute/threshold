import { EncounterScheduler } from './EncounterScheduler.js';
import { MonsterAssetRegistry } from './MonsterAssetRegistry.js';
import { MonsterBase } from './MonsterBase.js';
import { MONSTER_TYPES, isMonsterType } from './MonsterConfig.js';
import { SensoryEventBus } from './SensoryEventBus.js';
import { SurvivalNavigationGrid } from './SurvivalNavigationGrid.js';
import { MONSTER_CLASSES } from './monsters/index.js';

export class SurvivalMonsterDirector {
  constructor({ scene, camera, player, levelBuilder, lightManager, audioManager, renderer }) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.levelBuilder = levelBuilder;
    this.lightManager = lightManager;
    this.audioManager = audioManager;
    this.renderer = renderer;
    this.assetRegistry = new MonsterAssetRegistry();
    this.sensoryEvents = new SensoryEventBus();
    this.navigation = new SurvivalNavigationGrid(levelBuilder);
    this.scheduler = new EncounterScheduler(1);
    this.monsters = new Map();
    this.pendingSpawns = new Set();
    this.started = false;
    this.disposed = false;
    this.gameTime = 0;
    this.routeEventTimer = 0;
    this.distressEventTimer = 0;
    this.lastRouteCell = null;
    this.authorityMode = 'solo';
    this.automaticEncounters = false;
    this.unsubscribeSensory = null;
    this._cameraDirection = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._rayHit = new THREE.Vector3();
  }

  start({ seed = Date.now(), authorityMode = 'solo', automaticEncounters = false } = {}) {
    if (this.started) return this;
    this.scheduler.reset(seed);
    this.authorityMode = authorityMode;
    this.automaticEncounters = Boolean(automaticEncounters);
    this.navigation.start();
    this.unsubscribeSensory = this.sensoryEvents.subscribe((event) => {
      for (const monster of this.monsters.values()) monster.onSensoryEvent(event);
    });
    this.player.setSensoryEventBus(this.sensoryEvents);
    this.started = true;
    return this;
  }

  emitPlayerEvent(type, intensity = 0.5) {
    if (!this.started || this.disposed) return null;
    return this.sensoryEvents.emit(type, { position: this.player.position, intensity });
  }

  getActiveCounts() {
    const counts = {};
    for (const type of MONSTER_TYPES) counts[type] = 0;
    for (const monster of this.monsters.values()) counts[monster.type]++;
    for (const type of this.pendingSpawns) counts[type]++;
    return counts;
  }

  update(delta, survivalState = null) {
    if (!this.started || this.disposed) return;
    this.gameTime += Math.max(0, delta);
    this.sensoryEvents.setGameTime(this.gameTime);
    this.routeEventTimer += delta;
    this.distressEventTimer += delta;

    if (this.routeEventTimer >= 1) {
      this.routeEventTimer %= 1;
      const cell = this.navigation.worldToCell(this.player.position);
      const key = `${cell.gx}:${cell.gz}`;
      if (key !== this.lastRouteCell) {
        this.lastRouteCell = key;
        this.emitPlayerEvent('player:route_cell', 0.25);
      }
    }
    if (this.distressEventTimer >= 2 && survivalState?.fearFactor >= 61) {
      this.distressEventTimer %= 2;
      this.emitPlayerEvent('player:distress', survivalState.fearFactor / 100);
    }

    for (const [id, monster] of this.monsters) {
      monster.update(delta);
      if (!monster.object || !this.isPositionInActiveChunk(monster.object.position)) {
        monster.dispose();
        this.monsters.delete(id);
      }
    }

    if (!this.automaticEncounters) return;
    const cycleInfo = this.lightManager.getCycleInfo();
    const request = this.scheduler.update(delta, {
      cycleNumber: survivalState?.cycleNumber || 1,
      isNight: cycleInfo.isNight,
      players: [{ id: 'local', position: this.player.position }],
      activeCounts: this.getActiveCounts(),
      isWalkable: (position) => this.navigation.isWalkable(position),
      isVisible: (position) => this.isPositionVisible(position),
    });
    if (request) this.spawnMonster(request.type, request.position).catch((error) => {
      console.warn(`[SurvivalMonsterDirector] Spawn failed for ${request.type}:`, error);
    });
  }

  isPositionInActiveChunk(position) {
    const cx = Math.round(position.x / this.levelBuilder.CHUNK_SIZE);
    const cz = Math.round(position.z / this.levelBuilder.CHUNK_SIZE);
    return this.levelBuilder.activeChunks.has(`${cx}_${cz}`);
  }

  isPositionVisible(position) {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const target = this._toTarget.set(position.x, Math.max(1, position.y || 0), position.z);
    const direction = target.sub(origin);
    const distance = direction.length();
    if (distance <= 0.001) return true;
    direction.normalize();
    this.camera.getWorldDirection(this._cameraDirection);
    if (this._cameraDirection.dot(direction) < Math.cos((this.camera.fov * Math.PI / 180) * 0.58)) return false;
    this._ray.set(origin, direction);
    for (const collider of this.levelBuilder.colliders) {
      const hit = this._ray.intersectBox(collider, this._rayHit);
      if (hit && origin.distanceTo(hit) < distance - 0.5) return false;
    }
    return true;
  }

  async spawnMonster(type, position, { passive = false } = {}) {
    if (!isMonsterType(type)) throw new Error(`Unknown monster type: ${String(type)}`);
    if (this.disposed) throw new Error('Monster director is disposed');
    const walkable = this.navigation.findNearestWalkable(position, 8);
    if (!walkable) throw new Error(`No walkable spawn cell near ${position.x}, ${position.z}`);
    this.pendingSpawns.add(type);
    const MonsterClass = MONSTER_CLASSES[type] || MonsterBase;
    const monster = new MonsterClass(type, {
      scene: this.scene,
      player: this.player,
      camera: this.camera,
      renderer: this.renderer,
      audioManager: this.audioManager,
      levelBuilder: this.levelBuilder,
      assetRegistry: this.assetRegistry,
      navigation: this.navigation,
      lightManager: this.lightManager,
      sensoryEvents: this.sensoryEvents,
    });
    monster.passive = passive;
    try {
      await monster.spawn(walkable);
      if (this.disposed) {
        monster.dispose();
        throw new Error('Monster director disposed during spawn');
      }
      this.monsters.set(monster.id, monster);
      return monster;
    } finally {
      this.pendingSpawns.delete(type);
    }
  }

  async spawnDebug(type, position = null, { passive = false } = {}) {
    if (!this.started) throw new Error('Monster director has not started');
    const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3());
    const desired = position || {
      x: this.player.position.x - cameraDirection.x * 8,
      y: 0,
      z: this.player.position.z - cameraDirection.z * 8,
    };
    return this.spawnMonster(type, desired, { passive });
  }

  async debugSpawnAll() {
    const spawned = [];
    for (let i = 0; i < MONSTER_TYPES.length; i++) {
      const angle = (i / MONSTER_TYPES.length) * Math.PI * 2;
      const desired = {
        x: this.player.position.x + Math.cos(angle) * 10,
        y: 0,
        z: this.player.position.z + Math.sin(angle) * 10,
      };
      spawned.push(await this.spawnMonster(MONSTER_TYPES[i], desired));
    }
    return spawned;
  }

  serializeAuthoritySnapshot() {
    return {
      authorityMode: this.authorityMode,
      gameTime: this.gameTime,
      monsters: [...this.monsters.values()].map((monster) => monster.serializeSnapshot()),
    };
  }

  async restoreAuthoritySnapshot(snapshot) {
    for (const monster of this.monsters.values()) monster.dispose();
    this.monsters.clear();
    this.gameTime = Math.max(0, snapshot?.gameTime || 0);
    for (const state of snapshot?.monsters || []) {
      const monster = await this.spawnMonster(state.type, state.position);
      monster.applySnapshot(state);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.player.setSensoryEventBus(null);
    if (this.unsubscribeSensory) this.unsubscribeSensory();
    this.unsubscribeSensory = null;
    for (const monster of this.monsters.values()) monster.dispose();
    this.monsters.clear();
    this.navigation.dispose();
    this.sensoryEvents.clear();
    this.assetRegistry.dispose();
    this.lightManager.resetSuppressions();
  }
}
