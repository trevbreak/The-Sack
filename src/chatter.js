// The kids talking: speech bubbles over their heads, little two-line arguments,
// reactions to whatever's happening, and the sound effects they make with their mouths.
// Rate-limited so the street feels chatty without drowning the screen.
import * as THREE from 'three';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// {NAME} is the speaker, {OTHER} someone else, {THING} a creature or weapon.
export const LINES = {
  kill: ['GOT HIM!', 'Take THAT!', 'Boom. Headshot.', 'Did you see that?!', 'Too easy!', 'Eat rocks!', 'That one was mine!', 'Bullseye!', 'Get outta our street!', 'Yesss!'],
  bossKill: ['WE DID IT!!', 'BEST. DAY. EVER.', 'Nobody tell Mum about this.', 'That was SO sick!', 'I\'m telling everyone at school!'],
  leak: ['NOOO! The sack!', 'It got past!', 'Who was meant to be guarding?!', 'Not the letterbox!', 'Mum\'s gonna kill us.', 'That\'s not fair, it cheated!'],
  newCreature: ['What IS that?!', 'Ummm… guys?', 'That\'s a new one.', 'Nobody said there\'d be THOSE.', 'I\'m not scared. You\'re scared.'],
  lion: ['It can FLY?! That\'s not fair!', 'LIONS don\'t even fly!', 'Aim UP! Aim UP!'],
  boss: ['That is SO big.', 'Is that… the boss?', 'We\'re gonna need a bigger slingshot.', 'I call not it!'],
  arrive: ['Reporting for duty!', 'I\'m heeeere!', 'What\'d I miss?', 'Scooch over.', 'This is MY fort now.'],
  upgrade: ['SICK!', 'Best. Fort. Ever.', 'Ooooh, fancy.', 'Can I live up here?', 'Dad would be proud. Maybe.'],
  spec: ['IT\'S ALIVE!', 'This is the best thing I\'ve ever made.', 'Nobody touch it, it\'s perfect.'],
  bored: ['I\'m booored.', 'Is anything even coming?', 'This is taking forever.', 'Can we play something else?', 'My legs are asleep.', '*yaaawn*', 'I spy something… brown.'],
  drift: ['Back in a sec!', 'I\'m gonna shoot some hoops.', 'Brb, getting a Zooper Dooper.', 'This is boring, I\'m going inside.', 'I saw a lizard!', 'Just one game of Minecraft…'],
  complain: ['{OTHER}\'s not even helping!', 'Oi! {OTHER}! Get back here!', 'Where\'s {OTHER} going?!', '{OTHER} always does this.', 'Fine, I\'ll do it MYSELF.', 'Typical {OTHER}.'],
  back: ['What\'d I miss?', 'Okay okay, I\'m back.', 'Did we win yet?', 'I was only gone for like a second.'],
  backReply: ['EVERYTHING.', 'Took you long enough.', 'Finally.', 'Nothing. You missed nothing. Ugh.'],
  called: ['Awww, MUUUM!', 'But we\'re in the middle of something!', 'Can\'t it wait?!', 'Five more minutes!', 'It\'s not even my turn!'],
  dinner: ['Five more minutes!!', 'Is it spag bol?', 'Same time tomorrow?', 'Bags the treehouse tomorrow!', 'Don\'t touch my fort!', 'Byeee!'],
  morning: ['Race ya!', 'Last one there\'s a rotten egg!', 'Bags the good fort!', 'I had a dream about golems.', 'Today\'s the day.'],
  scared: ['AAAAHH!', 'GET IT OFF GET IT OFF!', 'Drop bear! DROP BEAR!', 'I want my mum!'],
  recruit: ['Can I play?', 'Hi! I\'m {NAME}. What are we playing?', 'My mum said I could come out.'],
  recruitReply: ['Yeah, but you have to be the goblin.', 'Only if you know the secret password.', 'Okay but no crying.', 'You\'re on the team. I guess.'],
  goof: ['Watch this!', 'Swish!', 'I\'m the best at this.', 'Bet you can\'t do a handstand.', 'Ten points!'],
  callback: ['Fine…', 'Ugh, okay.', 'Only because you gave me an icy pole.', 'Mmm, raspberry.'],
};

// Little two-kid arguments, the way kids actually play pretend.
export const PAIRS = [
  ['I got him!', 'No way, he had a force field!'],
  ['You\'re dead, you have to lie down.', 'Nuh-uh, I had an extra life!'],
  ['I\'m the captain now.', 'You can\'t be captain, it\'s MY fort!'],
  ['That one was worth a million points.', 'Points aren\'t even real.'],
  ['I\'m a level 99 wizard.', 'Well I\'m level 100.'],
  ['My dad could beat that golem.', 'My dad could beat YOUR dad.'],
  ['Cover me!', 'I AM covering you!'],
  ['Pass the rocks.', 'Get your own rocks.'],
  ['I think it\'s getting closer.', 'That\'s what I SAID.'],
  ['Do you think golems have mums?', 'Focus, {OTHER}!'],
  ['This is the best holidays ever.', 'Yeah.'],
  ['I\'m starving.', 'You just had a whole packet of Shapes.'],
  ['Watch out for the lava!', 'That\'s just the path.'],
  ['What if we build a moat?', 'With what, the hose?'],
  ['I invented this game.', 'You did NOT.'],
];

