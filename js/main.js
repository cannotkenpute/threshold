/**
 * 1980s Backrooms Horror Game - Engine Bootstrap & Master Game Loop
 */

import { CONFIG } from './config.js';
import { RetroRenderer } from './core/Renderer.js';
import { InputManager } from './core/Input.js';
import { StateManager, GAME_MODES } from './core/StateManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { CassettePlayer } from './audio/CassettePlayer.js';
import { LightManager } from './world/LightManager.js';
import { ShiftingSpace } from './world/ShiftingSpace.js';
import { LevelBuilder } from './world/LevelBuilder.js';
import { Player } from './entities/Player.js';
import { EntityDirector } from './entities/EntityDirector.js';
import { Inventory } from './items/Inventory.js';
import { HUDManager } from './ui/HUD.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { CassetteUI } from './ui/CassetteUI.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { OptionsUI } from './ui/OptionsUI.js';
import { ArchiveUI } from './ui/ArchiveUI.js';
import { EscapeCutscene } from './cinematics/EscapeCutscene.js';

class GameEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // UI Systems
    this.hud = new HUDManager();
    this.dialogue = new DialogueUI();
    this.audio = new AudioManager();
    this.cassettePlayer = new CassettePlayer(this.audio);
    this.cassetteUI = new CassetteUI(this.cassettePlayer, this.audio);
    this.archiveUI = null; // initialized after input
    this.inventoryUI = new InventoryUI(this.audio);
    this.inventory = new Inventory(this.audio, this.hud);

    // State & Core 3D
    this.state = new StateManager(this.audio, this.hud);
    this.renderer = new RetroRenderer(this.container);
    window.gameRenderer = this.renderer;
    window.gameEngine = this;

    // World & Systems
    this.shiftingSpace = new ShiftingSpace(this.renderer.scene, this.state);
    this.lightManager = new LightManager(this.renderer.scene, this.audio);
    this.levelBuilder = new LevelBuilder(this.renderer.scene, this.lightManager, this.shiftingSpace);
    
    // Start by loading Level 2 Parking Garage for the Title Screen infinite background camera pan
    this.titlePanPos = new THREE.Vector3(0, 1.45, 0);
    this.levelBuilder.switchLevel(2, this.titlePanPos);

    // Player & Entity
    this.player = new Player(this.renderer.camera, this.renderer.scene, this.audio, this.levelBuilder);
    // Explicitly hide flashlight and held models from menu camera pan
    if (this.player.flashlightModel) this.player.flashlightModel.visible = false;
    this.player.flashlight.visible = false;
    if (this.player.fillLight) this.player.fillLight.visible = false;
    this.player.heldItemModels.forEach(m => m.visible = false);

    this.entityDirector = new EntityDirector(
      this.renderer.scene,
      this.player,
      this.audio,
      this.state,
      this.lightManager,
      this.shiftingSpace
    );

    // Input & Options (with dev teleport capabilities)
    this.input = new InputManager(document.body, (action) => this.handleAction(action));
    this.optionsUI = new OptionsUI(this.audio, this.input, this.renderer, this.player, this.levelBuilder);
    this.archiveUI = new ArchiveUI(this.cassettePlayer, this.audio, this.input);

    // Cutscene System
    this.cutscene = new EscapeCutscene(this.renderer, this.audio, this.state, this.hud, this.dialogue, this.player, this.input, this.levelBuilder);

    // Clock
    this.clock = new THREE.Clock();
    this.isRunning = false;

    this.initTitleScreen();
    this.setupModalDismiss();
  }

  initTitleScreen() {
    const startBtn = document.getElementById('btn-start-game');
    const titleScreen = document.getElementById('title-screen');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // Initialize AudioContext on user interaction
        this.audio.init();
        this.audio.resume();

        if (titleScreen) titleScreen.style.display = 'none';

        // Reveal flashlight model for gameplay
        if (this.player.flashlightModel) this.player.flashlightModel.visible = true;

        // Load Level 1 Yellow Sector and reset player spawn position
        this.levelBuilder.buildFullLevel();
        this.player.position.set(0, 1.65, 20);
        this.player.camera.position.set(0, 1.65, 20);
        this.player.velocity.set(0, 0, 0);

        this.state.setMode(GAME_MODES.GAMEPLAY);
        this.input.requestLock();
        this.isRunning = true;

        // Show opening supervisor dialogue and play distorted radio voiceover
        setTimeout(() => {
          this.dialogue.showSubtitle("SUPERVISOR: Vaughn here. Tether is secured to the gateway frame. Enter DTE-04, locate Mercer's team, and return.", "supervisor", 7000);
          this.audio.playRadioVoiceAudio('./assets/audio/dialogue%231.mp3');
        }, 1000);
      });
    }

    const restartBtn = document.getElementById('btn-restart-game');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  setupModalDismiss() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (this.archiveUI && this.archiveUI.isOpen) {
          this.archiveUI.close();
          return;
        }
        if (this.optionsUI.isOpen) {
          this.optionsUI.close();
          return;
        }
        if (this.inventoryUI.isOpen) {
          this.inventoryUI.close();
          return;
        }
        if (this.cassetteUI.isOpen) {
          this.cassetteUI.close();
          return;
        }
      }
    });
  }

  handleAction(action) {
    if (this.state.mode !== GAME_MODES.GAMEPLAY) return;

    if (action === 'archive') {
      if (this.archiveUI) this.archiveUI.toggle();
    } else if (action === 'dev_menu') {
      this.optionsUI.toggle();
    } else if (action === 'flashlight') {
      this.player.toggleFlashlight();
    } else if (action === 'interact') {
      this.handlePlayerInteract();
    } else if (action === 'use_item') {
      this.inventory.useSlot(this.inventory.activeSlotIndex, this.player);
    } else if (action.startsWith('slot_')) {
      const slotIdx = parseInt(action.replace('slot_', '')) - 1;
      this.inventory.selectSlot(slotIdx, this.player);
    }
  }

  handlePlayerInteract() {
    const focused = this.player.focusedInteractive;
    if (!focused) return;

    if (focused.type === 'battery') {
      this.inventory.addItem('battery', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.dialogue.showSubtitle("Collected: Alkaline D-Cell Battery", "mercer", 2500);
    } else if (focused.type === 'almond_water') {
      this.inventory.addItem('almond_water', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.dialogue.showSubtitle("Collected: Unmarked Bottle (Almond Water)", "mercer", 2500);
    } else if (focused.type === 'medkit') {
      this.inventory.addItem('medkit', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.dialogue.showSubtitle("Collected: Emergency Medical Kit", "mercer", 2500);
    } else if (focused.type === 'security_keycard') {
      if (!this.inventory.addItem('security_keycard', this.player)) {
        this.dialogue.showSubtitle("Inventory full. Clear a slot for the security keycard.", "supervisor", 2500);
        return;
      }
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.player.focusedInteractive = null;
      this.hud.showSplashBanner("ACCESS CARD ACQUIRED", "LEVEL 5 SECURITY CLEARANCE", 4000);
      this.dialogue.showSubtitle("Collected: Level 5 Security Keycard", "supervisor", 2500);
      if (this.audio) this.audio.playUI('battery');
    } else if (focused.type === 'mercer_01') {
      this.inventory.addItem('mercer_01', this.player);
      if (this.archiveUI) this.archiveUI.unlockLog('mercer_01');
      this.cassetteUI.openWithTape(CONFIG.NARRATIVE.MERCER_LOG_01);
    } else if (focused.type === 'reed_notes') {
      this.inventory.addItem('reed_notes', this.player);
      this.inventoryUI.showDocument(CONFIG.NARRATIVE.SAMUEL_REED_NOTES);
    } else if (focused.type === 'cole_tape') {
      this.inventory.addItem('cole_tape', this.player);
      if (this.archiveUI) this.archiveUI.unlockLog('cole_tape');
      this.cassetteUI.openWithTape(CONFIG.NARRATIVE.DANIEL_COLE_TAPE);
    } else if (focused.type === 'park_notes') {
      this.inventory.addItem('park_notes', this.player);
      this.inventoryUI.showDocument(CONFIG.NARRATIVE.HELEN_PARK_NOTES);
    } else if (focused.type === 'wall_warning') {
      this.inventoryUI.showDocument(CONFIG.NARRATIVE.OBSERVATION_WARNING);
    } else if (focused.type === 'mercer_final') {
      this.inventory.addItem('mercer_final', this.player);
      if (this.archiveUI) this.archiveUI.unlockLog('mercer_final');
      this.cassetteUI.openWithTape(CONFIG.NARRATIVE.MERCER_FINAL_TAPE);
    } else if (focused.type === 'garage_mercer_tape') {
      this.inventory.addItem('garage_mercer_tape', this.player);
      if (this.archiveUI) this.archiveUI.unlockLog('garage_mercer_tape');
      this.cassetteUI.openWithTape(CONFIG.NARRATIVE.GARAGE_MERCER_LOG, () => {
        // Automatically close cassette deck modal so the game view & splash are visible
        if (this.cassetteUI.isOpen) {
          this.cassetteUI.close();
        }
        // Trigger splash banner & new directive
        this.hud.showSplashBanner("NEW DIRECTIVE", "LOCATE THE EMERGENCY FUEL CANISTER IN THE GARAGE", 6000);
        this.hud.updateObjective("OBJECTIVE: FIND THE GAS CAN IN THE SUBTERRANEAN GARAGE");
        this.dialogue.showSubtitle("DIRECTIVE UPDATED // FIND THE GAS CANISTER", "mercer", 4500);
        if (this.audio) this.audio.playUI('tape');
      });
    } else if (focused.type === 'gas_can') {
      this.inventory.addItem('gas_can', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.hud.showSplashBanner("OBJECTIVE COMPLETE", "ACQUIRED: EMERGENCY FUEL CANISTER [GAS CAN]", 5000);
      this.hud.updateObjective("OBJECTIVE: RETURN TO THE ESCAPE VEHICLE");
      this.dialogue.showSubtitle("Collected: Emergency Fuel Canister. Now find a way to jimmy the lock.", "mercer", 4500);
      if (this.audio) this.audio.playUI('battery');
    } else if (focused.type === 'crow_bar') {
      this.inventory.addItem('crow_bar', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.hud.showSplashBanner("TOOL ACQUIRED", "STEEL CROWBAR — CAN FORCE LOCKED ENTRY POINTS", 5000);
      this.dialogue.showSubtitle("Found a crowbar. This could be used to jimmy the locked car doors.", "mercer", 4500);
      // Play crowbar creak on pickup
      if (this.audio) this.audio.playBuffer(this.audio.crowbarCreakBuffer, 'UI', 0.9);
    } else if (focused.type === 'spawn_car_cutscene') {
      // Start 10-hour escape driving cutscene
      this.state.setMode(GAME_MODES.CUTSCENE);
      this.input.exitLock();
      this.cutscene.start();
    } else if (focused.type === 'locked_car') {
      const hasCrowbar = this.inventory.primarySlots.some(s => s && s.id === 'crow_bar');
      const hasGasCan  = this.inventory.primarySlots.some(s => s && s.id === 'gas_can');

      if (!focused.unlocked) {
        // --- JIMMY WITH CROWBAR ---
        if (!hasCrowbar) {
          this.audio.playUI('click');
          this.dialogue.showSubtitle("The door is locked. You need something to force it open.", "mercer", 3000);
          return;
        }
        // Play crowbar creak then unlock click
        if (this.audio) this.audio.playBuffer(this.audio.crowbarCreakBuffer, 'ENVIRONMENT', 1.0);
        setTimeout(() => {
          if (this.audio) this.audio.playBuffer(this.audio.carUnlockBuffer, 'ENVIRONMENT', 1.0);
        }, 900);

        focused.unlocked = true;
        focused.name = 'Escape Vehicle — [Fill with Gas Can]';
        this.hud.showSplashBanner("DOOR OPEN", "ESCAPE VEHICLE UNLOCKED — FILL WITH GAS TO ESCAPE", 5500);
        this.hud.updateObjective("OBJECTIVE: FILL THE ESCAPE VEHICLE WITH THE GAS CAN");
        this.dialogue.showSubtitle("The lock gave way. Now you need to fuel it.", "mercer", 4000);

      } else if (!focused.fueled) {
        // --- FILL WITH GAS CAN ---
        if (!hasGasCan) {
          this.audio.playUI('click');
          this.dialogue.showSubtitle("The car is open but has no fuel. Find the gas canister.", "mercer", 3500);
          return;
        }
        // Consume the gas can
        const gasSlotIdx = this.inventory.primarySlots.findIndex(s => s && s.id === 'gas_can');
        if (gasSlotIdx >= 0) this.inventory.primarySlots[gasSlotIdx] = null;
        this.hud.updateQuickSlots(this.inventory.primarySlots);

        if (this.audio) this.audio.playBuffer(this.audio.carUnlockBuffer, 'ENVIRONMENT', 0.6);
        focused.fueled = true;
        focused.name = 'Escape Vehicle — Engine Ready';
        this.hud.showSplashBanner("ENGINE FUELED", "START THE ENGINE AND ESCAPE THE COMPLEX", 6000);
        this.hud.updateObjective("OBJECTIVE: START THE ENGINE — PRESS [E]");
        this.dialogue.showSubtitle("Tank filled. The engine might just start...", "mercer", 4000);

      } else {
        // --- START ENGINE / WIN ---
        this.hud.showSplashBanner("ESCAPED", "THE ENGINE ROARS TO LIFE — YOU FOUND A WAY OUT", 8000);
        this.dialogue.showSubtitle("The engine turned over. For the first time in what felt like days — a way out.", "mercer", 7000);
        if (this.audio) this.audio.playBuffer(this.audio.carUnlockBuffer, 'ENVIRONMENT', 1.2);
      }
    } else if (focused.type === 'maintenance_door') {
      this.entityDirector.escapeThroughMaintenanceDoor();
      this.dialogue.showSubtitle("You slammed and latched the steel door! Heavy footsteps stop outside...", "mercer", 5000);
    } else if (focused.type === 'locked_lab_door') {
      const hasKeycard = this.inventory.primarySlots.some(slot => slot && slot.id === 'security_keycard');
      if (focused.unlocked) {
        this.audio.playUI('click');
        this.dialogue.showSubtitle("[ACCESS GRANTED] SECURITY AIRLOCK UNLOCKED.", "supervisor", 3000);
      } else if (!hasKeycard) {
        this.audio.playUI('click');
        this.dialogue.showSubtitle("[SECURITY LOCK ENGAGED] LEVEL 5 KEYCARD REQUIRED.", "supervisor", 4000);
      } else {
        focused.unlocked = true;
        focused.name = 'Security Airlock Door [UNLOCKED]';
        focused.keyLedMaterial.color.setHex(0x33ff66);
        focused.mesh.material = focused.mesh.material.clone();
        focused.mesh.material.color.setHex(0x61706a);
        this.audio.playUI('click');
        this.hud.showSplashBanner("ACCESS GRANTED", "SECURITY AIRLOCK UNLOCKED", 4500);
        this.dialogue.showSubtitle("LEVEL 5 CLEARANCE ACCEPTED. SECURITY AIRLOCK UNLOCKED.", "supervisor", 4000);
      }
    } else if (focused.type === 'computer_terminal') {
      this.audio.playUI('click');
      this.dialogue.showSubtitle("TERMINAL // DTE-04 STATUS: TETHER INTEGRITY 100%. TELEMETRY LINK WEAK. TIME ELAPSED: 00:04:12.", "supervisor", 4500);
    } else if (focused.type === 'level2_exit') {
      this.triggerLevel2Transition();
    }
  }

  triggerLevel2Transition() {
    this.audio.playUI('tape');
    this.dialogue.showSubtitle("DOOR UNSEALED. STEPPING INTO THE UNKNOWN...", "supervisor", 3500);

    // Audio glitch & door latch sound
    if (this.audio.synth) {
      this.audio.triggerBlackoutAudio();
    }

    setTimeout(() => {
      // 1. Switch level to Level 2 (Parking Garage)
      this.levelBuilder.switchLevel(2, new THREE.Vector3(0, 1.65, 0));

      // 2. Position player at Level 2 entrance
      this.player.position.set(0, 1.65, 0);
      this.player.camera.position.set(0, 1.65, 0);
      this.player.velocity.set(0, 0, 0);

      // 3. Switch ambient audio to subterranean garage drone
      this.audio.switchLevelAmbience(2);

      // 4. Update HUD objectives & notification
      this.state.setObjective("FIND AN EXIT (NO EXIT DETECTED)");
      this.dialogue.showSubtitle("LEVEL 2: THE SUBTERRANEAN GARAGE. THE CEILING IS TOO LOW. THE AIR IS STAGNANT.", "supervisor", 6000);
    }, 800);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.update();
    };
    loop();
  }

  update() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    if (this.isRunning && this.state.mode === GAME_MODES.GAMEPLAY) {
      // 1. Update Player
      this.player.update(delta, this.input);

      // 2. Dynamic Procedural Chunk Generation & World Streaming
      this.levelBuilder.update(this.player.position);

      // 3. Update Lights & Audio (10-minute Day/Night Cycle)
      this.lightManager.update(elapsedTime, this.player.position, delta);
      this.audio.update(delta, this.player.position);

      // 4. Update Stalker AI & Story Triggers
      this.entityDirector.update(delta);

      // 5. Update HUD & Power Grid Status
      this.hud.updateVitals(this.player.batteryLevel, this.player.stamina, this.player.sanity);
      this.hud.updateCompass(this.player.rotation.y, this.player.position);
      this.hud.updatePowerGrid(this.lightManager.getCycleInfo());
      this.hud.updateInteractivePrompt(this.player.focusedInteractive);
    } else if (this.state.mode === GAME_MODES.CUTSCENE) {
      // 10-Hour Escape Driving Cutscene & Night Highway Progression
      this.cutscene.update(delta);
      if (this.cutscene.phase === 'ignition' || this.cutscene.phase === 'garage_drive') {
        this.levelBuilder.update(this.renderer.camera.position);
        this.lightManager.update(elapsedTime, this.renderer.camera.position, delta);
      }
    } else if (this.state.mode === GAME_MODES.TITLE) {
      // Ensure flashlight and handheld models are not rendered in menu camera pan
      if (this.player.flashlightModel) this.player.flashlightModel.visible = false;
      this.player.flashlight.visible = false;
      if (this.player.fillLight) this.player.fillLight.visible = false;
      this.player.heldItemModels.forEach(m => m.visible = false);

      // Smooth Infinite Camera Pan through Level 2 Parking Garage
      const panSpeed = 1.6; // Meters per second walking glide
      this.titlePanPos.z -= panSpeed * delta;
      
      // Subtle organic head bobbing & wandering camera sway
      const bobY = Math.sin(elapsedTime * 3.5) * 0.04;
      const swayX = Math.sin(elapsedTime * 0.35) * 1.5;
      const swayAngle = Math.sin(elapsedTime * 0.25) * 0.08;

      this.renderer.camera.position.set(swayX, 1.45 + bobY, this.titlePanPos.z);
      this.renderer.camera.rotation.set(0, swayAngle, 0);

      // Infinite procedural chunk streaming for the garage background
      this.levelBuilder.update(this.renderer.camera.position);
      this.lightManager.update(elapsedTime, this.renderer.camera.position, delta);
    }

    // Render Scene through 1980s Retro Shaders
    this.renderer.render(elapsedTime);
  }
}

// Bootstrap once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
  engine.start();
});
