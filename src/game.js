import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import {
  WEAPONS, FORT_LEVELS, WEAPON_LEVELS, GOLEMS, weaponUpgradeCost, START, RECRUIT_COSTS, MAX_BOYS,
  BOY_NAMES, MAIN_BOYS, TRAITS, makeWave, DINNER_LINES, CHORE_LINES, CHORE_TIME,
  STAGES, weekOf, troubleFor, GROUNDED_LINES, LATE_LINES, setDifficulty, DIFFICULTIES,
} from './config.js';
import { TrailPath, DETOURS, DETOUR_COSTS, RIFTS, spurPath } from './path.js';
import { Parent } from './parents.js';
import { buildWorld } from './world.js';
import { Golem } from './golems.js';
import { Fort } from './forts.js';
import { Boy } from './boys.js';
import { Projectiles } from './projectiles.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { makeRangeRing } from './util.js';

const WEAPON_KEYS = Object.keys(WEAPONS);
const PAN_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'];
const UP = new THREE.Vector3(0, 1, 0);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

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

    this.golems = [];
    this.forts = [];
    this.boys = [];
    this.points = START.points;
    this.sackHp = START.sackHp;
    this.maxSackHp = START.sackHp;
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
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    sun.shadow.mapSize.set(4096, 4096);
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
  addBoy(atHangout) {
    const used = new Set(this.boys.map((b) => b.name));
    const names = BOY_NAMES.filter((n) => !used.has(n));
    const name = MAIN_BOYS.find((n) => !used.has(n)) || names[Math.floor(Math.random() * names.length)] || `Kid ${this.nextBoyId}`;
    const total = TRAITS.reduce((a, t) => a + t.weight, 0);
    let r = Math.random() * total;
    const trait = TRAITS.find((t) => (r -= t.weight) < 0) || TRAITS[0];
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

  recruitCost() {
    return RECRUIT_COSTS[Math.min(this.recruits, RECRUIT_COSTS.length - 1)];
  }

  recruit() {
    if (!this.started || this.over) return;
    if (this.phase === 'dusk' || this.phase === 'night') return this.fail('Everyone\'s inside for dinner. Try in the morning.');
    if (this.boys.length >= MAX_BOYS) return this.fail('Every kid on the street is already in the crew!');
    const cost = this.recruitCost();
    if (this.points < cost) return this.fail(`Need ⭐${cost} to recruit another boy`);
    this.points -= cost;
    this.recruits++;
    const b = this.addBoy(false);
    this.audio.play('recruit');
    this.ui.toast(`👦 ${b.name} from No. ${b.houseNo} joined the crew! (${b.trait.name}: ${b.trait.desc})`, 'good');
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
    if (this.points < w.cost) return this.fail(`Need ⭐${w.cost} for a ${w.name}`);
    this.buildKey = key;
    this.select(null);
    this.audio.play('click');
    this.ui.updateBuildActive();
  }

  cancelBuild() {
    this.buildKey = null;
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
    const w = WEAPONS[key];
    this.points -= w.cost;
    const f = new Fort(this, x, z, key);
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
    if (!keepBuilding || this.points < w.cost) {
      this.cancelBuild();
      this.select(f);
    }
  }

  upgradeFort(f) {
    const next = FORT_LEVELS[f.level + 1];
    if (!next) return;
    if (this.points < next.cost) return this.fail(`Need ⭐${next.cost} to build it up`);
    this.points -= next.cost;
    f.spent += next.cost;
    f.upgradeStructure();
    this.effects.burst(f.pos.clone().setY(1.5), 0xcaa46d, 22, { speed: 4, up: 6, size: 0.22 });
    this.audio.play('build');
    this.ui.toast(`🔨 Built it up into a ${next.name}!`, 'good');
    this.ui.renderPanel();
  }

  upgradeWeapon(f) {
    if (f.wlevel >= WEAPON_LEVELS.length - 1) return;
    const cost = weaponUpgradeCost(f.weapon, f.wlevel);
    if (this.points < cost) return this.fail(`Need ⭐${cost} to upgrade the ${f.weapon.short}`);
    this.points -= cost;
    f.spent += cost;
    f.upgradeWeapon();
    this.effects.burst(f.pos.clone().setY(f.height + 1), 0xffd02e, 16, { speed: 3, up: 5, size: 0.14 });
    this.audio.play('upgrade');
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
    this.ui.hideTitle();
    this.ui.toast('Pick a fort (1–7) and build it in the bush along the fire trail!');
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
    const expected = troubleFor(this.wave).chores;
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

  spawnGolem(type, hpScale = this.waveDef.hpScale, rewardScale = this.waveDef.rewardScale, rift = 0) {
    const g = new Golem(this, type, hpScale, rewardScale, this.spurs[rift] || rift === 0 ? rift : 0);
    this.golems.push(g);
    if (g.def.flying) this.audio.play('roar');
    return g;
  }

  // Sky lions ignore the trail and fly from their rift straight over the houses.
  flightPath(rift) {
    this.flights = this.flights || [];
    if (!this.flights[rift]) {
      // Straight over the bush to the gap where the trail enters the sack, then in.
      const p = this.world.rifts[rift].pos;
      const gate = this.path.pointAt(this.path.length - 26);
      const mid = [(p.x + gate.x) / 2, (p.z + gate.z) / 2 - 6];
      this.flights[rift] = new TrailPath(new Set(), [[p.x, p.z], mid, [gate.x, gate.z], [1, 0]]);
    }
    return this.flights[rift];
  }

  // Seconds until the slowest golem (on the trail or still to spawn) would reach the sack.
  timeLeftForGolems() {
    let need = 0;
    for (const g of this.golems) {
      if (g.alive && !g.retreating) need = Math.max(need, g.remaining / g.def.speed);
    }
    let t = Math.max(0, this.spawnTimer);
    for (const it of this.queue) {
      const r = it.rift || 0;
      const sp = this.spurs[r];
      const walk = GOLEMS[it.type].flying ? this.flightPath(r).length : sp ? sp.length + this.path.length - this.joinDists[r] : this.path.length;
      need = Math.max(need, t + walk / GOLEMS[it.type].speed);
      t += it.gap;
    }
    return need;
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
    b.callForChore(CHORE_TIME);
    this.audio.play('yell');
    this.ui.toast(`📢 ${b.name}'s been called in for chores! His fort is empty for a bit.`, 'warn');
  }

  beginDusk() {
    this.phase = 'dusk';
    this.waveActive = false;
    this.duskT = 0;
    this.queue = [];
    const left = this.golems.filter((g) => g.alive).length;
    for (const g of this.golems) g.retreat();
    for (const p of this.parents) p.dispose();
    this.parents = [];
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
      at: i * 0.45,
      b,
      line: pick(DINNER_LINES).replace('{NAME}', b.name.toUpperCase()),
    }));
    this.audio.play('bell');
    this.ui.toast(left ? `🌅 The streetlights are on! ${left} golem${left > 1 ? 's' : ''} slink back into the bush…` : '🌅 The streetlights are on. Dinner time!');
    this.cancelBuild();
    this.select(null);
    this.ui.setWavePreview();
  }

  endDay() {
    this.phase = 'night';
    this.nightT = 0;
    const bonus = 20 + this.wave * 4;
    this.points += bonus;
    this.audio.play('coin');
    this.ui.toast(`🍝 Day ${this.wave} done. ${this.dayKills} golems smashed. +⭐${bonus} pocket money`, 'good');
    this.saveBest();
    this.ui.night(true, this.wave + 1);
  }

  // The big button / Space: head out in the morning, or skip dinner time
  // (and the wait for it once the trail is clear) straight to the next morning.
  mainAction() {
    if (this.phase === 'morning') this.startWave();
    else if (this.canSkip) this.skipToMorning();
  }

  get canSkip() {
    return this.phase === 'dusk' || this.phase === 'night' || this.dayCleared;
  }

  skipToMorning() {
    if (!this.started || this.over || !this.canSkip) return;
    if (this.phase === 'day') this.beginDusk();
    for (const g of this.golems) g.dispose();
    this.golems = [];
    for (const p of this.projectiles.list) this.scene.remove(p.mesh);
    this.projectiles.list = [];
    this.dinnerCalls = [];
    if (this.phase === 'dusk') {
      this.endDay();
      if (this.over) return;
    }
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
    for (const b of this.boys) if (!b.away) b.wakeUp();
    this.ui.night(false);
    this.ui.toast(`☀️ Day ${day} of the holidays${day % 7 === 1 ? ` · Week ${weekOf(day)}` : ''}. Build, then head out when you're ready.`);
    this.openStages(day);
    this.ui.setWavePreview();
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
    const t = troubleFor(day);
    const maxOut = Math.floor(this.boys.length / 3);
    let out = 0;
    for (const b of [...this.boys].sort(() => Math.random() - 0.5)) {
      b.away = null;
      if (out >= maxOut) continue;
      const r = Math.random();
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
    this.flights = [];
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
    if (g.def.boss) this.ui.toast(`🏆 The ${g.def.name} is down! +⭐${g.reward}`, 'good');
  }

  golemReachedSack(g) {
    this.sackHp = Math.max(0, this.sackHp - g.def.damage);
    this.world.setDamage(1 - this.sackHp / this.maxSackHp);
    this.stats.leaked++;
    this.dayLeaks++;
    this.audio.play('hurt');
    this.ui.damageFlash();
    this.ui.toast(`💥 A ${g.def.name} stomped into the sack! (−${g.def.damage})`, 'bad');
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
    const SPEEDS = [1, 2, 3, 5, 10];
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
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
      if (d.b === 0) this.handleClick(e.shiftKey);
      else if (d.b === 2) {
        if (this.buildKey) this.cancelBuild();
        else this.select(null);
      }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => this.audio.ensure());

    window.addEventListener('keydown', (e) => {
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

  handleClick(shift) {
    if (this.over) return;
    if (this.buildKey) {
      if (!this.groundOk) return;
      const w = WEAPONS[this.buildKey];
      const reason = this.placeReason(this.ground.x, this.ground.z);
      if (reason) return this.fail(reason);
      if (this.points < w.cost) return this.fail(`Need ⭐${w.cost}`);
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
      const ok = !this.placeReason(this.ground.x, this.ground.z) && this.points >= w.cost;
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
    this.updatePointer();
    this.effects.update(dt, raw);
    this.ui.update(raw);
    this.renderer.render(this.scene, this.camera);
  }

  updateGame(dt) {
    this.time += dt;
    if (this.phase === 'day') {
      this.spawnTimer -= dt;
      while (this.queue.length && this.spawnTimer <= 0) {
        const it = this.queue.shift();
        this.spawnGolem(it.type, undefined, undefined, it.rift || 0);
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
      this.tod = 1 + Math.min(1, this.duskT / 5);
      while (this.dinnerCalls.length && this.duskT >= this.dinnerCalls[0].at) {
        const c = this.dinnerCalls.shift();
        this.parents.push(new Parent(this, c.b.home, c.line));
        this.audio.play('yell');
      }
      const home = this.boys.every((b) => b.asleep) && this.golems.length === 0;
      if ((home && this.duskT > 4) || this.duskT > 12) this.endDay();
    } else if (this.phase === 'night') {
      this.nightT += dt / this.speed;
      if (this.nightT > 1.6) this.morning();
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
