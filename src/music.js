// "The Sack" theme: an epic little adventure score with some whimsy, synthesized
// on the fly (no audio files). D minor, lifting into F major for the heroic bits.
// Mood follows the game: 'calm' in the morning (no drums), 'action' while creatures
// are out (full orchestra: timpani, galloping strings, brass), 'night' for a music box.

const MINOR = [0, 2, 3, 5, 7, 8, 10]; // D natural minor (same notes as F major)
const TONIC = 62; // D4
const BPM = 128;
const STEPS = 16; // 16th notes per bar

// Melody bars in scale degrees (0 = D4, 7 = D5), one token per 8th note:
// '_' holds, 'x' rests.
const bars = (s) => s.split('|').map((b) => b.trim().split(/\s+/).map((t) => (t === '_' || t === 'x' ? t : +t)));

// Chords: semitones above D and quality. A major (with its C#) is the big "here we go" chord.
const CH = {
  Dm: [0, 'm'], Gm: [5, 'm'], Bb: [-4, 'M'], F: [3, 'M'], C: [-2, 'M'], A: [7, 'M'],
};

const SECTIONS = {
  // Horn fanfare over timpani.
  F: {
    chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'],
    lead: 'brass',
    melody: bars('0 _ _ 0 4 _ _ _ | 5 _ _ 5 7 _ _ _ | 6 _ _ 6 8 _ _ _ | 4 _ _ _ _ _ x x | 7 _ _ 7 11 _ _ _ | 12 _ _ 12 9 _ 7 _ | 13 _ _ 13 8 _ _ _ | 11 _ _ _ _ _ x x'),
    crash: true,
  },
  // The adventure theme: off down the fire trail.
  A: {
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'A'],
    lead: 'horn',
    melody: bars('0 _ _ 4 _ 3 4 _ | 5 _ 4 _ 3 _ 2 _ | 2 _ _ 4 _ 7 _ _ | 6 _ 5 4 _ _ x _ | 0 _ _ 4 _ 3 4 _ | 5 _ 7 _ 9 _ 8 _ | 7 _ 6 _ 5 _ 4 _ | 4 _ _ _ 1 _ 4 _'),
  },
  // Same again, with glockenspiel sparkles.
  A2: { from: 'A', lead: 'horn', glock: true },
  // The heroic chorus: soaring brass.
  B: {
    chords: ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'Gm', 'A'],
    lead: 'brass',
    melody: bars('7 _ _ _ 8 _ 9 _ | 9 _ _ _ _ _ 7 8 | 10 _ 9 _ 8 _ 7 _ | 7 _ _ _ _ _ x _ | 7 _ _ _ 8 _ 9 _ | 11 _ _ _ 10 _ 9 _ | 10 _ 9 _ 8 _ 10 _ | 11 _ _ _ _ _ _ _'),
    crash: true,
    big: true,
  },
  // Tiptoeing past the golems: bassoon, pizzicato and a slide whistle.
  C: {
    chords: ['Dm', 'Gm', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm'],
    lead: 'bassoon',
    sneaky: true,
    melody: bars('0 x 2 x 4 x 3 2 | 3 x 5 x 7 x 6 5 | 4 x 2 x 0 x 2 x | 4 _ 1 _ -3 _ x x | 0 x 2 x 4 x 7 x | 8 x 7 x 5 x 3 x | 4 x 1 x 4 x 8 x | 7 _ _ _ x x x x'),
  },
};
const FORM = ['F', 'A', 'A2', 'B', 'C', 'A', 'B'];
const LOOP_FROM = 1; // the fanfare only plays once

