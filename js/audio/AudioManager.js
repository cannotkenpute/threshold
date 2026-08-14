/**
 * 1980s Backrooms Audio Manager & 8-Channel Mixer Engine
 * Compliant with sound_design.md specifications.
 */

import { CONFIG } from '../config.js';
import { SoundSynthesizer } from './SoundSynthesizer.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.synth = null;
    this.isInitialized = false;

    // 8 Mixer Buses
    this.buses = {};
    this.masterGain = null;

    // Active nodes
    this.hvacNode = null;
    this.fluorescentNodes = [];
    this.chaseDroneNode = null;

    // Ambient event scheduler
    this.ambientCooldown = 12.0;
    this.currentTension = CONFIG.TENSION_STATES.STATE_0_SAFE;

    // Footstep deception tracking
    this.playerLastStepTime = 0;
    this.playerStoppedTime = 0;
    this.hasTriggeredDeception = false;
    this.isPlayerMoving = false;
    this.footstepBuffers = {
      level1: null,
      level2: null
    };
    this.currentLevel = 1;
  }

  init() {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.synth = new SoundSynthesizer(this.ctx);

    // Master Bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = CONFIG.AUDIO_VOLUMES.MASTER;
    this.masterGain.connect(this.ctx.destination);

    // 8 Sub-Buses
    const categories = ['AMBIENCE', 'ENVIRONMENT', 'PLAYER', 'ENTITY', 'MUSIC', 'VOICE', 'CASSETTE', 'UI'];
    categories.forEach(cat => {
      const bus = this.ctx.createGain();
      bus.gain.value = CONFIG.AUDIO_VOLUMES[cat] || 0.7;
      bus.connect(this.masterGain);
      this.buses[cat] = bus;
    });

    this.isInitialized = true;
    this.preloadFootstepAudio();
    this.startBaseAmbience();
  }

  async preloadFootstepAudio() {
    try {
      const loadBuf = async (url) => {
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        return await this.ctx.decodeAudioData(ab);
      };
      loadBuf('./assets/audio/carpet_walk_sound.mp3').then(buf => { this.footstepBuffers.level1 = buf; });
      loadBuf('./assets/audio/concrete_garage_footsteps_sound.mp3').then(buf => { this.footstepBuffers.level2 = buf; });
      loadBuf('./assets/audio/crowbar_creak.mp3').then(buf => { this.crowbarCreakBuffer = buf; });
      loadBuf('./assets/audio/car_unlock_click.mp3').then(buf => { this.carUnlockBuffer = buf; });
      loadBuf('./assets/audio/car_start.mp3').then(buf => { this.carStartBuffer = buf; });
    } catch (e) {
      console.warn("Could not preload audio files:", e);
    }
  }

  // Play a pre-loaded buffer through the ENVIRONMENT bus, returns the source node
  playBuffer(buffer, busName = 'ENVIRONMENT', gain = 1.0) {
    if (!this.isInitialized || !buffer) return null;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.buses[busName] || this.buses.UI);
      src.start();
      return src;
    } catch (e) {
      console.warn('playBuffer error:', e);
      return null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startBaseAmbience(level = 1) {
    if (!this.synth) return;
    if (this.hvacNode) {
      try { this.hvacNode.stop(); } catch(e) {}
    }
    if (level === 3) {
      this.hvacNode = this.synth.createHighwayNightDrone();
    } else if (level === 2) {
      this.hvacNode = this.synth.createGarageDrone();
    } else {
      this.hvacNode = this.synth.createHVACDrone();
    }
    this.hvacNode.gainNode.connect(this.buses.AMBIENCE);
  }

  switchLevelAmbience(level) {
    this.currentLevel = level;
    this.startBaseAmbience(level);
  }

  // Set audio tension state (0=Safe, 1=Uneasy, 2=Observed, 3=Danger, 4=Chase, 5=Aftermath)
  setTensionState(state) {
    this.currentTension = state;
    const t = this.ctx.currentTime;

    switch(state) {
      case CONFIG.TENSION_STATES.STATE_0_SAFE:
        this.buses.AMBIENCE.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.AMBIENCE, t, 1.5);
        this.buses.ENTITY.gain.setTargetAtTime(0.0, t, 1.0);
        if (this.chaseDroneNode) {
          this.chaseDroneNode.gainNode.gain.setTargetAtTime(0.0, t, 1.0);
        }
        break;

      case CONFIG.TENSION_STATES.STATE_1_UNEASY:
        this.buses.AMBIENCE.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.AMBIENCE * 0.9, t, 2.0);
        this.ambientCooldown = Math.min(this.ambientCooldown, 6.0);
        break;

      case CONFIG.TENSION_STATES.STATE_2_OBSERVED:
        // Lower background hum to make player hear subtle sounds
        this.buses.AMBIENCE.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.AMBIENCE * 0.6, t, 3.0);
        this.buses.ENTITY.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.ENTITY, t, 2.0);
        break;

      case CONFIG.TENSION_STATES.STATE_3_DANGER:
        // Severe drop in ambience (silence before attack)
        this.buses.AMBIENCE.gain.setTargetAtTime(0.2, t, 1.5);
        this.buses.ENTITY.gain.setTargetAtTime(1.0, t, 1.0);
        break;

      case CONFIG.TENSION_STATES.STATE_4_CHASE:
        // Full chase state
        this.buses.AMBIENCE.gain.setTargetAtTime(0.3, t, 0.5);
        this.buses.ENTITY.gain.setTargetAtTime(1.2, t, 0.5);
        if (!this.chaseDroneNode) {
          this.chaseDroneNode = this.synth.createChaseDrone();
          this.chaseDroneNode.gainNode.connect(this.buses.ENTITY);
        }
        this.chaseDroneNode.gainNode.gain.setTargetAtTime(0.7, t, 0.5);
        break;

      case CONFIG.TENSION_STATES.STATE_5_AFTERMATH:
        if (this.chaseDroneNode) {
          this.chaseDroneNode.gainNode.gain.setTargetAtTime(0.0, t, 2.0);
        }
        // Sudden silence after door slam
        this.buses.AMBIENCE.gain.setTargetAtTime(0.1, t, 0.3);
        this.buses.AMBIENCE.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.AMBIENCE * 0.7, t + 4.0, 3.0);
        break;
    }
  }

  // Trigger footstep sound
  playFootstep(surface = 'carpet', isPlayer = true, customGain = 1.0) {
    if (!this.isInitialized) return;
    const bus = isPlayer ? this.buses.PLAYER : this.buses.ENTITY;

    // Use authentic audio samples for Level 1 & Level 2 footsteps
    const buf = (this.currentLevel === 2) ? this.footstepBuffers.level2 : this.footstepBuffers.level1;
    if (buf && buf.duration > 0.1) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      // Organic pitch variation for authentic step texture
      const pitchVariance = (Math.random() - 0.5) * 0.14;
      src.playbackRate.value = 1.0 + pitchVariance;

      const gainNode = this.ctx.createGain();
      const stepVol = (this.currentLevel === 2 ? 0.7 : 0.8) * customGain;
      const now = this.ctx.currentTime;
      const singleStepDuration = 0.28; // Cut length of a single discrete footstep impact

      // Rapid attack & smooth exponential decay for a crisp single-step hit
      gainNode.gain.setValueAtTime(stepVol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + singleStepDuration);

      src.connect(gainNode);
      gainNode.connect(bus);

      // Random offset slice into the continuous walking track
      const maxOffset = Math.max(0, buf.duration - singleStepDuration - 0.2);
      const cueOffset = (Math.random() * maxOffset);

      src.start(now, cueOffset, singleStepDuration);
      this.activeFootstepNode = { src, gainNode };
    } else {
      // Procedural synthesizer fallback
      const node = this.synth.playFootstep(surface, isPlayer, customGain);
      node.connect(bus);
    }

    if (isPlayer) {
      this.playerLastStepTime = performance.now();
      this.hasTriggeredDeception = false;
      this.isPlayerMoving = true;
    }
  }

  notifyPlayerStopped() {
    this.isPlayerMoving = false;
    this.playerStoppedTime = performance.now();
    
    // Immediately cut off any active trailing footstep sound when player stops
    if (this.activeFootstepNode && this.activeFootstepNode.gainNode) {
      try {
        const now = this.ctx.currentTime;
        this.activeFootstepNode.gainNode.gain.cancelScheduledValues(now);
        this.activeFootstepNode.gainNode.gain.setValueAtTime(this.activeFootstepNode.gainNode.gain.value, now);
        this.activeFootstepNode.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      } catch (e) {}
      this.activeFootstepNode = null;
    }
  }

  // Update loop for dynamic events and footstep deception (called from main game loop)
  update(delta, playerPos) {
    if (!this.isInitialized) return;

    // Ambient random events timer
    this.ambientCooldown -= delta;
    if (this.ambientCooldown <= 0) {
      this.triggerRandomAmbientSound();
      // Reset cooldown depending on tension
      const minCD = this.currentTension >= CONFIG.TENSION_STATES.STATE_2_OBSERVED ? 8 : 16;
      const maxCD = this.currentTension >= CONFIG.TENSION_STATES.STATE_2_OBSERVED ? 22 : 36;
      this.ambientCooldown = minCD + Math.random() * (maxCD - minCD);
    }

    // Footstep Deception Logic (sound_design.md #834)
    // When the player was walking and abruptly stops, 20% chance to play 1-2 delayed footsteps nearby
    if (!this.isPlayerMoving && !this.hasTriggeredDeception && this.currentTension >= CONFIG.TENSION_STATES.STATE_1_UNEASY) {
      const timeSinceStop = performance.now() - this.playerStoppedTime;
      if (timeSinceStop > 1200 && timeSinceStop < 2800) {
        this.hasTriggeredDeception = true;
        if (Math.random() < 0.35) {
          // Delayed footstep in adjacent room
          setTimeout(() => {
            if (!this.isPlayerMoving) {
              this.playFootstep('carpet', false, 0.4);
            }
          }, 350 + Math.random() * 500);
        }
      }
    }
  }

  triggerRandomAmbientSound() {
    const chance = Math.random();
    if (chance < 0.5) {
      // Distant metal groan / impact
      const dist = 12 + Math.random() * 20;
      const node = this.synth.playDistantMetalImpact(dist);
      node.connect(this.buses.ENVIRONMENT);
    } else if (chance < 0.8) {
      // Distant foreign footstep
      this.playFootstep('carpet', false, 0.35);
    }
  }

  // Play UI Sound
  playUI(type) {
    if (!this.isInitialized) return;
    if (type === 'click') {
      const node = this.synth.playSwitchClick(true);
      node.connect(this.buses.UI);
    } else if (type === 'battery') {
      const node = this.synth.playBatteryInsert();
      node.connect(this.buses.UI);
    } else if (type === 'tape') {
      const node = this.synth.playTapeMechanicalClick('play');
      node.connect(this.buses.UI);
    }
  }

  // --- DAY/NIGHT GRID POWER AUDIO TRIGGERS ---
  triggerBlackoutAudio() {
    if (!this.isInitialized || !this.synth) return;
    const node = this.synth.playBlackoutEvent();
    node.connect(this.buses.ENVIRONMENT);
    // Lower base HVAC ambience during blackout
    if (this.buses.AMBIENCE) {
      this.buses.AMBIENCE.gain.setTargetAtTime(0.25, this.ctx.currentTime, 0.8);
    }
  }

  triggerPowerRestoreAudio() {
    if (!this.isInitialized || !this.synth) return;
    const node = this.synth.playPowerRestoreEvent();
    node.connect(this.buses.ENVIRONMENT);
    // Restore base ambience
    if (this.buses.AMBIENCE) {
      this.buses.AMBIENCE.gain.setTargetAtTime(CONFIG.AUDIO_VOLUMES.AMBIENCE, this.ctx.currentTime, 1.5);
    }
  }

  // Play dialogue audio through 1980s radio filter
  async playRadioVoiceAudio(audioUrl) {
    if (!this.isInitialized) return;
    try {
      // Play initial radio click/squelch
      this.playUI('click');

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;

      const radioChain = this.synth.createRadioVoiceChain();
      source.connect(radioChain.input);
      radioChain.output.connect(this.buses.VOICE);

      source.onended = () => {
        radioChain.stopHiss();
        this.playUI('click'); // Radio end squelch
      };

      source.start();
      return source;
    } catch (err) {
      console.warn('Failed to load or play radio voice audio:', err);
    }
  }
}
