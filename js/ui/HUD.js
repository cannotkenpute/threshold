/**
 * 1980s HUD Manager: Analog Meters, Mechanical Compass, Quick Slots & Objectives
 */

export class HUDManager {
  constructor() {
    this.crosshair = document.getElementById('crosshair');
    this.interactPrompt = document.getElementById('interact-prompt');
    this.vitalsContainer = document.querySelector('.retro-vitals-container');
    this.healthPercentText = document.getElementById('health-percent-text');
    this.healthSegments = document.querySelectorAll('#health-segments .h-seg');
    this.ecgIcon = document.querySelector('.ecg-icon');
    this.batterySegments = document.querySelectorAll('#battery-segments .seg');
    this.batteryContainer = document.getElementById('battery-segments');
    this.batteryPercentText = document.getElementById('battery-percent-text');
    this.staminaBar = document.getElementById('stamina-level-bar');
    this.compassNeedle = document.getElementById('compass-needle');
    this.objectiveText = document.getElementById('objective-text');
    this.quickSlots = document.querySelectorAll('.slot-box');
    this.gridStatusText = document.getElementById('grid-status-text');
    this.gridTimerText = document.getElementById('grid-timer-text');
    this.fpsValueText = document.getElementById('fps-value-text');
    this.fpsWidget = document.getElementById('fps-counter-widget');
    this.fpsFrameCount = 0;
    this.fpsLastTime = performance.now();
    this.currentFps = 60;

    // Survival Mode: Hunger / Thirst vitals (hidden container unless Survival is active)
    this.survivalVitalsContainer = document.getElementById('survival-vitals-container');
    this.hungerSegments = document.querySelectorAll('#hunger-segments .seg');
    this.hungerContainer = document.getElementById('hunger-segments');
    this.hungerPercentText = document.getElementById('hunger-percent-text');
    this.thirstSegments = document.querySelectorAll('#thirst-segments .seg');
    this.thirstContainer = document.getElementById('thirst-segments');
    this.thirstPercentText = document.getElementById('thirst-percent-text');
    this.drawCallsText = document.getElementById('draw-calls-text');
    this.triCountText = document.getElementById('tri-count-text');

    // Memoized-write bookkeeping: the HUD refresh is throttled to 10Hz, and these caches
    // additionally skip the remaining string/className writes when nothing visibly changed.
    // Rebuilding ~20 DOM strings every call was a steady main-thread style-recalc cost.
    this._lastHealth = -1;
    this._lastBattery = -1;
    this._lastStaminaPct = -1;
    this._lastPhase = '';
    this._lastGridTimer = '';
    this._lastPromptText = null;
    this._lastPromptVisible = null;
    this._lastSurvivalHunger = -1;
    this._lastSurvivalThirst = -1;
  }

  updateFPS() {
    this.fpsFrameCount++;
    const now = performance.now();
    const elapsed = now - this.fpsLastTime;
    if (elapsed >= 250) {
      this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.fpsFrameCount = 0;
      this.fpsLastTime = now;

      if (this.fpsValueText) {
        this.fpsValueText.textContent = this.currentFps;
      }
      if (this.fpsWidget) {
        if (this.currentFps >= 50) {
          this.fpsWidget.className = 'fps-counter-widget fps-good';
        } else if (this.currentFps >= 30) {
          this.fpsWidget.className = 'fps-counter-widget fps-warning';
        } else {
          this.fpsWidget.className = 'fps-counter-widget fps-critical';
        }
      }

      // Draw calls are the usual ceiling on a scene built from many small meshes; showing them
      // next to FPS makes it obvious whether a slowdown is submission-bound or something else.
      const r = window.gameRenderer && window.gameRenderer.renderer;
      if (r && r.info) {
        if (this.drawCallsText) this.drawCallsText.textContent = r.info.render.calls;
        if (this.triCountText) {
          const tris = r.info.render.triangles;
          this.triCountText.textContent = tris > 1000 ? `${Math.round(tris / 1000)}k` : tris;
        }
      }
    }
  }

