/**
 * Subtitle and Ambient Narrative Overlay Engine
 */

export class DialogueUI {
  constructor() {
    this.el = document.getElementById('subtitles');
    this.timeout = null;
  }

  showSubtitle(text, speaker = 'mercer', durationMs = 4000) {
    if (!this.el) return;

    if (this.timeout) clearTimeout(this.timeout);

    this.el.className = `speaker-${speaker}`;
    this.el.textContent = text;
    this.el.style.display = 'block';

    this.timeout = setTimeout(() => {
      this.el.style.display = 'none';
    }, durationMs);
  }
}
