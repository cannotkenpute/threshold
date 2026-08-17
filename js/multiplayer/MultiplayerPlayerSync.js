/**
 * THRESHOLD Multiplayer — MultiplayerPlayerSync (Phase 5).
 *
 * Remote player representation + transform send/receive:
 *  - broadcasts the local player's transform at PLAYER_TRANSFORM_HZ
 *    (replaceable state: newest wins),
 *  - feeds remote player:transform samples into NetworkInterpolation and
 *    applies the delayed interpolated transform to cheap low-poly avatars,
 *  - relays player:flashlight on/off to a per-remote spotlight toggle.
 *
 * Three.js r128 is loaded as a global (window.THREE) by index.html; this
 * module reads `globalThis.THREE` lazily INSIDE methods only, so importing it
 * in Node (tests, tooling) never touches browser APIs.
 *
 * Per plan §11: NO hard player-vs-player collision — remotes are visual only.
 *
 * Dependencies are duck-typed so Phase 3/4 implementations slot in without
 * any import coupling:
 *   transport: { broadcast(type, payload), onMessage(type, handler),
 *                offMessage?(type, handler) }
 *   clock:     { now() -> ms }   (Phase 4 NetworkClock satisfies this)
 */

import { UPDATE_RATES_HZ, MAX_PLAYERS } from './protocol.js';
import { NetworkInterpolation } from './NetworkInterpolation.js';
import { CONFIG } from '../config.js';

/** Transform broadcast period (ms). */
const SEND_INTERVAL_MS = 1000 / UPDATE_RATES_HZ.PLAYER_TRANSFORM;
/** Remote players besides ourselves (4-player co-op cap). */
const MAX_REMOTE_PLAYERS = MAX_PLAYERS - 1;
/** No samples for this long -> hide the avatar (it may be gone). */
const REMOTE_TIMEOUT_MS = 10000;
/** Terminal amber + monospace for the floating name tag. */
const NAME_COLOR = '#ffb000';
const NAME_FONT = 'bold 30px "Courier New", "Lucida Console", monospace';

/**
 * Team spawn cluster: 4 corners around the Level 1 spawn area (0, 20).
 * Half-side 1.4m -> adjacent players 2.8m apart, diagonal ~3.96m apart.
 */
const SPAWN_CENTER = { x: 0, z: 20 };
const SPAWN_HALF_SIDE = 1.4;
const SPAWN_OFFSETS = [
  { x: -SPAWN_HALF_SIDE, z: -SPAWN_HALF_SIDE },
  { x: SPAWN_HALF_SIDE, z: -SPAWN_HALF_SIDE },
  { x: SPAWN_HALF_SIDE, z: SPAWN_HALF_SIDE },
  { x: -SPAWN_HALF_SIDE, z: SPAWN_HALF_SIDE },
];

/**
 * Deterministic spawn assignment (PURE — import-safe in Node tests).
 *
 * Sorts the member ids, maps sorted index -> spawn point, and rotates the
 * point set by `seed % 4` so every match scatters the team differently while
 * every client computes the IDENTICAL mapping from the same (seed, members).
 * Invariant to input member order: sorting happens here.
 *
 * @returns {{x:number, z:number, yaw:number, index:number}|null} the spawn for
 *          `playerId` (facing the cluster center), or null for non-members.
 */
export function computeSpawnAssignment(playerId, memberIds, seed) {
  if (!Array.isArray(memberIds) || memberIds.length === 0 || playerId === undefined || playerId === null) {
    return null;
  }
  const sorted = [...new Set(memberIds.map(String))].sort();
  const index = sorted.indexOf(String(playerId));
  if (index === -1) return null;
  const numericSeed = Number.isFinite(Number(seed)) ? Math.floor(Math.abs(Number(seed))) : 0;
  const rotation = numericSeed % SPAWN_OFFSETS.length;
  const off = SPAWN_OFFSETS[(index + rotation) % SPAWN_OFFSETS.length];
  const x = SPAWN_CENTER.x + off.x;
  const z = SPAWN_CENTER.z + off.z;
  // Avatar models face local -Z, so yaw toward the cluster center is:
  const yaw = Math.atan2(x - SPAWN_CENTER.x, z - SPAWN_CENTER.z);
  return { x, z, yaw, index };
}

