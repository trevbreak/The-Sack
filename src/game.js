import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import {
  WEAPONS, FORT_LEVELS, WEAPON_LEVELS, GOLEMS, weaponUpgradeCost, START, RECRUIT_COSTS, MAX_BOYS,
  BOY_NAMES, MAIN_BOYS, TRAITS, makeWave, DINNER_LINES, CHORE_LINES, CHORE_TIME,
  STAGES, weekOf, troubleFor, GROUNDED_LINES, LATE_LINES, setDifficulty, DIFFICULTIES, ELITES, SPECS, specCost,
} from './config.js';
import { baseMods, drawPerks, PERKS } from './perks.js';
import { Chatter } from './chatter.js';
import { rollNightEvent, LITTLE } from './nights.js';
import { TrailPath, DETOURS, DETOUR_COSTS, RIFTS, spurPath } from './path.js';
import { Parent } from './parents.js';
import { buildWorld } from './world.js';
import { Golem } from './golems.js';
import { Fort } from './forts.js';
import { Boy } from './boys.js';
import { Projectiles } from './projectiles.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { UI } from './ui.js';
import { makeRangeRing } from './util.js';

const WEAPON_KEYS = Object.keys(WEAPONS);
const PAN_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'];
const UP = new THREE.Vector3(0, 1, 0);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// A parent looks out at dusk: what they say, and what the kid yells back.
const REVEAL_LINES = [
  ['WHAT are you lot DOING out there?', 'SAVING THE STREET, MUM!'],
  ['Having fun, love?', 'Mum! You\'re standing in the LAVA!'],
  ['Who\'s winning?', 'Us! Obviously!'],
  ['Don\'t poke anyone\'s eye out with that stick!', 'It\'s not a stick, it\'s a ROCKET LAUNCHER.'],
  ['Why are you yelling at the bushes?', 'Because that\'s where the GOLEMS are!'],
];
// Heard through the windows after dinner.
const HOUSE_LINES = [
  'But Mum, there were GOLEMS!',
  'I wasn\'t even muddy!',
  'Can Kai sleep over? Pleeeease?',
  'I\'m not even tired!!',
  'Do I HAVE to have a bath?',
  'It was Jimmy\'s fault!',
  'I\'m not hungry, I had Shapes.',
  'Can we have fish fingers again?',
  'We saved the whole street today!',
  'Five more minutes of telly!',
]; 

