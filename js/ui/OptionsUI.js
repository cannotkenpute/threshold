/**
 * 1980s Options & Settings Modal Manager
 */

import { GAME_MODES } from '../core/StateManager.js';

export class OptionsUI {
  constructor(audioManager, inputManager, renderer, player = null, levelBuilder = null) {
    this.audioManager = audioManager;
    this.inputManager = inputManager;
    this.renderer = renderer;
    this.player = player;
    this.levelBuilder = levelBuilder;

    this.modal = document.getElementById('options-modal');
    this.isOpen = false;

    // UI elements
    this.masterVolSlider = document.getElementById('opt-master-vol');
    this.masterVolVal = document.getElementById('opt-master-vol-val');

    this.voiceVolSlider = document.getElementById('opt-voice-vol');
    this.voiceVolVal = document.getElementById('opt-voice-vol-val');

    this.sfxVolSlider = document.getElementById('opt-sfx-vol');
    this.sfxVolVal = document.getElementById('opt-sfx-vol-val');

    this.mouseSensSlider = document.getElementById('opt-mouse-sens');
    this.mouseSensVal = document.getElementById('opt-mouse-sens-val');

    this.scanlinesSlider = document.getElementById('opt-scanlines');
    this.scanlinesVal = document.getElementById('opt-scanlines-val');

    this.curvatureSlider = document.getElementById('opt-curvature');
    this.curvatureVal = document.getElementById('opt-curvature-val');

    this.resumeBtn = document.getElementById('btn-options-resume');

    this.initEvents();
    this.initDevTeleport();
  }