// Mouth sound effects when a fort fires (it's all pretend, after all).
export const SFX = {
  slingshot: ['PEW!', 'THWACK!', 'PING!', 'YOINK!'],
  balloon: ['SPLOOSH!', 'SPLAT!', 'KA-SPLOSH!'],
  rocket: ['KA-BLAM!', 'WHOOSH!', 'KABOOM!', 'FWOOSH!'],
  dart: ['PEW PEW PEW!', 'RATATAT!', 'BRRRRT!'],
  magnifier: ['SIZZLE!', 'TSSSS!'],
  zapper: ['ZZZAP!', 'BZZT!', 'KRRZZT!'],
  salt: ['SPLOOF!', 'KER-SPLASH!', 'THOOMP!'],
};

class Bubble {
  constructor(root, target, html, color, life) {
    this.target = target; // Object3D (a kid) or Vector3
    this.life = life;
    this.t = 0;
    this.el = document.createElement('div');
    this.el.className = 'kidbubble';
    this.el.style.setProperty('--kid', color);
    this.el.innerHTML = html;
    root.appendChild(this.el);
    this.v = new THREE.Vector3();
  }

  place(cam) {
    const t = this.target;
    if (t.isObject3D) {
      if (!t.visible) return (this.el.style.display = 'none');
      t.getWorldPosition(this.v);
    } else this.v.copy(t);
    this.v.y += 2.1;
    this.v.project(cam);
    if (this.v.z > 1) return (this.el.style.display = 'none');
    this.el.style.display = '';
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    this.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    // pop in, fade out
    this.el.style.opacity = this.t > this.life - 0.4 ? Math.max(0, (this.life - this.t) / 0.4) : 1;
  }

  remove() {
    this.el.remove();
  }
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class Chatter {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('floaters');
    this.list = [];
    this.lastByKid = new Map();
    this.lastByKind = new Map();
    this.queue = []; // delayed replies: { at, fn }
    this.clock = 0;
    this.pairT = 8;
  }

  // Say a line (or pick from LINES[kind]). Returns false if rate-limited.
  say(boy, kindOrText, vars = {}, { force = false, life = 2.6, gap = 7, kindGap = 0 } = {}) {
    if (!boy || !boy.mesh) return false;
    const isKind = LINES[kindOrText];
    if (!force) {
      if (this.list.length >= 5) return false;
      if (this.clock - (this.lastByKid.get(boy) ?? -99) < gap) return false;
      if (isKind && kindGap && this.clock - (this.lastByKind.get(kindOrText) ?? -99) < kindGap) return false;
    }
    const text = fill(isKind ? pick(LINES[kindOrText]) : kindOrText, { NAME: boy.name, ...vars });
    this.lastByKid.set(boy, this.clock);
    if (isKind) this.lastByKind.set(kindOrText, this.clock);
    const b = new Bubble(this.root, boy.mesh, `<b>${esc(boy.name)}</b>${esc(text)}`, boy.shirtCss, life);
    this.list.push(b);
    return true;
  }

  // A kid's voice from somewhere else (through a window, say).
  sayAt(pos, boy, text) {
    const b = new Bubble(this.root, pos.clone().setY(1.2), `<b>${esc(boy.name)}</b>${esc(text)}`, boy.shirtCss, 3);
    b.el.classList.add('window');
    this.list.push(b);
  }

  // One kid says something, another answers a moment later.
  exchange(a, b, first, second, vars = {}) {
    if (!this.say(a, first, { OTHER: b.name, ...vars }, { gap: 4 })) return false;
    this.later(1.5, () => this.say(b, second, { OTHER: a.name, ...vars }, { force: true }));
    return true;
  }

  later(sec, fn) {
    this.queue.push({ at: this.clock + sec, fn });
  }

  // A comic-book mouth sound effect near a fort.
  sfx(fort) {
    const words = SFX[fort.base.key];
    if (!words) return;
    const p = fort.pos.clone();
    p.y = fort.height + 1.8;
    p.x += (Math.random() - 0.5) * 1.5;
    this.game.effects.float(pick(words), p, `sfx sfx${Math.floor(Math.random() * 3)}`);
  }

  // Random chatter between two kids on the same (or neighbouring) fort.
  randomPair() {
    const g = this.game;
    const manned = g.boys.filter((b) => b.state === 'manning');
    if (manned.length < 2) return;
    const a = pick(manned);
    const near = manned.filter((b) => b !== a && b.fort && a.fort && b.fort.pos.distanceToSquared(a.fort.pos) < 16 * 16);
    if (!near.length) return;
    const b = near.find((x) => x.fort === a.fort) || pick(near);
    const [l1, l2] = pick(PAIRS);
    this.exchange(a, b, l1, l2);
  }

  update(dt, raw) {
    this.clock += raw;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.clock >= this.queue[i].at) {
        const q = this.queue.splice(i, 1)[0];
        q.fn();
      }
    }
    const g = this.game;
    if (g.phase === 'day' && !g.paused && g.started && !g.over) {
      this.pairT -= raw;
      if (this.pairT <= 0) {
        this.pairT = 9 + Math.random() * 10;
        this.randomPair();
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.t += raw;
      if (b.t >= b.life) {
        b.remove();
        this.list.splice(i, 1);
      }
    }
  }

  place() {
    for (const b of this.list) b.place(this.game.camera);
  }

  clear() {
    for (const b of this.list) b.remove();
    this.list = [];
    this.queue = [];
  }
}
