// A whimsical adventure tune, synthesized on the fly (no audio files).
// Written as scale degrees in D major, eight swung 8th-note steps per bar.
// Mood follows the game: 'calm' in the morning, 'action' while creatures are
// out (drums and oom-pah bass kick in), 'night' for a quiet lullaby.

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const TONIC = 62; // D4
const BPM = 108;
const SWING = 0.6; // share of each beat given to the on-beat 8th

// Melody bars: numbers are scale degrees (0 = D4, 7 = D5), '_' holds, 'x' rests.
const bars = (s) => s.split('|').map((b) => b.trim().split(/\s+/).map((t) => (t === '_' || t === 'x' ? t : +t)));

const SECTIONS = {
  // The main theme: up the hill and over the fence.
  A: {
    chords: [0, 3, 0, 4, 0, 3, 4, 0],
    lead: 'flute',
    melody: bars('0 _ 2 4 7 _ 4 _ | 5 _ 3 5 8 _ 7 5 | 4 _ 2 4 7 _ 9 _ | 8 7 6 _ 4 _ x _ | 0 _ 2 4 7 _ 4 2 | 3 _ 5 7 10 _ 9 7 | 8 _ 6 4 1 _ 6 _ | 7 _ _ _ x _ x x'),
  },
  // Same theme, with glockenspiel sparkles on top.
  A2: { from: 'A', lead: 'flute', glock: true },
  // Off into the bush: minor-ish and a bit braver.
  B: {
    chords: [5, 3, 0, 4, 5, 3, 4, 4],
    lead: 'reed',
    melody: bars('5 _ 4 5 7 _ 5 _ | 3 _ 2 3 5 _ 3 _ | 2 _ 4 7 9 _ 7 _ | 8 _ _ 6 4 _ _ _ | 5 6 7 _ 5 6 7 _ | 10 _ 9 _ 7 _ 5 _ | 4 _ 6 _ 8 _ 11 _ | 8 _ _ _ x 4 5 6'),
  },
  // Sneaking along the trail on tiptoes.
  C: {
    chords: [1, 4, 0, 5, 1, 4, 0, 0],
    lead: 'pizz',
    quiet: true,
    melody: bars('1 x 3 x 5 x 3 x | 4 x 6 x 8 x 6 x | 7 x 4 x 2 x 4 x | 5 x 2 x 0 x 2 x | 1 x 3 x 5 x 8 x | 7 x 6 x 4 x 1 x | 2 x 4 x 7 x 9 x | 7 _ _ _ x x x x'),
  },
};
const FORM = ['A', 'A2', 'B', 'A', 'C', 'B', 'A2'];

