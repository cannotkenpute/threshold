/**
 * 1980s Non-Euclidean Spatial Anomaly & Geometry Warper
 */

export class ShiftingSpace {
  constructor(scene, stateManager) {
    this.scene = scene;
    this.stateManager = stateManager;

    // References to dynamically alterable geometry
    this.entrancePortalMesh = null;
    this.entranceSolidWall = null;
    this.lengtheningCorridor = null;
    this.ropeMesh = null;
    this.tetherSnapped = false;
    this.entranceLost = false;
    this.lastPlayerZ = null;
    this.onEntranceClosed = null;

    // Scratch objects for updateTether(): called every story-mode frame; reusing these
    // keeps the hot path allocation-free.
    this._scratchStart = new THREE.Vector3(0, 0.2, 13.0);
    this._scratchPlayerFoot = new THREE.Vector3();
    this._scratchMid = new THREE.Vector3();
    this._scratchAxis = new THREE.Vector3(0, 1, 0);
    this._scratchDir = new THREE.Vector3();
  }

  registerEntrance(portalMesh, replacementWallMesh, ropeMesh, onEntranceClosed = null) {
    this.entrancePortalMesh = portalMesh;
    this.entranceSolidWall = replacementWallMesh;
    this.ropeMesh = ropeMesh;
    this.tetherSnapped = false;
    this.entranceLost = false;
    this.lastPlayerZ = null;
    this.onEntranceClosed = onEntranceClosed;
    if (this.entranceSolidWall) {
      this.entranceSolidWall.visible = false; // Initially open portal
    }
  }

  // Update tether rope stretching dynamically behind the player as they explore
  updateTether(playerPos, isSnapped) {
    if (!this.ropeMesh || isSnapped) return;
    this._scratchStart.set(0, 0.2, 13.0);
    this._scratchPlayerFoot.set(playerPos.x, 0.08, playerPos.z);
    const dist = this._scratchStart.distanceTo(this._scratchPlayerFoot);

    this._scratchMid.addVectors(this._scratchStart, this._scratchPlayerFoot).multiplyScalar(0.5);
    this.ropeMesh.position.copy(this._scratchMid);
    this.ropeMesh.scale.set(1.0, dist / 24.0);
    this.ropeMesh.quaternion.setFromUnitVectors(
      this._scratchAxis,
      this._scratchDir.subVectors(this._scratchPlayerFoot, this._scratchStart).normalize()
    );
  }