  initDevTeleport() {
    const warpTargets = {
      spawn: { level: 1, x: 0, y: 1.65, z: 20.0, label: "Facility Spawn" },
      alpha: { level: 1, x: 0, y: 1.65, z: -30.0, label: "Camp Alpha (Dr. Mercer Log 01)" },
      flood: { level: 1, x: 20.0, y: 1.65, z: -46.0, label: "Flooded Sector (Dr. Reed Notebook)" },
      cole: { level: 1, x: -20.0, y: 1.65, z: -70.0, label: "Maintenance Cache (Cole Tape #2)" },
      obs: { level: 1, x: 0, y: 1.65, z: -118.0, label: "Observation Room (Helen Park Log)" },
      steel: { level: 1, x: 0, y: 1.65, z: -140.0, label: "Heavy Steel Maintenance Door" },
      mercer_final: { level: 1, x: 0, y: 1.65, z: -162.0, label: "Destroyed Camp (Mercer Final Tape)" },
      exit: { level: 1, x: 0, y: 1.65, z: -170.0, label: "Level 1 Exit Doorway" },
      lvl2_entrance: { level: 2, x: 0.0, y: 1.65, z: -2.5, label: "Level 2: Parking Garage Entrance (Beside Mercer Tape Car)" },
      lvl2_gas_can: { level: 2, x: -28.2, y: 1.65, z: -21.2, label: "Level 2: Gas Can Cache" },
      lvl2_crowbar: { level: 2, x: 20.0, y: 1.65, z: -29.0, yaw: 0, label: "Level 2: Crowbar Location" },
      lvl2_escape_car: { level: 2, x: 16.0, y: 1.65, z: 2.0, label: "Level 2: Escape Vehicle (Locked Car)" },
      lvl2_sedans: { level: 2, x: 24.0, y: 1.65, z: 24.0, label: "Level 2: Abandoned Cars Row" },
      lvl2_deep: { level: 2, x: -48.0, y: 1.65, z: -48.0, label: "Level 2: Deep Garage Sector" },
      lvl3_highway: { level: 3, x: 0.0, y: 1.65, z: 0.0, label: "Level 3: The Dark Highway" },
      lvl3_police: { level: 3, x: -6.0, y: 1.65, z: -72.0, label: "Level 3: Abandoned Patrol Car" }
    };

    const devButtons = document.querySelectorAll('.dev-btn');
    devButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const warpKey = btn.getAttribute('data-warp');
        const target = warpTargets[warpKey];
        if (target && this.player) {
          this.teleportPlayer(target.x, target.y, target.z, target.level, target.yaw);
          this.close();
        }
      });
    });
  }

  teleportPlayer(x, y, z, targetLevel = 1, yaw = null) {
    if (!this.player) return;

    // Check if switching between Level 1 and Level 2
    if (this.levelBuilder && this.levelBuilder.currentLevel !== targetLevel) {
      this.levelBuilder.switchLevel(targetLevel, new THREE.Vector3(x, y, z));
      if (this.audioManager) {
        this.audioManager.switchLevelAmbience(targetLevel);
      }
    }

    this.player.position.set(x, y, z);
    this.player.camera.position.set(x, y, z);
    this.player.velocity.set(0, 0, 0);
    if (yaw !== null) {
      this.player.rotation.set(0, yaw, 0, 'YXZ');
      this.player.camera.rotation.copy(this.player.rotation);
    }

    // Force chunk generator update around teleported destination
    if (this.levelBuilder) {
      this.levelBuilder.update(this.player.position, true);
    }

    // Ensure flashlight works and is illuminated on dark highway
    if (this.player) {
      this.player.isFlashlightOn = true;
      this.player.batteryLevel = 100;
      if (this.player.flashlight) this.player.flashlight.visible = true;
      if (this.player.fillLight) this.player.fillLight.visible = true;
      if (this.player.lensMat) this.player.lensMat.color.setHex(0xffeed8);
    }

    // Ensure audio context is alive on user click
    if (this.audioManager) {
      this.audioManager.init();
      this.audioManager.resume();
    }

    // Activate GAMEPLAY mode
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';

    if (window.gameEngine) {
      window.gameEngine.isRunning = true;
      if (window.gameEngine.state) {
        window.gameEngine.state.setMode(GAME_MODES.GAMEPLAY);
      }
    }

    if (this.inputManager) {
      // Clear stuck key states
      Object.keys(this.inputManager.keys).forEach(k => {
        this.inputManager.keys[k] = false;
      });
      this.inputManager.requestLock();
    }

    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  initEvents() {
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Master Volume
    if (this.masterVolSlider) {
      this.masterVolSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.masterVolVal) this.masterVolVal.textContent = `${val}%`;
        if (this.audioManager && this.audioManager.masterGain) {
          this.audioManager.masterGain.gain.value = val / 100;
        }
      });
    }

    // Voice & Radio Volume
    if (this.voiceVolSlider) {
      this.voiceVolSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.voiceVolVal) this.voiceVolVal.textContent = `${val}%`;
        if (this.audioManager && this.audioManager.buses && this.audioManager.buses.VOICE) {
          this.audioManager.buses.VOICE.gain.value = (val / 100);
        }
      });
    }

    // SFX & Ambience Volume
    if (this.sfxVolSlider) {
      this.sfxVolSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.sfxVolVal) this.sfxVolVal.textContent = `${val}%`;
        if (this.audioManager && this.audioManager.buses) {
          const gain = val / 100;
          if (this.audioManager.buses.AMBIENCE) this.audioManager.buses.AMBIENCE.gain.value = gain;
          if (this.audioManager.buses.ENVIRONMENT) this.audioManager.buses.ENVIRONMENT.gain.value = gain;
          if (this.audioManager.buses.PLAYER) this.audioManager.buses.PLAYER.gain.value = gain;
        }
      });
    }

    // Mouse Sensitivity
    if (this.mouseSensSlider) {
      this.mouseSensSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.mouseSensVal) this.mouseSensVal.textContent = `${val}`;
        if (this.inputManager) {
          this.inputManager.mouseSensitivity = (val / 100) * 0.005;
        }
      });
    }

    // CRT Scanlines
    if (this.scanlinesSlider) {
      this.scanlinesSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.scanlinesVal) this.scanlinesVal.textContent = `${val}%`;
        if (this.renderer && this.renderer.postMaterial) {
          this.renderer.postMaterial.uniforms.scanlineIntensity.value = (val / 100) * 0.8;
        }
      });
    }

    // CRT Curvature
    if (this.curvatureSlider) {
      this.curvatureSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.curvatureVal) this.curvatureVal.textContent = `${val}%`;
        if (this.renderer && this.renderer.postMaterial) {
          this.renderer.postMaterial.uniforms.curvature.value = (val / 100) * 0.25;
        }
      });
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.modal) return;
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.inputManager.exitLock();
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  close() {
    if (!this.modal) return;
    this.isOpen = false;
    this.modal.style.display = 'none';
    this.inputManager.requestLock();
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }
}