export class MultiplayerPlayerSync {
  /**
   * @param {object} deps
   * @param {object|null} deps.scene THREE.Scene (browser runtime)
   * @param {object|null} deps.transport duck-typed broadcast/onMessage
   * @param {object|null} deps.clock duck-typed { now() } shared clock
   * @param {string|null} [deps.selfId] our player id; own echoes are ignored
   *                      (self-authoritative local position until Phase 8)
   * @param {string|null} [deps.localName] optional display name to attach to transforms
   */
  constructor({ scene = null, transport = null, clock = null, selfId = null, localName = null } = {}) {
    this.scene = scene ?? null;
    this.transport = transport ?? null;
    this.clock = clock ?? null;
    this.selfId = selfId === null ? null : String(selfId);
    this.localName = null;
    this.setLocalName(localName);
    this.localPlayer = null;

    /** @type {NetworkInterpolation} */
    this._interp = new NetworkInterpolation();
    /** @type {Map<string, object>} entityId -> avatar record (see _createAvatar) */
    this._remotes = new Map();
    this._sendTimer = null;
    this._boundHandlers = []; // { type, fn } registered on the transport
    this._disposed = false;

    this._bindTransport();
  }

  // --------------------------------------------------------------------------
  // Local player
  // --------------------------------------------------------------------------

  /** Reference to the local Player instance (position/rotation.y source). */
  setLocalPlayer(player) {
    this.localPlayer = player ?? null;
    return this;
  }

  /** Display name broadcast with transforms (truncated; null clears it). */
  setLocalName(name) {
    this.localName = typeof name === 'string' && name.length > 0 ? name.slice(0, 24) : null;
    return this;
  }

  /** Derive the compact animation state from the local Player duck. */
  _deriveState(player) {
    if (player.isCrouching) return 'crouch';
    const vx = Number(player.velocity ? player.velocity.x : 0);
    const vz = Number(player.velocity ? player.velocity.z : 0);
    const speed = Math.hypot(vx, vz);
    if (player.isSprinting && speed > 0.3) return 'sprint';
    if (speed > 0.3) return 'walk';
    return 'idle';
  }

  _sendTransform() {
    const player = this.localPlayer;
    if (!player || !player.position || !this.transport || typeof this.transport.broadcast !== 'function') return;
    const p = player.position;
    const yaw = Number(player.rotation ? player.rotation.y : 0);
    const payload = {
      // RealtimeTransport's match-channel broadcast delivers handlers the bare payload
      // (no senderId/meta envelope -- see RealtimeTransport.js's `broadcast`/`_emit`), so
      // the sender's id has to travel inside the payload itself, same convention as
      // MultiplayerFearSync's { playerId, fear }. _unwrap()'s meta-less fallback already
      // reads payload.senderId, so this alone is what makes _isSelf() work correctly.
      senderId: this.selfId,
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      z: Math.round(p.z * 1000) / 1000,
      yaw: Math.round(yaw * 1000) / 1000,
      state: this._deriveState(player),
    };
    if (this.localName) payload.name = this.localName;
    this.transport.broadcast('player:transform', payload);
  }

  /** Start broadcasting player:transform at PLAYER_TRANSFORM_HZ (idempotent). */
  startSending() {
    if (this._disposed || this._sendTimer || !this.transport) return this;
    this._sendTimer = setInterval(() => this._sendTransform(), SEND_INTERVAL_MS);
    if (typeof this._sendTimer.unref === 'function') this._sendTimer.unref(); // Node-safe no-op guard
    this._sendTransform();
    return this;
  }

  stopSending() {
    if (this._sendTimer) {
      clearInterval(this._sendTimer);
      this._sendTimer = null;
    }
    return this;
  }

  /**
   * Broadcast local flashlight on/off (replaceable state). Call this from the
   * input handler that toggles the local flashlight.
   */
  broadcastFlashlight(isOn) {
    if (this._disposed || !this.transport || typeof this.transport.broadcast !== 'function') return this;
    this.transport.broadcast('player:flashlight', { senderId: this.selfId, on: Boolean(isOn) });
    return this;
  }

