import { CONFIG } from '../config.js';

/**
 * 1980s Audio Log Archive & Magnetic Tape Player Modal
 * Allows playback and review of all recovered audio logs & dispatches.
 * Undiscovered logs are masked with '???' until collected in the anomaly.
 */
export class ArchiveUI {
  constructor(cassettePlayer, audioManager, inputManager) {
    this.player = cassettePlayer;
    this.audioManager = audioManager;
    this.input = inputManager;

    this.modal = document.getElementById('archive-modal');
    this.listContainer = document.getElementById('archive-log-list');
    this.labelEl = document.getElementById('archive-deck-label');
    this.speakerEl = document.getElementById('archive-deck-speaker');
    this.transcriptEl = document.getElementById('archive-transcript-text');
    this.playBtn = document.getElementById('btn-archive-play');
    this.stopBtn = document.getElementById('btn-archive-stop');
    this.closeBtn = document.getElementById('btn-archive-close');
    this.spools = document.querySelectorAll('.archive-spool');

    this.isOpen = false;
    // Track discovered logs - opening dispatch is unlocked on start
    this.discoveredIds = new Set(['opening_dispatch']);
    this.archiveLogs = this.initArchiveLogDefinitions();

    this.initButtons();
    this.renderLogList();
  }

  initArchiveLogDefinitions() {
    return [
      {
        id: 'opening_dispatch',
        title: '00:00 — SUPERVISOR VAUGHN: GATEWAY DISPATCH',
        speaker: 'Supervisor K. Vaughn (Dept of Spatial Anomaly)',
        role: 'Expedition Supervisor',
        audioFile: './assets/audio/dialogue%231.mp3',
        audioTranscript: `SUPERVISOR: Vaughn here. Tether is secured to the gateway frame. Enter DTE-04, locate Mercer's team, and return.`,
        icon: '📻',
        tag: 'TRANSMISSION'
      },
      {
        id: 'mercer_01',
        title: '09:42 — EXPEDITION LOG 01 (CHECKPOINT ALPHA)',
        speaker: 'Dr. Evelyn Mercer',
        role: 'Lead Expedition Physicist',
        audioFile: CONFIG.NARRATIVE.MERCER_LOG_01.audioFile || './assets/audio/log1dialogue.mp3',
        audioTranscript: CONFIG.NARRATIVE.MERCER_LOG_01.audioTranscript,
        icon: '📼',
        tag: 'EXPEDITION TAPE'
      },
      {
        id: 'cole_tape',
        title: '11:15 — DANIEL COLE: AUDIO LOG #2 (ECHOES)',
        speaker: 'Daniel Cole',
        role: 'Tether & Comms Engineer',
        audioFile: CONFIG.NARRATIVE.DANIEL_COLE_TAPE.audioFile || './assets/audio/log2dialogue.mp3',
        audioTranscript: CONFIG.NARRATIVE.DANIEL_COLE_TAPE.audioTranscript,
        icon: '📼',
        tag: 'EXPEDITION TAPE'
      },
      {
        id: 'garage_mercer_tape',
        title: '14:30 — DR. MERCER: SUBTERRANEAN GARAGE LOG',
        speaker: 'Dr. Evelyn Mercer',
        role: 'Expedition Leader',
        audioFile: CONFIG.NARRATIVE.GARAGE_MERCER_LOG.audioFile || './assets/audio/garage_cassette%231.mp3',
        audioTranscript: CONFIG.NARRATIVE.GARAGE_MERCER_LOG.audioTranscript,
        icon: '📼',
        tag: 'GARAGE LOG'
      },
      {
        id: 'mercer_final',
        title: '17:00 — DR. MERCER: FINAL EXPEDITION LOG',
        speaker: 'Dr. Evelyn Mercer',
        role: 'Expedition Leader',
        audioFile: CONFIG.NARRATIVE.MERCER_FINAL_TAPE.audioFile || './assets/audio/final_log_tape.mp3',
        audioTranscript: CONFIG.NARRATIVE.MERCER_FINAL_TAPE.audioTranscript,
        icon: '📼',
        tag: 'RECOVERED TAPE'
      },
      {
        id: 'police_radio_tape',
        title: '18:20 — HIGHWAY PATROL: DISPATCH UNIT 412',
        speaker: 'Officer J. Alvarez',
        role: 'State Highway Patrol',
        audioFile: CONFIG.NARRATIVE.HIGHWAY_POLICE_LOG.audioFile || './assets/audio/garage_cassette%231.mp3',
        audioTranscript: CONFIG.NARRATIVE.HIGHWAY_POLICE_LOG.audioTranscript,
        icon: '🚓',
        tag: 'RADIO DISPATCH'
      }
    ];
  }

