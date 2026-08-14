/**
 * Trash Panda Wash & Dry - Audio Engine
 * Pure Web Audio API procedural sound synthesizer and cozy lofi music generator.
 * Zero external audio files required, runs 100% offline & instant.
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = true;
    this.musicPlaying = false;
    this.musicInterval = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    
    // Load preferences
    const savedSound = localStorage.getItem('trash_panda_sound');
    const savedMusic = localStorage.getItem('trash_panda_music');
    if (savedSound !== null) this.soundEnabled = savedSound === 'true';
    if (savedMusic !== null) this.musicEnabled = savedMusic === 'true';

    this.initAudioContext = this.initAudioContext.bind(this);
  }

  initAudioContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 0.7 : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.25 : 0, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      if (this.musicEnabled) {
        this.startMusic();
      }
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('trash_panda_sound', this.soundEnabled);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 0.7 : 0, this.ctx.currentTime);
    }
    return this.soundEnabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('trash_panda_music', this.musicEnabled);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.25 : 0, this.ctx.currentTime);
    }
    if (this.musicEnabled && !this.musicPlaying) {
      this.startMusic();
    }
    return this.musicEnabled;
  }

  // --- SOUND EFFECTS ---

  playBubblePop(pitchMod = 1) {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = (450 + Math.random() * 200) * pitchMod;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.08);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playCoin() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    const playTone = (freq, delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);
      gain.gain.setValueAtTime(0.25, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + delay);
      osc.stop(t + delay + 0.2);
    };

    playTone(987.77, 0);       // B5
    playTone(1318.51, 0.08);    // E6
  }

  playDing() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1760, t); // A6
    osc.frequency.exponentialRampToValueAtTime(1750, t + 0.6);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.7);
  }

  playFold() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    
    // Soft cloth rustle using bandpass filtered noise
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(2, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start(t);
  }

  playPawStep() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const pitch = 140 + Math.random() * 40;
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  playCustomerChirp(isHappy = true) {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (isHappy) {
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.1);
    } else {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(320, t + 0.12);
    }

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playTrinketFound() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);
      gain.gain.setValueAtTime(0.25, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    });
  }

  playUpgrade() {
    if (!this.soundEnabled || !this.ctx) return;
    this.ensureContext();
    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      gain.gain.setValueAtTime(0.3, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.4);
    });
  }

  // --- PROCEDURAL COZY LOFI MUSIC ---

  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;

    // Cozy Chord progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    const chords = [
      [349.23, 440.00, 523.25, 659.25], // F4, A4, C5, E5
      [329.63, 392.00, 493.88, 587.33], // E4, G4, B4, D5
      [293.66, 349.23, 440.00, 523.25], // D4, F4, A4, C5
      [261.63, 329.63, 392.00, 493.88], // C4, E4, G4, B4
    ];
    const bassNotes = [174.61, 164.81, 146.83, 130.81]; // F3, E3, D3, C3

    let step = 0;
    const playBar = () => {
      if (!this.musicPlaying || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;

      const chordIdx = Math.floor(step / 4) % chords.length;
      const beatInBar = step % 4;
      const t = this.ctx.currentTime;

      // Play soft bass on beat 0 and 2
      if (beatInBar === 0 || beatInBar === 2) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassNotes[chordIdx], t);
        bassGain.gain.setValueAtTime(0.18, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);
        bassOsc.start(t);
        bassOsc.stop(t + 0.95);
      }

      // Play soft electric piano/marimba chord arpeggio
      const chord = chords[chordIdx];
      const noteToPlay = chord[beatInBar % chord.length];
      
      const epOsc = this.ctx.createOscillator();
      const epGain = this.ctx.createGain();
      epOsc.type = 'sine';
      epOsc.frequency.setValueAtTime(noteToPlay, t);
      epGain.gain.setValueAtTime(0.12, t);
      epGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      epOsc.connect(epGain);
      epGain.connect(this.musicGain);
      epOsc.start(t);
      epOsc.stop(t + 0.55);

      // Random gentle melody embellishment on some beats
      if (Math.random() > 0.4) {
        const melOsc = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();
        melOsc.type = 'sine';
        const melNote = chord[Math.floor(Math.random() * chord.length)] * (Math.random() > 0.5 ? 2 : 1);
        melOsc.frequency.setValueAtTime(melNote, t + 0.25);
        melGain.gain.setValueAtTime(0.08, t + 0.25);
        melGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        melOsc.connect(melGain);
        melGain.connect(this.musicGain);
        melOsc.start(t + 0.25);
        melOsc.stop(t + 0.65);
      }

      step++;
    };

    this.musicInterval = setInterval(playBar, 550); // ~109 BPM chill lofi tempo
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

// Global audio singleton
window.gameAudio = new AudioManager();