  // --------------------------------------------------------------------------
  // Transport plumbing
  // --------------------------------------------------------------------------

  _bindTransport() {
    if (!this.transport || typeof this.transport.onMessage !== 'function') return;
    const bind = (type, method) => {
      const fn = (msg, meta) => this[method](msg, meta);
      this.transport.onMessage(type, fn);
      this._boundHandlers.push({ type, fn });
    };
    bind('player:transform', '_onRemoteTransform');
    bind('player:flashlight', '_onRemoteFlashlight');
  }

  _now() {
    return this.clock && typeof this.clock.now === 'function' ? this.clock.now() : Date.now();
  }

  /**
   * Normalize whatever the transport hands handlers into
   * { senderId, sentAt, payload }. Handles full envelopes
   * ({ v, type, matchId, senderId, seq, sentAt, payload }), (payload, meta)
   * two-argument delivery, and flattened { senderId, ...fields } shapes.
   */
  _unwrap(msg, meta) {
    if (msg && typeof msg === 'object' && msg.payload !== undefined) {
      return {
        senderId: msg.senderId !== undefined ? msg.senderId : meta && meta.senderId,
        sentAt: msg.sentAt !== undefined ? msg.sentAt : meta && meta.sentAt,
        payload: msg.payload,
      };
    }
    const senderId = meta && meta.senderId !== undefined ? meta.senderId : msg && msg.senderId;
    const sentAt = meta && meta.sentAt !== undefined ? meta.sentAt : msg && msg.sentAt;
    return { senderId, sentAt, payload: msg };
  }

  _isSelf(senderId) {
    return senderId === undefined || senderId === null || String(senderId) === this.selfId;
  }

