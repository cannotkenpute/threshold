/**
 * 1980s Procedural Sound Synthesizer & DSP Generator (Web Audio API)
 * Compliant with sound_design.md specifications.
 */

export class SoundSynthesizer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.noiseBuffer = this.createNoiseBuffer(4.0);
    this.hissBuffer = this.createTapeHissBuffer(5.0);
  }

  createNoiseBuffer(duration = 2.0) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  createTapeHissBuffer(duration = 5.0) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.95 * b1 + white * 0.08;
      b2 = 0.85 * b2 + white * 0.12;
      output[i] = (b0 + b1 + b2) * 0.3;
    }
    return buffer;
  }

  // --- FLUORESCENT BALLAST HUM ---
  createFluorescentHumNode(pitchMult = 1.0) {
    const group = {
      gainNode: this.ctx.createGain(),
      oscillators: [],
      panner: this.ctx.createPanner ? this.ctx.createPanner() : null
    };

    const baseFreq = 60.0 * pitchMult; // 60Hz mains hum
    const harmonics = [1, 2, 3, 4, 6, 8, 12];
    const weights = [0.4, 0.7, 0.25, 0.5, 0.15, 0.1, 0.05];

    harmonics.forEach((h, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = (idx % 2 === 0) ? 'sawtooth' : 'sine';
      osc.frequency.value = baseFreq * h + (Math.random() * 0.4 - 0.2);

      const oscGain = this.ctx.createGain();
      oscGain.gain.value = weights[idx] * 0.15;

      osc.connect(oscGain);
      oscGain.connect(group.gainNode);
      osc.start();
      group.oscillators.push(osc);
    });

    // Add slight random ballast buzz
    const buzzNoise = this.ctx.createBufferSource();
    buzzNoise.buffer = this.noiseBuffer;
    buzzNoise.loop = true;

    const buzzFilter = this.ctx.createBiquadFilter();
    buzzFilter.type = 'bandpass';
    buzzFilter.frequency.value = 180 * pitchMult;
    buzzFilter.Q.value = 4.0;

    const buzzGain = this.ctx.createGain();
    buzzGain.gain.value = 0.04;

    buzzNoise.connect(buzzFilter);
    buzzFilter.connect(buzzGain);
    buzzGain.connect(group.gainNode);
    buzzNoise.start();
    group.oscillators.push(buzzNoise);

    group.stop = () => {
      group.oscillators.forEach(o => {
        try { o.stop(); } catch (e) {}
      });
    };

    return group;
  }

  // --- SUBTERRANEAN GARAGE ACOUSTIC DRONE ---
  createGarageDrone() {
    const group = {
      oscillators: [],
      gainNode: this.ctx.createGain()
    };
    group.gainNode.gain.value = 0.45;

    // Sub-bass structural resonance (48Hz, 96Hz, 120Hz)
    const baseFreqs = [48, 96, 120];
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = this.ctx.createGain();
      g.gain.value = 0.2;

      osc.connect(g);
      g.connect(group.gainNode);
      osc.start();
      group.oscillators.push(osc);
    });

    // Massive echoing industrial exhaust fan / wind tunnel
    const fanNoise = this.ctx.createBufferSource();
    fanNoise.buffer = this.noiseBuffer;
    fanNoise.loop = true;

    const fanFilter = this.ctx.createBiquadFilter();
    fanFilter.type = 'bandpass';
    fanFilter.frequency.value = 240;
    fanFilter.Q.value = 1.8;

    const fanGain = this.ctx.createGain();
    fanGain.gain.value = 0.12;

    fanNoise.connect(fanFilter);
    fanFilter.connect(fanGain);
    fanGain.connect(group.gainNode);
    fanNoise.start();
    group.oscillators.push(fanNoise);

    group.stop = () => {
      group.oscillators.forEach(o => {
        try { o.stop(); } catch(e) {}
      });
    };

    return group;
  }

  // --- LEVEL 3: THE DARK HIGHWAY NIGHT & WIND DRONE ---
  createHighwayNightDrone() {
    const group = {
      oscillators: [],
      gainNode: this.ctx.createGain()
    };
    group.gainNode.gain.value = 0.55;

    // Sub-bass road rumble & nocturnal atmosphere (38Hz, 62Hz, 95Hz)
    const baseFreqs = [38, 62, 95];
    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      const g = this.ctx.createGain();
      g.gain.value = 0.18;

      osc.connect(g);
      g.connect(group.gainNode);
      osc.start();
      group.oscillators.push(osc);
    });

    // Howling night highway wind with modulated bandpass filter
    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = this.noiseBuffer;
    windNoise.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 180;
    windFilter.Q.value = 3.5;

    // LFO for periodic howling wind gust swells
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12; // 8-second wind cycle

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160; // sweeps frequency 180Hz +/- 160Hz
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();
    group.oscillators.push(lfo);

    const windGain = this.ctx.createGain();
    windGain.gain.value = 0.22;

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(group.gainNode);
    windNoise.start();
    group.oscillators.push(windNoise);

    group.stop = () => {
      group.oscillators.forEach(o => {
        try { o.stop(); } catch(e) {}
      });
    };

    return group;
  }

  // Distant car alarm chirp / horn echo
  playCarAlarm(isHonk = false) {
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.25;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isHonk ? 380 : 880, t);
    osc.frequency.setValueAtTime(isHonk ? 340 : 1200, t + 0.15);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.3, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    // Reverb lowpass filter for distance
    const distFilter = this.ctx.createBiquadFilter();
    distFilter.type = 'lowpass';
    distFilter.frequency.value = 1400;

    osc.connect(env);
    env.connect(distFilter);
    distFilter.connect(masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
    return masterGain;
  }

  playWaterDrip() {
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.18;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const startFreq = 800 + Math.random() * 600;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.8, t + 0.06);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(env);
    env.connect(masterGain);

    osc.start(t);
    osc.stop(t + 0.09);
    return masterGain;
  }

  // --- FOOTSTEPS ---
  playFootstep(surface = 'carpet', isPlayer = true, customGain = 1.0) {
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = (isPlayer ? 0.35 : 0.5) * customGain;

    if (surface === 'carpet') {
      // Muffled soft thud
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80 + Math.random() * 20, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350 + Math.random() * 50, t);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.8, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(filter);
      filter.connect(env);
      env.connect(masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    } else if (surface === 'wet_carpet') {
      // Carpet thud + water splash squelch
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(75, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.14);

      const thudEnv = this.ctx.createGain();
      thudEnv.gain.setValueAtTime(0.7, t);
      thudEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(thudEnv);
      thudEnv.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.15);

      // Splash high-end squelch
      const splash = this.ctx.createBufferSource();
      splash.buffer = this.noiseBuffer;
      const splashFilter = this.ctx.createBiquadFilter();
      splashFilter.type = 'bandpass';
      splashFilter.frequency.setValueAtTime(1400 + Math.random() * 400, t);
      splashFilter.Q.value = 2.5;

      const splashEnv = this.ctx.createGain();
      splashEnv.gain.setValueAtTime(0.35, t);
      splashEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      splash.connect(splashFilter);
      splashFilter.connect(splashEnv);
      splashEnv.connect(masterGain);
      splash.start(t);
      splash.stop(t + 0.22);
    } else if (surface === 'tile' || surface === 'concrete') {
      // Crisp click and short echo
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1200;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.6, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      osc.connect(env);
      noise.connect(noiseFilter);
      noiseFilter.connect(env);
      env.connect(masterGain);

      osc.start(t);
      noise.start(t);
      osc.stop(t + 0.12);
      noise.stop(t + 0.12);
    }

    return masterGain;
  }

  // --- ITEM & MECHANICAL SOUNDS ---
  playSwitchClick(isOn = true) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isOn ? 1800 : 1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.035);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(1.0, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(env);
    env.connect(gain);
    osc.start(t);
    osc.stop(t + 0.05);

    return gain;
  }

  playBatteryInsert() {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.35;

    // Plastic slide + metal spring click
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.8, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(env);
    env.connect(gain);
    osc.start(t);
    osc.stop(t + 0.09);

    return gain;
  }

  playTapeMechanicalClick(action = 'play') {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = action === 'play' ? 2400 : 1600;
    filter.Q.value = 3.0;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    noise.connect(filter);
    filter.connect(env);
    env.connect(gain);

    noise.start(t);
    noise.stop(t + 0.08);
    return gain;
  }

  // --- AMBIENT DRONE & ATMOSPHERE ---
  createHVACDrone() {
    const group = {
      gainNode: this.ctx.createGain(),
      nodes: []
    };
    group.gainNode.gain.value = 0.25;

    // Sub rumble (38Hz + 45Hz)
    const sub1 = this.ctx.createOscillator();
    sub1.type = 'sine';
    sub1.frequency.value = 38;

    const sub2 = this.ctx.createOscillator();
    sub2.type = 'triangle';
    sub2.frequency.value = 45.5;

    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.4;

    sub1.connect(subGain);
    sub2.connect(subGain);
    subGain.connect(group.gainNode);
    sub1.start();
    sub2.start();
    group.nodes.push(sub1, sub2);

    // Filtered air rush noise
    const airNoise = this.ctx.createBufferSource();
    airNoise.buffer = this.noiseBuffer;
    airNoise.loop = true;

    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.value = 180;

    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.3;

    airNoise.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(group.gainNode);
    airNoise.start();
    group.nodes.push(airNoise);

    group.stop = () => {
      group.nodes.forEach(n => {
        try { n.stop(); } catch (e) {}
      });
    };
    return group;
  }

  // --- DISTANT HORROR IMPACTS & METAL ---
  playDistantMetalImpact(distance = 15) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const distFactor = Math.max(0.1, 1.0 - (distance / 40));
    gain.gain.value = 0.45 * distFactor;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(160, t);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.9);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, t);
    osc2.frequency.exponentialRampToValueAtTime(90, t + 0.7);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.max(400, 2800 - distance * 60);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(gain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 1.2);
    osc2.stop(t + 1.2);

    return gain;
  }

  // --- CHASE DRONE ---
  createChaseDrone() {
    const group = {
      gainNode: this.ctx.createGain(),
      nodes: []
    };
    group.gainNode.gain.value = 0.0; // Start at 0, fade in

    // Dark pulsing bass
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 3.5; // Pulsing 3.5Hz panic rate
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(osc.frequency);
    lfo.start();
    group.nodes.push(lfo);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    osc.connect(filter);
    filter.connect(group.gainNode);
    osc.start();
    group.nodes.push(osc);

    group.stop = () => {
      group.nodes.forEach(n => {
        try { n.stop(); } catch (e) {}
      });
    };
    return group;
  }

  // --- CASSETTE SPEECH DSP FILTER ---
  createCassetteVoiceChain(options = {}) {
    const degraded = options.degraded === true;
    // 1980s microcassette frequency curve: 350Hz - 3800Hz with slight distortion and tape hiss
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();

    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = degraded ? 470 : 360;

    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = degraded ? 2550 : 3600;

    const midBoost = this.ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 1600;
    midBoost.gain.value = degraded ? 7.5 : 4.0;
    midBoost.Q.value = 1.2;

    input.connect(hpFilter);
    hpFilter.connect(midBoost);
    if (degraded) {
      const saturation = this.ctx.createWaveShaper();
      const curve = new Float32Array(44100);
      const amount = 55;
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / curve.length - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) /
          (Math.PI + amount * Math.abs(x));
      }
      saturation.curve = curve;
      saturation.oversample = '2x';
      midBoost.connect(saturation);
      saturation.connect(lpFilter);
    } else {
      midBoost.connect(lpFilter);
    }
    lpFilter.connect(output);

    return { input, output };
  }

  // --- RADIO / FIELD INTERCOM DSP FILTER ---
  createRadioVoiceChain() {
    // 1980s military radio communication chain: 400Hz - 3200Hz, aggressive midrange boost, analog overdrive & squelch
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();

    // Highpass filter (cuts low frequencies & rumble)
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 450;

    // Lowpass filter (cuts highs, giving the boxy walkie-talkie/radio tone)
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 3200;

    // Aggressive telephone/radio presence boost
    const midBoost = this.ctx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 1800;
    midBoost.gain.value = 8.5;
    midBoost.Q.value = 2.0;

    // WaveShaper for mild transistor distortion / saturation
    const distortion = this.ctx.createWaveShaper();
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    const k = 18; // distortion amount
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.oversample = '2x';

    // Static hiss generator
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 2.5;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.08; // Subtle background radio static

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start();

    // Connect voice chain
    input.connect(hpFilter);
    hpFilter.connect(midBoost);
    midBoost.connect(distortion);
    distortion.connect(lpFilter);
    lpFilter.connect(output);

    return {
      input,
      output,
      stopHiss: () => {
        try {
          noise.stop();
          noise.disconnect();
        } catch (e) {}
      }
    };
  }

  // --- DAY/NIGHT GRID POWER OUTAGE EVENTS ---
  playBlackoutEvent() {
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.85;

    // Transformer pop / circuit breaker trip
    const pop = this.ctx.createOscillator();
    pop.type = 'sawtooth';
    pop.frequency.setValueAtTime(140, t);
    pop.frequency.exponentialRampToValueAtTime(30, t + 0.35);

    const popEnv = this.ctx.createGain();
    popEnv.gain.setValueAtTime(0.9, t);
    popEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    pop.connect(popEnv);
    popEnv.connect(masterGain);
    pop.start(t);
    pop.stop(t + 0.45);

    // Falling pitch electrical whine
    const whine = this.ctx.createOscillator();
    whine.type = 'sine';
    whine.frequency.setValueAtTime(440, t);
    whine.frequency.exponentialRampToValueAtTime(40, t + 0.8);

    const whineEnv = this.ctx.createGain();
    whineEnv.gain.setValueAtTime(0.4, t);
    whineEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    whine.connect(whineEnv);
    whineEnv.connect(masterGain);
    whine.start(t);
    whine.stop(t + 0.9);

    return masterGain;
  }

  playPowerRestoreEvent() {
    const t = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.75;

    // Relay mechanical switch thud
    const relay = this.ctx.createOscillator();
    relay.type = 'square';
    relay.frequency.setValueAtTime(800, t);
    relay.frequency.exponentialRampToValueAtTime(120, t + 0.08);

    const relayEnv = this.ctx.createGain();
    relayEnv.gain.setValueAtTime(0.8, t);
    relayEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    relay.connect(relayEnv);
    relayEnv.connect(masterGain);
    relay.start(t);
    relay.stop(t + 0.12);

    // Gas tube ignition arc noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 3.0;

    const noiseEnv = this.ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.5, t + 0.05);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    noise.connect(filter);
    filter.connect(noiseEnv);
    noiseEnv.connect(masterGain);
    noise.start(t + 0.05);
    noise.stop(t + 0.5);

    return masterGain;
  }

  // --- OPENING CINEMATIC SOUND EFFECTS ---

  playPaperSlam() {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.45;

    // Filtered friction noise burst for paper impact
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    filter.Q.value = 1.8;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.7, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(env);
    env.connect(gain);

    noise.start(t);
    noise.stop(t + 0.2);
    return gain;
  }

  playStampThud() {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.65;

    // Deep wooden / mechanical thud
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(env);
    env.connect(gain);

    // Initial click impact
    const click = this.ctx.createBufferSource();
    click.buffer = this.noiseBuffer;
    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 2000;
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.setValueAtTime(0.4, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    click.connect(clickFilter);
    clickFilter.connect(clickEnv);
    clickEnv.connect(gain);

    osc.start(t);
    osc.stop(t + 0.18);
    click.start(t);
    click.stop(t + 0.05);

    return gain;
  }

  playVHSStaticBurst(duration = 0.45) {
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.Q.value = 1.2;

    noise.connect(filter);
    filter.connect(gain);

    noise.start(t);
    noise.stop(t + duration);
    return gain;
  }

  createOpeningDrone() {
    const group = {
      gainNode: this.ctx.createGain(),
      oscillators: [],
      sources: []
    };
    group.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    group.gainNode.gain.linearRampToValueAtTime(0.55, this.ctx.currentTime + 3.0);

    // 1. Low 60Hz Electrical Hum with harmonics
    const freqs = [60, 120, 180, 240];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'sawtooth';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.15 / (i + 1);
      osc.connect(g);
      g.connect(group.gainNode);
      osc.start();
      group.oscillators.push(osc);
    });

    // 2. Sub-bass atmospheric drone (38Hz)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 38;
    const subG = this.ctx.createGain();
    subG.gain.value = 0.35;
    subOsc.connect(subG);
    subG.connect(group.gainNode);
    subOsc.start();
    group.oscillators.push(subOsc);

    // 3. Continuous tape hiss
    const hiss = this.ctx.createBufferSource();
    hiss.buffer = this.hissBuffer;
    hiss.loop = true;
    const hissFilter = this.ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 1500;
    const hissGain = this.ctx.createGain();
    hissGain.gain.value = 0.12;

    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(group.gainNode);
    hiss.start();
    group.sources.push(hiss);

    group.stop = (fadeTime = 1.0) => {
      const now = this.ctx.currentTime;
      group.gainNode.gain.setValueAtTime(group.gainNode.gain.value, now);
      group.gainNode.gain.linearRampToValueAtTime(0.001, now + fadeTime);
      setTimeout(() => {
        group.oscillators.forEach(o => { try { o.stop(); } catch(e){} });
        group.sources.forEach(s => { try { s.stop(); } catch(e){} });
      }, fadeTime * 1000 + 50);
    };

    return group;
  }
}