  updatePowerGrid(cycleInfo) {
    if (!cycleInfo) return;
    if (this.gridStatusText && cycleInfo.phase !== this._lastPhase) {
      this._lastPhase = cycleInfo.phase;
      this.gridStatusText.className = `grid-status ${cycleInfo.phase.toLowerCase()}`;
      if (cycleInfo.phase === 'DAY') {
        this.gridStatusText.textContent = 'ACTIVE [DAY]';
      } else if (cycleInfo.phase === 'DUSK') {
        this.gridStatusText.textContent = 'BROWNOUT [DUSK]';
      } else if (cycleInfo.phase === 'NIGHT') {
        this.gridStatusText.textContent = 'BLACKOUT [NIGHT]';
      } else if (cycleInfo.phase === 'DAWN') {
        this.gridStatusText.textContent = 'REBOOTING [DAWN]';
      }
    }

    if (this.gridTimerText) {
      const remaining = Math.max(0, Math.floor(cycleInfo.totalDuration - cycleInfo.cycleTime));
      const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
      const secs = (remaining % 60).toString().padStart(2, '0');
      const timerText = `${mins}:${secs}`;
      if (timerText !== this._lastGridTimer) {
        this._lastGridTimer = timerText;
        this.gridTimerText.textContent = timerText;
      }
    }
  }