  _onRemoteTransform(msg, meta) {
    if (this._disposed) return;
    const { senderId, payload } = this._unwrap(msg, meta);
    if (this._isSelf(senderId) || !payload || typeof payload !== 'object') return; // own echo: ignored
    const x = Number(payload.x);
    const y = Number(payload.y);
    const z = Number(payload.z);
    const yaw = Number(payload.yaw);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(yaw)) return;
    const id = String(senderId);
    const now = this._now();
    // Samples are stamped at LOCAL receive time: sender clock offsets are not
    // synchronized until Phase 8, and BUFFER_MS absorbs arrival jitter.
    this._interp.onSample(id, now, { x, y, z, yaw });
    const remote = this._ensureRemote(id, payload.name);
    if (!remote) return;
    remote.lastSampleAt = now;
    if (typeof payload.state === 'string') remote.lastState = payload.state;
    if (typeof payload.name === 'string' && payload.name && payload.name !== remote.lastName) {
      this._setRemoteName(remote, payload.name);
    }
  }

  _onRemoteFlashlight(msg, meta) {
    if (this._disposed) return;
    const { senderId, payload } = this._unwrap(msg, meta);
    if (this._isSelf(senderId)) return;
    const remote = this._remotes.get(String(senderId));
    if (!remote || !payload || typeof payload !== 'object') return;
    remote.flashlightOn = Boolean(payload.on);
    if (remote.spotlight) remote.spotlight.visible = remote.flashlightOn;
  }

  // --------------------------------------------------------------------------
  // Remote avatars (THREE touched ONLY below this line, lazily)
  // --------------------------------------------------------------------------

  _ensureRemote(id, name) {
    let remote = this._remotes.get(id);
    if (remote) return remote;
    if (this._remotes.size >= MAX_REMOTE_PLAYERS) return null; // 4-slot cap: 3 remotes max
    remote = this._createAvatar(id, typeof name === 'string' ? name : null);
    if (!remote) return null;
    this._remotes.set(id, remote);
    return remote;
  }

  _createAvatar(id, name) {
    const THREE = globalThis.THREE;
    if (!THREE || !this.scene) return null; // No renderer (Node/tooling): interpolation-only mode

    const geometries = [];
    const materials = [];
    const track = (geo, mat) => {
      geometries.push(geo);
      materials.push(mat);
      return new THREE.Mesh(geo, mat);
    };

    const group = new THREE.Group(); // world position + yaw
    const body = new THREE.Group(); // crouch squash scale (sprite excluded)
    group.add(body);

    // Muted 1980s palette, MeshLambert = cheapest lit material in r128.
    const matTorso = new THREE.MeshLambertMaterial({ color: 0x54503c });
    const matLimbs = new THREE.MeshLambertMaterial({ color: 0x3a362c });
    const matArms = new THREE.MeshLambertMaterial({ color: 0x474434 });
    const matHead = new THREE.MeshLambertMaterial({ color: 0x9c7f66 });
    const matHair = new THREE.MeshLambertMaterial({ color: 0x23231f });

    // Legs: pivot at the hip so swing rotates naturally.
    const legGeo = new THREE.BoxGeometry(0.13, 0.6, 0.15);
    legGeo.translate(0, -0.3, 0);
    const leftLeg = track(legGeo, matLimbs);
    leftLeg.position.set(-0.1, 0.6, 0);
    const rightLeg = track(legGeo.clone(), matLimbs);
    rightLeg.position.set(0.1, 0.6, 0);
    body.add(leftLeg, rightLeg);

    // Torso
    const torso = track(new THREE.BoxGeometry(0.44, 0.55, 0.24), matTorso);
    torso.position.set(0, 0.88, 0);
    body.add(torso);

    // Arms: pivot at the shoulder.
    const armGeo = new THREE.BoxGeometry(0.09, 0.5, 0.12);
    armGeo.translate(0, -0.25, 0);
    const leftArm = track(armGeo, matArms);
    leftArm.position.set(-0.28, 1.12, 0);
    const rightArm = track(armGeo.clone(), matArms);
    rightArm.position.set(0.28, 1.12, 0);
    body.add(leftArm, rightArm);

    // Head + hair cap
    const head = track(new THREE.BoxGeometry(0.24, 0.26, 0.22), matHead);
    head.position.set(0, 1.36, 0);
    const hair = track(new THREE.BoxGeometry(0.26, 0.09, 0.24), matHair);
    hair.position.set(0, 1.51, 0);
    body.add(head, hair);

    // Handheld flashlight prop (face is local -Z, matching camera convention)
    const prop = track(new THREE.BoxGeometry(0.06, 0.06, 0.18), matHair);
    prop.position.set(0.14, 1.18, -0.16);
    body.add(prop);

    // Remote flashlight: spotlight toggled by player:flashlight (default off).
    const F = CONFIG.FLASHLIGHT;
    const spotlight = new THREE.SpotLight(F.COLOR, 3.5, 25, Math.PI / 3, 0.8, 1.0);
    spotlight.position.set(0, 1.4, -0.1);
    spotlight.visible = false;
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 1.2, -4);
    spotlight.target = spotTarget;
    body.add(spotlight, spotTarget);

    // Floating amber name tag (canvas sprite, redrawn in place on rename).
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
    sprite.scale.set(1.6, 0.4, 1);
    sprite.position.set(0, 2.0, 0);
    group.add(sprite);

    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const texture = canvas ? new THREE.CanvasTexture(canvas) : null;
    if (texture) {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      sprite.material.map = texture;
    }
    const remote = {
      id,
      group,
      body,
      parts: { leftLeg, rightLeg, leftArm, rightArm },
      spotlight,
      sprite,
      canvas,
      texture,
      geometries,
      materials,
      lastName: '',
      lastState: 'idle',
      lastSampleAt: this._now(),
      lastPos: { x: 0, z: 0 },
      bobPhase: 0,
      swingAmp: 0,
      flashlightOn: false,
    };
    this._setRemoteName(remote, name || 'PLAYER');
    this.scene.add(group);
    return remote;
  }

  _setRemoteName(remote, name) {
    remote.lastName = String(name).slice(0, 24);
    if (!remote.canvas) return;
    const ctx = remote.canvas.getContext('2d');
    if (!ctx) return;
    remote.canvas.width = 256;
    remote.canvas.height = 64;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(10, 10, 8, 0.65)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = 'rgba(255, 176, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 62);
    ctx.font = NAME_FONT;
    ctx.fillStyle = NAME_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(remote.lastName, 128, 34);
    if (remote.texture) remote.texture.needsUpdate = true;
  }

  /**
   * Per-frame visual update: applies the BUFFER_MS-delayed interpolated
   * transform (position + shortest-arc yaw, already blended by the buffer)
   * to every remote avatar, with walk bob derived from interpolated velocity.
   *
   * @param {number} [delta=1/60] frame delta in seconds.
   */
  update(delta = 1 / 60) {
    if (this._disposed || this._remotes.size === 0) return;
    const now = this._now();
    const states = this._interp.interpolate(now);
    const dt = Math.max(delta, 1e-4);
    for (const [id, s] of states) {
      const r = this._remotes.get(id);
      if (!r) continue;
      if (now - r.lastSampleAt > REMOTE_TIMEOUT_MS) {
        r.group.visible = false;
        continue;
      }
      r.group.visible = true;

      // Horizontal speed from the applied interpolated motion -> bob cadence.
      const dx = s.x - r.lastPos.x;
      const dz = s.z - r.lastPos.z;
      r.lastPos.x = s.x;
      r.lastPos.z = s.z;
      const speed = Math.hypot(dx, dz) / dt;
      const moving = speed > 0.25;
      const sprint = r.lastState === 'sprint' || speed > 3.4;
      if (moving) r.bobPhase += dt * (sprint ? 11 : 7);
      const targetAmp = moving ? (sprint ? 0.8 : 0.55) : 0;
      r.swingAmp += (targetAmp - r.swingAmp) * Math.min(1, dt * 8);

      // Avatar root at ground level; sample y is the sender's eye height.
      const bobY = Math.abs(Math.sin(r.bobPhase)) * 0.04 * (r.swingAmp / 0.55);
      r.group.position.set(s.x, s.y - CONFIG.PLAYER.EYE_HEIGHT_STAND + bobY, s.z);
      r.group.rotation.y = s.yaw; // shortest-arc blended by SnapshotBuffer

      const swing = Math.sin(r.bobPhase) * r.swingAmp;
      r.parts.leftLeg.rotation.x = swing;
      r.parts.rightLeg.rotation.x = -swing;
      r.parts.leftArm.rotation.x = -swing * 0.8;
      r.parts.rightArm.rotation.x = swing * 0.8;

      const crouchScale = r.lastState === 'crouch' ? 0.68 : 1;
      r.body.scale.y += (crouchScale - r.body.scale.y) * Math.min(1, dt * 6);

      if (r.spotlight) r.spotlight.visible = r.flashlightOn;
    }
  }

  /** Ids of the remotes currently tracked (for HUD/debug). */
  getRemoteIds() {
    return [...this._remotes.keys()];
  }

  /** { id, name, connected }[] for every tracked remote, for a HUD player list. `connected`
   *  is false once a remote's samples have gone stale past REMOTE_TIMEOUT_MS (see update()). */
  getRemotePlayers() {
    const now = this._now();
    return [...this._remotes.values()].map((r) => ({
      id: r.id,
      name: r.lastName || 'PLAYER',
      connected: now - r.lastSampleAt <= REMOTE_TIMEOUT_MS,
    }));
  }

  getRemoteCount() {
    return this._remotes.size;
  }

  /** Underlying interpolation stats (see NetworkInterpolation.getStats). */
  getStats(nowMs = null) {
    return this._interp.getStats(nowMs);
  }

  _removeRemote(id) {
    const r = this._remotes.get(id);
    if (!r) return;
    if (this.scene && r.group) this.scene.remove(r.group);
    for (const g of r.geometries) g.dispose();
    for (const m of r.materials) m.dispose();
    if (r.texture) r.texture.dispose();
    if (r.sprite && r.sprite.material) r.sprite.material.dispose();
    this._remotes.delete(id);
    this._interp.removeEntity(id);
  }

  /**
   * Full teardown: stop sending, remove all remote meshes, dispose every
   * geometry/material/texture, unsubscribe transport handlers. Idempotent.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.stopSending();
    for (const id of [...this._remotes.keys()]) this._removeRemote(id);
    this._interp.clear();
    if (this.transport && typeof this.transport.offMessage === 'function') {
      for (const { type, fn } of this._boundHandlers) this.transport.offMessage(type, fn);
    }
    this._boundHandlers.length = 0;
    this.localPlayer = null;
  }
}
