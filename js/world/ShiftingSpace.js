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
  }

  registerEntrance(portalMesh, replacementWallMesh, ropeMesh) {
    this.entrancePortalMesh = portalMesh;
    this.entranceSolidWall = replacementWallMesh;
    this.ropeMesh = ropeMesh;
    if (this.entranceSolidWall) {
      this.entranceSolidWall.visible = false; // Initially open portal
    }
  }

  // Update tether rope stretching dynamically behind the player as they explore
  updateTether(playerPos, isSnapped) {
    if (!this.ropeMesh || isSnapped) return;
    const startPoint = new THREE.Vector3(0, 0.2, 13.0); // Anchored at facility gateway frame
    const playerFoot = new THREE.Vector3(playerPos.x, 0.08, playerPos.z);
    const dist = startPoint.distanceTo(playerFoot);

    // Reposition and orient rope cylinder between portal and player
    const midPoint = new THREE.Vector3().addVectors(startPoint, playerFoot).multiplyScalar(0.5);
    this.ropeMesh.position.copy(midPoint);
    this.ropeMesh.scale.set(1.0, dist / 24.0, 1.0); // Scale along length
    this.ropeMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      playerFoot.clone().sub(startPoint).normalize()
    );
  }

  // Called when the tether snaps: entrance is replaced by a solid yellow wall!
  severTetherAndCloseEntrance(audioManager) {
    if (this.entrancePortalMesh) {
      this.entrancePortalMesh.visible = false;
    }
    if (this.entranceSolidWall) {
      this.entranceSolidWall.visible = true;
    }
    if (this.ropeMesh) {
      // Show severed frayed rope end trailing on the floor
      this.ropeMesh.scale.set(0.6, 0.3, 0.6);
      this.ropeMesh.position.y = 0.05;
    }
    if (audioManager) {
      audioManager.playUI('click');
      audioManager.triggerBlackoutAudio(); // Heavy mechanical/spatial resonance sound
    }
    this.stateManager.triggerTetherSever();
  }

  // Corridors that alter their geometry when the player looks away
  warpCorridor(corridorGroup, scaleFactorZ) {
    if (corridorGroup) {
      corridorGroup.scale.z = scaleFactorZ;
    }
  }
}