  updateVitals(battery, stamina, sanity, health = 100) {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(health)));
    const clampedBattery = Math.max(0, Math.min(100, Math.round(battery)));
    const staminaPct = Math.max(0, Math.min(100, Math.round(stamina)));

    // 1. Update Retro Biometric Health / Vitals (only when the rounded value changed)
    if (clampedHealth !== this._lastHealth) {
      this._lastHealth = clampedHealth;

      if (this.healthPercentText) {
        this.healthPercentText.textContent = `${clampedHealth}%`;
        if (clampedHealth <= 25) {
          this.healthPercentText.className = 'health-percent critical';
        } else if (clampedHealth <= 55) {
          this.healthPercentText.className = 'health-percent warning';
        } else {
          this.healthPercentText.className = 'health-percent nominal';
        }
      }

      if (this.healthSegments && this.healthSegments.length > 0) {
        // 10 Segments: each represents 10% health
        const activeSegs = Math.ceil(clampedHealth / 10);
        this.healthSegments.forEach((seg, idx) => {
          seg.className = 'h-seg';
          if (idx < activeSegs) {
            if (clampedHealth <= 25) {
              seg.classList.add('danger');
            } else if (clampedHealth <= 55) {
              seg.classList.add('warning');
            } else {
              seg.classList.add('active');
            }
          }
        });

        if (this.vitalsContainer) {
          if (clampedHealth <= 25) {
            this.vitalsContainer.className = 'analog-meter-container retro-vitals-container critical';
          } else if (clampedHealth <= 55) {
            this.vitalsContainer.className = 'analog-meter-container retro-vitals-container warning';
          } else {
            this.vitalsContainer.className = 'analog-meter-container retro-vitals-container';
          }
        }
      }
    }

    // 2. Update Numerical Battery Percentage + 4-Segment Retro Battery Cells
    if (clampedBattery !== this._lastBattery) {
      this._lastBattery = clampedBattery;

      if (this.batteryPercentText) {
        this.batteryPercentText.textContent = `${clampedBattery}%`;
        if (clampedBattery < 20) {
          this.batteryPercentText.className = 'battery-percent low';
        } else {
          this.batteryPercentText.className = 'battery-percent';
        }
      }

      if (this.batterySegments && this.batterySegments.length > 0) {
        const activeSegs = Math.ceil(clampedBattery / 25);
        this.batterySegments.forEach((seg, idx) => {
          seg.className = 'seg';
          if (idx < activeSegs) {
            if (clampedBattery <= 20) {
              seg.classList.add('danger');
            } else if (clampedBattery <= 45) {
              seg.classList.add('warning');
            } else {
              seg.classList.add('active');
            }
          }
        });

        if (this.batteryContainer) {
          if (clampedBattery <= 20) {
            this.batteryContainer.classList.add('low');
          } else {
            this.batteryContainer.classList.remove('low');
          }
        }
      }
    }

    // 3. Update Exertion Stamina Bar
    if (staminaPct !== this._lastStaminaPct) {
      this._lastStaminaPct = staminaPct;
      if (this.staminaBar) {
        this.staminaBar.style.width = `${staminaPct}%`;
      }
    }
  }

  updateSurvivalVitals(hunger, thirst) {
    const clampedHunger = Math.max(0, Math.min(100, Math.round(hunger)));
    const clampedThirst = Math.max(0, Math.min(100, Math.round(thirst)));

    if (clampedHunger === this._lastSurvivalHunger && clampedThirst === this._lastSurvivalThirst) return;
    this._lastSurvivalHunger = clampedHunger;
    this._lastSurvivalThirst = clampedThirst;

    if (this.hungerPercentText) {
      this.hungerPercentText.textContent = `${clampedHunger}%`;
      this.hungerPercentText.className = clampedHunger < 20 ? 'battery-percent low' : 'battery-percent';
    }
    if (this.hungerSegments && this.hungerSegments.length > 0) {
      const activeSegs = Math.ceil(clampedHunger / 25);
      this.hungerSegments.forEach((seg, idx) => {
        seg.className = 'seg';
        if (idx < activeSegs) {
          if (clampedHunger <= 20) {
            seg.classList.add('danger');
          } else if (clampedHunger <= 45) {
            seg.classList.add('warning');
          } else {
            seg.classList.add('active');
          }
        }
      });
      if (this.hungerContainer) {
        if (clampedHunger <= 20) {
          this.hungerContainer.classList.add('low');
        } else {
          this.hungerContainer.classList.remove('low');
        }
      }
    }

    if (this.thirstPercentText) {
      this.thirstPercentText.textContent = `${clampedThirst}%`;
      this.thirstPercentText.className = clampedThirst < 20 ? 'battery-percent low' : 'battery-percent';
    }
    if (this.thirstSegments && this.thirstSegments.length > 0) {
      const activeSegs = Math.ceil(clampedThirst / 25);
      this.thirstSegments.forEach((seg, idx) => {
        seg.className = 'seg';
        if (idx < activeSegs) {
          if (clampedThirst <= 20) {
            seg.classList.add('danger');
          } else if (clampedThirst <= 45) {
            seg.classList.add('warning');
          } else {
            seg.classList.add('active');
          }
        }
      });
      if (this.thirstContainer) {
        if (clampedThirst <= 20) {
          this.thirstContainer.classList.add('low');
        } else {
          this.thirstContainer.classList.remove('low');
        }
      }
    }
  }

  updateCompass(yawAngle, playerPos) {
    if (!this.compassNeedle) return;
    // Calculate angle in degrees
    let deg = (-yawAngle * (180 / Math.PI)) % 360;
    
    // Magnetic distortion inside Backrooms: needle wanders near anomalies
    if (playerPos && playerPos.z < 0) {
      const anomalyJitter = Math.sin(performance.now() * 0.005) * 25.0;
      deg += anomalyJitter;
    }

    this.compassNeedle.style.transform = `rotate(${deg}deg)`;
  }

  updateInteractivePrompt(focusedObject) {
    const promptText = focusedObject ? `[E] ${focusedObject.name}` : null;
    const visible = !!focusedObject;
    if (promptText === this._lastPromptText && visible === this._lastPromptVisible) return;
    this._lastPromptText = promptText;
    this._lastPromptVisible = visible;

    if (focusedObject) {
      if (this.crosshair) this.crosshair.classList.add('interactive');
      if (this.interactPrompt) {
        this.interactPrompt.style.display = 'block';
        this.interactPrompt.textContent = promptText;
      }
    } else {
      if (this.crosshair) this.crosshair.classList.remove('interactive');
      if (this.interactPrompt) {
        this.interactPrompt.style.display = 'none';
      }
    }
  }

  updateObjective(text) {
    if (this.objectiveText) {
      this.objectiveText.textContent = text;
    }
  }

  showSplashBanner(title, subtitle, durationMs = 6000) {
    const splash = document.getElementById('hud-splash-banner');
    if (!splash) return;

    const titleEl = document.getElementById('splash-title');
    const subEl = document.getElementById('splash-sub');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;

    // Reset and trigger animation
    splash.classList.remove('active');
    void splash.offsetWidth; // Force reflow
    splash.classList.add('active');

    if (this.splashTimeout) clearTimeout(this.splashTimeout);
    this.splashTimeout = setTimeout(() => {
      splash.classList.remove('active');
    }, durationMs);
  }

  updateQuickSlots(slots) {
    this.quickSlots.forEach((el, index) => {
      const item = slots[index];
      const iconEl = el.querySelector('.slot-icon');
      const countEl = el.querySelector('.slot-count');

      if (item) {
        const icon = item.id === 'battery' ? '⚡'
          : item.id === 'almond_water' ? '💧'
          : item.id === 'gas_can' ? '⛽'
          : item.id === 'crow_bar' ? '🔧'
          : item.id === 'security_keycard' ? '▣'
          : item.id === 'ration_pack' ? '🥫'
          : item.id === 'canteen_water' ? '🧴'
          : '🩹';
        if (iconEl) iconEl.textContent = icon;
        if (countEl) countEl.textContent = item.count > 1 ? `x${item.count}` : '';
      } else {
        if (iconEl) iconEl.textContent = '';
        if (countEl) countEl.textContent = '';
      }
    });
  }

  setActiveSlot(activeIndex) {
    this.quickSlots.forEach((el, index) => {
      if (index === activeIndex) {
        el.classList.add('active-slot');
      } else {
        el.classList.remove('active-slot');
      }
    });
  }
}