  severTether(playerPos, audioManager) {
    if (this.tetherSnapped) return false;
    this.tetherSnapped = true;
    this.lastPlayerZ = playerPos.z;

    if (this.ropeMesh) {
      const looseEndDirection = new THREE.Vector3(0, 0, 1);
      this.ropeMesh.position.set(playerPos.x, 0.08, playerPos.z + 0.65);
      this.ropeMesh.scale.set(1.0, 0.055, 1.0);
      this.ropeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), looseEndDirection);
    }

    if (audioManager) {
      audioManager.playUI('click');
      audioManager.triggerBlackoutAudio();
    }
    this.stateManager.triggerTetherSever();
    return true;
  }

  updateEntranceLoss(playerPos, audioManager) {
    if (!this.tetherSnapped || this.entranceLost) {
      this.lastPlayerZ = playerPos.z;
      return false;
    }

    const previousZ = this.lastPlayerZ ?? playerPos.z;
    const movingBackTowardEntrance = playerPos.z > previousZ + 0.002;
    this.lastPlayerZ = playerPos.z;

    // The portal vanishes while the player is returning, before reaching the old threshold.
    if (!movingBackTowardEntrance || playerPos.z < 4.0) return false;
    return this.closeEntrance(audioManager);
  }

  closeEntrance(audioManager) {
    if (this.entranceLost) return false;
    this.entranceLost = true;

    if (this.entrancePortalMesh) {
      this.entrancePortalMesh.visible = false;
    }
    if (this.entranceSolidWall) {
      this.entranceSolidWall.visible = true;
    }
    if (this.ropeMesh) {
      this.ropeMesh.visible = false;
    }
    if (this.onEntranceClosed) this.onEntranceClosed();
    if (audioManager) {
      audioManager.playUI('click');
      audioManager.triggerBlackoutAudio();
    }
    return true;
  }

  // Corridors that alter their geometry when the player looks away
  warpCorridor(corridorGroup, scaleFactorZ) {
    if (corridorGroup) {
      corridorGroup.scale.z = scaleFactorZ;
    }
  }

  // --- ANOMALOUS PERIMETER VOID FOG & SPATIAL IMPASSE ---
  updatePerimeterVoid(player, renderer, dialogueUI, audioManager, delta) {
    if (!player || !renderer || !renderer.scene || !renderer.scene.fog) return;

    // Check if in Level 1
    const levelBuilder = window.gameEngine ? window.gameEngine.levelBuilder : null;
    if (levelBuilder && levelBuilder.currentLevel !== 1) return;

    const pX = player.position.x;
    const pZ = player.position.z;

    // Playable corridor sector bounding box (covers all logs, tapes, rooms, and exit)
    const minX = -38.0;
    const maxX = 38.0;
    const minZ = -180.0;
    const maxZ = 45.0;

    const overflowX = Math.max(0, Math.abs(pX) - 38.0);
    const overflowZ = pZ > maxZ ? (pZ - maxZ) : (pZ < minZ ? (minZ - pZ) : 0);
    const voidDepth = Math.sqrt(overflowX * overflowX + overflowZ * overflowZ);

    if (voidDepth > 0.5) {
      // 1. Roll in dense anomalous fog
      const fogRatio = Math.min(1.0, (voidDepth - 0.5) / 10.0);
      const targetDensity = 0.020 + fogRatio * 0.16; // Up to 0.18 density (thick wall of fog)
      renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, targetDensity, 0.08);

      // Shift fog toward eerie dark yellowish/amber void color
      const voidColor = new THREE.Color(0x181406);
      renderer.scene.fog.color.lerp(voidColor, 0.08);

      // 2. Add spatial VHS distortion & static
      renderer.setVHSGlitch(fogRatio * 1.5);

      // 3. Impassable barrier: Push player back if attempting to push deeper into the void
      if (voidDepth >= 7.5) {
        const clampedX = Math.max(minX, Math.min(maxX, pX));
        const clampedZ = Math.max(minZ, Math.min(maxZ, pZ));
        const repelDirX = clampedX - pX;
        const repelDirZ = clampedZ - pZ;
        const repelDist = Math.sqrt(repelDirX * repelDirX + repelDirZ * repelDirZ);

        if (repelDist > 0.001) {
          const inv = 1.0 / repelDist;
          const pushForce = Math.min(6.0, (voidDepth - 7.0) * 3.5 + 2.2);
          player.position.x += repelDirX * inv * pushForce * delta;
          player.position.z += repelDirZ * inv * pushForce * delta;
          player.velocity.set(0, 0, 0);
        }

        // Show warning dialogue (throttled)
        const now = performance.now();
        if (!this.lastVoidWarningTime || (now - this.lastVoidWarningTime > 6500)) {
          this.lastVoidWarningTime = now;
          if (dialogueUI) {
            dialogueUI.showSubtitle("ANOMALOUS SPATIAL VOID // IMPENETRABLE FOG PREVENTS FURTHER ADVANCEMENT.", "supervisor", 4000);
          }
          if (audioManager) {
            audioManager.playUI('click');
          }
        }
      }
    } else {
      // Within safe playable sector: return fog and VHS glitch smoothly to normal
      if (renderer.scene.fog.density > 0.021) {
        renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, 0.020, 0.05);
      }
      if (renderer.postMaterial && renderer.postMaterial.uniforms.vhsJitter.value > 0.01) {
        renderer.setVHSGlitch(0.0);
      }
    }
  }
}
