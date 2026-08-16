import { CONFIG } from '../config.js';

export class LightManager {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.lights = []; // fixture records { group, tubeMesh, worldPos, baseIntensity, currentIntensity, ... }

    // 10-Minute Day/Night Grid Power Cycle State
    this.cycleTime = 0.0;
    this.currentPhase = 'DAY';
    this.previousPhase = 'DAY';

    // --- CONSTANT-SIZE LIGHT POOL ---
    // A fixed number of real THREE.PointLights, repositioned every frame onto the nearest
    // lit fixtures. Because the scene's actual light count never changes while playing,
    // three.js never has to recompile material programs mid-gameplay. The old per-fixture
    // PointLights made the visible count oscillate between 0 and 8+ while walking, and each
    // change forced a program switch -- the single largest source of random hitches.
    this.lightPool = [];
    this._poolIsHighway = false;
    this._initPool(8);

    // Persistent scratch array for the per-frame nearest-fixture pass -- reused/cleared
    // each call instead of reallocating.
    this._nearbyLightsScratch = [];

    // Sequential-shutdown chase timeline: elapsed-time based queue processed in update()
    // instead of a setTimeout ladder, so it can't pile up timers across level rebuilds.
    this._shutdownQueue = [];
    this._shutdownComplete = null;
    this._shutdownCompleteAt = 0;
  }

  _initPool(count) {
    for (let i = 0; i < this.lightPool.length; i++) {
      this.scene.remove(this.lightPool[i]);
    }
    this.lightPool.length = 0;
    for (let i = 0; i < count; i++) {
      const pl = new THREE.PointLight(0xffe8a3, 0.0, 13.0, 0.6);
      pl.castShadow = false;
      pl.visible = true; // unused pool slots are parked at intensity 0
      this.scene.add(pl);
      this.lightPool.push(pl);
    }
  }

  createFluorescentFixture(x, y, z, options = {}) {
    const fixtureGroup = new THREE.Group();
    fixtureGroup.position.set(x, y, z);

    // Lamp casing mesh (1980s commercial office ceiling drop light)
    const casingGeo = new THREE.BoxGeometry(1.6, 0.12, 0.45);
    const casingMat = new THREE.MeshLambertMaterial({ color: 0x1f1f1f });
    const casingMesh = new THREE.Mesh(casingGeo, casingMat);
    fixtureGroup.add(casingMesh);

    // 3D Glowing Light Tube (Visible from all angles below and around)
    const tubeGeo = new THREE.BoxGeometry(1.4, 0.06, 0.35);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xd0c490 });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.position.y = -0.06;
    fixtureGroup.add(tubeMesh);

    this.scene.add(fixtureGroup);

    const lightObj = {
      group: fixtureGroup,
      tubeMesh,
      baseColor: options.color || 0xffe8a3,
      baseIntensity: options.intensity || 0.75,
      baseDistance: options.distance || 13.0,
      flickerOffset: Math.random() * 100,
      isFailing: options.isFailing || false,
      isOff: false,
      worldPos: new THREE.Vector3(x, y, z),
      // Animated every frame in update(); consumed by the light pool:
      currentIntensity: 0,
      currentColor: options.color || 0xffe8a3,
      // Scratch fields reused per frame (no per-light object allocation):
      _distSq: 0,
      _popUntil: 0
    };

    this.lights.push(lightObj);
    return lightObj;
  }

  update(clockTime, playerPos, delta = 0.016) {
    // 1. Advance 10-minute Day/Night Cycle (600s total)
    const cfg = CONFIG.DAY_NIGHT_CYCLE;
    this.cycleTime = (this.cycleTime + delta) % cfg.TOTAL_DURATION;

    // Determine current phase
    if (this.cycleTime < cfg.DAY_DURATION) {
      this.currentPhase = 'DAY';
    } else if (this.cycleTime < cfg.DAY_DURATION + cfg.DUSK_DURATION) {
      this.currentPhase = 'DUSK';
    } else if (this.cycleTime < cfg.DAY_DURATION + cfg.DUSK_DURATION + cfg.NIGHT_DURATION) {
      this.currentPhase = 'NIGHT';
    } else {
      this.currentPhase = 'DAWN';
    }

    // Handle Phase Transitions
    const isHighway = (window.gameEngine && window.gameEngine.levelBuilder && window.gameEngine.levelBuilder.currentLevel === 3);
    const activeRenderer = window.gameRenderer;

    // Pool sizing: 16 lit street lamps on the freeway, 8 indoors. Rebuilding the pool
    // switches the shader's light configuration exactly once per level transition rather
    // than continuously while walking.
    if (isHighway !== this._poolIsHighway) {
      this._poolIsHighway = isHighway;
      this._initPool(isHighway ? 16 : 8);
    }

    if (this.currentPhase !== this.previousPhase || isHighway) {
      const r = window.gameRenderer;

      if (activeRenderer && activeRenderer.renderer) {
        activeRenderer.renderer.shadowMap.enabled = isHighway;
      }
      if (activeRenderer && activeRenderer.sunLight) {
        activeRenderer.sunLight.castShadow = isHighway;
      }

      if (isHighway) {
        const lb = window.gameEngine ? window.gameEngine.levelBuilder : null;
        const skyDome = lb && lb.artificialSkyGroup ? lb.artificialSkyGroup.getObjectByName('ArtificialSkyDome') : null;
        const sunGroup = lb && lb.artificialSkyGroup ? lb.artificialSkyGroup.getObjectByName('ArtificialSunGroup') : null;

        // Highway Atmospheric Day/Night Sky & Fog Progression (Clear visibility, atmospheric, eerie)
        if (this.currentPhase === 'DAY') {
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0xb5c8d4); r.ambientLight.intensity = 0.78; }
          if (r && r.sunLight) {
            r.sunLight.color.setHex(0xfff6dd);
            r.sunLight.intensity = 1.05;
            r.sunLight.position.set(60, 140, -160);
            r.sunLight.visible = true;
          }
          if (r && r.scene) { r.scene.background.setHex(0x425f6e); r.scene.fog.color.setHex(0x385260); r.scene.fog.density = 0.007; }
          if (skyDome) { skyDome.material.color.setHex(0x486b7c); skyDome.visible = true; }
          if (sunGroup) { sunGroup.visible = true; sunGroup.position.set(50, 140, -180); }
        } else if (this.currentPhase === 'DUSK') {
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0xa65636); r.ambientLight.intensity = 0.52; }
          if (r && r.sunLight) {
            r.sunLight.color.setHex(0xe06a32);
            r.sunLight.intensity = 0.65;
            r.sunLight.position.set(80, 50, -180);
            r.sunLight.visible = true;
          }
          if (r && r.scene) { r.scene.background.setHex(0x38190d); r.scene.fog.color.setHex(0x2f150b); r.scene.fog.density = 0.009; }
          if (skyDome) { skyDome.material.color.setHex(0x562312); skyDome.visible = true; }
          if (sunGroup) { sunGroup.visible = true; sunGroup.position.set(80, 50, -180); }
        } else if (this.currentPhase === 'NIGHT') {
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0x526a88); r.ambientLight.intensity = 0.38; }
          if (r && r.sunLight) {
            r.sunLight.color.setHex(0x4a6a96);
            r.sunLight.intensity = 0.30;
            r.sunLight.position.set(-40, 120, 100);
            r.sunLight.visible = true;
          }
          if (r && r.scene) { r.scene.background.setHex(0x0e1824); r.scene.fog.color.setHex(0x0c141e); r.scene.fog.density = 0.010; }
          if (skyDome) { skyDome.material.color.setHex(0x101b28); skyDome.visible = true; }
          if (sunGroup) { sunGroup.visible = false; }
        } else if (this.currentPhase === 'DAWN') {
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0x7692a4); r.ambientLight.intensity = 0.60; }
          if (r && r.sunLight) {
            r.sunLight.color.setHex(0xa6c5d9);
            r.sunLight.intensity = 0.78;
            r.sunLight.position.set(40, 70, -180);
            r.sunLight.visible = true;
          }
          if (r && r.scene) { r.scene.background.setHex(0x1e2f3a); r.scene.fog.color.setHex(0x1a2832); r.scene.fog.density = 0.008; }
          if (skyDome) { skyDome.material.color.setHex(0x284050); skyDome.visible = true; }
          if (sunGroup) { sunGroup.visible = true; sunGroup.position.set(40, 70, -180); }
        }
      } else {
        // Indoor Levels (Level 1 & 2)
        if (r && r.sunLight) {
          r.sunLight.visible = false;
          r.sunLight.castShadow = false;
        }
        if (this.currentPhase === 'NIGHT') {
          if (this.audioManager) this.audioManager.triggerBlackoutAudio();
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0x38301c); r.ambientLight.intensity = 0.08; }
          if (r && r.scene) { r.scene.background.setHex(0x0a0906); r.scene.fog.color.setHex(0x0c0a07); r.scene.fog.density = 0.025; }
        } else if (this.currentPhase === 'DAWN') {
          if (this.audioManager) this.audioManager.triggerPowerRestoreAudio();
          // Power is restoring: brighter than night, not yet full daylight.
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0xb3a98a); r.ambientLight.intensity = 0.55; }
          if (r && r.scene) { r.scene.background.setHex(0x16140e); r.scene.fog.color.setHex(0x1e1a12); r.scene.fog.density = 0.014; }
        } else if (this.currentPhase === 'DAY') {
          // Bright, clearly-visible daytime. The fluorescent fixtures give the local
          // pools of light; a healthy ambient floor plus a thin fog keeps the whole
          // corridor readable instead of fading into near-black at a few meters.
          if (r && r.ambientLight) { r.ambientLight.color.setHex(0xd2cbb0); r.ambientLight.intensity = 0.95; }
          if (r && r.scene) { r.scene.background.setHex(0x1c1912); r.scene.fog.color.setHex(0x26221a); r.scene.fog.density = 0.009; }
        }
      }
      this.previousPhase = this.currentPhase;
    }

    // 2. Sequential shutdown timeline (chase climax): process due pop-offs
    const nowPerf = performance.now();
    if (this._shutdownQueue.length > 0) {
      while (this._shutdownQueue.length > 0 && nowPerf >= this._shutdownQueue[0].at) {
        const ev = this._shutdownQueue.shift();
        ev.light._popUntil = nowPerf + 120;
        ev.light.isOff = true;
        if (this.audioManager) {
          this.audioManager.playUI('click');
        }
      }
    }
    if (this._shutdownComplete && nowPerf >= this._shutdownCompleteAt) {
      const cb = this._shutdownComplete;
      this._shutdownComplete = null;
      cb();
    }

    // 3. Animate fixture diffuser tubes & flicker -> per-fixture currentIntensity/currentColor
    const isBlackout = (this.currentPhase === 'NIGHT' && !isHighway);
    const isDusk = (this.currentPhase === 'DUSK');
    const isDawn = (this.currentPhase === 'DAWN');

    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];

      // Chase shutdown pop: brief 2x flare as the tube dies
      if (l._popUntil > nowPerf) {
        l.currentIntensity = l.baseIntensity * 2.0;
        l.currentColor = 0xffffff;
        l.tubeMesh.material.color.setHex(0xffffff);
        continue;
      }

      if (l.isOff) {
        l.currentIntensity = 0.0;
        l.tubeMesh.material.color.setHex(0x111111);
        continue;
      }

      if (isBlackout) {
        // Blackout: Dark dead tube
        l.currentIntensity = 0.0;
        l.tubeMesh.material.color.setHex(0x1a1a1a);
        continue;
      }

      if (isDusk) {
        // Dusk: Heavy brownout flicker
        const brownoutFlicker = Math.sin(clockTime * 40.0 + l.flickerOffset);
        if (brownoutFlicker > 0.3) {
          l.currentIntensity = 0.0;
          l.tubeMesh.material.color.setHex(0x222222);
        } else {
          l.currentIntensity = l.baseIntensity * 0.5;
          l.currentColor = l.baseColor;
          l.tubeMesh.material.color.setHex(0xffaa55);
        }
      } else if (isDawn) {
        // Dawn: Ignition arc flashes
        const ignition = Math.sin(clockTime * 25.0 + l.flickerOffset);
        if (ignition > 0.5) {
          l.currentIntensity = l.baseIntensity * 1.5;
          l.tubeMesh.material.color.setHex(0xffffff);
        } else {
          l.currentIntensity = l.baseIntensity * 0.3;
          l.currentColor = l.baseColor;
          l.tubeMesh.material.color.setHex(0xffe8a3);
        }
      } else if (l.isFailing) {
        // Failing light in daytime
        const noise = Math.sin(clockTime * 28.0 + l.flickerOffset) * Math.cos(clockTime * 14.0);
        if (noise > 0.6) {
          l.currentIntensity = 0.0;
          l.tubeMesh.material.color.setHex(0x333333);
        } else {
          l.currentIntensity = l.baseIntensity * (0.4 + Math.random() * 0.8);
          l.currentColor = l.baseColor;
          l.tubeMesh.material.color.setHex(0xffe8a3);
        }
      } else {
        // Normal Day Operation: Bright warm fluorescent tube
        const micro = 1.0 + (Math.sin(clockTime * 120.0 + l.flickerOffset) * 0.04);
        l.currentIntensity = l.baseIntensity * micro;
        l.currentColor = l.baseColor;
        l.tubeMesh.material.color.setHex(0xfffae0);
      }
    }

    // 4. Assign the constant-size light pool onto the nearest lit fixtures
    const maxDistanceSq = isHighway ? (36 * 36) : (20 * 20); // 20m threshold for indoor maze

    const pool = this.lightPool;
    const candidates = this._nearbyLightsScratch;
    candidates.length = 0;

    if (playerPos) {
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i];
        if (l.currentIntensity <= 0.001) continue;
        const distSq = l.worldPos.distanceToSquared(playerPos);
        if (distSq >= maxDistanceSq) continue;
        l._distSq = distSq;
        candidates.push(l);
      }

      if (candidates.length > pool.length) {
        candidates.sort((a, b) => a._distSq - b._distSq);
      }
    }

    const assignCount = Math.min(candidates.length, pool.length);
    for (let i = 0; i < pool.length; i++) {
      const pl = pool[i];
      if (i < assignCount) {
        const l = candidates[i];
        pl.position.set(l.worldPos.x, l.worldPos.y - 0.25, l.worldPos.z);
        pl.color.setHex(l.currentColor);
        pl.intensity = l.currentIntensity;
        pl.distance = l.baseDistance;
      } else {
        pl.intensity = 0.0;
      }
    }
  }

  getCycleInfo() {
    return {
      phase: this.currentPhase,
      cycleTime: this.cycleTime,
      totalDuration: CONFIG.DAY_NIGHT_CYCLE.TOTAL_DURATION,
      isNight: this.currentPhase === 'NIGHT',
      isDusk: this.currentPhase === 'DUSK',
      isDawn: this.currentPhase === 'DAWN'
    };
  }

  // Climax sequence: Sequential light shutdown wave moving toward player (sound_design.md #911).
  // Elapsed-time queue processed inside update() -- no setTimeout chain.
  triggerSequentialShutdown(startPos, endPos, onComplete) {
    // Sort lights by distance from startPos to endPos
    const sorted = [...this.lights].sort((a, b) => {
      return a.worldPos.distanceTo(startPos) - b.worldPos.distanceTo(startPos);
    });

    const now = performance.now();
    this._shutdownQueue = sorted.map((l, index) => ({ light: l, at: now + index * 450 }));
    this._shutdownComplete = onComplete || null;
    this._shutdownCompleteAt = now + sorted.length * 450 + 600;
  }
}
