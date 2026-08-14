/**
 * Two Raccoons in a Trench Coat: High-Stakes Blackjack
 * Procedural Web Audio API Sound Engine & Speakeasy Jazz Synth
 */

class CasinoAudio {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.musicPlaying = false;
    this.musicInterval = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    const savedSound = localStorage.getItem('raccoons_sound');
    const savedMusic = localStorage.getItem('raccoons_music');
    if (savedSound !== null) this.soundEnabled = savedSound === 'true';
    if (savedMusic !== null) this.musicEnabled = savedMusic === 'true';
  }

  initAudio() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 0.75 : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.22 : 0, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      if (this.musicEnabled) {
        this.startJazzMusic();
      }
    } catch (e) {
      console.warn('Web Audio not supported', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudio();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('raccoons_sound', this.soundEnabled);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 0.75 : 0, this.ctx.currentTime);
    }
    return this.soundEnabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('raccoons_music', this.musicEnabled);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.22 : 0, this.ctx.currentTime);
    }
    if (this.musicEnabled && !this.musicPlaying) {
      this.startJazzMusic();
    }
    return this.musicEnabled;
  }

  // --- SOUND EFFECTS ---

  playCardDeal() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
  }

  playChipClink() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freq = 1800 + Math.random() * 400;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  playMustachePat() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playTailTuck() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.1);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playSuspicionWarning() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.2);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playBlackjackWin() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      gain.gain.setValueAtTime(0.25, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.3);
    });
  }

  playBustedAlarm() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    // Dramatic low horn sting
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.6);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.7);
  }

  // --- PROCEDURAL SPEAKEASY JAZZ ---

  startJazzMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;

    // Classic Jazz ii - V - I - VI progression (Dm9 - G13 - Cmaj9 - A7b9)
    const jazzChords = [
      [293.66, 349.23, 440.00, 523.25, 659.25], // Dm9: D4, F4, A4, C5, E5
      [196.00, 329.63, 392.00, 493.88, 659.25], // G13: G3, E4, G4, B4, E5
      [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9: C4, E4, G4, B4, D5
      [220.00, 277.18, 329.63, 392.00, 523.25], // A7b9: A3, C#4, E4, G4, C5
    ];
    const walkingBass = [
      [146.83, 174.61, 164.81, 155.56], // D3 walking
      [98.00, 123.47, 130.81, 146.83],  // G2 walking
      [130.81, 164.81, 146.83, 138.59], // C3 walking
      [110.00, 138.59, 146.83, 155.56], // A2 walking
    ];

    let step = 0;
    const playJazzBar = () => {
      if (!this.musicPlaying || !this.ctx || this.ctx.state === 'suspended') return;

      const chordIdx = Math.floor(step / 4) % jazzChords.length;
      const beatInBar = step % 4;
      const t = this.ctx.currentTime;

      // 1. Walking Upright Acoustic Bass Note
      const bassNote = walkingBass[chordIdx][beatInBar];
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassNote, t);
      bassGain.gain.setValueAtTime(0.18, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(t);
      bassOsc.stop(t + 0.48);

      // 2. Smooth Electric Piano / Rhodes chord on beats 0 and 2.5
      if (beatInBar === 0 || beatInBar === 2) {
        const chord = jazzChords[chordIdx];
        chord.forEach(freq => {
          const epOsc = this.ctx.createOscillator();
          const epGain = this.ctx.createGain();
          epOsc.type = 'sine';
          epOsc.frequency.setValueAtTime(freq, t);
          epGain.gain.setValueAtTime(0.06, t);
          epGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
          epOsc.connect(epGain);
          epGain.connect(this.musicGain);
          epOsc.start(t);
          epOsc.stop(t + 0.75);
        });
      }

      // 3. Subtle jazz saxophone/trumpet solo riff on some bars
      if (Math.random() < 0.35) {
        const soloOsc = this.ctx.createOscillator();
        const soloGain = this.ctx.createGain();
        soloOsc.type = 'sine';
        const chord = jazzChords[chordIdx];
        const soloFreq = chord[Math.floor(Math.random() * chord.length)] * 1.5;
        soloOsc.frequency.setValueAtTime(soloFreq, t + 0.15);
        soloGain.gain.setValueAtTime(0.05, t + 0.15);
        soloGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        soloOsc.connect(soloGain);
        soloGain.connect(this.musicGain);
        soloOsc.start(t + 0.15);
        soloOsc.stop(t + 0.48);
      }

      step++;
    };

    this.musicInterval = setInterval(playJazzBar, 480); // ~125 BPM swing
  }

  stopJazzMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

window.casinoAudio = new CasinoAudio();