// Afternoon → sunset → night palettes for the sky and lights.
const TOD = [
  { top: 0x3f86d8, mid: 0x9cc8ec, bottom: 0xffd7a3, sun: 0xffe2b8, sunI: 2.8, hemi: 1.2, glass: 0x16242c },
  { top: 0x34498a, mid: 0xe8946a, bottom: 0xffb066, sun: 0xff9a55, sunI: 1.7, hemi: 0.85, glass: 0x7a5a2a },
  { top: 0x070b24, mid: 0x1a2350, bottom: 0x3a2f5c, sun: 0x8090ff, sunI: 0.35, hemi: 0.35, glass: 0xffc766 },
];
const _ca = new THREE.Color();
const _cb = new THREE.Color();
function lerpHex(a, b, t, out) {
  return out.copy(_ca.setHex(a)).lerp(_cb.setHex(b), t);
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.initRenderer();
    this.initScene();

    this.path = new TrailPath();
    this.spurs = RIFTS.map(() => null); // spur trails of open rifts (index 0 is the main trail's own rift)
    this.joinDists = RIFTS.map(() => 0); // where each spur meets the main trail
    this.best = 0;
    try {
      this.diffKey = localStorage.getItem('theSack.difficulty') || 'pro';
    } catch {
      this.diffKey = 'pro';
    }
    this.diff = setDifficulty(this.diffKey);
    this.best = this.loadBest();
    this.world = buildWorld(this.scene, this.path);
    this.effects = new Effects(this);
    this.projectiles = new Projectiles(this);
    this.audio = new Sfx();
    this.music = new Music(this.audio);
    this.chatter = new Chatter(this);

    this.golems = [];
    this.forts = [];
    this.boys = [];
    this.points = START.points;
    this.sackHp = START.sackHp;
    this.maxSackHp = START.sackHp;
    this.mods = baseMods();
    this.perks = [];
    this.perkOffer = null;
    this.dayMods = { dmg: 1, rate: 1 };
    this.banned = null; // a weapon Mum confiscated for the day
    this.plans = []; // dinner-table consequences: { day, fn }
    this.nightEvent = null;
    this.revealing = false;
    this.seenToday = new Set();
    this.wave = 0;
    this.waveActive = false;
    this.queue = [];
    this.spawnTimer = 0;
    this.waveDef = null;
    this.time = 0;
    this.realTime = 0;
    this.speed = 1;
    this.paused = false;
    this.started = false;
    this.over = false;
    this.endless = false;
    this.buildKey = null;
    this.selected = null;
    this.hovered = null;
    this.stats = { kills: 0, built: 0, leaked: 0 };
    this.recruits = 0;
    this.nextBoyId = 1;
    this.phase = 'morning'; // morning (build) → day (golems) → dusk (parents) → night → morning
    this.parents = [];
    this.detours = new Set();
    this.dayT = 0;
    this.dayLen = 1;
    this.chores = [];
    this.duskT = 0;
    this.nightT = 0;
    this.tod = 0;
    this.dayKills = 0;
    this.dayLeaks = 0;
    this.seenToday = new Set();

    this.mouse = new THREE.Vector2(-9, -9);
    this.ground = new THREE.Vector3();
    this.groundOk = false;
    this.keys = new Set();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(UP, 0);

    this.ghost = this.makeGhost();
    this.selRing = makeRangeRing(0xffffff);
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    this.ui = new UI(this);
    for (let i = 0; i < START.boys; i++) this.addBoy(true);
    this.ui.renderRoster();
    this.ui.setWavePreview();

    this.bindInput();
    this.lastT = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- setup ----------
  initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    // Phones and tablets: a little less resolution and shadow detail to stay smooth.
    this.touch = window.matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('touch', this.touch);
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.touch ? 1.5 : 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.renderer = r;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf0d8b4, 150, 330);
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 1400);
    this.camera.position.set(0, 52, 36);

    const c = new MapControls(this.camera, this.canvas);
    c.target.set(0, 0, -18);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 14;
    c.maxDistance = 150;
    c.minPolarAngle = 0.2;
    c.maxPolarAngle = 1.3;
    c.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.update();
    this.controls = c;

    this.hemi = new THREE.HemisphereLight(0xcfe7ff, 0x5a4a30, 1.2);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.8);
    sun.position.set(-60, 95, 45);
    sun.target.position.set(0, 0, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(this.touch ? 2048 : 4096);
    const s = sun.shadow.camera;
    s.left = -110;
    s.right = 110;
    s.top = 110;
    s.bottom = -110;
    s.near = 1;
    s.far = 320;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  makeGhost() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.45, depthWrite: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 2.4), mat);
    box.position.y = 0.65;
    const ring = makeRangeRing(0x66ff88);
    g.add(box, ring);
    g.userData = { mat, ring };
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  // ---------- boys ----------
  addBoy(atHangout, opts = {}) {
    const used = new Set(this.boys.map((b) => b.name));
    const names = BOY_NAMES.filter((n) => !used.has(n));
    const name = opts.name || MAIN_BOYS.find((n) => !used.has(n)) || names[Math.floor(Math.random() * names.length)] || `Kid ${this.nextBoyId}`;
    const total = TRAITS.reduce((a, t) => a + t.weight, 0);
    let r = Math.random() * total;
    const trait = opts.trait || TRAITS.find((t) => (r -= t.weight) < 0) || TRAITS[0];
    const boy = new Boy(this, this.nextBoyId++, name, trait, this.boys.length);
    this.boys.push(boy);
    const doors = this.world.doors;
    const d = Math.floor(Math.random() * doors.length);
    boy.home.copy(doors[d]);
    boy.houseNo = 1 + d * 2;
    if (atHangout) boy.placeAtHangout();
    else boy.walkFrom(doors[d]);
    return boy;
  }

  // ---------- the kids being kids ----------
  get boredMul() {
    return 0.6 + 0.4 * Math.sqrt(this.diff.trouble || 1);
  }

  // Regular crew (not tag-along little siblings).
  crewKids() {
    return this.boys.filter((b) => !b.temp);
  }

  pickKids(n) {
    return [...this.crewKids()].sort(() => Math.random() - 0.5).slice(0, n);
  }

  // Someone on this fort says something.
  crewSays(f, kind, opts) {
    const on = f.mannedCrew;
    if (on.length) this.chatter.say(pick(on), kind, {}, opts);
  }

  // A manned kid near a spot (for reacting to things on the trail).
  kidNear(pos, r = 30) {
    let best = null;
    let bd = r * r;
    for (const b of this.boys) {
      if (b.state !== 'manning') continue;
      const d = b.fort.pos.distanceToSquared(pos);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  kidDrifts(b) {
    b.driftOff();
    this.chatter.say(b, 'drift', {}, { force: true });
    const mate = (b.fort && b.fort.mannedCrew[0]) || this.kidNear(b.fort ? b.fort.pos : b.mesh.position, 25);
    if (mate) this.chatter.later(1.4, () => this.chatter.say(mate, 'complain', { OTHER: b.name }, { force: true }));
    this.ui.toast(`${b.drifting.label.split(' ')[0]} ${b.name} got bored and wandered off. ${b.drifting.label.slice(b.drifting.label.indexOf(' ') + 1)}.`, 'warn');
    if (this.selected) this.ui.renderPanel();
  }

  kidBack(b) {
    this.chatter.say(b, 'back', {}, { force: true });
    const mate = b.fort && b.fort.mannedCrew.find((x) => x !== b);
    if (mate && Math.random() < 0.6) this.chatter.later(1.4, () => this.chatter.say(mate, 'backReply', {}, { force: true }));
    if (this.selected) this.ui.renderPanel();
  }

  iceCost() {
    return 10 + this.wave * 2;
  }

  // Bribe a wandering kid back with an icy pole.
  callBack(b) {
    if (!b || !b.drifting) return;
    const cost = this.iceCost();
    if (this.points < cost) return this.fail(`Need ⭐${cost} for an icy pole`);
    this.points -= cost;
    this.audio.play('coin');
    b.comeBack();
    this.chatter.say(b, 'callback', {}, { force: true });
  }

  kidArrived(b) {
    const mate = b.fort.mannedCrew.find((x) => x !== b);
    if (mate && Math.random() < 0.5) this.chatter.exchange(b, mate, pick(['Reporting for duty!', 'Scooch over.', 'I\'m heeeere!', 'What\'d I miss?']), pick(['Took you long enough.', 'Don\'t touch my rocks.', 'Finally!', 'Shhh, I\'m concentrating.']));
    else if (Math.random() < 0.15) this.chatter.say(b, 'arrive');
  }

  // A little sibling tags along for one day.
  addLittle(name, sibling) {
    const b = this.addBoy(false, { name, trait: LITTLE });
    b.temp = true;
    b.home.copy(sibling.home);
    b.houseNo = sibling.houseNo;
    b.mesh.scale.setScalar(0.8);
    b.walkFrom(b.home);
    this.ui.toast(`🧸 ${name} is tagging along today. Put her on a fort, she\'s trying her best.`, 'good');
    this.ui.renderRoster();
  }

  // Schedule something for a morning n days from now.
  plan(n, fn) {
    this.plans.push({ day: this.wave + n, fn });
  }

  // ---------- costs (weekly perks can change these) ----------
  fortCost(key) {
    return Math.round(WEAPONS[key].cost * this.mods.fortCost);
  }

  fortUpCost(f) {
    const next = FORT_LEVELS[f.level + 1];
    return next ? Math.round(next.cost * this.mods.upCost) : 0;
  }

  weaponUpCost(f) {
    return Math.round(weaponUpgradeCost(f.base, f.wlevel) * this.mods.upCost);
  }

  specCost(f) {
    return Math.round(specCost(f.base) * this.mods.upCost);
  }

  get maxBoys() {
    return MAX_BOYS + this.mods.extraBoys;
  }

  recruitCost() {
    return RECRUIT_COSTS[Math.min(this.recruits, RECRUIT_COSTS.length - 1)];
  }

  recruit() {
    if (!this.started || this.over) return;
    if (this.phase === 'dusk' || this.phase === 'night') return this.fail('Everyone\'s inside for dinner. Try in the morning.');
    if (this.crewKids().length >= this.maxBoys) return this.fail('Every kid on the street is already in the crew!');
    const cost = this.recruitCost();
    if (this.points < cost) return this.fail(`Need ⭐${cost} to recruit another boy`);
    this.points -= cost;
    this.recruits++;
    const b = this.addBoy(false);
    this.audio.play('recruit');
    this.ui.toast(`👦 ${b.name} from No. ${b.houseNo} joined the crew! (${b.trait.icon} ${b.trait.name}: ${b.trait.desc})`, 'good');
    const old = this.boys.filter((x) => x !== b && x.mesh.visible);
    if (old.length) this.chatter.exchange(b, pick(old), pick(['Can I play?', 'Hi! What are we playing?', 'My mum said I could come out.']), pick(['Yeah, but you have to be the goblin.', 'Only if you know the secret password.', 'Okay, but no crying.', 'You\'re on the team. I guess.']));
    this.ui.renderRoster();
    if (this.selected) this.ui.renderPanel();
  }

  assignBoy(boy, fort) {
    if (!boy || !fort || fort.crew.includes(boy)) return;
    if (this.phase === 'dusk' || this.phase === 'night') return this.fail('Everyone\'s inside for dinner.');
    if (boy.onChore) return this.fail(`${boy.name} is doing chores. He'll be back soon.`);
    if (boy.away === 'grounded') return this.fail(`${boy.name} is grounded today.`);
    if (boy.away === 'late') return this.fail(`${boy.name} isn't allowed out yet.`);
    // Full fort: whoever joined last swaps out, and we say so.
    if (fort.crew.length >= fort.maxCrew) {
      const out = fort.crew[fort.crew.length - 1];
      this.sendHome(fort, out);
      if (fort.maxCrew === 1) this.ui.toast(`🔁 Swapped ${out.name} for ${boy.name}. A ${FORT_LEVELS[fort.level].name} only fits one kid. Build it up (U) to fit two.`, 'warn');
      else this.ui.toast(`🔁 Swapped ${out.name} for ${boy.name}. This fort is full (two kids max).`, 'warn');
    }
    if (boy.fort) boy.fort.crew = boy.fort.crew.filter((b) => b !== boy);
    fort.crew.push(boy);
    boy.goTo(fort);
    this.audio.play('click');
    if (this.selected) this.ui.renderPanel();
  }

  // Send one kid (or the whole crew) off a fort, back to the sack.
  sendHome(fort, boy = null) {
    const who = boy ? [boy] : [...fort.crew];
    for (const b of who) {
      fort.crew = fort.crew.filter((x) => x !== b);
      if (b.onChore || b.away || this.phase === 'dusk' || this.phase === 'night') b.fort = null;
      else b.goHome();
    }
    if (this.selected) this.ui.renderPanel();
  }

  // ---------- forts ----------
  setBuild(key) {
    if (!this.started || this.over) return;
    const w = WEAPONS[key];
    if (this.buildKey === key) return this.cancelBuild();
    if (this.points < this.fortCost(key)) return this.fail(`Need ⭐${this.fortCost(key)} for a ${w.name}`);
    this.buildKey = key;
    this.select(null);
    this.audio.play('click');
    this.ui.updateBuildActive();
  }

  cancelBuild() {
    this.buildKey = null;
    this.pendingSpot = null;
    this.ghost.visible = false;
    this.ui.updateBuildActive();
  }

  placeReason(x, z) {
    if (Math.abs(x) > 115 || Math.abs(z) > 115) return 'Too far into the bush';
    if (Math.hypot(x, z) < 15.5) return 'Not in the middle of the street!';
    if (Math.abs(x) < 6.8 && z > 0) return 'Not on the road!';
    if (this.path.distanceTo(x, z) < 3.2) return 'Too close to the fire trail — golems would flatten it';
    if (this.spurs.some((sp) => sp && sp.distanceTo(x, z) < 3.2)) return 'Too close to a rift trail — golems would flatten it';
    for (const b of this.world.blockers) if ((b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + 1.3) ** 2) return 'Something is in the way';
    for (const f of this.forts) if ((f.pos.x - x) ** 2 + (f.pos.z - z) ** 2 < 3.8 ** 2) return 'Too close to another fort';
    return null;
  }

  placeFort(x, z, key, keepBuilding) {
    const cost = this.fortCost(key);
    this.points -= cost;
    const f = new Fort(this, x, z, key);
    f.spent = cost;
    this.forts.push(f);
    this.stats.built++;
    this.effects.burst(new THREE.Vector3(x, 0.6, z), 0xc79a64, 18, { speed: 4, up: 5, size: 0.22 });
    this.audio.play('build');

    const free = this.boys.filter((b) => !b.fort);
    if (free.length) {
      free.sort((a, b) => a.mesh.position.distanceToSquared(f.pos) - b.mesh.position.distanceToSquared(f.pos));
      this.assignBoy(free[0], f);
    } else {
      this.ui.toast('Nobody free to man it! Recruit a boy (R) or move one over.', 'warn');
    }
    if (!keepBuilding || this.points < cost) {
      this.cancelBuild();
      this.select(f);
    }
  }

  upgradeFort(f) {
    const next = FORT_LEVELS[f.level + 1];
    if (!next) return;
    const cost = this.fortUpCost(f);
    if (this.points < cost) return this.fail(`Need ⭐${cost} to build it up`);
    this.points -= cost;
    f.spent += cost;
    f.upgradeStructure();
    this.effects.burst(f.pos.clone().setY(1.5), 0xcaa46d, 22, { speed: 4, up: 6, size: 0.22 });
    this.audio.play('build');
    this.ui.toast(`🔨 Built it up into a ${next.name}!`, 'good');
    this.crewSays(f, 'upgrade');
    this.ui.renderPanel();
  }

  upgradeWeapon(f) {
    if (f.wlevel >= WEAPON_LEVELS.length - 1) return;
    const cost = this.weaponUpCost(f);
    if (this.points < cost) return this.fail(`Need ⭐${cost} to upgrade the ${f.weapon.short}`);
    this.points -= cost;
    f.spent += cost;
    f.upgradeWeapon();
    if (Math.random() < 0.5) this.crewSays(f, 'upgrade');
    this.effects.burst(f.pos.clone().setY(f.height + 1), 0xffd02e, 16, { speed: 3, up: 5, size: 0.14 });
    this.audio.play('upgrade');
    this.ui.renderPanel();
  }

  // A 5-star weapon can be specialised one of two ways.
  specialise(f, i) {
    const spec = SPECS[f.base.key]?.[i];
    if (!spec || f.spec || f.wlevel < WEAPON_LEVELS.length - 1) return;
    const cost = this.specCost(f);
    if (this.points < cost) return this.fail(`Need ⭐${cost} to make it a ${spec.name}`);
    this.points -= cost;
    f.spent += cost;
    f.specialise(spec);
    this.effects.burst(f.pos.clone().setY(f.height + 1), 0xffd02e, 30, { speed: 5, up: 7, size: 0.18 });
    this.effects.float(spec.name.toUpperCase() + '!', f.pos.clone().setY(f.height + 2), 'big');
    this.audio.play('win');
    this.ui.toast(`${spec.icon} It's a ${spec.name} now! ${spec.desc}`, 'good');
    this.crewSays(f, 'spec');
    for (const b of f.mannedCrew) b.cheer();
    this.ui.renderPanel();
  }

  sellFort(f) {
    const refund = f.sellValue();
    this.points += refund;
    this.sendHome(f);
    this.effects.burst(f.pos.clone().setY(1), 0xc79a64, 24, { speed: 5, up: 6, size: 0.25 });
    f.destroy();
    this.forts = this.forts.filter((x) => x !== f);
    this.select(null);
    this.audio.play('pop');
    this.ui.toast(`Pulled it down. +⭐${refund}`);
  }

  select(f) {
    this.selected = f;
    if (f) this.ui.showFort(f);
    else this.ui.hideFort();
  }

  focusOn(pos) {
    const d = new THREE.Vector3(pos.x - this.controls.target.x, 0, pos.z - this.controls.target.z);
    this.controls.target.add(d);
    this.camera.position.add(d);
  }

  // ---------- waves ----------
  // Best day is kept separately for each difficulty.
  loadBest() {
    try {
      const own = +localStorage.getItem(`theSack.bestDay.${this.diffKey}`) || 0;
      const legacy = this.diffKey === 'pro' ? +localStorage.getItem('theSack.bestDay') || 0 : 0;
      return Math.max(own, legacy);
    } catch {
      return 0;
    }
  }

  chooseDifficulty(key) {
    if (this.started) return;
    this.diffKey = DIFFICULTIES.some((d) => d.key === key) ? key : 'pro';
    this.diff = setDifficulty(this.diffKey);
    this.best = this.loadBest();
    try {
      localStorage.setItem('theSack.difficulty', this.diffKey);
    } catch {
      // No storage: the choice just won't be remembered.
    }
    this.ui.setWavePreview();
  }

  start() {
    if (this.started) return;
    this.started = true;
    const d = this.diff;
    this.points = Math.round(START.points * d.points);
    this.sackHp = this.maxSackHp = d.sack;
    this.ui.setWavePreview();
    this.audio.ensure();
    this.music.start();
    this.ui.hideTitle();
    this.ui.toast(this.touch ? 'Tap a fort card, then build it in the bush along the fire trail!' : 'Pick a fort (1–7) and build it in the bush along the fire trail!');
  }

  // ---------- the day loop ----------
  // Morning: build and plan. Day: school's out, golems come. Dusk: parents call
  // everyone in for dinner and surviving golems slink off. Night: fade to next morning.
  startWave() {
    if (!this.started || this.over || this.phase !== 'morning') return;
    this.wave++;
    this.phase = 'day';
    this.waveActive = true;
    this.waveDef = makeWave(this.wave);
    this.queue = [...this.waveDef.list];
    this.spawnTimer = 2;
    this.dayT = 0;
    const spawnTime = this.queue.reduce((a, it) => a + it.gap, 0);
    const avgSpeed = this.queue.reduce((a, it) => a + GOLEMS[it.type].speed, 0) / this.queue.length;
    this.dayLen = 2 + spawnTime + (this.path.length / avgSpeed) * 1.05 + 8;
    this.dayKills = 0;
    this.dayLeaks = 0;
    // From day 3 a parent sometimes calls a boy in for chores mid-afternoon.
    this.chores = [];
    const expected = troubleFor(this.wave).chores * this.mods.trouble;
    let n = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) this.chores.push(this.dayLen * (0.15 + Math.random() * 0.55));
    this.chores.sort((a, b) => a - b);
    // Kids who weren't allowed out till later this arvo.
    for (const b of this.boys) if (b.away === 'late') b.lateAt = this.dayLen * (0.12 + Math.random() * 0.3);
    this.audio.play('horn');
    const boss = this.waveDef.list.some((i) => GOLEMS[i.type].boss);
    this.ui.toast(boss ? `🌋 Day ${this.wave}: a MAGMA TITAN is coming!` : `🎒 Day ${this.wave}: school's out. Here they come!`, boss ? 'bad' : '');
    const idle = this.forts.filter((f) => !f.crew.length).length;
    if (idle) this.ui.toast(`⚠️ ${idle} fort${idle > 1 ? 's have' : ' has'} nobody manning ${idle > 1 ? 'them' : 'it'}!`, 'warn');
    this.ui.hideTrail();
    this.ui.setWavePreview();
  }

  spawnGolem(type, hpScale = this.waveDef.hpScale, rewardScale = this.waveDef.rewardScale, rift = 0, opts = {}) {
    const g = new Golem(this, type, hpScale, rewardScale, this.spurs[rift] || rift === 0 ? rift : 0, opts);
    this.golems.push(g);
    if (g.def.flying) this.audio.play('roar');
    // First sighting of a creature type today: somebody reacts.
    if (!opts.mini && !this.seenToday.has(type)) {
      this.seenToday.add(type);
      const first = this.wave === STAGES.find((st) => st.golem === type)?.day;
      const kind = g.def.boss ? 'boss' : type === 'lion' && first ? 'lion' : first ? 'newCreature' : null;
      const kid = kind && pick(this.boys.filter((b) => b.state === 'manning').concat([null]));
      if (kid) this.chatter.later(2.5, () => this.chatter.say(kid, kind, {}, { force: true }));
    }
    return g;
  }

  // Seconds until the slowest golem (on the trail or still to spawn) would reach the sack.
  timeLeftForGolems() {
    let need = 0;
    for (const g of this.golems) {
      if (g.alive && !g.retreating) need = Math.max(need, g.remaining / g.baseSpeed);
    }
    let t = Math.max(0, this.spawnTimer);
    for (const it of this.queue) {
      const r = it.rift || 0;
      const sp = this.spurs[r];
      const walk = sp ? sp.length + this.path.length - this.joinDists[r] : this.path.length;
      need = Math.max(need, t + walk / this.golemSpeed(it.type, it.elite));
      t += it.gap;
    }
    return need;
  }

  // Walking speed after weekly twists and tougher-variant rolls.
  golemSpeed(type, elite = []) {
    const m = this.mods.golemSpeed;
    let v = GOLEMS[type].speed * (m['*'] || 1) * (m[type] || 1);
    for (const e of elite || []) v *= ELITES[e].speed || 1;
    return v;
  }

  get dayCleared() {
    return this.phase === 'day' && !this.queue.length && this.golems.length === 0;
  }

  // 3:30pm (school's out) to 6:00pm (dinner).
  clockText() {
    const p = this.phase === 'day' ? Math.min(1, this.dayT / this.dayLen) : this.phase === 'morning' ? 0 : 1;
    const mins = 15 * 60 + 30 + Math.round(p * 150);
    const h = Math.floor(mins / 60) - 12;
    return `${h}:${String(mins % 60).padStart(2, '0')}pm`;
  }

  callChore() {
    const manned = this.boys.filter((b) => b.state === 'manning' && !b.onChore && !b.away);
    if (!manned.length) return;
    const b = pick(manned);
    const line = pick(CHORE_LINES).replace('{NAME}', b.name.toUpperCase());
    this.parents.push(new Parent(this, b.home, line, 5));
    b.callForChore(CHORE_TIME * this.mods.chore);
    this.chatter.later(0.8, () => this.chatter.say(b, 'called', {}, { force: true }));
    this.audio.play('yell');
    this.ui.toast(`📢 ${b.name}'s been called in for chores! His fort is empty for a bit.`, 'warn');
  }

  beginDusk() {
    this.phase = 'dusk';
    this.waveActive = false;
    this.duskT = 0;
    this.dinnerCalls = [];
    this.queue = [];
    const left = this.golems.filter((g) => g.alive).length;
    for (const g of this.golems) g.retreat();
    for (const p of this.parents) p.dispose();
    this.parents = [];
    // Sometimes a parent looks out first and sees what's really going on.
    const manned = this.boys.filter((b) => b.state === 'manning');
    if (manned.length && !this.skipping && (this.wave === 1 || Math.random() < 0.3)) this.startReveal(manned);
    else this.sendKidsHome();
    this.audio.play('bell');
    this.ui.toast(left && !this.revealing ? `🌅 The streetlights are on! ${left} golem${left > 1 ? 's' : ''} slink back into the bush…` : '🌅 The streetlights are on. Dinner time!');
    this.cancelBuild();
    this.select(null);
    this.ui.setWavePreview();
  }

  sendKidsHome() {
    const homes = new Map();
    for (const b of this.boys) {
      if (b.away) {
        b.away = null;
        b.state = 'asleep';
        continue;
      }
      b.goToBed();
      const k = `${b.home.x.toFixed(1)},${b.home.z.toFixed(1)}`;
      if (!homes.has(k)) homes.set(k, b);
    }
    this.dinnerCalls = [...homes.values()].map((b, i) => ({
      at: this.duskT + i * 0.45,
      b,
      line: pick(DINNER_LINES).replace('{NAME}', b.name.toUpperCase()),
    }));
    const walking = this.boys.filter((b) => b.state === 'walking');
    walking.sort(() => Math.random() - 0.5).slice(0, 2).forEach((b, i) => this.chatter.later(0.6 + i * 0.9, () => this.chatter.say(b, 'dinner', {}, { force: true })));
    // Through the windows, once they're inside.
    const kids = [...homes.values()].sort(() => Math.random() - 0.5).slice(0, 2);
    kids.forEach((b, i) => this.chatter.later(3 + i * 1.3, () => this.chatter.sayAt(b.home, b, pick(HOUSE_LINES))));
  }

  // "What Mum sees": for a moment it's just kids waving sticks at nothing.
  startReveal(manned) {
    this.revealing = true;
    this.revealT = 3.2;
    document.body.classList.add('reveal');
    for (const g of this.golems) g.root.visible = g.hpGroup.visible = false;
    for (const r of this.world.rifts) r.group.visible = false;
    for (const f of this.forts) {
      f.w.group.visible = false;
      if (f.beam) f.beam.visible = false;
    }
    for (const p of this.projectiles.list) p.mesh.visible = false;
    for (const b of manned) b.setStick(true);
    const kid = pick(manned);
    const [mumLine, kidLine] = pick(REVEAL_LINES);
    this.parents.push(new Parent(this, kid.home, mumLine, 3.2));
    this.audio.play('yell');
    this.chatter.later(1.1, () => this.chatter.say(kid, kidLine, {}, { force: true, life: 2.2 }));
    const other = manned.filter((b) => b !== kid);
    if (other.length) this.chatter.later(0.3, () => this.chatter.say(pick(other), pick(['Pew pew pew!', 'Take that, lava monster!', 'I\'ve got you now!', 'Shields up!', 'NOBODY gets past me!']), {}, { force: true, life: 2 }));
  }

  endReveal() {
    if (!this.revealing) return;
    this.revealing = false;
    document.body.classList.remove('reveal');
    for (const g of this.golems) g.root.visible = true;
    for (const r of this.world.rifts) r.group.visible = true;
    for (const f of this.forts) f.w.group.visible = true;
    for (const p of this.projectiles.list) p.mesh.visible = true;
    for (const b of this.boys) b.setStick(false);
  }

  // Little siblings go home for good at the end of the day.
  dropTagAlongs() {
    const temps = this.boys.filter((b) => b.temp);
    if (!temps.length) return;
    for (const b of temps) {
      if (b.fort) b.fort.crew = b.fort.crew.filter((x) => x !== b);
      b.detach();
      this.scene.remove(b.mesh);
    }
    this.boys = this.boys.filter((b) => !b.temp);
    this.ui.renderRoster();
  }

  resolveNight(i) {
    const ev = this.nightEvent;
    const o = ev && ev.options[i];
    if (!o) return;
    if (o.cost) {
      if (this.points < o.cost) return this.fail(`Need ⭐${o.cost}`);
      this.points -= o.cost;
    }
    o.apply();
    this.nightEvent = null;
    this.audio.play('click');
    this.ui.hideNightEvent();
  }

  endDay() {
    this.endReveal();
    this.dropTagAlongs();
    this.phase = 'night';
    this.nightT = 0;
    const bonus = 20 + this.wave * 4;
    this.points += bonus;
    this.audio.play('coin');
    this.ui.toast(`🍝 Day ${this.wave} done. ${this.dayKills} golems smashed. +⭐${bonus} pocket money`, 'good');
    this.saveBest();
    this.ui.night(true, this.wave + 1);
    this.nightEvent = rollNightEvent(this);
    if (this.nightEvent) this.ui.showNightEvent(this.nightEvent);
  }

  // The big button / Space: head out in the morning, or skip dinner time
  // (and the wait for it once the trail is clear) straight to the next morning.
  mainAction() {
    if (this.perkOffer) return this.ui.showPerks(this.perkOffer, weekOf(this.wave + 1));
    if (this.nightEvent) return this.ui.showNightEvent(this.nightEvent);
    if (this.phase === 'morning') this.startWave();
    else if (this.canSkip) this.skipToMorning();
  }

  get canSkip() {
    return this.phase === 'dusk' || this.phase === 'night' || this.dayCleared;
  }

  skipToMorning() {
    if (!this.started || this.over || !this.canSkip) return;
    this.skipping = true;
    if (this.phase === 'day') this.beginDusk();
    this.skipping = false;
    if (this.revealing) {
      this.endReveal();
      this.sendKidsHome();
    }
    for (const g of this.golems) g.dispose();
    this.golems = [];
    for (const p of this.projectiles.list) this.scene.remove(p.mesh);
    this.projectiles.list = [];
    this.dinnerCalls = [];
    if (this.phase === 'dusk') {
      this.endDay();
      if (this.over) return;
    }
    if (this.nightEvent) return;
    this.morning();
  }

  morning() {
    this.phase = 'morning';
    this.tod = 0;
    for (const p of this.parents) p.dispose();
    this.parents = [];
    const day = this.wave + 1;
    // Overnight, the dads patch up the sack a little.
    if (this.sackHp < this.maxSackHp && !this.diff.noRepair) {
      this.sackHp++;
      this.world.setDamage(1 - this.sackHp / this.maxSackHp);
      this.ui.toast('🔧 Dad patched the fence overnight. +1 sack health', 'good');
    }
    this.rollTrouble(day);
    // Yesterday's dinner-table decisions come due.
    this.dayMods = { dmg: 1, rate: 1 };
    this.banned = null;
    for (const b of this.boys) {
      b.tired = b.boredLock = b.annoyed = false;
      b.bored = 0;
    }
    const due = this.plans.filter((p) => p.day === day);
    this.plans = this.plans.filter((p) => p.day > day);
    for (const p of due) p.fn();
    if (this.banned) this.ui.toast(`🚫 Mum's confiscated every ${WEAPONS[this.banned].short} for today!`, 'warn');
    for (const b of this.boys) if (!b.away) b.wakeUp();
    const out = this.boys.filter((b) => !b.away);
    if (out.length > 1) this.chatter.later(1, () => this.chatter.say(pick(out), 'morning', {}, { force: true }));
    this.ui.night(false);
    this.ui.toast(`☀️ Day ${day} of the holidays${day % 7 === 1 ? ` · Week ${weekOf(day)}` : ''}. Build, then head out when you're ready.`);
    this.openStages(day);
    this.ui.setWavePreview();
    if (day > 1 && day % 7 === 1) this.offerPerks();
  }

  // ---------- weekly picks ----------
  offerPerks() {
    const cards = drawPerks(this.perks);
    if (!cards.length) return;
    this.perkOffer = cards;
    this.ui.showPerks(cards, weekOf(this.wave + 1));
  }

  takePerk(key) {
    const p = this.perkOffer && this.perkOffer.find((c) => c.key === key);
    if (!p) return;
    this.perkOffer = null;
    this.perks.push(p.key);
    p.apply(this.mods, this);
    this.audio.play('upgrade');
    this.ui.hidePerks();
    this.ui.toast(`${p.icon} ${p.name}: ${p.text}`, 'good');
    this.ui.renderPerks();
    this.ui.setWavePreview();
    if (this.selected) this.ui.renderPanel();
  }

  // Anything new starting today: new golems, new rifts.
  openStages(day) {
    for (const st of STAGES) {
      if (st.day !== day || day === 1) continue;
      if (st.rift) this.openRift(st.rift);
      this.ui.toast(`${st.rift ? '🌀' : '📣'} ${st.text}`, 'bad');
    }
  }

  openRift(i) {
    if (this.spurs[i]) return;
    const sp = spurPath(RIFTS[i]);
    this.spurs[i] = sp;
    this.world.rifts[i].activate();
    this.world.addSpur(sp);
    this.updateJoins();
    for (const f of [...this.forts]) {
      if (sp.distanceTo(f.pos.x, f.pos.z) < 3.2) this.packUp(f, 'the new rift trail');
    }
    for (let k = 0; k < 20; k++) this.effects.burst(sp.pointAt(Math.random() * sp.length).setY(0.3), 0x9b5cff, 2, { speed: 2, up: 4, size: 0.25 });
    const p = this.world.rifts[i].pos;
    this.focusOn({ x: p.x * 0.6, z: p.z * 0.6 });
    this.audio.play('hurt');
  }

  updateJoins() {
    RIFTS.forEach((r, i) => {
      const sp = this.spurs[i];
      if (!sp) return;
      const end = sp.curve.getPointAt(1);
      this.joinDists[i] = this.path.nearestDist(end.x, end.z);
    });
  }

  // Parents decide who's grounded or kept in late today. Never more than a third of the crew.
  rollTrouble(day) {
    const t = { ...troubleFor(day) };
    t.grounded *= this.mods.trouble;
    t.late *= this.mods.trouble;
    const maxOut = Math.floor(this.boys.length / 3);
    let out = 0;
    for (const b of [...this.boys].sort(() => Math.random() - 0.5)) {
      b.away = null;
      if (out >= maxOut) continue;
      const r = Math.random() / (b.trait.trouble ?? 1);
      if (r < t.grounded) {
        b.stayHome('grounded');
        this.ui.toast(`😠 ${pick(GROUNDED_LINES).replace('{NAME}', b.name)} No fort today.`, 'warn');
        out++;
      } else if (r < t.grounded + t.late) {
        b.stayHome('late');
        this.ui.toast(`⏰ ${pick(LATE_LINES).replace('{NAME}', b.name)} He'll be out later this arvo.`, 'warn');
        out++;
      }
    }
  }

  packUp(f, why) {
    this.points += f.spent;
    this.sendHome(f);
    if (this.selected === f) this.select(null);
    f.destroy();
    this.forts = this.forts.filter((x) => x !== f);
    this.ui.toast(`📦 The ${f.weapon.name} was in the way of ${why}, so the boys packed it up. +⭐${f.spent}`, 'warn');
  }

  saveBest() {
    if (this.wave <= this.best) return;
    this.best = this.wave;
    try {
      localStorage.setItem(`theSack.bestDay.${this.diffKey}`, String(this.best));
    } catch {
      // Private browsing: no high score, no problem.
    }
  }

  setTimeOfDay(k) {
    const i = Math.min(1, Math.floor(k));
    const t = Math.min(1, k - i);
    const a = TOD[i];
    const b = TOD[i + 1];
    const w = this.world.sky;
    lerpHex(a.top, b.top, t, w.top.value);
    lerpHex(a.mid, b.mid, t, w.mid.value);
    lerpHex(a.bottom, b.bottom, t, w.bottom.value);
    this.scene.fog.color.copy(w.bottom.value);
    lerpHex(a.sun, b.sun, t, this.sun.color);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * t;
    lerpHex(a.glass, b.glass, t, this.world.glass.emissive);
  }

  // ---------- trail works ----------
  detourCost() {
    return DETOUR_COSTS[Math.min(this.detours.size, DETOUR_COSTS.length - 1)];
  }

  previewDetour(key) {
    if (!key || this.detours.has(key)) return this.world.previewTrail(null);
    this.world.previewTrail(new TrailPath(new Set([...this.detours, key])));
  }

  detourGain(key) {
    return Math.round(new TrailPath(new Set([...this.detours, key])).length - this.path.length);
  }

  buyDetour(key) {
    const d = DETOURS.find((x) => x.key === key);
    if (!d || this.detours.has(key)) return;
    if (this.phase !== 'morning') return this.fail('The boys can only dig the trail in the morning.');
    const cost = this.detourCost();
    if (this.points < cost) return this.fail(`Need ⭐${cost} for Trail Works`);
    this.points -= cost;
    const before = this.path.length;
    this.detours.add(key);
    this.path = new TrailPath(this.detours);
    this.world.previewTrail(null);
    this.world.setTrail(this.path);
    // Any fort sitting on the new trail gets packed up, full refund.
    this.updateJoins();
    for (const f of [...this.forts]) {
      if (this.path.distanceTo(f.pos.x, f.pos.z) < 3.2) this.packUp(f, 'the new trail');
    }
    for (let i = 0; i < 30; i++) {
      const p = this.path.pointAt(Math.random() * this.path.length);
      this.effects.burst(p.setY(0.3), 0xb08a5a, 2, { speed: 2, up: 4, size: 0.25 });
    }
    this.focusOn({ x: d.focus[0], z: d.focus[1] });
    this.audio.play('build');
    this.ui.toast(`🚧 ${d.name} dug! The trail is ${Math.round(this.path.length - before)}m longer.`, 'good');
    this.ui.renderTrail();
  }

  golemKilled(g, fort) {
    this.points += g.reward;
    this.stats.kills++;
    this.dayKills++;
    if (fort) fort.kills++;
    this.effects.float(`+${g.reward}`, g.headPos(), g.def.boss ? 'big' : '');
    this.audio.play('pop');
    if (g.def.boss) {
      this.ui.toast(`🏆 The ${g.def.name} is down! +⭐${g.reward}`, 'good');
      const manned = this.boys.filter((b) => b.state === 'manning');
      for (const b of manned) b.cheer();
      manned.sort(() => Math.random() - 0.5).slice(0, 3).forEach((b, i) => this.chatter.later(i * 0.6, () => this.chatter.say(b, 'bossKill', {}, { force: true })));
    } else if (fort && !g.mini) {
      if (Math.random() < 0.25) for (const b of fort.mannedCrew) b.cheer();
      if (Math.random() < 0.12) this.crewSays(fort, 'kill', { gap: 10 });
    }
  }

  golemReachedSack(g) {
    this.sackHp = Math.max(0, this.sackHp - g.def.damage);
    this.world.setDamage(1 - this.sackHp / this.maxSackHp);
    this.stats.leaked++;
    this.dayLeaks++;
    this.audio.play('hurt');
    this.ui.damageFlash();
    this.ui.toast(`💥 A ${g.def.name} stomped into the sack! (−${g.def.damage})`, 'bad');
    const kid = this.kidNear(g.pos, 60);
    if (kid) this.chatter.say(kid, 'leak', {}, { kindGap: 4, gap: 3 });
    this.effects.burst(g.pos.clone().setY(1), g.def.glow, 20, { speed: 6, up: 7, size: 0.25 });
    if (this.sackHp <= 0) this.finish(false);
  }

  finish(win) {
    if (this.over) return;
    this.over = true;
    this.saveBest();
    this.cancelBuild();
    this.audio.play(win ? 'win' : 'lose');
    this.ui.showEnd(win);
  }

  continueEndless() {
    this.endless = true;
    this.over = false;
    this.ui.hideEnd();
    this.ui.toast('Endless mode — how long can the sack hold?');
  }

  toggleSpeed() {
    const SPEEDS = [1, 2, 3, 5];
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.music.applyLevel();
  }

  togglePause() {
    if (this.started && !this.over) this.paused = !this.paused;
  }

  fail(msg) {
    this.ui.toast(msg, 'warn');
    this.audio.play('err');
  }

  // ---------- input ----------
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    });
    c.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, b: e.button };
      this.audio.ensure();
    });
    c.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.updatePointer();
      if (d.b === 0) this.handleClick(e.shiftKey, e.pointerType);
      else if (d.b === 2) {
        if (this.buildKey) this.cancelBuild();
        else this.select(null);
      }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => this.audio.ensure());

    window.addEventListener('keydown', (e) => {
      // Typing a name on the leaderboard shouldn't recruit kids or mute the game.
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (!this.started) {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          this.start();
        }
        return;
      }
      if (PAN_KEYS.includes(k)) {
        this.keys.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
        return;
      }
      if (this.nightEvent && k >= '1' && k <= String(this.nightEvent.options.length)) {
        this.resolveNight(+k - 1);
        return;
      }
      if (this.perkOffer && k >= '1' && k <= String(this.perkOffer.length)) {
        this.takePerk(this.perkOffer[+k - 1].key);
        return;
      }
      if (k >= '1' && k <= String(WEAPON_KEYS.length)) this.setBuild(WEAPON_KEYS[+k - 1]);
      else if (k === ' ') {
        e.preventDefault();
        this.mainAction();
      } else if (k === 'r') this.recruit();
      else if (k === 't') this.ui.toggleTrail();
      else if (k === 'escape') {
        if (this.buildKey) this.cancelBuild();
        else this.select(null);
      } else if (k === 'u' && this.selected) this.upgradeFort(this.selected);
      else if (k === 'g' && this.selected) this.upgradeWeapon(this.selected);
      else if ((k === 'delete' || k === 'backspace') && this.selected) this.sellFort(this.selected);
      else if (k === 'f') this.toggleSpeed();
      else if (k === 'm') this.toggleMute();
      else if (k === 'n') this.music.toggle();
      else if (k === 'p') this.togglePause();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  handleClick(shift, pointerType = 'mouse') {
    if (this.over) return;
    if (this.buildKey) {
      if (!this.groundOk) return;
      const w = WEAPONS[this.buildKey];
      const reason = this.placeReason(this.ground.x, this.ground.z);
      // On touch there's no hover preview, so the first tap shows the fort
      // and a second tap on the same spot builds it.
      if (pointerType === 'touch') {
        const p = this.pendingSpot;
        if (!p || Math.hypot(p.x - this.ground.x, p.z - this.ground.z) > 2.5) {
          this.pendingSpot = this.ground.clone();
          if (reason) return this.fail(reason);
          this.audio.play('click');
          return this.ui.toast('Tap again to build here');
        }
        this.pendingSpot = null;
      }
      if (reason) return this.fail(reason);
      if (this.points < this.fortCost(this.buildKey)) return this.fail(`Need ⭐${this.fortCost(this.buildKey)}`);
      this.placeFort(this.ground.x, this.ground.z, this.buildKey, shift);
      return;
    }
    if (this.hovered) this.audio.play('click');
    this.select(this.hovered);
  }

  fortFromObject(o) {
    while (o) {
      if (o.userData && o.userData.fort) return o.userData.fort;
      o = o.parent;
    }
    return null;
  }

  updatePointer() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.groundOk = !!this.raycaster.ray.intersectPlane(this.groundPlane, this.ground);

    if (this.buildKey && this.groundOk) {
      const w = WEAPONS[this.buildKey];
      const ok = !this.placeReason(this.ground.x, this.ground.z) && this.points >= this.fortCost(this.buildKey);
      const col = ok ? 0x66ff88 : 0xff5a4a;
      this.ghost.visible = true;
      this.ghost.position.set(this.ground.x, 0, this.ground.z);
      this.ghost.userData.mat.color.setHex(col);
      this.ghost.userData.ring.userData.setColor(col);
      this.ghost.userData.ring.scale.setScalar(w.range);
    } else {
      this.ghost.visible = false;
    }

    let hov = null;
    if (!this.buildKey && this.forts.length) {
      const hits = this.raycaster.intersectObjects(this.forts.map((f) => f.group), true);
      if (hits.length) hov = this.fortFromObject(hits[0].object);
    }
    this.hovered = hov;
    this.canvas.style.cursor = this.buildKey ? 'crosshair' : hov ? 'pointer' : 'default';

    const rf = this.selected || hov;
    this.selRing.visible = !!rf;
    if (rf) {
      this.selRing.position.set(rf.pos.x, 0, rf.pos.z);
      this.selRing.scale.setScalar(rf.stats().range);
      this.selRing.userData.setColor(rf.manned ? 0xffffff : 0xff8a6a);
    }
  }

  updateCamera(raw) {
    const c = this.controls;
    const cam = this.camera;
    const fwd = new THREE.Vector3().subVectors(c.target, cam.position).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const k = this.keys;
    const mv = new THREE.Vector3();
    if (k.has('w') || k.has('arrowup')) mv.add(fwd);
    if (k.has('s') || k.has('arrowdown')) mv.sub(fwd);
    if (k.has('d') || k.has('arrowright')) mv.add(right);
    if (k.has('a') || k.has('arrowleft')) mv.sub(right);
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar(cam.position.distanceTo(c.target) * 0.9 * raw);
      c.target.add(mv);
      cam.position.add(mv);
    }
    const rot = (k.has('q') ? 1 : 0) - (k.has('e') ? 1 : 0);
    if (rot) {
      const off = cam.position.clone().sub(c.target).applyAxisAngle(UP, rot * 1.6 * raw);
      cam.position.copy(c.target).add(off);
    }
    const tl = Math.hypot(c.target.x, c.target.z);
    if (tl > 95) {
      const s = 95 / tl;
      const dx = c.target.x * s - c.target.x;
      const dz = c.target.z * s - c.target.z;
      c.target.x += dx;
      c.target.z += dz;
      cam.position.x += dx;
      cam.position.z += dz;
    }
    c.update();
  }

  // ---------- main loop ----------
  frame() {
    const now = performance.now();
    const raw = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.realTime += raw;
    this.updateCamera(raw);
    const running = this.started && !this.paused && !this.over;
    const dt = running ? raw * this.speed : 0;
    // Fast-forward in small steps so shots and creatures never skip past each other.
    if (running) {
      const steps = Math.ceil(dt / (1 / 30));
      for (let i = 0; i < steps; i++) this.updateGame(dt / steps);
    }
    for (const fn of this.world.animated) fn(this.realTime, raw);
    this.setTimeOfDay(this.tod);
    for (const p of this.parents) p.place();
    this.chatter.update(dt, raw);
    this.chatter.place();
    this.updatePointer();
    this.effects.update(dt, raw);
    const mood = this.over || this.phase === 'morning' ? 'calm' : this.phase === 'day' && (this.golems.length || this.queue.length) ? 'action' : this.phase === 'day' ? 'calm' : 'night';
    this.music.update(mood, this.paused);
    this.ui.update(raw);
    this.renderer.render(this.scene, this.camera);
  }

  updateGame(dt) {
    this.time += dt;
    if (this.phase === 'day') {
      this.spawnTimer -= dt;
      while (this.queue.length && this.spawnTimer <= 0) {
        const it = this.queue.shift();
        this.spawnGolem(it.type, undefined, undefined, it.rift || 0, { elite: it.elite });
        this.spawnTimer += it.gap;
      }
      // Once every golem is dealt with, the afternoon flies by until dinner.
      const cleared = this.dayCleared;
      // Dinner waits for the last golem: keep pushing 6pm back until every
      // golem out there (or still to come) could have reached the sack.
      if (!cleared) this.dayLen = Math.max(this.dayLen, this.dayT + this.timeLeftForGolems() + 3);
      this.dayT += dt * (cleared ? 10 : 1);
      for (const b of this.boys) {
        if (b.away === 'late' && this.dayT >= b.lateAt) {
          b.comeOut();
          this.ui.toast(`🏃 ${b.name} is finally allowed out!`, 'good');
        }
      }
      if (this.chores.length && this.dayT >= this.chores[0]) {
        this.chores.shift();
        if (!cleared) this.callChore();
      }
      this.tod = THREE.MathUtils.smoothstep(this.dayT / this.dayLen, 0.55, 1);
      if (cleared && this.dayT >= this.dayLen) this.beginDusk();
    } else if (this.phase === 'dusk') {
      this.duskT += dt;
      if (this.revealing) {
        this.revealT -= dt;
        if (this.revealT <= 0) {
          this.endReveal();
          this.sendKidsHome();
        }
      }
      this.tod = 1 + Math.min(1, this.duskT / 5);
      while (this.dinnerCalls.length && this.duskT >= this.dinnerCalls[0].at) {
        const c = this.dinnerCalls.shift();
        this.parents.push(new Parent(this, c.b.home, c.line));
        this.audio.play('yell');
      }
      const home = !this.revealing && this.boys.every((b) => b.asleep) && this.golems.length === 0;
      if ((home && this.duskT > 5.5) || this.duskT > 15) this.endDay();
    } else if (this.phase === 'night') {
      this.nightT += dt / this.speed;
      if (this.nightT > 1.6 && !this.nightEvent) this.morning();
    }
    for (const g of this.golems) g.update(dt);
    for (const f of this.forts) f.update(dt);
    for (const b of this.boys) b.update(dt);
    for (const p of this.parents) p.update(dt);
    this.parents = this.parents.filter((p) => !p.done);
    this.projectiles.update(dt);
    if (this.golems.some((g) => g.done)) {
      this.golems = this.golems.filter((g) => {
        if (g.done) g.dispose();
        return !g.done;
      });
    }
  }
}
