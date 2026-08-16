/**
 * 1980s First-Person Player Controller, Flashlight & Survival Systems
 */

import { CONFIG } from '../config.js';

export class Player {
  constructor(camera, scene, audioManager, levelBuilder) {
    this.camera = camera;
    this.scene = scene;
    this.audioManager = audioManager;
    this.levelBuilder = levelBuilder;

    // Position & Orientation
    this.position = new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT_STAND, 20.0); // Start in facility lab
    this.rotation = new THREE.Euler(0, Math.PI, 0, 'YXZ'); // Look toward anomaly (-Z)
    this.camera.position.copy(this.position);
    this.camera.rotation.copy(this.rotation);

    // Physics
    this.velocity = new THREE.Vector3();
    this.playerRadius = 0.35;
    this.isCrouching = false;
    this.isSprinting = false;

    // Vitals
    this.health = CONFIG.PLAYER.MAX_HEALTH;
    this.maxHealth = CONFIG.PLAYER.MAX_HEALTH;
    this.stamina = CONFIG.PLAYER.MAX_STAMINA;
    this.sanity = CONFIG.PLAYER.MAX_SANITY;
    this.batteryLevel = CONFIG.FLASHLIGHT.MAX_BATTERY;
    this.isFlashlightOn = false;

    // Survival Mode: when true, permadeath applies (no emergency revival on handleDeath()).
    // Set by main.js when Survival Mode launches; SurvivalState composes with this player.
    this.isSurvivalMode = false;

    // Flashlight SpotLight (Attached to camera)
    this.flashlight = new THREE.SpotLight(
      CONFIG.FLASHLIGHT.COLOR,
      CONFIG.FLASHLIGHT.INTENSITY,
      CONFIG.FLASHLIGHT.DISTANCE,
      CONFIG.FLASHLIGHT.ANGLE,
      CONFIG.FLASHLIGHT.PENUMBRA,
      0.0 // Uniform linear illumination
    );
    this.flashlight.position.set(0.18, -0.15, 0.0);
    this.flashlight.visible = false;
    this.camera.add(this.flashlight);