const midi = (deg, base = TONIC) => {
  const oct = Math.floor(deg / 7);
  return base + oct * 12 + SCALE[((deg % 7) + 7) % 7];
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.on = true;
    this.mood = 'calm';
    this.playing = false;
    try { this.on = localStorage.getItem('theSack.music') !== 'off'; } catch {}
  }

  get ctx() {
    return this.sfx.ctx;
  }

  start() {
    const c = this.ctx;
    if (!c || this.playing) return;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(c.destination);
    this.playing = true;
    this.form = 0;
    this.bar = 0;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.level = -1;
    this.timer = setInterval(() => this.schedule(), 50);
    this.applyLevel();
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('theSack.music', this.on ? 'on' : 'off'); } catch {}
    this.applyLevel();
  }

  // Called every frame from the game loop.
  update(mood, paused) {
    if (!this.playing) return;
    this.mood = mood;
    this.paused = paused;
    this.applyLevel();
  }

  applyLevel() {
    if (!this.out) return;
    let v = { calm: 0.16, action: 0.19, night: 0.08 }[this.mood] ?? 0.16;
    if (!this.on || this.sfx.muted) v = 0;
    else if (this.paused) v *= 0.35;
    if (v === this.level) return;
    this.level = v;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(v, t, 0.4);
  }

  // Keep ~0.25s of notes queued ahead of the audio clock.
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.25) {
      this.playStep(this.next);
      const beat = 60 / BPM;
      this.next += (this.step % 2 === 0 ? SWING : 1 - SWING) * beat;
      if (++this.step === 8) {
        this.step = 0;
        if (++this.bar === 8) {
          this.bar = 0;
          this.form = (this.form + 1) % FORM.length;
        }
      }
    }
  }

  playStep(t) {
    const name = FORM[this.form];
    const sec = SECTIONS[name];
    const base = sec.from ? SECTIONS[sec.from] : sec;
    const chord = base.chords[this.bar];
    const s = this.step;
    const note = base.melody[this.bar][s];
    const night = this.mood === 'night';
    const action = this.mood === 'action';
    const beat = 60 / BPM;

    // Melody: how long does this note ring (count the holds after it)?
    if (typeof note === 'number' && !night) {
      let len = 1;
      const row = base.melody[this.bar];
      while (s + len < 8 && row[s + len] === '_') len++;
      this.lead(sec.lead || base.lead, hz(midi(note)), len * beat * 0.5, t, sec.quiet || base.quiet);
    }
    if (night && s % 4 === 0 && typeof note === 'number') this.bell(hz(midi(note, TONIC + 12)), t, 0.035);

    // Oom-pah: bass on the beat, chord on the off-beat.
    if (s === 0 || s === 4) this.bass(hz(midi(chord + (s === 4 ? 4 : 0), TONIC - 24)), t, night ? 0.08 : 0.16, beat * 0.9);
    if ((s === 2 || s === 6) && !night) {
      for (const d of [0, 2, 4]) this.pluck(hz(midi(chord + d, TONIC - 12)), t, sec.quiet ? 0.025 : 0.04);
    }
    if (night && s === 0) {
      for (const d of [0, 2, 4]) this.pad(hz(midi(chord + d, TONIC - 12)), t, beat * 4);
    }

    // Glockenspiel sparkle: arpeggio of the chord up high.
    if ((sec.glock || action) && !night && s % 2 === 1 && (sec.glock || s === 7)) {
      const d = [0, 2, 4, 7][(s - 1) / 2];
      this.bell(hz(midi(chord + d, TONIC + 12)), t, 0.03);
    }

    // Drums only while creatures are about.
    if (action) {
      if (s === 0 || s === 4) this.kick(t);
      if (s === 2 || s === 6) this.snare(t, sec.quiet ? 0.04 : 0.07);
      if (s % 2 === 1) this.shaker(t);
      if (this.bar === 7 && s >= 5) this.snare(t, 0.05);
    }
  }

  // ---------- instruments ----------
  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  osc(type, f, t, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.1);
    return o;
  }

  lead(kind, f, dur, t, quiet) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.out);
    if (kind === 'pizz') {
      this.env(g, t, 0.005, quiet ? 0.09 : 0.12, 0.22);
      this.osc('triangle', f, t, 0.25, g);
      this.osc('sine', f * 2, t, 0.1, g);
      return;
    }
    const d = Math.max(0.12, dur);
    if (kind === 'reed') {
      // Clarinet-ish: a soft square through a low-pass.
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = f * 3;
      lp.connect(g);
      this.env(g, t, 0.02, 0.07, d);
      this.osc('square', f, t, d, lp);
      return;
    }
    // Flute/whistle: sine plus a touch of triangle, with a little vibrato.
    this.env(g, t, 0.03, 0.12, d);
    const o = this.osc('sine', f, t, d, g);
    const o2 = this.osc('triangle', f * 2, t, d, g);
    o2.detune.value = 4;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = f * 0.008;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + d + 0.1);
  }

  bass(f, t, vol, dur) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(g).connect(this.out);
    this.env(g, t, 0.01, vol, dur);
    this.osc('sawtooth', f, t, dur, lp);
    this.osc('sine', f, t, dur, g);
  }

  pluck(f, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.005, vol, 0.16);
    this.osc('triangle', f, t, 0.2, g);
  }

  pad(f, t, dur) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.osc('sine', f, t, dur, g);
  }

  bell(f, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.003, vol, 0.5);
    this.osc('sine', f, t, 0.55, g);
    this.osc('sine', f * 2.76, t, 0.2, g);
  }

  kick(t) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.003, 0.22, 0.16);
    const o = this.osc('sine', 130, t, 0.18, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  }

  noise(t, vol, dur, type, freq) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.sfx.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    this.env(g, t, 0.002, vol, dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  snare(t, vol) {
    this.noise(t, vol, 0.12, 'bandpass', 1800);
  }

  shaker(t) {
    this.noise(t, 0.025, 0.05, 'highpass', 7000);
  }
}
