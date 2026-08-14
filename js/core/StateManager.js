/**
 * Game State & Narrative Story Sequence Manager
 */

import { CONFIG } from '../config.js';

export const GAME_MODES = {
  TITLE: 'TITLE',
  BRIEFING: 'BRIEFING',
  GAMEPLAY: 'GAMEPLAY',
  CUTSCENE: 'CUTSCENE',
  PAUSED: 'PAUSED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE'
};

export class StateManager {
  constructor(audioManager, hudManager) {
    this.audioManager = audioManager;
    this.hudManager = hudManager;
    this.mode = GAME_MODES.TITLE;

    // Narrative flags
    this.hasCrossedAnomaly = false;
    this.hasTetherBroken = false;
    this.foundCamp1 = false;
    this.foundFloodArea = false;
    this.foundObservation = false;
    this.chaseTriggered = false;
    this.chaseEscaped = false;
    this.foundFinalCamp = false;
    this.levelComplete = false;

    // Objective text state
    this.currentObjective = "FOLLOW THE ROPE TETHER INTO THE ANOMALY";
  }

  setMode(newMode) {
    this.mode = newMode;
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) {
      uiRoot.style.display = (newMode === GAME_MODES.GAMEPLAY) ? 'block' : 'none';
    }
  }

  setObjective(text) {
    this.currentObjective = text;
    if (this.hudManager) {
      this.hudManager.updateObjective(text);
    }
  }

  triggerTetherSever() {
    if (this.hasTetherBroken) return;
    this.hasTetherBroken = true;
    this.setObjective("FIND A WAY BACK");
    this.audioManager.setTensionState(CONFIG.TENSION_STATES.STATE_1_UNEASY);

    // Switch objective after 6 seconds to searching for team
    setTimeout(() => {
      this.setObjective("LOCATE THE MISSING RESEARCH TEAM");
    }, 6000);
  }

  triggerChaseSequence() {
    if (this.chaseTriggered) return;
    this.chaseTriggered = true;
    this.setObjective("RUN! FIND AN EXIT DOOR!");
    this.audioManager.setTensionState(CONFIG.TENSION_STATES.STATE_4_CHASE);
  }

  triggerChaseEscape() {
    if (this.chaseEscaped) return;
    this.chaseEscaped = true;
    this.setObjective("INVESTIGATE THE DESTROYED CAMPSITE");
    this.audioManager.setTensionState(CONFIG.TENSION_STATES.STATE_5_AFTERMATH);
  }

  triggerLevelComplete() {
    this.levelComplete = true;
    this.setMode(GAME_MODES.LEVEL_COMPLETE);
    const completeScreen = document.getElementById('level-complete-screen');
    if (completeScreen) completeScreen.style.display = 'flex';
  }
}
