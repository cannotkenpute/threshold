/**
 * 1980s Escape Cutscene & Night Highway System
 * Handles engine start, garage exit acceleration, 10-hour time-lapse, and highway drive.
 */

import { GAME_MODES } from '../core/StateManager.js';

export class EscapeCutscene {
  constructor(renderer, audio, state, hud, dialogue, player, input, levelBuilder) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.camera = renderer.camera;
    this.audio = audio;
    this.state = state;
    this.hud = hud;
    this.dialogue = dialogue;
    this.player = player;
    this.input = input;
    this.levelBuilder = levelBuilder;

    this.isActive = false;
    this.phase = 'idle'; // 'ignition', 'garage_drive', 'timelapse', 'exit_ramp', 'highway'
    this.elapsed = 0;
    this.phaseElapsed = 0;

    // Cutscene 3D Objects
    this.cutsceneGroup = new THREE.Group();
    this.highwayGroup = new THREE.Group();
    this.carGroup = this.createCutsceneCar();
    this.headlights = [];
    this.roadSegments = [];

    // Driving physics simulation
    this.carPos = new THREE.Vector3(4.5, 0, -2.5);
    this.speed = 0;
    this.targetSpeed = 0;
    this.traveledDistance = 0;

    this.initCutsceneOverlay();
  }

  createCutsceneCar() {
    const group = new THREE.Group();

    // Chassis / Lower body
    const bodyGeo = new THREE.BoxGeometry(1.9, 0.65, 4.4);
    const paintMat = new THREE.MeshStandardMaterial({ color: 0x551122, roughness: 0.35, metalness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    // Cabin / Roof & Windshield
    const cabinGeo = new THREE.BoxGeometry(1.7, 0.6, 2.2);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111618, roughness: 0.1, metalness: 0.9 });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.05, 0.2);
    group.add(cabin);

    // Chrome Bumper Front
    const bumperGeo = new THREE.BoxGeometry(1.95, 0.18, 0.15);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 });
    const bumperF = new THREE.Mesh(bumperGeo, chromeMat);
    bumperF.position.set(0, 0.35, -2.25);
    group.add(bumperF);

    // Hood surface marker / emblem
    const emblemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8);
    const emblem = new THREE.Mesh(emblemGeo, chromeMat);
    emblem.position.set(0, 0.9, -1.9);
    group.add(emblem);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

    [
      [-0.95, 0.32, -1.3],
      [0.95, 0.32, -1.3],
      [-0.95, 0.32, 1.3],
      [0.95, 0.32, 1.3]
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });

    // Dual Glowing Headlight lenses
    const lensGeo = new THREE.CircleGeometry(0.12, 12);
    const lightLensMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const leftLens = new THREE.Mesh(lensGeo, lightLensMat);
    leftLens.position.set(-0.65, 0.65, -2.21);
    leftLens.rotation.y = Math.PI;
    const rightLens = new THREE.Mesh(lensGeo, lightLensMat);
    rightLens.position.set(0.65, 0.65, -2.21);
    rightLens.rotation.y = Math.PI;
    group.add(leftLens, rightLens);

    return group;
  }

  initCutsceneOverlay() {
    let overlay = document.getElementById('cutscene-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cutscene-overlay';
      overlay.className = 'cutscene-overlay';
      overlay.innerHTML = `
        <div class="cutscene-vignette"></div>
        <div class="cutscene-scanlines"></div>
        <div id="cutscene-card" class="cutscene-card">
          <div id="cutscene-card-tag" class="card-tag">STATUS REPORT // DTE-04</div>
          <div id="cutscene-card-main" class="card-main">10 HOURS LATER...</div>
          <div id="cutscene-card-sub" class="card-sub">ODOMETER: 384.2 MILES // NON-EUCLIDEAN CORRIDOR EXHAUSTED</div>
        </div>
        <div id="cutscene-hud" class="cutscene-hud">
          <div class="hud-speedometer">SPEED: <span id="cutscene-speed-val">0</span> MPH</div>
          <div class="hud-time">ELAPSED: <span id="cutscene-time-val">00:00:00</span></div>
          <div class="hud-skip">[SPACE] SKIP CINEMATIC</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.overlay = overlay;
    this.card = document.getElementById('cutscene-card');
    this.cardTag = document.getElementById('cutscene-card-tag');
    this.cardMain = document.getElementById('cutscene-card-main');
    this.cardSub = document.getElementById('cutscene-card-sub');
    this.speedVal = document.getElementById('cutscene-speed-val');
    this.timeVal = document.getElementById('cutscene-time-val');

    // Allow skip with space or escape
    window.addEventListener('keydown', (e) => {
      if (this.isActive && (e.code === 'Space' || e.code === 'Escape')) {
        this.finish();
      }
    });
  }

  start() {
    this.isActive = true;
    this.elapsed = 0;
    this.phaseElapsed = 0;
    this.phase = 'ignition';
    this.speed = 0;
    this.targetSpeed = 0;
    this.traveledDistance = 0;

    // Position moving car in garage at spawn car location
    this.carPos.set(4.5, 0, -2.5);
    if (this.carGroup) {
      this.carGroup.position.copy(this.carPos);
      this.scene.add(this.carGroup);
    }

    // Show cutscene UI overlay
    if (this.overlay) {
      this.overlay.classList.add('active');
    }
    if (this.card) {
      this.card.classList.remove('visible');
    }

    // Play car engine start sound
    if (this.audio && this.audio.carStartBuffer) {
      this.audio.playBuffer(this.audio.carStartBuffer, 'ENVIRONMENT', 1.0);
    } else if (this.audio) {
      this.audio.playUI('tape');
    }

    // Build the Highway 3D environment in parallel
    this.buildHighwayScene();
  }

  buildHighwayScene() {
    // Clean up previous highway scene if any
    while (this.highwayGroup.children.length > 0) {
      this.highwayGroup.remove(this.highwayGroup.children[0]);
    }
    this.roadSegments = [];

    // Four-lane freeway material
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const ctx = roadCanvas.getContext('2d');

    // Dark rough asphalt
    ctx.fillStyle = '#141718';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle asphalt noise
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#1f2425' : '#0c0e0f';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // White dashed lane dividers and yellow median borders
    ctx.fillStyle = '#d5dbdc';
    ctx.fillRect(132, 40, 6, 180);
    ctx.fillRect(132, 300, 6, 180);
    ctx.fillRect(375, 40, 6, 180);
    ctx.fillRect(375, 300, 6, 180);
    ctx.fillStyle = '#e6b800';
    ctx.fillRect(239, 0, 6, 512);
    ctx.fillRect(267, 0, 6, 512);

    // White solid side shoulder lines
    ctx.fillStyle = '#cfd6d8';
    ctx.fillRect(20, 0, 8, 512);
    ctx.fillRect(484, 0, 8, 512);

    const roadTex = new THREE.CanvasTexture(roadCanvas);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 8);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.85,
      metalness: 0.1
    });

    // Spawn 10 chained modular highway road slabs
    const segmentLength = 80.0;
    const roadWidth = 24.0;
    const sandMat = new THREE.MeshStandardMaterial({ color: 0x765a36, roughness: 1.0 });

    for (let i = 0; i < 12; i++) {
      const segMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(roadWidth, segmentLength),
        roadMat
      );
      segMesh.rotation.x = -Math.PI / 2;
      segMesh.position.set(0, -0.01, -i * segmentLength);
      segMesh.receiveShadow = true;
      this.highwayGroup.add(segMesh);
      this.roadSegments.push(segMesh);

      const leftDesert = new THREE.Mesh(new THREE.PlaneGeometry(40, segmentLength), sandMat);
      leftDesert.rotation.x = -Math.PI / 2;
      leftDesert.position.set(-32, -0.03, -i * segmentLength);
      const rightDesert = leftDesert.clone();
      rightDesert.position.x = 32;
      this.highwayGroup.add(leftDesert, rightDesert);

      // Guard rails
      const railMat = new THREE.MeshStandardMaterial({ color: 0x4a555a, metalness: 0.8, roughness: 0.4 });
      const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, segmentLength), railMat);
      leftRail.position.set(-roadWidth / 2 - 0.2, 0.4, -i * segmentLength);
      const rightRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, segmentLength), railMat);
      rightRail.position.set(roadWidth / 2 + 0.2, 0.4, -i * segmentLength);
      this.highwayGroup.add(leftRail, rightRail);

      // Roadside Vintage Telegraph / Street Light Poles every segment
      if (i % 2 === 0) {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222622, roughness: 0.9 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 9, 8), poleMat);
        pole.position.set(-roadWidth / 2 - 2.5, 4.5, -i * segmentLength);
        this.highwayGroup.add(pole);

        // Distant desert rock silhouette
        const rockMat = new THREE.MeshBasicMaterial({ color: 0x201911 });
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.4, 0), rockMat);
        rock.scale.set(1.8, 0.7, 1.2);
        rock.position.set(roadWidth / 2 + 10.0 + Math.sin(i) * 3, 1.5, -i * segmentLength);
        this.highwayGroup.add(rock);
      }
    }

    // Distant dark night sky & fog
    this.highwayGroup.position.set(0, 0, -1000); // Placed at a distant coordinate zone
    this.scene.add(this.highwayGroup);

    // Car Cockpit Headlight Beams
    const headlightTargetL = new THREE.Object3D();
    const headlightTargetR = new THREE.Object3D();
    this.scene.add(headlightTargetL);
    this.scene.add(headlightTargetR);

    this.headlightL = new THREE.SpotLight(0xfffae0, 5.0, 65, Math.PI / 6, 0.5, 1.2);
    this.headlightR = new THREE.SpotLight(0xfffae0, 5.0, 65, Math.PI / 6, 0.5, 1.2);
    this.headlightL.target = headlightTargetL;
    this.headlightR.target = headlightTargetR;
    this.headlightTargetL = headlightTargetL;
    this.headlightTargetR = headlightTargetR;

    this.scene.add(this.headlightL);
    this.scene.add(this.headlightR);
  }

  update(delta) {
    if (!this.isActive) return;

    this.elapsed += delta;
    this.phaseElapsed += delta;

    // --- PHASE 1: IGNITION & HOOD VIBRATION (0s - 3.5s) ---
    if (this.phase === 'ignition') {
      const rumble = Math.sin(this.elapsed * 45) * 0.012;
      this.camera.position.set(this.carPos.x, this.carPos.y + 0.95 + rumble, this.carPos.z - 0.7);
      this.camera.lookAt(this.carPos.x, this.carPos.y + 0.85, this.carPos.z - 30);

      // Aim headlights forward
      if (this.headlightL && this.headlightR) {
        this.headlightL.position.set(this.carPos.x - 0.7, 0.65, this.carPos.z - 2.2);
        this.headlightR.position.set(this.carPos.x + 0.7, 0.65, this.carPos.z - 2.2);
        this.headlightTargetL.position.set(this.carPos.x - 0.7, 0.4, this.carPos.z - 35);
        this.headlightTargetR.position.set(this.carPos.x + 0.7, 0.4, this.carPos.z - 35);
      }

      if (this.speedVal) this.speedVal.textContent = '0';
      if (this.timeVal) this.timeVal.textContent = '00:00:02';

      if (this.phaseElapsed > 3.2) {
        this.phase = 'garage_drive';
        this.phaseElapsed = 0;
        this.targetSpeed = 45;
      }
    }

    // --- PHASE 2: GARAGE DRIVING (CAR PHYSICALLY MOVES FORWARD) (3.5s - 9.0s) ---
    else if (this.phase === 'garage_drive') {
      this.speed = THREE.MathUtils.lerp(this.speed, this.targetSpeed, delta * 1.5);
      const distanceMoved = (this.speed * 0.447) * delta;
      this.traveledDistance += distanceMoved;
      this.carPos.z -= distanceMoved;

      if (this.carGroup) {
        this.carGroup.position.copy(this.carPos);
      }

      // Camera mounted on the hood with engine vibration and driving sway
      const vibY = Math.sin(this.elapsed * 32) * 0.015 * (this.speed / 45);
      const swayX = Math.sin(this.elapsed * 1.6) * 0.12;

      this.camera.position.set(this.carPos.x + swayX, this.carPos.y + 0.95 + vibY, this.carPos.z - 0.7);
      this.camera.lookAt(this.carPos.x + swayX * 0.5, this.carPos.y + 0.85, this.carPos.z - 30);

      // Headlights project from moving car bumper
      if (this.headlightL && this.headlightR) {
        this.headlightL.position.set(this.carPos.x - 0.7, 0.65, this.carPos.z - 2.2);
        this.headlightR.position.set(this.carPos.x + 0.7, 0.65, this.carPos.z - 2.2);
        this.headlightTargetL.position.set(this.carPos.x - 0.7, 0.4, this.carPos.z - 35);
        this.headlightTargetR.position.set(this.carPos.x + 0.7, 0.4, this.carPos.z - 35);
      }

      if (this.speedVal) this.speedVal.textContent = Math.round(this.speed);
      if (this.timeVal) this.timeVal.textContent = `00:0${Math.floor(this.phaseElapsed)}:${Math.floor((this.phaseElapsed % 1) * 60)}`;

      if (this.phaseElapsed > 5.5) {
        this.phase = 'timelapse';
        this.phaseElapsed = 0;
        if (this.card) {
          this.card.classList.add('visible');
        }
      }
    }

    // --- PHASE 3: 10 HOURS TIME-LAPSE TRANSITION (9.0s - 14.5s) ---
    else if (this.phase === 'timelapse') {
      const hourProgress = Math.min(10, Math.floor(1 + (this.phaseElapsed / 5.0) * 9));
      const miles = Math.floor(12 + (this.phaseElapsed / 5.0) * 372);

      if (this.cardMain) {
        this.cardMain.textContent = `${hourProgress} HOURS LATER...`;
      }
      if (this.cardSub) {
        this.cardSub.textContent = `ODOMETER: ${miles} MILES // NON-EUCLIDEAN CORRIDOR EXHAUSTED`;
      }
      if (this.timeVal) {
        this.timeVal.textContent = `10:14:${Math.floor((this.phaseElapsed * 10) % 60)}`;
      }

      // Continuous subtle camera drift
      this.camera.position.x += Math.sin(this.elapsed * 0.8) * 0.01;

      if (this.phaseElapsed > 5.2) {
        if (this.card) {
          this.card.classList.remove('visible');
        }
        this.phase = 'highway';
        this.phaseElapsed = 0;
        this.targetSpeed = 75;

        // Position camera and car on the open night highway
        this.highwayGroup.position.set(0, 0, 0); // Activate highway in view
      }
    }

    // --- PHASE 4: THE DARK HIGHWAY ESCAPE (HOOD CAMERA) (14.5s+) ---
    else if (this.phase === 'highway') {
      this.speed = THREE.MathUtils.lerp(this.speed, this.targetSpeed, delta * 2.0);
      this.traveledDistance += (this.speed * 0.447) * delta;

      // Move road slabs seamlessly
      const segmentLength = 80.0;
      const totalHighwayLen = 12 * segmentLength;

      this.roadSegments.forEach((seg, idx) => {
        let segZ = -(idx * segmentLength) + (this.traveledDistance % segmentLength);
        if (segZ > segmentLength) segZ -= totalHighwayLen;
        seg.position.z = segZ;
      });

      // Highway hood perspective
      const hoodVib = Math.sin(this.elapsed * 24) * 0.012;
      const hoodSway = Math.sin(this.elapsed * 1.4) * 0.25;

      if (this.carGroup) {
        this.carGroup.position.set(hoodSway * 0.8, 0, 2.0);
      }

      this.camera.position.set(hoodSway, 0.95 + hoodVib, 1.3);
      this.camera.lookAt(hoodSway * 0.5, 0.85, -60);

      // High beams sweeping down the road
      if (this.headlightL && this.headlightR) {
        this.headlightL.position.set(-0.7 + hoodSway, 0.65, 0.0);
        this.headlightR.position.set(0.7 + hoodSway, 0.65, 0.0);
        this.headlightTargetL.position.set(-0.7 + hoodSway, 0.2, -60);
        this.headlightTargetR.position.set(0.7 + hoodSway, 0.2, -60);
      }

      if (this.speedVal) this.speedVal.textContent = Math.round(this.speed);
      if (this.timeVal) this.timeVal.textContent = '10:48:12';

      if (this.phaseElapsed > 9.0) {
        this.finish();
      }
    }
  }

  finish() {
    this.isActive = false;
    this.phase = 'idle';

    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
    if (this.card) {
      this.card.classList.remove('visible');
    }

    // Remove headlight beams, cutscene car, and highway group from active scene
    if (this.headlightL) this.scene.remove(this.headlightL);
    if (this.headlightR) this.scene.remove(this.headlightR);
    if (this.carGroup) this.scene.remove(this.carGroup);
    if (this.highwayGroup) this.scene.remove(this.highwayGroup);

    // Sync player position & switch to Level 3 in the left freeway lane.
    if (this.levelBuilder) {
      this.levelBuilder.switchLevel(3, new THREE.Vector3(-3.2, 1.65, 0));
    }
    if (this.audio) {
      this.audio.switchLevelAmbience(3);
    }
    if (this.player) {
      this.player.position.set(-3.2, 1.65, 0);
      this.player.camera.position.set(-3.2, 1.65, 0);
      this.player.velocity.set(0, 0, 0);
      this.player.isFlashlightOn = true;
      this.player.batteryLevel = 100;
      if (this.player.flashlight) this.player.flashlight.visible = true;
      if (this.player.fillLight) this.player.fillLight.visible = true;
      if (this.player.lensMat) this.player.lensMat.color.setHex(0xffeed8);
    }
    if (this.input) {
      this.input.requestLock();
    }

    this.state.setMode(GAME_MODES.GAMEPLAY);
    this.hud.showSplashBanner("ESCAPED THE COMPLEX", "LEVEL 3: THE DESERT FREEWAY // NO EXIT DETECTED", 8000);
    this.hud.updateObjective("OBJECTIVE: FOLLOW THE FREEWAY NORTH");
    this.dialogue.showSubtitle("Cold desert air hits your face. The freeway stretches forever across the dark sand.", "mercer", 6000);
  }
}
