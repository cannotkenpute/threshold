/**
 * Survival Mode Sustainment Systems: Hunger, Thirst, Cycle Tracking & Fear Factor
 *
 * Composes with a Player instance (does not extend it). Fear Factor is not a new stat --
 * it reuses the existing tuned sanity system, inverted, per the locked design review.
 */

import { CONFIG } from '../config.js';

export class SurvivalState {
  constructor(player, lightManager = null) {
    this.player = player;
    this.lightManager = lightManager;

    this.hunger = 100;
    this.thirst = 100;
    this.cycleNumber = 1;
    this.timeSurvived = 0;

    // Tracks how long Fear Factor has been continuously in the CRITICAL band (81-100)
    this.criticalStreakTime = 0;
    this.environmentSafety = { isSafe: false, score: 0, fixtureId: null, distance: Infinity };
  }

  // Fear Factor reuses the existing tuned sanity system, inverted (not a separate stat).
  get fearFactor() {
    return 100 - this.player.sanity;
  }

  get isDead() {
    return this.player.health <= 0;
  }

  tick(delta) {
    this.timeSurvived += delta;

    const cfg = CONFIG.SURVIVAL;

    this.environmentSafety = this.lightManager && this.lightManager.getSafetyAt
      ? this.lightManager.getSafetyAt(this.player.position)
      : { isSafe: false, score: 0, fixtureId: null, distance: Infinity };
    if (this.environmentSafety.isSafe) {
      this.player.sanity = Math.min(
        CONFIG.PLAYER.MAX_SANITY,
        this.player.sanity + cfg.SAFE_LIGHT_RECOVERY_RATE * this.environmentSafety.score * delta
      );
    }

    // Drain hunger & thirst
    this.hunger = Math.max(0, this.hunger - cfg.HUNGER_DRAIN_RATE * delta);
    this.thirst = Math.max(0, this.thirst - cfg.THIRST_DRAIN_RATE * delta);

    // Starvation / dehydration continuous health drain (stacks if both are empty)
    let damage = 0;
    if (this.hunger <= 0) damage += cfg.STARVE_DAMAGE;
    if (this.thirst <= 0) damage += cfg.DEHYDRATE_DAMAGE;

    // Fear Factor symptom damage
    const fear = this.fearFactor;
    if (fear >= 81) {
      this.criticalStreakTime += delta;
      const rampProgress = Math.min(1, this.criticalStreakTime / cfg.CRITICAL_RAMP_DURATION);
      damage += cfg.CRITICAL_DAMAGE_MIN + (cfg.CRITICAL_DAMAGE_MAX - cfg.CRITICAL_DAMAGE_MIN) * rampProgress;
    } else {
      this.criticalStreakTime = 0;
      if (fear >= 61) {
        damage += cfg.PANIC_DAMAGE;
      }
    }

    if (damage > 0) {
      this.player.takeDamage(damage * delta);
    }
  }

  eat(amount) {
    this.hunger = Math.min(100, this.hunger + amount);
  }

  drink(amount) {
    this.thirst = Math.min(100, this.thirst + amount);
  }
}
