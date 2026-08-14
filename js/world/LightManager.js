import { CONFIG } from '../config.js';

export class LightManager {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.lights = []; // { pointLight, mesh, originalColor, originalIntensity, flickerRate, isFailing }

    // 10-Minute Day/Night Grid Power Cycle State
    this.cycleTime = 0.0;
    this.currentPhase = 'DAY';
    this.previousPhase = 'DAY';
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

    // Three.js PointLight (Subtle, moody localized illumination)
    const pointLight = new THREE.PointLight(
      options.color || 0xffe8a3,
      options.intensity || 0.75,
      options.distance || 13.0,
      0.6
    );
    pointLight.position.y = -0.25;
    pointLight.castShadow = false;
    pointLight.visible = true; // Enabled on daytime start
    fixtureGroup.add(pointLight);

    this.scene.add(fixtureGroup);

    const lightObj = {
      group: fixtureGroup,
      pointLight,
      tubeMesh,
      baseColor: options.color || 0xffe8a3,
      baseIntensity: options.intensity || 0.75,
      flickerOffset: Math.random() * 100,
      isFailing: options.isFailing || false,
      isOff: false,
      worldPos: new THREE.Vector3(x, y, z)
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
    if (this.currentPhase !== this.previousPhase) {
      if (this.currentPhase === 'NIGHT') {
        // Sector Blackout Event
        if (this.audioManager) this.audioManager.triggerBlackoutAudio();
        if (window.gameRenderer && window.gameRenderer.ambientLight) {
          window.gameRenderer.ambientLight.intensity = 0.03; // Deep black night ambient
        }
      } else if (this.currentPhase === 'DAWN') {
        // Power Restoration Arc Event
        if (this.audioManager) this.audioManager.triggerPowerRestoreAudio();
      } else if (this.currentPhase === 'DAY') {
        // Low Atmospheric Day Ambient
        if (window.gameRenderer && window.gameRenderer.ambientLight) {
          window.gameRenderer.ambientLight.intensity = 0.15;
        }
      }
      this.previousPhase = this.currentPhase;
    }

    // 2. Distance culling & Night Blackout logic (Up to 24 active lights for large view distance)
    const isBlackout = (this.currentPhase === 'NIGHT');
    const isDusk = (this.currentPhase === 'DUSK');
    const isDawn = (this.currentPhase === 'DAWN');
    const maxActiveLights = 24;
    const maxDistanceSq = 36 * 36; // 36 meters

    let nearbyLights = [];
    if (playerPos && !isBlackout) {
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i];
        if (l.isOff) {
          l.pointLight.visible = false;
          continue;
        }
        const distSq = l.worldPos.distanceToSquared(playerPos);
        if (distSq < maxDistanceSq) {
          nearbyLights.push({ light: l, distSq });
        } else {
          l.pointLight.visible = false;
        }
      }

      nearbyLights.sort((a, b) => a.distSq - b.distSq);
      for (let i = 0; i < nearbyLights.length; i++) {
        nearbyLights[i].light.pointLight.visible = (i < maxActiveLights);
      }
    } else if (isBlackout) {
      // During Night Blackout, all ceiling point lights are OFF
      for (let i = 0; i < this.lights.length; i++) {
        this.lights[i].pointLight.visible = false;
      }
    }

    // 3. Animate Fixture Diffuser Tubes & Flickering
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      if (l.isOff) continue;

      if (isBlackout) {
        // Blackout: Dark dead tube
        l.tubeMesh.material.color.setHex(0x1a1a1a);
        continue;
      }

      if (isDusk) {
        // Dusk: Heavy brownout flicker
        const brownoutFlicker = Math.sin(clockTime * 40.0 + l.flickerOffset);
        if (brownoutFlicker > 0.3) {
          l.pointLight.intensity = 0.0;
          l.tubeMesh.material.color.setHex(0x222222);
        } else {
          l.pointLight.intensity = l.baseIntensity * 0.5;
          l.tubeMesh.material.color.setHex(0xffaa55);
        }
      } else if (isDawn) {
        // Dawn: Ignition arc flashes
        const ignition = Math.sin(clockTime * 25.0 + l.flickerOffset);
        if (ignition > 0.5) {
          l.pointLight.intensity = l.baseIntensity * 1.5;
          l.tubeMesh.material.color.setHex(0xffffff);
        } else {
          l.pointLight.intensity = l.baseIntensity * 0.3;
          l.tubeMesh.material.color.setHex(0xffe8a3);
        }
      } else if (l.isFailing) {
        // Failing light in daytime
        const noise = Math.sin(clockTime * 28.0 + l.flickerOffset) * Math.cos(clockTime * 14.0);
        if (noise > 0.6) {
          l.pointLight.intensity = 0.0;
          l.tubeMesh.material.color.setHex(0x333333);
        } else {
          l.pointLight.intensity = l.baseIntensity * (0.4 + Math.random() * 0.8);
          l.tubeMesh.material.color.setHex(0xffe8a3);
        }
      } else {
        // Normal Day Operation: Bright warm fluorescent tube
        const micro = 1.0 + (Math.sin(clockTime * 120.0 + l.flickerOffset) * 0.04);
        l.pointLight.intensity = l.baseIntensity * micro;
        l.tubeMesh.material.color.setHex(0xfffae0);
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

  // Climax sequence: Sequential light shutdown wave moving toward player (sound_design.md #911)
  triggerSequentialShutdown(startPos, endPos, onComplete) {
    // Sort lights by distance from startPos to endPos
    const sorted = [...this.lights].sort((a, b) => {
      return a.worldPos.distanceTo(startPos) - b.worldPos.distanceTo(startPos);
    });

    sorted.forEach((l, index) => {
      setTimeout(() => {
        // Flicker pop
        l.pointLight.intensity = l.baseIntensity * 2.0;
        if (this.audioManager) {
          this.audioManager.playUI('click');
        }

        setTimeout(() => {
          l.isOff = true;
          l.pointLight.intensity = 0.0;
          l.tubeMesh.material.color.setHex(0x111111);
        }, 120);
      }, index * 450);
    });

    if (onComplete) {
      setTimeout(onComplete, sorted.length * 450 + 600);
    }
  }
}
