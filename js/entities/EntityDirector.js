/**
 * 1980s Entity Stalker AI, Dynamic Events & Horror Director
 */

import { CONFIG } from '../config.js';

export class EntityDirector {
  constructor(scene, player, audioManager, stateManager, lightManager, shiftingSpace) {
    this.scene = scene;
    this.player = player;
    this.audioManager = audioManager;
    this.stateManager = stateManager;
    this.lightManager = lightManager;
    this.shiftingSpace = shiftingSpace;

    // Entity Mesh (Eerie low-poly humanoid silhouette)
    this.entityMesh = this.createEntityMesh();
    this.entityPosition = new THREE.Vector3(0, 0, -122);
    this.entityMesh.position.copy(this.entityPosition);
    this.entityMesh.visible = false;
    this.scene.add(this.entityMesh);

    // Progression Triggers
    this.anomalyCrossed = false;
    this.tetherSeverTimer = 0;
    this.silhouetteSpawned = false;
    this.chaseActive = false;
    this.chaseSpeed = 4.2;
    this.chaseEntityPos = new THREE.Vector3(0, 0, -120);
  }

  createEntityMesh() {
    const group = new THREE.Group();

    // Dark distorted figure material
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.9, 0.25);
    const torso = new THREE.Mesh(torsoGeo, shadowMat);
    torso.position.y = 1.3;
    group.add(torso);

    // Head (Slightly tilted, unnatural)
    const headGeo = new THREE.BoxGeometry(0.3, 0.35, 0.3);
    const head = new THREE.Mesh(headGeo, shadowMat);
    head.position.set(0, 1.9, 0.05);
    head.rotation.z = 0.2;
    group.add(head);

    // Elongated Arms
    const armGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const leftArm = new THREE.Mesh(armGeo, shadowMat);
    leftArm.position.set(-0.35, 1.15, 0);
    const rightArm = new THREE.Mesh(armGeo, shadowMat);
    rightArm.position.set(0.35, 1.15, 0);
    group.add(leftArm, rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.16, 1.0, 0.16);
    const leftLeg = new THREE.Mesh(legGeo, shadowMat);
    leftLeg.position.set(-0.16, 0.5, 0);
    const rightLeg = new THREE.Mesh(legGeo, shadowMat);
    rightLeg.position.set(0.16, 0.5, 0);
    group.add(leftLeg, rightLeg);

    return group;
  }

  update(delta) {
    const pPos = this.player.position;

    // 1. Check if player crossed into the anomaly portal (Z <= 12.0)
    if (!this.anomalyCrossed && pPos.z <= 12.0) {
      this.anomalyCrossed = true;
      this.stateManager.hasCrossedAnomaly = true;
      this.player.stepCount = 0; // Begin counting 500 exploration steps
    }

    // 2. Dynamic Tether Update & 500 Step Snap
    if (this.anomalyCrossed && !this.stateManager.hasTetherBroken) {
      this.shiftingSpace.updateTether(pPos, false);

      // Snap tether when reaching ~500 steps in the Backrooms
      const maxTetherSteps = 500;
      if (this.player.stepCount >= maxTetherSteps) {
        this.shiftingSpace.severTetherAndCloseEntrance(this.audioManager);
      }
    }

    // 3. Tension escalation based on exploration depth & Night Blackouts
    const isNight = (this.lightManager && this.lightManager.currentPhase === 'NIGHT');
    if (isNight && !this.chaseActive) {
      // Faster sanity drain during complete night blackout
      this.player.sanity = Math.max(0, this.player.sanity - CONFIG.PLAYER.SANITY_DRAIN_DARKNESS * 1.5 * delta);
      // Increased chance of distant footsteps
      if (Math.random() < 0.008) {
        this.audioManager.playFootstep('carpet', false, 0.45);
      }
    }

    if (pPos.z < -45 && this.stateManager.currentTension === CONFIG.TENSION_STATES.STATE_1_UNEASY) {
      this.audioManager.setTensionState(CONFIG.TENSION_STATES.STATE_2_OBSERVED);
    }

    // 4. Observation Room / Final corridor encounter trigger
    if (pPos.z < -126 && !this.silhouetteSpawned) {
      this.silhouetteSpawned = true;
      this.entityMesh.visible = true;
      this.entityPosition.set(0, 0, -150);
      this.entityMesh.position.copy(this.entityPosition);
      this.audioManager.setTensionState(CONFIG.TENSION_STATES.STATE_3_DANGER);
    }

    // 5. Approaching Silhouette triggers light shutdown & chase!
    if (this.silhouetteSpawned && !this.chaseActive && pPos.z < -136) {
      this.startChaseSequence();
    }

    // 6. Active Chase sequence logic
    if (this.chaseActive && !this.stateManager.chaseEscaped) {
      // Entity charges forward toward player
      this.chaseEntityPos.z += this.chaseSpeed * delta;
      this.entityMesh.position.copy(this.chaseEntityPos);

      // Play entity chase footsteps periodically
      if (Math.random() < 0.2) {
        this.audioManager.playFootstep('carpet', false, 1.2);
      }

      // Check distance to player
      const distToPlayer = Math.abs(this.chaseEntityPos.z - pPos.z);
      if (distToPlayer < 1.8) {
        // Player caught! Intense panic / knockback
        this.player.sanity = Math.max(0, this.player.sanity - 40 * delta);
        if (window.gameRenderer) {
          window.gameRenderer.setVHSGlitch(1.5);
        }
      }
    }
  }

  startChaseSequence() {
    this.chaseActive = true;
    this.entityMesh.visible = false; // Vanishes into darkness as lights cut
    this.chaseEntityPos.set(0, 0, -154);

    // Sequential light shutdown travelling towards player (sound_design.md)
    this.lightManager.triggerSequentialShutdown(
      new THREE.Vector3(0, 3, -154),
      new THREE.Vector3(0, 3, -130),
      () => {
        // Re-appear in darkness charging!
        this.entityMesh.visible = true;
        this.stateManager.triggerChaseSequence();
      }
    );
  }

  escapeThroughMaintenanceDoor() {
    this.chaseActive = false;
    this.entityMesh.visible = false;
    this.stateManager.triggerChaseEscape();

    // Sound: Heavy footsteps approach door then silence (sound_design.md #1016)
    setTimeout(() => {
      this.audioManager.playFootstep('carpet', false, 0.9);
      setTimeout(() => {
        this.audioManager.playFootstep('carpet', false, 0.8);
      }, 400);
    }, 800);
  }
}
