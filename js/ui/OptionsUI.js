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
    this.monsterDirector = null;

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

    this.renderScaleSlider = document.getElementById('opt-render-scale');
    this.renderScaleVal = document.getElementById('opt-render-scale-val');

    this.resumeBtn = document.getElementById('btn-options-resume');

    // Options shown from the title screen (before gameplay / pointer lock)
    this.titleMode = false;
    this.footerHintEl = document.querySelector('.options-footer-hint');

    this.initEvents();
    this.initDevTeleport();
    this.initDevMonsterSummon();
  }

  setMonsterDirector(monsterDirector) {
    this.monsterDirector = monsterDirector;
  }

  showMonsterStatus(text, isError = false) {
    const statusEl = document.getElementById('dev-monster-status');
    if (!statusEl) return;
    if (this.monsterStatusTimeout) clearTimeout(this.monsterStatusTimeout);
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
    statusEl.classList.add('active');
    this.monsterStatusTimeout = setTimeout(() => {
      statusEl.classList.remove('active');
    }, 3500);
  }

  initDevMonsterSummon() {
    const monsterButtons = document.querySelectorAll('.dev-monster-btn');
    monsterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-monster');
        const label = (btn.textContent || type).trim();
        if (!type) return;
        if (!this.monsterDirector) {
          this.showMonsterStatus('CANNOT SUMMON: START SURVIVAL MODE FIRST', true);
          return;
        }
        if (!this.player) {
          this.showMonsterStatus('CANNOT SUMMON: NO ACTIVE PLAYER', true);
          return;
        }

        // Spawn a couple of meters in front of the player, in view, rather than the
        // 8-unit-behind-camera debug default -- that default frequently landed outside the
        // streamed navigation grid and silently failed to find a walkable cell.
        const camera = this.renderer && this.renderer.camera;
        const forward = new THREE.Vector3(0, 0, -1);
        if (camera) camera.getWorldDirection(forward);
        const summonDistance = 2.5;
        const position = {
          // Ground level, not the player's eye height -- monsters stand on the floor like
          // every other spawn path (see SurvivalMonsterDirector.debugSpawnAll's y: 0).
          x: this.player.position.x + forward.x * summonDistance,
          y: 0,
          z: this.player.position.z + forward.z * summonDistance,
        };

        this.monsterDirector.spawnDebug(type, position, { passive: true }).then(() => {
          this.showMonsterStatus(`${label} SUMMONED NEAR PLAYER`);
        }).catch((error) => {
          console.warn(`[DevMenu] Failed to summon ${type}:`, error);
          this.showMonsterStatus(`FAILED TO SUMMON ${label}: ${error.message || error}`, true);
        });
      });
    });
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
      lvl3_highway: { level: 3, x: -3.2, y: 1.65, z: 0.0, yaw: 0, label: "Level 3: Infinite Desert Freeway" },
      lvl3_police: { level: 3, x: -6.0, y: 1.65, z: -72.0, label: "Level 3: Abandoned Patrol Car" },
      lvl3_gas_station: { level: 3, x: 18.0, y: 1.65, z: -715.0, yaw: -Math.PI / 2, label: "Level 3: Roadside Gas Station" }
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

    // Switch the streamed world when teleporting between levels.
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

    // Apply a visible moonlit baseline immediately when entering Level 3.
    if (targetLevel === 3 && this.renderer) {
      if (this.renderer.ambientLight) {
        this.renderer.ambientLight.color.setHex(0x607898);
        this.renderer.ambientLight.intensity = 0.52;
      }
      if (this.renderer.sunLight) {
        this.renderer.sunLight.color.setHex(0x718db5);
        this.renderer.sunLight.intensity = 0.45;
        this.renderer.sunLight.visible = true;
      }
      if (this.renderer.scene) {
        this.renderer.scene.background.setHex(0x172233);
        this.renderer.scene.fog.color.setHex(0x131d2b);
        this.renderer.scene.fog.density = 0.009;
      }
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

    // Render Scale (low-res retro target). Live-adjustable; the CRT/scanline/dither
    // effects re-align to the new render-target resolution automatically.
    if (this.renderScaleSlider) {
      this.renderScaleSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        if (this.renderScaleVal) this.renderScaleVal.textContent = `${val}%`;
        if (this.renderer && this.renderer.setRenderScale) {
          this.renderer.setRenderScale(val / 100);
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
    this.titleMode = false;
    this.modal.style.display = 'flex';
    this.inputManager.exitLock();
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  // Open the options from the title screen: no pointer lock exists yet,
  // and the action button acts as "BACK" rather than "resume mission".
  openTitle() {
    if (!this.modal) return;
    this.isOpen = true;
    this.titleMode = true;
    this.modal.style.display = 'flex';
    if (this.resumeBtn) this.resumeBtn.textContent = 'BACK';
    if (this.footerHintEl) this.footerHintEl.textContent = 'PRESS [ESC] TO CLOSE SETTINGS & RETURN TO TITLE';
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  close() {
    if (!this.modal) return;
    this.isOpen = false;
    this.modal.style.display = 'none';
    if (this.titleMode) {
      // Restore gameplay-mode labels and do not touch pointer lock on the title screen
      this.titleMode = false;
      if (this.resumeBtn) this.resumeBtn.textContent = 'RESUME MISSION [T / ESC]';
      if (this.footerHintEl) this.footerHintEl.textContent = 'PRESS [T] OR [ESC] TO CLOSE SETTINGS & RETURN TO GAMEPLAY';
    } else {
      this.inputManager.requestLock();
    }
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }
}
