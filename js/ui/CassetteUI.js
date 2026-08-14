/**
 * 1980s Cassette Deck UI Manager
 */

export class CassetteUI {
  constructor(cassettePlayer, audioManager) {
    this.player = cassettePlayer;
    this.audioManager = audioManager;
    this.modal = document.getElementById('cassette-modal');
    this.labelEl = document.getElementById('cassette-deck-label');
    this.transcriptEl = document.getElementById('cassette-transcript-text');
    this.playBtn = document.getElementById('btn-deck-play');
    this.stopBtn = document.getElementById('btn-deck-stop');
    this.ejectBtn = document.getElementById('btn-deck-eject');
    this.spools = document.querySelectorAll('.cassette-spool');

    this.isOpen = false;
    this.currentTapeData = null;
    this.onTapeFinishedCallback = null;

    this.initButtons();
  }

  initButtons() {
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.onPlayClick());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.onStopClick());
    }
    if (this.ejectBtn) {
      this.ejectBtn.addEventListener('click', () => this.close());
    }
  }

  openWithTape(tapeData, onFinished = null) {
    this.currentTapeData = tapeData;
    this.onTapeFinishedCallback = onFinished;
    this.isOpen = true;
    if (this.modal) this.modal.classList.add('active');

    if (this.labelEl) {
      this.labelEl.textContent = `${tapeData.title} — ${tapeData.speaker}`;
    }
    if (this.transcriptEl) {
      this.transcriptEl.textContent = "[INSERT CASSETTE. PRESS PLAY]";
    }

    // Auto-start playing for immediate atmosphere
    this.onPlayClick();
  }

  onPlayClick() {
    if (!this.currentTapeData) return;
    this.spools.forEach(s => s.classList.add('playing'));
    if (this.playBtn) this.playBtn.classList.add('depressed');

    this.player.playTape(
      this.currentTapeData,
      (text) => {
        if (this.transcriptEl) this.transcriptEl.textContent = text;
      },
      () => {
        this.onPlaybackFinished();
      }
    );
  }

  onStopClick() {
    this.player.stopTape();
    this.onPlaybackFinished();
  }

  onPlaybackFinished() {
    this.spools.forEach(s => s.classList.remove('playing'));
    if (this.playBtn) this.playBtn.classList.remove('depressed');
    if (this.onTapeFinishedCallback) {
      const cb = this.onTapeFinishedCallback;
      this.onTapeFinishedCallback = null;
      cb();
    }
  }

  close() {
    this.player.stopTape();
    this.isOpen = false;
    if (this.modal) this.modal.classList.remove('active');
    if (this.onTapeFinishedCallback) {
      const cb = this.onTapeFinishedCallback;
      this.onTapeFinishedCallback = null;
      cb();
    }
  }
}