const midiOf = (deg, base = TONIC) => base + Math.floor(deg / 7) * 12 + MINOR[((deg % 7) + 7) % 7];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const triad = (name, base) => {
  const [r, q] = CH[name];
  return [base + r, base + r + (q === 'm' ? 3 : 4), base + r + 7];
};

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
    // A gentle compressor glues the orchestra together and stops peaks clipping.
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.out.connect(comp).connect(c.destination);
    this.playing = true;
    this.form = 0;
    this.bar = 0;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.level = -1;
    this.timer = setInterval(() => this.schedule(), 25);
    this.applyLevel();
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('theSack.music', this.on ? 'on' : 'off'); } catch {}
    this.applyLevel();
  }

  update(mood, paused) {
    if (!this.playing) return;
    this.mood = mood;
    this.paused = paused;
    this.applyLevel();
  }

  applyLevel() {
    if (!this.out) return;
    let v = { calm: 0.25, action: 0.27, night: 0.22 }[this.mood] ?? 0.25;
    if (!this.on || this.sfx.muted) v = 0;
    else if (this.paused) v *= 0.35;
    if (v === this.level) return;
    this.level = v;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(v, t, 0.5);
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    const dur = 60 / BPM / 4;
    while (this.next < c.currentTime + 0.25) {
      this.playStep(this.next, dur);
      this.next += dur;
      if (++this.step === STEPS) {
        this.step = 0;
        if (++this.bar === 8) {
          this.bar = 0;
          this.form = this.form + 1 >= FORM.length ? LOOP_FROM : this.form + 1;
        }
      }
    }
  }

  playStep(t, dur) {
    const sec = SECTIONS[FORM[this.form]];
    const base = sec.from ? SECTIONS[sec.from] : sec;
    const chord = base.chords[this.bar];
    const s = this.step;
    const mood = this.mood;
    const action = mood === 'action';
    const night = mood === 'night';
    const sneaky = base.sneaky;
    const beat = dur * 4;

    // ----- melody (8th-note grid) -----
    if (s % 2 === 0) {
      const row = base.melody[this.bar];
      const i = s / 2;
      const note = row[i];
      if (typeof note === 'number') {
        let len = 1;
        while (i + len < 8 && row[i + len] === '_') len++;
        const d = len * dur * 2;
        const f = hz(midiOf(note));
        if (night) {
          if (i % 2 === 0) this.bell(f * 2, t, 0.09); // music box
        } else if (sneaky) {
          this.bassoon(f / 2, t, Math.min(d, 0.22));
          this.pizz(f, t, 0.07);
        } else {
          this.lead(sec.lead || base.lead, f, d, t, base.big && action);
          // Epic doubling: the horns an octave down join in during the action.
          if (action && !sneaky) this.lead('horn', f / 2, d, t, false, 0.45);
        }
      }
    }

    // ----- harmony -----
    const low = triad(chord, TONIC - 12);
    if (s === 0 && !sneaky) for (const m of low) this.pad(hz(m), t, beat * 4, night ? 0.018 : 0.028);
    if (!night) {
      // Galloping string ostinato: da-da-dum, da-da-dum.
      const gallop = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15];
      if (action && !sneaky && gallop.includes(s)) {
        const m = s % 4 === 0 ? low[0] : s % 4 === 2 ? low[2] : low[1];
        this.strings(hz(m), t, dur * 0.9, s % 4 === 0 ? 0.05 : 0.035);
      } else if ((!action || sneaky) && s % 4 === 2) {
        for (const m of low) this.pizz(hz(m), t, sneaky ? 0.03 : 0.025);
      }
    }

    // ----- bass -----
    if (!night && (s === 0 || s === 8 || (action && s === 14))) {
      const root = triad(chord, TONIC - 24)[0];
      this.bass(hz(s === 14 ? root + 12 : root), t, s === 14 ? dur : beat * 1.8, sneaky ? 0.12 : 0.18);
    }

    // ----- sparkle -----
    if ((sec.glock || sneaky) && !night && s % 4 === 3) {
      const up = triad(chord, TONIC + 12);
      this.bell(hz(up[(s >> 2) % 3]), t, 0.035);
    }
    // Slide whistle at the end of the sneaky phrases.
    if (sneaky && !night && (this.bar === 3 || this.bar === 7) && s === 12) this.slide(t, this.bar === 3);

    // ----- percussion (only while creatures are out) -----
    if (!action) return;
    if (sec.crash && this.bar === 0 && s === 0) this.crash(t);
    if (!sneaky) {
      if (s === 0 || s === 8) this.timpani(hz(low[0] - 12), t, 0.3);
      if (s === 4 || s === 12) this.snare(t, 0.08);
      if (s === 14 || s === 15) this.snare(t, 0.03);
      if (s % 2 === 1) this.hat(t);
      // Timpani roll into the next section.
      if (this.bar === 7 && s >= 8) this.timpani(hz(low[0] - 12), t, 0.08 + (s - 8) * 0.025);
      if (base.big && this.bar % 2 === 1 && s >= 12) this.snare(t, 0.05);
    } else {
      if (s === 0 || s === 8) this.timpani(hz(low[0] - 12), t, 0.12);
      if (s === 6 || s === 14) this.block(t);
    }
  }

  // ---------- instruments ----------
  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  osc(type, f, t, dur, dest, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.15);
    return o;
  }

  // Brass: detuned saws through a filter that opens as the note blares.
  lead(kind, f, dur, t, big = false, scale = 1) {
    const c = this.ctx;
    const d = Math.max(0.14, dur);
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = kind === 'brass' ? 2 : 0.7;
    const open = kind === 'brass' ? 7 : 3.5;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(f * open, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(f * (open * 0.6), t + d);
    lp.connect(g).connect(this.out);
    const vol = (kind === 'brass' ? (big ? 0.11 : 0.09) : 0.075) * scale;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.05, d - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
    const o1 = this.osc('sawtooth', f, t, d, lp, -6);
    const o2 = this.osc('sawtooth', f, t, d, lp, 6);
    // A little vibrato on held notes.
    if (d > 0.4) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.2;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
      lfo.connect(lg);
      lg.connect(o1.frequency);
      lg.connect(o2.frequency);
      lfo.start(t);
      lfo.stop(t + d + 0.15);
    }
  }

  bassoon(f, t, dur) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 3;
    lp.connect(g).connect(this.out);
    this.env(g, t, 0.015, 0.12, dur);
    this.osc('square', f, t, dur, lp);
  }

  strings(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.connect(g).connect(this.out);
    this.env(g, t, 0.01, vol, dur);
    this.osc('sawtooth', f, t, dur, lp, -4);
    this.osc('sawtooth', f * 2, t, dur, lp, 5);
  }

  pad(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(g).connect(this.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.5);
    g.gain.setValueAtTime(vol, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    this.osc('sawtooth', f, t, dur + 0.2, lp, -8);
    this.osc('sawtooth', f, t, dur + 0.2, lp, 8);
  }

  pizz(f, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.004, vol, 0.18);
    this.osc('triangle', f, t, 0.2, g);
  }

  bass(f, t, dur, vol) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.connect(g).connect(this.out);
    this.env(g, t, 0.01, vol, dur);
    this.osc('sawtooth', f, t, dur, lp);
    this.osc('sine', f, t, dur, g);
  }

  bell(f, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.003, vol, 0.7);
    this.osc('sine', f, t, 0.75, g);
    this.osc('sine', f * 2.76, t, 0.25, g);
  }

  // Slide whistle: wheee up (or down).
  slide(t, up) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.03, 0.06, 0.45);
    const o = this.osc('sine', up ? 600 : 1400, t, 0.5, g);
    o.frequency.exponentialRampToValueAtTime(up ? 1500 : 500, t + 0.42);
  }

  timpani(f, t, vol) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.004, vol, 0.45);
    const o = this.osc('sine', f * 1.5, t, 0.5, g);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    this.noise(t, vol * 0.3, 0.08, 'lowpass', 600);
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
    this.noise(t, vol, 0.13, 'bandpass', 1900);
  }

  hat(t) {
    this.noise(t, 0.018, 0.04, 'highpass', 8000);
  }

  crash(t) {
    this.noise(t, 0.09, 1.6, 'highpass', 5000);
  }

  block(t) {
    const g = this.ctx.createGain();
    g.connect(this.out);
    this.env(g, t, 0.002, 0.06, 0.06);
    this.osc('sine', 1250, t, 0.08, g);
  }
}
