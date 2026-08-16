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
import { SurvivalState } from './entities/SurvivalState.js';
import { EntityDirector } from './entities/EntityDirector.js';
import { Inventory } from './items/Inventory.js';
import { HUDManager } from './ui/HUD.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { CassetteUI } from './ui/CassetteUI.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { OptionsUI } from './ui/OptionsUI.js';
import { ArchiveUI } from './ui/ArchiveUI.js';
import { EscapeCutscene } from './cinematics/EscapeCutscene.js';
import { OpeningSequence } from './cinematics/OpeningSequence.js';

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
    this.tetherSnapStep = 50;
    this.hasShownEntranceLoss = false;

    // State & Core 3D
    this.state = new StateManager(this.audio, this.hud);
    this.renderer = new RetroRenderer(this.container);
    // Levels 1 & 2 are lit entirely by the fluorescent light pool -- the directional
    // shadow pass is pure wasted GPU work indoors. Disabled before the first render so
    // no material program is ever compiled with shadow support; Level 3 re-enables it.
    this.renderer.renderer.shadowMap.enabled = false;
    this.renderer.sunLight.castShadow = false;
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

    // Cinematics System
    this.cutscene = new EscapeCutscene(this.renderer, this.audio, this.state, this.hud, this.dialogue, this.player, this.input, this.levelBuilder);
    this.openingSequence = new OpeningSequence(this.renderer, this.audio, this.state, () => this.launchGameplay());

    // Clock
    this.clock = new THREE.Clock();
    this.isRunning = false;

    // Fixed-timestep accumulator & HUD throttle bookkeeping
    this._physicsAcc = 0;
    this._hudTimer = 0;

    this.initTitleScreen();
    this.setupModalDismiss();
  }

  startGame() {
    if (this.state.mode === GAME_MODES.GAMEPLAY || this.state.mode === GAME_MODES.BRIEFING) return;

    try {
      this.audio.init();
      this.audio.resume();
    } catch (e) {
      console.warn("Audio init warning:", e);
    }
    this.audio.stopTitleMusic();

    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';

    this.state.setMode(GAME_MODES.BRIEFING);
    this.openingSequence.start();
  }

  launchGameplay() {
    if (this.state.mode === GAME_MODES.GAMEPLAY) return;

    try {
      this.audio.init();
      this.audio.resume();
      this.audio.switchLevelAmbience(1);
    } catch (e) {
      console.warn("Audio init warning:", e);
    }

    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';

    // Reveal flashlight model for gameplay
    if (this.player && this.player.flashlightModel) this.player.flashlightModel.visible = true;

    // Story Mode never shows the Survival Mode Hunger/Thirst HUD
    if (this.hud && this.hud.survivalVitalsContainer) {
      this.hud.survivalVitalsContainer.style.display = 'none';
    }

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
  }

  initTitleScreen() {
    const startBtn = document.getElementById('btn-start-game');

    this.showChangelog();

    // Unlock the AudioContext and start looping title music on the first user
    // gesture (browsers block autoplay until an interaction). Entering story or
    // survival mode stops it via stopTitleMusic() in those entry points.
    const unlockTitleAudio = () => {
      if (this.state.mode !== GAME_MODES.TITLE) return;
      try {
        if (!this.audio.isInitialized) {
          this.audio.init();
          this.audio.resume();
        }
      } catch (e) {}
      this.audio.startTitleMusic();
    };
    // Registered in the CAPTURE phase (the `true` third argument) so this always fires first,
    // before any element's own bubble-phase handler -- e.g. btn-start-game's pointerdown
    // listener below calls stopPropagation(), which would otherwise silently prevent this
    // from ever running when that button is the user's first interaction with the page.
    window.addEventListener('pointerdown', unlockTitleAudio, true);
    window.addEventListener('keydown', unlockTitleAudio, true);

    // Title screen "OPTIONS" button opens the settings modal in title mode
    const titleOptionsBtn = document.getElementById('btn-title-options');
    if (titleOptionsBtn && this.optionsUI) {
      titleOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.init();
        this.audio.resume();
        this.audio.startTitleMusic();
        this.optionsUI.openTitle();
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startGame();
      });
      startBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startGame();
      });
    }

    // Allow pressing Space or Enter on Title Screen to start game
    window.addEventListener('keydown', (e) => {
      if (this.state.mode === GAME_MODES.TITLE && (e.code === 'Enter' || e.code === 'Space')) {
        if (this.optionsUI && this.optionsUI.isOpen) return;
        e.preventDefault();
        this.startGame();
      }
    });

    const restartBtn = document.getElementById('btn-restart-game');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }

    const survivalBtn = document.getElementById('btn-survival-mode');
    if (survivalBtn) {
      survivalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.launchSurvivalMode();
      });
    }

    const survivalReturnBtn = document.getElementById('btn-survival-return');
    if (survivalReturnBtn) {
      survivalReturnBtn.addEventListener('click', () => {
        // Simplest correct reset for Survival Mode's permadeath end screen.
        window.location.reload();
      });
    }
  }

  // Shows a "what changed" bulletin on the title screen once per new version, gated by
  // localStorage so returning players aren't nagged on every visit. Dismissing it is a real
  // click on the page, which doubles as the gesture that unlocks title-screen audio.
  showChangelog() {
    const ENTRIES = [
      { tag: 'new', text: 'SURVIVAL PROTOCOL added to the main menu -- an endless, permadeath survival mode with Hunger, Thirst, and Fear Factor sustainment systems. Early build; expect rough edges.' },
      { tag: 'changed', text: '[E] now handles both examining/picking up items AND using whatever is in your active inventory slot -- no separate key or right-click needed.' },
      { tag: 'fixed', text: 'Various stability fixes to procedural level generation, item pickups, and audio.' }
    ];

    const modal = document.getElementById('changelog-modal');
    const body = document.getElementById('changelog-body');
    const dismissBtn = document.getElementById('btn-changelog-dismiss');
    if (!modal || !body || !dismissBtn) return;

    // Always shown on load -- this is also what supplies the guaranteed first click that
    // unlocks title-screen audio, so it needs to appear every time, not just once per version.
    body.innerHTML = ENTRIES.map(entry => `
      <div class="changelog-entry">
        <span class="changelog-tag ${entry.tag}">${entry.tag.toUpperCase()}</span>
        <span class="changelog-text">${entry.text}</span>
      </div>
    `).join('');

    modal.classList.add('active');

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      modal.classList.remove('active');
    };

    // Three independent, guaranteed ways to close this regardless of how the layout renders
    // on the player's screen: the button itself, clicking the dark backdrop outside the paper,
    // and Escape -- the last two don't depend on the button being reachable/visible at all.
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismiss();
    });
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.key === 'Escape') && modal.classList.contains('active')) {
        dismiss();
      }
    });
  }

  // Entry point for the title screen's "SURVIVAL PROTOCOL" button. Reuses the bounded
  // Level 1 geometry as the survival space (per the design review's "bounded, reused map"
  // call), and layers Hunger/Thirst/Fear-Factor sustainment systems on top of the shared
  // core gameplay loop. Permadeath applies -- see Player.handleDeath().
  launchSurvivalMode() {
    if (this.state.mode === GAME_MODES.SURVIVAL) return;

    try {
      this.audio.init();
      this.audio.resume();
      this.audio.switchLevelAmbience(1);
    } catch (e) {
      console.warn("Audio init warning:", e);
    }
    this.audio.stopTitleMusic();

    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';

    // Reveal flashlight model for gameplay
    if (this.player && this.player.flashlightModel) this.player.flashlightModel.visible = true;

    // Load Level 1 Yellow Sector and reset player spawn position, same as story mode.
    // survivalMode/scarcityMultiplier must be set BEFORE buildFullLevel() -- it synchronously
    // streams and generates the initial 5x5 chunk grid (including the two chunks around the
    // origin that never unload for the rest of the run), so setting it after would permanently
    // lock the starting area to the story item pool.
    this.levelBuilder.survivalMode = true;
    this.levelBuilder.survivalScarcityMultiplier = 1.0;
    this.levelBuilder.buildFullLevel();
    this.player.position.set(0, 1.65, 20);
    this.player.camera.position.set(0, 1.65, 20);
    this.player.velocity.set(0, 0, 0);

    // Establish Survival sustainment systems & permadeath
    this.player.survivalState = new SurvivalState(this.player);
    this.player.isSurvivalMode = true;
    // Read the real current phase rather than assuming 'DAY' -- safe today since every exit
    // path does a full page reload, but this avoids a spurious cycle-1 incrementing itself if
    // that ever changes.
    this.survivalLastPhase = this.lightManager.getCycleInfo().phase;
    this.survivalEnded = false;

    if (this.hud && this.hud.survivalVitalsContainer) {
      this.hud.survivalVitalsContainer.style.display = 'flex';
    }

    this.state.setMode(GAME_MODES.SURVIVAL);
    this.input.requestLock();
    this.isRunning = true;
  }

  // Called each frame while in GAME_MODES.SURVIVAL: advances hunger/thirst/Fear Factor,
  // tracks the day/night cycle count into item-spawn scarcity, and watches for death.
  updateSurvivalMode(delta) {
    const survivalState = this.player.survivalState;
    if (!survivalState || this.survivalEnded) return;

    survivalState.tick(delta);

    // Cycle counter: increments each time the grid cycle transitions into DAWN
    const cycleInfo = this.lightManager.getCycleInfo();
    if (cycleInfo.phase === 'DAWN' && this.survivalLastPhase !== 'DAWN') {
      survivalState.cycleNumber++;
    }
    this.survivalLastPhase = cycleInfo.phase;

    // Day/night cycle count -> item spawn scarcity
    this.levelBuilder.survivalScarcityMultiplier = CONFIG.SURVIVAL.scarcityMultiplier(survivalState.cycleNumber);

    // Hunger/Thirst HUD (Fear Factor is intentionally never shown as a number/bar)
    if (this.hud) this.hud.updateSurvivalVitals(survivalState.hunger, survivalState.thirst);

    if (survivalState.isDead) {
      this.triggerSignalLost();
    }
  }

  // Survival Mode permadeath end screen: shows time survived & cycles survived, then
  // freezes further Survival ticking. "RETURN TO TITLE" reloads the page (see initTitleScreen).
  triggerSignalLost() {
    if (this.survivalEnded) return;
    this.survivalEnded = true;
    this.isRunning = false;
    this.input.exitLock();

    // A safe non-gameplay state: nothing in update() handles PAUSED, so the per-frame
    // Survival/GAMEPLAY subsystems stop advancing while the last frame stays rendered.
    this.state.setMode(GAME_MODES.PAUSED);

    const survivalState = this.player.survivalState;
    const totalSeconds = Math.floor(survivalState ? survivalState.timeSurvived : 0);
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');

    const timeEl = document.getElementById('signal-lost-time');
    if (timeEl) timeEl.textContent = `${mins}:${secs}`;
    const cyclesEl = document.getElementById('signal-lost-cycles');
    if (cyclesEl) cyclesEl.textContent = survivalState ? survivalState.cycleNumber : 1;

    const screen = document.getElementById('signal-lost-screen');
    if (screen) screen.style.display = 'flex';
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
    if (this.state.mode !== GAME_MODES.GAMEPLAY && this.state.mode !== GAME_MODES.SURVIVAL) return;

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
    if (!focused) {
      // Nothing in the world to pick up/examine -- fall back to using the active inventory slot,
      // so [E] alone covers both actions (no separate right-click/trackpad gesture needed).
      this.inventory.useSlot(this.inventory.activeSlotIndex, this.player);
      return;
    }

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
    } else if (focused.type === 'ration_pack') {
      this.inventory.addItem('ration_pack', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.dialogue.showSubtitle("Collected: DSA Field Ration Pack", "mercer", 2500);
    } else if (focused.type === 'canteen_water') {
      this.inventory.addItem('canteen_water', this.player);
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.dialogue.showSubtitle("Collected: Military Canteen", "mercer", 2500);
    } else if (this.state.mode !== GAME_MODES.GAMEPLAY) {
      // Everything below this point is story-progression interaction (keys, doors, tapes,
      // cutscene triggers, etc). Survival Mode must never be able to trigger it.
      return;
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
    } else if (focused.type === 'convenience_store_key') {
      if (!this.inventory.addItem('convenience_store_key', this.player)) {
        this.dialogue.showSubtitle("Inventory full. Clear a slot for the store key.", "mercer", 2500);
        return;
      }
      this.levelBuilder.hasConvenienceStoreKeyCollected = true;
      this.renderer.scene.remove(focused.mesh);
      this.levelBuilder.interactiveObjects = this.levelBuilder.interactiveObjects.filter(o => o !== focused);
      this.player.focusedInteractive = null;
      this.hud.showSplashBanner("KEY ACQUIRED", "ROADSIDE CONVENIENCE STORE", 3500);
      this.dialogue.showSubtitle("A key. It might fit the convenience store door.", "mercer", 3000);
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
    } else if (focused.type === 'highway_reed_store_tape') {
      this.inventory.addItem('highway_reed_store_tape', this.player);
      if (this.archiveUI) this.archiveUI.unlockLog('highway_reed_store_tape');
      this.cassetteUI.openWithTape(CONFIG.NARRATIVE.HIGHWAY_REED_STORE_LOG);
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
    } else if (focused.type === 'locked_convenience_store_door') {
      const hasStoreKey = this.inventory.primarySlots.some(slot => slot && slot.id === 'convenience_store_key');
      if (!hasStoreKey) {
        this.audio.playUI('click');
        this.dialogue.showSubtitle("The convenience store is locked. The key must be nearby.", "mercer", 3500);
      } else {
        focused.unlocked = true;
        focused.name = 'Convenience Store Entrance [UNLOCKED]';
        this.levelBuilder.isConvenienceStoreUnlocked = true;
        this.levelBuilder.unregisterCollider(focused.doorCollider);
        if (focused.doorVisual) focused.doorVisual.visible = false;
        if (focused.padlock) focused.padlock.visible = false;
        focused.mesh.visible = false;
        this.audio.playUI('click');
        this.hud.showSplashBanner("DOOR UNLOCKED", "CONVENIENCE STORE ACCESS GRANTED", 3500);
        this.dialogue.showSubtitle("The old key turns. The store is open.", "mercer", 3000);
      }
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
        focused.name = 'Security Airlock Door [OPEN]';
        focused.keyLedMaterial.color.setHex(0x33ff66);
        focused.mesh.material = focused.mesh.material.clone();
        focused.mesh.material.color.setHex(0x61706a);
        this.levelBuilder.unregisterCollider(focused.doorCollider);

        const door = focused.mesh;
        const closedY = door.position.y;
        const openedY = closedY + 2.65;
        const animationStart = performance.now();
        const animateDoor = (now) => {
          const progress = Math.min(1, (now - animationStart) / 900);
          const eased = 1 - Math.pow(1 - progress, 3);
          door.position.y = THREE.MathUtils.lerp(closedY, openedY, eased);
          if (progress < 1) requestAnimationFrame(animateDoor);
        };
        requestAnimationFrame(animateDoor);

        this.audio.playUI('click');
        this.hud.showSplashBanner("ACCESS GRANTED", "LEVEL 5 LABORATORY AIRLOCK OPEN", 4500);
        this.dialogue.showSubtitle("LEVEL 5 CLEARANCE ACCEPTED. LABORATORY AIRLOCK OPEN.", "supervisor", 4000);
      }
    } else if (focused.type === 'computer_terminal') {
      this.audio.playUI('click');
      this.dialogue.showSubtitle("TERMINAL // DTE-04 STATUS: TETHER INTEGRITY 100%. TELEMETRY LINK WEAK. TIME ELAPSED: 00:04:12.", "supervisor", 4500);
    } else if (focused.type === 'department_seal') {
      this.audio.playUI('click');
      this.dialogue.showSubtitle("UNITED STATES DEPARTMENT OF SPATIAL ANOMALY // \"OBSERVE • CONTAIN • UNDERSTAND\"", "supervisor", 4000);
    } else if (focused.type === 'containment_note') {
      this.inventoryUI.showDocument(CONFIG.NARRATIVE.LAB_SUBSTANCE_29_NOTE);
    } else if (focused.type === 'vaughn_resignation') {
      this.inventoryUI.showDocument(CONFIG.NARRATIVE.VAUGHN_RESIGNATION_LETTER);
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

    const isStoryMode = this.state.mode === GAME_MODES.GAMEPLAY;
    const isSurvivalMode = this.state.mode === GAME_MODES.SURVIVAL;

    if (this.isRunning && (isStoryMode || isSurvivalMode)) {
      // 1. Player: fixed-timestep simulation (identical movement & cadence at any fps),
      //    then per-frame look/raycast. Max 6 steps per frame guards the spiral of death;
      //    leftover backlog is discarded rather than accumulated.
      const fixedH = 1 / CONFIG.PERF.PHYSICS_HZ;
      this._physicsAcc = Math.min(this._physicsAcc + delta, fixedH * CONFIG.PERF.MAX_PHYSICS_STEPS);
      let steps = 0;
      while (this._physicsAcc >= fixedH && steps < CONFIG.PERF.MAX_PHYSICS_STEPS) {
        this.player.physicsStep(fixedH, this.input);
        this._physicsAcc -= fixedH;
        steps++;
      }
      if (steps === CONFIG.PERF.MAX_PHYSICS_STEPS) this._physicsAcc = 0;
      this.player.updateLook(delta, this.input);

      if (isStoryMode) {
        // Story loop: tether follows the player, snaps after roughly 50 footsteps,
        // then the return doorway disappears only when the player heads back.
        this.shiftingSpace.updateTether(this.player.position, this.state.hasTetherBroken);
        if (
          this.player.hasCrossedPortal &&
          this.player.stepCount >= this.tetherSnapStep &&
          !this.state.hasTetherBroken
        ) {
          const snapped = this.shiftingSpace.severTether(this.player.position, this.audio);
          if (snapped) {
            this.hud.showSplashBanner("TETHER FAILURE", "PHYSICAL LINK SEVERED — RETURN TO THE GATEWAY", 5000);
            this.dialogue.showSubtitle("The tether snapped. The line has gone slack behind you.", "mercer", 4500);
          }
        }

        if (
          this.state.hasTetherBroken &&
          !this.hasShownEntranceLoss &&
          this.shiftingSpace.updateEntranceLoss(this.player.position, this.audio)
        ) {
          this.hasShownEntranceLoss = true;
          this.hud.showSplashBanner("RETURN PATH LOST", "THE FACILITY DOORWAY HAS DISAPPEARED", 5500);
          this.dialogue.showSubtitle("The doorway is gone. There is only wallpaper where the facility should be.", "mercer", 5000);
        }
      }

      // 2. Dynamic Procedural Chunk Generation & World Streaming (shared core subsystem)
      this.levelBuilder.update(this.player.position);
      this.levelBuilder.updateWallpaperLOD(this.renderer.camera);
      if (isStoryMode) {
        // Void Perimeter is a story-specific narrative beat (return-path loss), not shared.
        this.shiftingSpace.updatePerimeterVoid(this.player, this.renderer, this.dialogue, this.audio, delta);
      }

      // 3. Update Lights & Audio (10-minute Day/Night Cycle) -- shared core subsystem
      this.lightManager.update(elapsedTime, this.player.position, delta);
      this.audio.update(delta, this.player.position);

      if (isStoryMode) {
        // 4. Stalker AI & Story Triggers (story-mode only -- Mimic is explicitly deferred)
        this.entityDirector.update(delta);
      }

      // 5. Update HUD: compass every frame (compositor-friendly transform), everything
      // else throttled to 10Hz with memoized DOM writes inside HUDManager.
      this._hudTimer += delta;
      if (this._hudTimer >= CONFIG.PERF.HUD_UPDATE_INTERVAL) {
        this._hudTimer = 0;
        this.hud.updateVitals(this.player.batteryLevel, this.player.stamina, this.player.sanity, this.player.health);
        this.hud.updatePowerGrid(this.lightManager.getCycleInfo());
        this.hud.updateInteractivePrompt(this.player.focusedInteractive);
      }
      this.hud.updateCompass(this.player.rotation.y, this.player.position);

      if (isSurvivalMode) {
        // 6. Survival Mode: Hunger/Thirst/Fear Factor ticking, cycle-driven scarcity, death check
        this.updateSurvivalMode(delta);
      }
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

    // Update Real-Time Telemetry FPS Counter
    if (this.hud) this.hud.updateFPS();

    // Render Scene through 1980s Retro Shaders
    this.renderer.render(elapsedTime);
  }
}

// Bootstrap once DOM is loaded or immediately if already ready
function bootstrap() {
  if (window.gameEngine) return;
  const engine = new GameEngine();
  window.gameEngine = engine;
  window.startGame = () => engine.startGame();
  engine.start();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