    // Flashlight target locked forward in camera coordinate frame
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -10);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    // Forward broad fill light (illuminates entire room/corridor seamlessly)
    this.fillLight = new THREE.PointLight(CONFIG.FLASHLIGHT.COLOR, 1.5, 30.0, 1.0);
    this.fillLight.position.set(0.0, 0.0, -1.0);
    this.fillLight.visible = false;
    this.camera.add(this.fillLight);

    // 3D First-Person Flashlight & Held Items
    this.flashlightModel = this.createFirstPersonFlashlightModel();
    this.initHeldItemModels();

    // Head bobbing & footstep timer
    this.bobTimer = 0;
    this.footstepTimer = 0;
    this.stepCount = 0; // Steps taken since entering the anomaly
    this.hasCrossedPortal = false;

    // Fixed-timestep bookkeeping
    this._lastIsMoving = false;
    this._raycastFrame = 0;

    // Interactive targeting
    this.raycaster = new THREE.Raycaster();
    this.focusedInteractive = null;

    // Scratch objects reused every frame in update()/handleCollision()/updateInteractionRaycast()
    // to avoid per-frame allocation churn in the player's hot path.
    this._scratchMoveDir = new THREE.Vector3();
    this._scratchUpAxis = new THREE.Vector3(0, 1, 0);
    this._scratchNextPos = new THREE.Vector3();
    this._scratchVelocityStep = new THREE.Vector3();
    this._scratchBoxXMin = new THREE.Vector3();
    this._scratchBoxXMax = new THREE.Vector3();
    this._scratchBoxZMin = new THREE.Vector3();
    this._scratchBoxZMax = new THREE.Vector3();
    this._scratchBoxX = new THREE.Box3(this._scratchBoxXMin, this._scratchBoxXMax);
    this._scratchBoxZ = new THREE.Box3(this._scratchBoxZMin, this._scratchBoxZMax);
    this._scratchScreenCenter = new THREE.Vector2(0, 0);

    // Cache of levelBuilder.interactiveObjects mapped to meshes; rebuilt when the source
    // array's identity or version changes (adds/removes during chunk load/unload and item
    // pickup). The version counter catches remove+add pairs that keep the length identical,
    // which a pure length check would miss.
    this._cachedInteractiveObjectsRef = null;
    this._cachedInteractiveVersion = -1;
    this._cachedInteractiveMeshes = [];
  }

  createFirstPersonFlashlightModel() {
    const group = new THREE.Group();
    // Position held model safely within player's 0.35m collision radius to prevent wall penetration
    this.flashlightBasePos = new THREE.Vector3(0.18, -0.16, -0.26);
    group.position.copy(this.flashlightBasePos);
    group.rotation.set(0.06, -0.04, 0.05);
    group.renderOrder = 9999;

    // 1. Flashlight Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 16);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshPhongMaterial({ color: 0x3d443a, shininess: 30, specular: 0x222222, depthTest: true });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.z = 0.06;
    barrel.renderOrder = 9999;
    group.add(barrel);

    // 2. Grip Ribs
    const ringGeo = new THREE.TorusGeometry(0.023, 0.0025, 8, 16);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0x1f221e, depthTest: true });
    [-0.03, 0.0, 0.03].forEach(zOffset => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.z = 0.06 + zOffset;
      ring.renderOrder = 9999;
      group.add(ring);
    });

    // 3. Flashlight Head / Bezel
    const headGeo = new THREE.CylinderGeometry(0.038, 0.024, 0.07, 16);
    headGeo.rotateX(Math.PI / 2);
    const headMat = new THREE.MeshPhongMaterial({ color: 0x282c26, shininess: 40, specular: 0x444444, depthTest: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.z = -0.05;
    head.renderOrder = 9999;
    group.add(head);

    // 4. Front Metallic Rim
    const rimGeo = new THREE.TorusGeometry(0.037, 0.0035, 8, 16);
    const rimMat = new THREE.MeshPhongMaterial({ color: 0x889484, shininess: 80, depthTest: true });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = -0.085;
    rim.renderOrder = 9999;
    group.add(rim);

    // 5. Emissive Front Lens / Bulb
    const lensGeo = new THREE.CircleGeometry(0.034, 16);
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffeed8, depthTest: true });
    const lens = new THREE.Mesh(lensGeo, this.lensMat);
    lens.position.z = -0.086;
    lens.rotation.y = Math.PI;
    lens.renderOrder = 9999;
    group.add(lens);

    // 6. Switch on top
    const switchGeo = new THREE.BoxGeometry(0.012, 0.008, 0.03);
    const switchMat = new THREE.MeshPhongMaterial({ color: 0xaa2211, depthTest: true });
    const switchMesh = new THREE.Mesh(switchGeo, switchMat);
    switchMesh.position.set(0, 0.026, 0.05);
    switchMesh.renderOrder = 9999;
    group.add(switchMesh);

    this.camera.add(group);
    return group;
  }

  initHeldItemModels() {
    this.heldItemModels = new Map();
    this.currentHeldItemId = null;

    // 1. Gas Can Held Model (compact, scaled down ~0.16m, lower-right perspective)
    const gasGroup = new THREE.Group();
    gasGroup.position.set(0.19, -0.18, -0.28);
    gasGroup.rotation.set(0.12, -0.2, 0.08);

    const gasBodyGeo = new THREE.BoxGeometry(0.14, 0.18, 0.09);
    const gasBodyMat = new THREE.MeshStandardMaterial({ color: 0xb51a1a, roughness: 0.5, metalness: 0.3 });
    const gasBody = new THREE.Mesh(gasBodyGeo, gasBodyMat);
    gasGroup.add(gasBody);

    const gasHandleGeo = new THREE.BoxGeometry(0.02, 0.04, 0.08);
    const gasHandle = new THREE.Mesh(gasHandleGeo, gasBodyMat);
    gasHandle.position.set(0, 0.11, 0);
    gasGroup.add(gasHandle);

    const gasSpoutGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8);
    const gasSpoutMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
    const gasSpout = new THREE.Mesh(gasSpoutGeo, gasSpoutMat);
    gasSpout.position.set(0.05, 0.11, -0.02);
    gasSpout.rotation.z = -0.4;
    gasGroup.add(gasSpout);

    gasGroup.visible = false;
    this.camera.add(gasGroup);
    this.heldItemModels.set('gas_can', gasGroup);

    // 2. Crowbar Held Model (angled heavy forged steel crowbar with red grip)
    const barGroup = new THREE.Group();
    barGroup.position.set(0.20, -0.17, -0.28);
    barGroup.rotation.set(-0.25, 0.15, -0.35);

    const barShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.3, metalness: 0.85 });
    const barShaft = new THREE.Mesh(barShaftGeo, steelMat);
    barShaft.position.y = 0.08;
    barGroup.add(barShaft);

    const barGripGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.20, 6);
    const redGripMat = new THREE.MeshStandardMaterial({ color: 0xcc2211, roughness: 0.5, metalness: 0.1 });
    const barGrip = new THREE.Mesh(barGripGeo, redGripMat);
    barGrip.position.y = 0.02;
    barGroup.add(barGrip);

    const barHookGeo = new THREE.CylinderGeometry(0.013, 0.01, 0.10, 6);
    const barHook = new THREE.Mesh(barHookGeo, steelMat);
    barHook.position.set(0.04, 0.31, 0);
    barHook.rotation.z = -Math.PI / 3.5;
    barGroup.add(barHook);

    barGroup.visible = false;
    this.camera.add(barGroup);
    this.heldItemModels.set('crow_bar', barGroup);

    // 3. Audio Cassette Tape Held Model
    const tapeGroup = new THREE.Group();
    tapeGroup.position.set(0.16, -0.15, -0.25);
    tapeGroup.rotation.set(0.2, -0.1, 0.05);

    const tapeGeo = new THREE.BoxGeometry(0.12, 0.02, 0.08);
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6 });
    const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
    tapeGroup.add(tapeMesh);

    const labelGeo = new THREE.PlaneGeometry(0.10, 0.06);
    const labelMat = new THREE.MeshBasicMaterial({ color: 0xfdfbe8 });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.011;
    labelMesh.rotation.x = -Math.PI / 2;
    tapeGroup.add(labelMesh);

    tapeGroup.visible = false;
    this.camera.add(tapeGroup);
    this.heldItemModels.set('tape', tapeGroup);

    // 4. Almond Water Bottle
    const waterGroup = new THREE.Group();
    waterGroup.position.set(0.18, -0.16, -0.26);
    waterGroup.rotation.set(0.1, -0.1, 0.05);

    const botGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.14, 12);
    const botMat = new THREE.MeshStandardMaterial({ color: 0x99bb99, roughness: 0.2, transparent: true, opacity: 0.7 });
    const bot = new THREE.Mesh(botGeo, botMat);
    waterGroup.add(bot);

    waterGroup.visible = false;
    this.camera.add(waterGroup);
    this.heldItemModels.set('almond_water', waterGroup);

    // 5. Battery
    const batGroup = new THREE.Group();
    batGroup.position.set(0.17, -0.16, -0.25);
    batGroup.rotation.set(0.1, -0.1, 0.05);

    const batGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.08, 12);
    const batMat = new THREE.MeshStandardMaterial({ color: 0xddaa22, roughness: 0.4, metalness: 0.6 });
    const bat = new THREE.Mesh(batGeo, batMat);
    batGroup.add(bat);

    batGroup.visible = false;
    this.camera.add(batGroup);
    this.heldItemModels.set('battery', batGroup);

    // 6. Medkit
    const medGroup = new THREE.Group();
    medGroup.position.set(0.18, -0.16, -0.26);
    medGroup.rotation.set(0.1, -0.1, 0.05);

    const medGeo = new THREE.BoxGeometry(0.11, 0.09, 0.05);
    const medMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7 });
    const med = new THREE.Mesh(medGeo, medMat);
    medGroup.add(med);

    medGroup.visible = false;
    this.camera.add(medGroup);
    this.heldItemModels.set('medkit', medGroup);

    // 7. Level 5 Security Keycard
    const cardGroup = new THREE.Group();
    cardGroup.position.set(0.17, -0.15, -0.25);
    cardGroup.rotation.set(-0.15, -0.2, 0.08);

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.075, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xd8e5df, roughness: 0.35, metalness: 0.05 })
    );
    cardGroup.add(card);

    const cardStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.018),
      new THREE.MeshBasicMaterial({ color: 0x1b3340 })
    );
    cardStripe.position.set(0, 0.018, 0.0035);
    cardGroup.add(cardStripe);

    cardGroup.visible = false;
    this.camera.add(cardGroup);
    this.heldItemModels.set('security_keycard', cardGroup);
  }

  setHeldItem(itemId) {
    this.currentHeldItemId = itemId;

    // Hide all custom held models first
    this.heldItemModels.forEach(m => { m.visible = false; });

    if (!itemId) {
      // Empty hand / flashlight only
      if (this.flashlightModel) this.flashlightModel.visible = true;
      return;
    }

    let modelKey = itemId;
    if (itemId.includes('tape') || itemId.includes('mercer') || itemId.includes('cole')) {
      modelKey = 'tape';
    }

    const heldModel = this.heldItemModels.get(modelKey);
    if (heldModel) {
      heldModel.visible = true;
      // When holding large items (like crowbar or gas can), flashlight remains attached to shoulder
      if (this.flashlightModel) {
        this.flashlightModel.visible = (modelKey === 'battery' || modelKey === 'tape');
      }
    } else {
      if (this.flashlightModel) this.flashlightModel.visible = true;
    }
  }

  toggleFlashlight() {
    if (this.batteryLevel <= 0) {
      this.isFlashlightOn = false;
      this.flashlight.visible = false;
      if (this.fillLight) this.fillLight.visible = false;
      if (this.lensMat) this.lensMat.color.setHex(0x222222);
      if (this.audioManager) {
        this.audioManager.playUI('click');
      }
      return;
    }
    this.isFlashlightOn = !this.isFlashlightOn;
    const isLit = this.isFlashlightOn && this.batteryLevel > 0;
    this.flashlight.visible = isLit;
    if (this.fillLight) this.fillLight.visible = isLit;
    if (this.lensMat) this.lensMat.color.setHex(isLit ? 0xffeed8 : 0x222222);
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  reloadBattery() {
    this.batteryLevel = CONFIG.FLASHLIGHT.MAX_BATTERY;
    this.flashlight.intensity = CONFIG.FLASHLIGHT.INTENSITY;
    if (this.fillLight) this.fillLight.intensity = 0.7;
    if (this.lensMat) this.lensMat.color.setHex(this.isFlashlightOn ? 0xffeed8 : 0x222222);
    if (this.audioManager) {
      this.audioManager.playUI('battery');
    }
  }

  // Per-frame visual/input update: mouse & arrow-key look (zero added latency -- raw
  // deltas consumed exactly once per rendered frame), interaction raycast (throttled),
  // and the held-flashlight hand sway. All movement/vitals simulation lives in
  // physicsStep(), driven at a fixed rate by the game loop's accumulator.
  updateLook(delta, input) {
    // 1. Mouse & Arrow Keys Look
    const mouse = input.consumeMouseDelta();
    let lookYaw = mouse.x * input.mouseSensitivity;
    let lookPitch = mouse.y * input.mouseSensitivity;

    // Smooth arrow key looking
    const arrowLookSpeed = 2.2;
    if (input.keys.lookLeft) lookYaw -= arrowLookSpeed * delta;
    if (input.keys.lookRight) lookYaw += arrowLookSpeed * delta;
    if (input.keys.lookUp) lookPitch -= arrowLookSpeed * delta;
    if (input.keys.lookDown) lookPitch += arrowLookSpeed * delta;

    this.rotation.y -= lookYaw;
    this.rotation.x -= lookPitch;
    this.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotation.x));
    this.camera.rotation.copy(this.rotation);

    // 2. Interaction focus raycast, every 3rd frame (~20Hz at 60fps) -- imperceptible
    // at the 3.2m pickup range but skips a recursive raycast against every interactive
    // mesh in the streamed area on 2 of every 3 frames.
    this._raycastFrame = (this._raycastFrame + 1) % CONFIG.PERF.RAYCAST_EVERY_N_FRAMES;
    if (this._raycastFrame === 0) {
      this.updateInteractionRaycast();
    }

    // 3. Dynamic first-person flashlight hand sway (visual only)
    if (this.flashlightModel) {
      const isMoving = this._lastIsMoving;
      const swayX = Math.cos(this.bobTimer * 0.5) * (isMoving ? 0.008 : 0.001);
      const swayY = Math.sin(this.bobTimer) * (isMoving ? 0.012 : 0.002);
      this.flashlightModel.position.set(
        this.flashlightBasePos.x + swayX,
        this.flashlightBasePos.y + swayY,
        this.flashlightBasePos.z
      );
    }
  }

  // Fixed-timestep simulation step (h = 1/120s by default). Identical movement,
  // footstep cadence and vitals behaviour at any display frame rate -- no more
  // frame-rate-dependent glide or collision tunneling on slow frames.
  physicsStep(h, input) {
    // 1. Movement & Speed determination
    this.isCrouching = input.keys.crouch;
    this.isSprinting = input.keys.sprint && !this.isCrouching && this.stamina > 5;

    let targetSpeed = CONFIG.PLAYER.WALK_SPEED;
    if (this.isCrouching) targetSpeed = CONFIG.PLAYER.CROUCH_SPEED;
    else if (this.isSprinting) targetSpeed = CONFIG.PLAYER.SPRINT_SPEED;

    // Stamina depletion / recovery
    if (this.isSprinting && (input.keys.forward || input.keys.backward || input.keys.left || input.keys.right)) {
      this.stamina = Math.max(0, this.stamina - CONFIG.PLAYER.STAMINA_DRAIN_SPRINT * h);
    } else {
      this.stamina = Math.min(CONFIG.PLAYER.MAX_STAMINA, this.stamina + CONFIG.PLAYER.STAMINA_RECOVERY * h);
    }

    // Thresholds (40 sanity, 70 stamina) keep passive regen from masking real danger -- it only
    // kicks in once the player is genuinely composed and rested, not merely between fear spikes.
    if (this.health < this.maxHealth && this.sanity > 40 && this.stamina > 70 && !this.isSprinting) {
      this.health = Math.min(this.maxHealth, this.health + CONFIG.PLAYER.HEALTH_RECOVERY * h);
    }

    // Direction calculation relative to camera yaw
    const moveDir = this._scratchMoveDir.set(0, 0, 0);
    if (input.keys.forward) moveDir.z -= 1;
    if (input.keys.backward) moveDir.z += 1;
    if (input.keys.left) moveDir.x -= 1;
    if (input.keys.right) moveDir.x += 1;
    moveDir.normalize();
    moveDir.applyAxisAngle(this._scratchUpAxis, this.rotation.y);

    const isMoving = moveDir.lengthSq() > 0.01;
    this._lastIsMoving = isMoving;

    // Acceleration & exponential friction (frame-rate independent: v *= e^(-DEC*h),
    // vs the old linear v -= v*DEC*dt which decayed differently at low fps)
    if (isMoving) {
      this.velocity.x += moveDir.x * targetSpeed * CONFIG.PLAYER.ACCELERATION * h;
      this.velocity.z += moveDir.z * targetSpeed * CONFIG.PLAYER.ACCELERATION * h;
    }
    const friction = Math.exp(-CONFIG.PLAYER.DECELERATION * h);
    this.velocity.x *= friction;
    this.velocity.z *= friction;

    // 2. Collision handling
    const nextPos = this._scratchNextPos.copy(this.position).add(
      this._scratchVelocityStep.copy(this.velocity).multiplyScalar(h)
    );
    this.handleCollision(nextPos);

    // 3. Surface detection & Footstep audio
    if (isMoving) {
      this.bobTimer += h * (this.isSprinting ? 12 : 7.5);
      this.footstepTimer += h;

      const stepInterval = this.isSprinting ? 0.32 : (this.isCrouching ? 0.65 : 0.48);
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        const currentSurface = this.detectCurrentSurface();
        this.audioManager.playFootstep(currentSurface, true, this.isSprinting ? 1.2 : 0.8);

        // Check if player has stepped through the portal into the Backrooms
        if (this.position.z <= 12.0) {
          this.hasCrossedPortal = true;
          this.stepCount++;
        }
      }
    } else {
      if (this.audioManager.isPlayerMoving) {
        this.audioManager.notifyPlayerStopped();
      }
      this.bobTimer = 0;
    }

    // 4. Head Bobbing & camera follow (120Hz -- smoother than the display rate)
    const eyeHeight = this.isCrouching ? CONFIG.PLAYER.EYE_HEIGHT_CROUCH : CONFIG.PLAYER.EYE_HEIGHT_STAND;
    const bobOffset = isMoving ? Math.sin(this.bobTimer) * CONFIG.PLAYER.BOB_AMPLITUDE : 0;
    this.camera.position.set(this.position.x, eyeHeight + bobOffset, this.position.z);

    // 5. Flashlight follow & Battery drain
    if (this.isFlashlightOn && this.batteryLevel > 0) {
      this.batteryLevel = Math.max(0, this.batteryLevel - CONFIG.FLASHLIGHT.DRAIN_RATE * h);

      // Low battery flicker & dim
      if (this.batteryLevel < CONFIG.FLASHLIGHT.LOW_BATTERY_THRESHOLD) {
        const flicker = Math.random() > 0.85 ? 0.2 : 0.85;
        const factor = (this.batteryLevel / CONFIG.FLASHLIGHT.LOW_BATTERY_THRESHOLD) * flicker;
        this.flashlight.intensity = CONFIG.FLASHLIGHT.INTENSITY * factor;
        if (this.fillLight) this.fillLight.intensity = 1.5 * factor;
      } else {
        this.flashlight.intensity = CONFIG.FLASHLIGHT.INTENSITY;
        if (this.fillLight) this.fillLight.intensity = 1.5;
      }

      this.flashlight.visible = true;
      if (this.fillLight) this.fillLight.visible = true;
    } else {
      this.flashlight.visible = false;
      if (this.fillLight) this.fillLight.visible = false;
      // Darkness drains sanity
      this.sanity = Math.max(0, this.sanity - CONFIG.PLAYER.SANITY_DRAIN_DARKNESS * h);
    }
  }

  detectCurrentSurface() {
    if (this.levelBuilder && this.levelBuilder.currentLevel === 2) {
      return 'tile'; // Sharp echoing concrete footstep sound
    }

    // Check if player is within any flooded zone bounding area
    const pX = this.position.x;
    const pZ = this.position.z;

    for (let zone of this.levelBuilder.floodedZones) {
      if (pX >= zone.minX && pX <= zone.maxX && pZ >= zone.minZ && pZ <= zone.maxZ) {
        return 'wet_carpet';
      }
    }

    if (pZ > 12.0) return 'tile'; // Inside research facility lab
    return 'carpet';
  }

  handleCollision(nextPos) {
    const nearbyColliders = this.levelBuilder.getNearbyColliders ? this.levelBuilder.getNearbyColliders(this.position) : this.levelBuilder.colliders;

    const playerBox = this._scratchBoxX;
    this._scratchBoxXMin.set(nextPos.x - this.playerRadius, 0.1, this.position.z - this.playerRadius);
    this._scratchBoxXMax.set(nextPos.x + this.playerRadius, 2.5, this.position.z + this.playerRadius);

    let collideX = false;
    for (let i = 0; i < nearbyColliders.length; i++) {
      if (playerBox.intersectsBox(nearbyColliders[i])) {
        collideX = true;
        break;
      }
    }
    if (!collideX) this.position.x = nextPos.x;

    const playerBoxZ = this._scratchBoxZ;
    this._scratchBoxZMin.set(this.position.x - this.playerRadius, 0.1, nextPos.z - this.playerRadius);
    this._scratchBoxZMax.set(this.position.x + this.playerRadius, 2.5, nextPos.z + this.playerRadius);

    let collideZ = false;
    for (let i = 0; i < nearbyColliders.length; i++) {
      if (playerBoxZ.intersectsBox(nearbyColliders[i])) {
        collideZ = true;
        break;
      }
    }
    if (!collideZ) this.position.z = nextPos.z;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.handleDeath();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  handleDeath() {
    if (this.isSurvivalMode) {
      // Permadeath: no emergency adrenaline resuscitation in Survival Mode.
      if (this.audioManager) {
        this.audioManager.triggerBlackoutAudio();
      }
      return;
    }
    this.health = 35; // Emergency adrenaline resuscitation
    this.sanity = Math.max(25, this.sanity);
    if (this.audioManager) {
      this.audioManager.triggerBlackoutAudio();
    }
  }

  updateInteractionRaycast() {
    this.raycaster.setFromCamera(this._scratchScreenCenter, this.camera);
    this.raycaster.far = 3.2;

    // Only remap interactiveObjects -> meshes when the source array's identity or version
    // has changed (LevelBuilder adds/removes entries on chunk load/unload and pickups)
    // rather than every frame.
    const interactiveObjects = this.levelBuilder.interactiveObjects;
    const version = this.levelBuilder.interactiveVersion || 0;
    if (interactiveObjects !== this._cachedInteractiveObjectsRef || version !== this._cachedInteractiveVersion) {
      this._cachedInteractiveMeshes = interactiveObjects.map(o => o.mesh);
      this._cachedInteractiveObjectsRef = interactiveObjects;
      this._cachedInteractiveVersion = version;
    }
    const meshes = this._cachedInteractiveMeshes;
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let hitMesh = intersects[0].object;
      let found = null;
      let depth = 0;
      while (hitMesh && !found && depth < 10) {
        found = this.levelBuilder.interactiveObjects.find(o => o.mesh === hitMesh);
        hitMesh = hitMesh.parent;
        depth++;
      }
      this.focusedInteractive = found || null;
    } else {
      this.focusedInteractive = null;
    }
  }
}
