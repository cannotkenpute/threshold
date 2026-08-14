/**
 * 1980s Cassette Deck & Research Audio Player
 * Synchronizes voice playback, tape hiss, motor noise, and VU meter needle deflection.
 */

export class CassettePlayer {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.isPlaying = false;
    this.currentTape = null;
    this.onTranscriptUpdate = null;
    this.onPlaybackEnd = null;
    this.speechUtterance = null;
    this.hissSource = null;
    this.vuInterval = null;
  }

  async playTape(tapeData, onUpdate, onEnd) {
    this.currentTape = tapeData;
    this.onTranscriptUpdate = onUpdate;
    this.onPlaybackEnd = onEnd;
    this.isPlaying = true;

    // Start tape hiss & mechanical click
    if (this.audioManager.synth) {
      this.audioManager.playUI('tape');
      this.startTapeHiss();
    }

    // 1. If tape has an actual recorded voiceover audio file (e.g. log1dialogue.mp3)
    if (tapeData.audioFile && this.audioManager.ctx) {
      try {
        const safeUrl = tapeData.audioFile.includes('%23') 
          ? tapeData.audioFile 
          : tapeData.audioFile.replace(/#/g, '%23');
        const response = await fetch(safeUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioManager.ctx.decodeAudioData(arrayBuffer);

        if (!this.isPlaying) return;

        const source = this.audioManager.ctx.createBufferSource();
        source.buffer = audioBuffer;

        // Route through 1980s microcassette filter chain (360Hz-3600Hz + midrange boost)
        const cassetteChain = this.audioManager.synth.createCassetteVoiceChain();
        source.connect(cassetteChain.input);
        cassetteChain.output.connect(this.audioManager.buses.CASSETTE);

        // Progressively animate transcript
        const durationMs = audioBuffer.duration * 1000;
        const totalChars = tapeData.audioTranscript.length;
        const startTime = Date.now();

        this.transcriptInterval = setInterval(() => {
          if (!this.isPlaying) {
            clearInterval(this.transcriptInterval);
            return;
          }
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1.0, elapsed / durationMs);
          const charsToShow = Math.floor(progress * totalChars);
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(tapeData.audioTranscript.substring(0, Math.max(30, charsToShow)));
          }
        }, 100);

        source.onended = () => {
          if (this.transcriptInterval) clearInterval(this.transcriptInterval);
          if (this.onTranscriptUpdate) this.onTranscriptUpdate(tapeData.audioTranscript);
          this.stopTape();
        };

        this.currentAudioSource = source;
        source.start();
        this.startVUMeterSimulation();
        return;
      } catch (err) {
        console.warn("Failed to load cassette audio file, falling back to synthesis:", err);
      }
    }

    // 2. Fallback: Synthesized speech synthesis with 1980s microcassette characteristics
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(tapeData.audioTranscript);
      utterance.rate = 0.88; // Slightly slow 1980s recording pace
      utterance.pitch = tapeData.speaker.includes('Mercer') ? 1.05 : (tapeData.speaker.includes('Cole') ? 0.9 : 0.95);
      
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const engVoices = voices.filter(v => v.lang.startsWith('en'));
        if (engVoices.length > 0) {
          utterance.voice = engVoices[0];
        }
      }

      utterance.onboundary = (event) => {
        if (this.onTranscriptUpdate && this.isPlaying) {
          const charIndex = event.charIndex;
          const currentSnippet = tapeData.audioTranscript.substring(0, charIndex + 30);
          this.onTranscriptUpdate(currentSnippet);
        }
      };

      utterance.onend = () => {
        this.stopTape();
      };

      utterance.onerror = () => {
        this.stopTape();
      };

      this.speechUtterance = utterance;
      setTimeout(() => {
        if (this.isPlaying) {
          window.speechSynthesis.speak(utterance);
        }
      }, 400);
    } else {
      setTimeout(() => {
        if (this.isPlaying) this.stopTape();
      }, 8000);
    }

    this.startVUMeterSimulation();
  }

  startTapeHiss() {
    if (!this.audioManager.ctx || !this.audioManager.synth) return;
    try {
      this.hissSource = this.audioManager.ctx.createBufferSource();
      this.hissSource.buffer = this.audioManager.synth.hissBuffer;
      this.hissSource.loop = true;

      const gain = this.audioManager.ctx.createGain();
      gain.gain.value = 0.12;

      this.hissSource.connect(gain);
      gain.connect(this.audioManager.buses.CASSETTE);
      this.hissSource.start();
    } catch (e) {
      console.warn("Tape hiss error", e);
    }
  }

  stopTape() {
    this.isPlaying = false;
    if (this.currentAudioSource) {
      try { this.currentAudioSource.stop(); } catch(e) {}
      this.currentAudioSource = null;
    }
    if (this.transcriptInterval) {
      clearInterval(this.transcriptInterval);
      this.transcriptInterval = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.hissSource) {
      try { this.hissSource.stop(); } catch(e) {}
      this.hissSource = null;
    }
    if (this.vuInterval) {
      clearInterval(this.vuInterval);
      this.vuInterval = null;
    }

    if (this.audioManager.synth) {
      this.audioManager.playUI('tape');
    }

    if (this.onPlaybackEnd) {
      const cb = this.onPlaybackEnd;
      this.onPlaybackEnd = null;
      cb();
    }
  }

  startVUMeterSimulation() {
    const leftNeedle = document.getElementById('vu-needle-left');
    const rightNeedle = document.getElementById('vu-needle-right');

    if (this.vuInterval) clearInterval(this.vuInterval);

    this.vuInterval = setInterval(() => {
      if (!this.isPlaying) {
        if (leftNeedle) leftNeedle.style.transform = `rotate(-35deg)`;
        if (rightNeedle) rightNeedle.style.transform = `rotate(-35deg)`;
        return;
      }

      // Random dynamic needle oscillation matching speech dynamics
      const dbL = -35 + Math.random() * 55;
      const dbR = -35 + Math.random() * 50;

      if (leftNeedle) leftNeedle.style.transform = `rotate(${dbL}deg)`;
      if (rightNeedle) rightNeedle.style.transform = `rotate(${dbR}deg)`;
    }, 60);
  }
}
