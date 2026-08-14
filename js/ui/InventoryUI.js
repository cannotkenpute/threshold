/**
 * 1980s Classified Paper Dossier & Research Document Viewer
 */

export class InventoryUI {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.modal = document.getElementById('dossier-modal');
    this.titleEl = document.getElementById('dossier-title');
    this.subEl = document.getElementById('dossier-sub');
    this.bodyEl = document.getElementById('dossier-body');
    this.isOpen = false;
  }

  showDocument(docData) {
    if (!this.modal) return;
    this.isOpen = true;
    this.modal.classList.add('active');

    if (this.titleEl) this.titleEl.textContent = docData.title || "CLASSIFIED REPORT";
    if (this.subEl) this.subEl.textContent = `${docData.speaker || docData.author || "UNKNOWN"} — ${docData.role || "FIELD RESEARCH"}`;
    if (this.bodyEl) this.bodyEl.textContent = docData.body || docData.text || "";

    if (this.audioManager) {
      this.audioManager.playUI('click');
    }
  }

  close() {
    if (!this.modal) return;
    this.isOpen = false;
    this.modal.classList.remove('active');
  }
}