  unlockLog(logId) {
    if (!this.discoveredIds.has(logId)) {
      this.discoveredIds.add(logId);
      this.renderLogList();
      console.log(`[ArchiveUI] Unlocked audio log: ${logId}`);
    }
  }

  initButtons() {
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.playCurrentSelection());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.stopPlayback());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
  }

  renderLogList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    this.archiveLogs.forEach((log, index) => {
      const isDiscovered = this.discoveredIds.has(log.id);
      const item = document.createElement('div');
      item.className = `archive-log-item ${index === 0 ? 'active' : ''} ${isDiscovered ? 'unlocked' : 'locked'}`;
      item.dataset.index = index;

      if (isDiscovered) {
        item.innerHTML = `
          <div class="archive-log-icon">${log.icon}</div>
          <div class="archive-log-info">
            <div class="archive-log-title">${log.title}</div>
            <div class="archive-log-speaker">${log.speaker}</div>
          </div>
          <div class="archive-log-tag">${log.tag}</div>
        `;
      } else {
        item.innerHTML = `
          <div class="archive-log-icon" style="color: #667766;">❓</div>
          <div class="archive-log-info">
            <div class="archive-log-title" style="color: #889988; font-style: italic;">[REEL #0${index + 1}] — ??????????????</div>
            <div class="archive-log-speaker" style="color: #556655;">[ENCRYPTED // UNDISCOVERED]</div>
          </div>
          <div class="archive-log-tag" style="color: #ffaa33; border-color: #554422;">LOCKED</div>
        `;
      }

      item.addEventListener('click', () => {
        this.selectLog(index, isDiscovered);
      });

      this.listContainer.appendChild(item);
    });
  }

  selectLog(index, autoPlay = true) {
    const items = this.listContainer.querySelectorAll('.archive-log-item');
    items.forEach(el => el.classList.remove('active'));
    if (items[index]) items[index].classList.add('active');

    const log = this.archiveLogs[index];
    if (!log) return;

    const isDiscovered = this.discoveredIds.has(log.id);

    if (isDiscovered) {
      if (this.labelEl) this.labelEl.textContent = log.title;
      if (this.speakerEl) this.speakerEl.textContent = `${log.speaker} [${log.role}]`;
      if (this.transcriptEl) this.transcriptEl.textContent = `[CASSETTE LOADED: ${log.title}]\nPress PLAY to initiate playback.`;

      if (autoPlay) {
        this.playLog(log);
      }
    } else {
      this.stopPlayback();
      if (this.labelEl) this.labelEl.textContent = `[TAPE REEL #0${index + 1}] — ??????????????`;
      if (this.speakerEl) this.speakerEl.textContent = `[ENCRYPTED AUDIO SIGNAL — UNDISCOVERED]`;
      if (this.transcriptEl) {
        this.transcriptEl.textContent = `[SIGNAL ENCRYPTED // TAPE NOT YET RECOVERED]\n\nExplore the anomaly corridors and locate this physical microcassette to decrypt and listen to the audio recording.`;
      }
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    if (this.modal) this.modal.classList.add('active');
    if (this.input) this.input.exitLock();
    if (this.audioManager) this.audioManager.playUI('tape');

    this.renderLogList();
    // Default select first tape (Opening dispatch)
    this.selectLog(0, false);
  }

  close() {
    this.stopPlayback();
    this.isOpen = false;
    if (this.modal) this.modal.classList.remove('active');
    if (this.input) this.input.requestLock();
  }

  playCurrentSelection() {
    const activeItem = this.listContainer.querySelector('.archive-log-item.active');
    const idx = activeItem ? parseInt(activeItem.dataset.index, 10) : 0;
    const log = this.archiveLogs[idx];
    if (log && this.discoveredIds.has(log.id)) {
      this.playLog(log);
    } else {
      if (this.audioManager) this.audioManager.playUI('click');
      if (this.transcriptEl) {
        this.transcriptEl.textContent = `[ERROR: ACCESS DENIED]\n\nThis audio log has not been recovered yet. Find the tape in the anomaly to unlock.`;
      }
    }
  }

  playLog(log) {
    this.spools.forEach(s => s.classList.add('playing'));
    if (this.playBtn) this.playBtn.classList.add('depressed');

    const tapeData = {
      title: log.title,
      speaker: log.speaker,
      audioFile: log.audioFile,
      audioTranscript: log.audioTranscript
    };

    this.player.playTape(
      tapeData,
      (liveText) => {
        if (this.transcriptEl) {
          this.transcriptEl.textContent = liveText;
          this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight;
        }
      },
      () => {
        this.stopPlayback();
      }
    );
  }

  stopPlayback() {
    this.player.stopTape();
    this.spools.forEach(s => s.classList.remove('playing'));
    if (this.playBtn) this.playBtn.classList.remove('depressed');
  }
}
