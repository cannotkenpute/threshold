/**
 * 1980s HUD Manager: Analog Meters, Mechanical Compass, Quick Slots & Objectives
 */

export class HUDManager {
  constructor() {
    this.crosshair = document.getElementById('crosshair');
    this.interactPrompt = document.getElementById('interact-prompt');
    this.batterySegments = document.querySelectorAll('#battery-segments .seg');
    this.batteryContainer = document.getElementById('battery-segments');
    this.batteryPercentText = document.getElementById('battery-percent-text');
    this.staminaBar = document.getElementById('stamina-level-bar');
    this.compassNeedle = document.getElementById('compass-needle');
    this.objectiveText = document.getElementById('objective-text');
    this.quickSlots = document.querySelectorAll('.slot-box');
    this.gridStatusText = document.getElementById('grid-status-text');
    this.gridTimerText = document.getElementById('grid-timer-text');
  }

  updatePowerGrid(cycleInfo) {
    if (!cycleInfo) return;
    if (this.gridStatusText) {
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
      this.gridTimerText.textContent = `${mins}:${secs}`;
    }
  }

  updateVitals(battery, stamina, sanity) {
    const clampedBattery = Math.max(0, Math.min(100, Math.round(battery)));

    // Update Numerical Percentage
    if (this.batteryPercentText) {
      this.batteryPercentText.textContent = `${clampedBattery}%`;
      if (clampedBattery < 20) {
        this.batteryPercentText.className = 'battery-percent low';
      } else {
        this.batteryPercentText.className = 'battery-percent';
      }
    }

    // Update 4-Segment Retro Battery Cells
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

    if (this.staminaBar) {
      this.staminaBar.style.width = `${Math.max(0, Math.min(100, stamina))}%`;
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
    if (focusedObject) {
      if (this.crosshair) this.crosshair.classList.add('interactive');
      if (this.interactPrompt) {
        this.interactPrompt.style.display = 'block';
        this.interactPrompt.textContent = `[E] ${focusedObject.name}`;
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
