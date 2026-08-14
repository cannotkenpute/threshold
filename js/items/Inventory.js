/**
 * 6 Primary + 2 Equipment Slot Inventory System
 */

import { ITEM_TYPES } from './ItemTypes.js';

export class Inventory {
  constructor(audioManager, hudManager) {
    this.audioManager = audioManager;
    this.hudManager = hudManager;
    this.primarySlots = new Array(6).fill(null); // [{ id, count }]
    this.activeSlotIndex = 0;
    this.documents = []; // Paper research notes & dossiers (unlimited storage)
    this.tapes = []; // Audio cassettes (unlimited storage)
  }

  selectSlot(slotIndex, player) {
    if (slotIndex < 0 || slotIndex >= this.primarySlots.length) return;
    this.activeSlotIndex = slotIndex;
    if (this.hudManager && this.hudManager.setActiveSlot) {
      this.hudManager.setActiveSlot(slotIndex);
    }
    const item = this.primarySlots[slotIndex];
    if (player && player.setHeldItem) {
      player.setHeldItem(item ? item.id : null);
    }
    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  addItem(itemId, player = null) {
    const def = ITEM_TYPES[itemId];
    if (!def) return false;

    // Research docs / tapes go to special collection
    if (def.isDoc && !this.documents.some(d => d.id === itemId)) {
      this.documents.push(def);
      if (this.hudManager) this.hudManager.updateQuickSlots(this.primarySlots);
      return true;
    }

    if (def.isTape && !this.tapes.some(t => t.id === itemId)) {
      this.tapes.push(def);
      if (this.hudManager) this.hudManager.updateQuickSlots(this.primarySlots);
      return true;
    }

    // Try stacking in existing slot
    if (def.stackable) {
      for (let i = 0; i < this.primarySlots.length; i++) {
        if (this.primarySlots[i] && this.primarySlots[i].id === itemId) {
          if (this.primarySlots[i].count < def.maxStack) {
            this.primarySlots[i].count++;
            if (this.hudManager) this.hudManager.updateQuickSlots(this.primarySlots);
            if (i === this.activeSlotIndex && player) player.setHeldItem(itemId);
            return true;
          }
        }
      }
    }

    // Place into first empty slot
    for (let i = 0; i < this.primarySlots.length; i++) {
      if (!this.primarySlots[i]) {
        this.primarySlots[i] = { id: itemId, count: 1 };
        if (this.hudManager) this.hudManager.updateQuickSlots(this.primarySlots);
        if (i === this.activeSlotIndex && player) player.setHeldItem(itemId);
        return true;
      }
    }

    return false; // Inventory full
  }

  useSlot(slotIndex, player) {
    if (slotIndex < 0 || slotIndex >= this.primarySlots.length) return false;
    const item = this.primarySlots[slotIndex];
    if (!item) return false;

    const def = ITEM_TYPES[item.id];
    if (def && def.onUse) {
      const success = def.onUse(player, this.hudManager);
      if (success) {
        if (this.audioManager) this.audioManager.playUI('battery');
        item.count--;
        if (item.count <= 0) {
          this.primarySlots[slotIndex] = null;
          if (player) player.setHeldItem(null);
        }
        if (this.hudManager) this.hudManager.updateQuickSlots(this.primarySlots);
        return true;
      }
    }
    return false;
  }
}
