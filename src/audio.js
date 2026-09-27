// Tiny synthesized sound effects — no audio files needed.
const THROTTLE = { hop: 0.1, dig: 0.15, roar: 1.5, sizzle: 0.12, zapper: 0.05, salt: 0.1, dart: 0.07, slingshot: 0.05, hit: 0.04, pop: 0.05, coin: 0.08, splash: 0.06, boom: 0.06, balloon: 0.05, rocket: 0.06 };

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.last = {};
  }

  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  tone(f, dur, { type = 'square', vol = 0.15, to = null, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, type = 'lowpass', delay = 0, q = 0.8 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name) {
    if (this.muted || !this.ctx) return;
    const gap = THROTTLE[name];
    if (gap) {
      const now = performance.now();
      if (this.last[name] && now - this.last[name] < gap * 1000) return;
      this.last[name] = now;
    }
    switch (name) {
      case 'slingshot':
        this.noise(0.06, { vol: 0.12, freq: 2500, type: 'highpass' });
        this.tone(320, 0.07, { type: 'triangle', to: 120, vol: 0.12 });
        break;
      case 'balloon':
        this.tone(180, 0.2, { type: 'sine', to: 520, vol: 0.12 });
        break;
      case 'splash':
        this.noise(0.3, { vol: 0.25, freq: 900 });
        break;
      case 'rocket':
        this.noise(0.25, { vol: 0.1, freq: 3000, type: 'bandpass' });
        this.tone(700, 0.22, { type: 'sawtooth', to: 1800, vol: 0.04 });
        break;
      case 'boom':
        this.noise(0.45, { vol: 0.35, freq: 420 });
        break;
      case 'dart':
        this.tone(950, 0.03, { type: 'square', to: 600, vol: 0.035 });
        break;
      case 'hit':
        this.noise(0.04, { vol: 0.08, freq: 1500 });
        break;
      case 'pop':
        this.tone(200, 0.18, { type: 'square', to: 60, vol: 0.1 });
        this.noise(0.2, { vol: 0.15, freq: 600 });
        break;
      case 'coin':
        this.tone(880, 0.06, { type: 'sine', vol: 0.1 });
        this.tone(1320, 0.12, { type: 'sine', vol: 0.1, delay: 0.06 });
        break;
      case 'build':
        for (let i = 0; i < 3; i++) {
          this.noise(0.08, { vol: 0.25, freq: 500, delay: i * 0.11 });
          this.tone(140, 0.08, { type: 'triangle', vol: 0.15, delay: i * 0.11 });
        }
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.1, delay: i * 0.07 }));
        break;
      case 'horn':
        this.tone(220, 0.6, { type: 'sawtooth', vol: 0.08 });
        this.tone(277, 0.6, { type: 'sawtooth', vol: 0.06, delay: 0.05 });
        this.tone(330, 0.8, { type: 'sawtooth', vol: 0.06, delay: 0.1 });
        break;
      case 'hurt':
        this.tone(160, 0.45, { type: 'sawtooth', to: 70, vol: 0.2 });
        this.noise(0.4, { vol: 0.2, freq: 300 });
        break;
      case 'recruit':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.15, { type: 'sine', vol: 0.12, delay: i * 0.09 }));
        break;
      case 'sizzle':
        this.noise(0.12, { vol: 0.04, freq: 5000, type: 'highpass' });
        break;
      case 'zapper':
        this.tone(1200, 0.12, { type: 'sawtooth', vol: 0.06, to: 300 });
        this.noise(0.1, { vol: 0.12, freq: 3500, type: 'bandpass', q: 3 });
        break;
      case 'salt':
        this.noise(0.18, { vol: 0.25, freq: 250 });
        this.tone(90, 0.2, { type: 'sine', vol: 0.2 });
        break;
      case 'hop':
        this.noise(0.12, { vol: 0.1, freq: 1800, type: 'bandpass' });
        break;
      case 'dig':
        this.noise(0.35, { vol: 0.2, freq: 300 });
        break;
      case 'roar':
        this.tone(140, 0.7, { type: 'sawtooth', vol: 0.12, to: 80 });
        this.noise(0.6, { vol: 0.15, freq: 500 });
        break;
      case 'scared':
        this.tone(700, 0.25, { type: 'square', vol: 0.08, to: 1200 });
        this.tone(900, 0.3, { type: 'square', vol: 0.06, to: 1500, delay: 0.1 });
        break;
      case 'yell':
        // A muffled "HEYYY" from the front door.
        this.tone(330, 0.12, { type: 'sawtooth', vol: 0.07, to: 420 });
        this.tone(420, 0.35, { type: 'sawtooth', vol: 0.07, to: 260, delay: 0.12 });
        break;
      case 'bell':
        [988, 784, 988, 784].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.22 }));
        break;
      case 'click':
        this.tone(660, 0.04, { type: 'square', vol: 0.05 });
        break;
      case 'err':
        this.tone(160, 0.12, { type: 'square', vol: 0.08 });
        break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.13 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { type: 'sawtooth', vol: 0.08, delay: i * 0.25 }));
        break;
    }
  }
}
