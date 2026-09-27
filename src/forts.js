import * as THREE from 'three';
import { WEAPONS, FORT_LEVELS, WEAPON_LEVELS, TEAM_LEVEL, TEAM_BONUS } from './config.js';
import { std, mesh, boxGeo, cylGeo, canvasTexture, angleLerp, angleDiff } from './util.js';

const FM = {
  card: std(0xc79a64),
  card2: std(0xb5854f),
  tape: std(0xe8d9a8),
  hole: std(0x3a2a1a),
  wood: std(0xa0703f),
  woodDark: std(0x6b4526),
  pallet: std(0xcaa46d),
  post: std(0x7b5230),
  trunk: std(0xd6ccb8),
  leaf: std(0x6f8c4c),
  tarp: std(0x2f6fb5),
  rope: std(0xd9c79c),
  pole: std(0x8b6b4a),
  metal: std(0x8f969e, { metalness: 0.5, roughness: 0.4 }),
  rubber: std(0x2b2b2b),
  orange: std(0xff8c1a),
  blue: std(0x2a7fd4),
  yellow: std(0xffd02e),
  red: std(0xd8342c),
  band: std(0xb03a2e),
  bottle: std(0x2f7a3a, { roughness: 0.2 }),
  balloon: std(0x3fa9ff, { roughness: 0.25, flatShading: false }),
  grey: std(0x9a9a92),
  greyDark: std(0x74746c),
  slide: std(0xffc21a, { roughness: 0.4 }),
  zapGlow: new THREE.MeshBasicMaterial({ color: 0x4fb8ff }),
  zapHot: new THREE.MeshBasicMaterial({ color: 0xd8f6ff }),
  lens: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide }),
  saltBin: std(0x3b6fb5),
  white: std(0xf4f1ea),
};
const FLAG_COLORS = [0xd8342c, 0x2a7fd4, 0xffd02e, 0x2ecc71, 0x9b59b6, 0xff8c1a, 0x111111];

const flagShape = new THREE.Shape();
flagShape.moveTo(0, 0);
flagShape.lineTo(0.95, -0.28);
flagShape.lineTo(0, -0.56);
const flagGeo = new THREE.ShapeGeometry(flagShape);

function addFlag(parent, x, y, z, color, h) {
  mesh(cylGeo(0.04, 0.04, h, 5), FM.pole, x, y + h / 2, z, parent);
  const f = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
  f.position.set(x, y + h, z);
  f.castShadow = true;
  parent.add(f);
  return f;
}

// ---------- fort structures ----------
function cardboardFort(color) {
  const g = new THREE.Group();
  mesh(boxGeo(2.3, 1.3, 2.3), FM.card, 0, 0.65, 0, g);
  mesh(boxGeo(2.32, 0.02, 0.3), FM.tape, 0, 1.31, 0, g);
  mesh(boxGeo(0.8, 0.45, 0.02), FM.hole, 0.2, 0.8, 1.16, g);
  const f1 = mesh(boxGeo(2.3, 0.04, 0.8), FM.card2, 0, 1.15, 1.45, g);
  f1.rotation.x = 0.55;
  const f2 = mesh(boxGeo(0.8, 0.04, 2.3), FM.card2, -1.45, 1.15, 0, g);
  f2.rotation.z = -0.55;
  mesh(boxGeo(1.1, 0.9, 1.1), FM.card2, 1.6, 0.45, 0.9, g).rotation.y = 0.3;
  mesh(boxGeo(0.7, 0.6, 0.7), FM.card, 1.55, 1.2, 0.95, g).rotation.y = 0.7;
  mesh(boxGeo(0.9, 0.7, 0.9), FM.card, -1.3, 0.35, -1.3, g).rotation.y = -0.2;
  const flag = addFlag(g, -0.95, 1.3, -0.95, color, 1.6);
  return { group: g, height: 1.3, flag };
}

function palletFort(color) {
  const g = new THREE.Group();
  const H = 2.4;
  for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) mesh(boxGeo(0.2, H, 0.2), FM.post, x, H / 2, z, g);
  mesh(boxGeo(2.8, 0.2, 2.8), FM.pallet, 0, H - 0.1, 0, g);
  for (const [x, z, alongX] of [[0, 1.37, true], [0, -1.37, true], [1.37, 0, false], [-1.37, 0, false]]) {
    for (let k = 0; k < 3; k++) {
      const s = alongX ? boxGeo(2.8, 0.14, 0.07) : boxGeo(0.07, 0.14, 2.8);
      mesh(s, FM.pallet, x, H + 0.18 + k * 0.24, z, g);
    }
  }
  for (const [x, z] of [[-1.37, -1.37], [1.37, -1.37], [-1.37, 1.37], [1.37, 1.37]]) mesh(boxGeo(0.14, 0.8, 0.14), FM.woodDark, x, H + 0.4, z, g);
  // Diagonal braces
  const b1 = mesh(boxGeo(0.08, 2.9, 0.08), FM.woodDark, 0, H / 2, -1.2, g);
  b1.rotation.z = 0.72;
  const b2 = mesh(boxGeo(0.08, 2.9, 0.08), FM.woodDark, -1.2, H / 2, 0, g);
  b2.rotation.x = 0.72;
  // Ladder
  for (const x of [-0.35, 0.35]) mesh(boxGeo(0.08, H, 0.08), FM.woodDark, x, H / 2, 1.55, g);
  for (let i = 0; i < 5; i++) mesh(boxGeo(0.7, 0.06, 0.06), FM.woodDark, 0, 0.35 + i * 0.45, 1.55, g);
  // Tarp roof over the back
  for (const x of [-1.3, 1.3]) mesh(boxGeo(0.1, 1.6, 0.1), FM.post, x, H + 0.8, -1.3, g);
  const tarp = mesh(boxGeo(2.9, 0.04, 1.5), FM.tarp, 0, H + 1.4, -0.75, g);
  tarp.rotation.x = -0.28;
  mesh(boxGeo(1, 0.8, 1), FM.card, 0.3, 0.4, 0.2, g).rotation.y = 0.4;
  const flag = addFlag(g, 1.3, H + 0.3, 1.3, color, 1.8);
  return { group: g, height: H, flag };
}

function treehouse(color, H = 3.8) {
  const g = new THREE.Group();
  mesh(cylGeo(0.45, 0.7, H + 3.2, 8), FM.trunk, 0, (H + 3.2) / 2, -1.6, g);
  const br1 = mesh(cylGeo(0.12, 0.2, 2.4, 6), FM.trunk, 0.9, H + 2.3, -1.6, g);
  br1.rotation.z = -0.8;
  const br2 = mesh(cylGeo(0.12, 0.2, 2.2, 6), FM.trunk, -0.9, H + 1.8, -1.7, g);
  br2.rotation.z = 0.9;
  for (const [x, z] of [[-1.45, 1.45], [1.45, 1.45], [1.45, -1.2], [-1.45, -1.2]]) mesh(boxGeo(0.24, H, 0.24), FM.post, x, H / 2, z, g);
  mesh(boxGeo(3.4, 0.25, 3.4), FM.wood, 0, H - 0.125, 0, g);
  for (const [x, z, alongX] of [[0, 1.66, true], [0, -1.66, true], [1.66, 0, false], [-1.66, 0, false]]) {
    const wallG = alongX ? boxGeo(3.4, 0.45, 0.08) : boxGeo(0.08, 0.45, 3.4);
    const railG = alongX ? boxGeo(3.4, 0.1, 0.1) : boxGeo(0.1, 0.1, 3.4);
    mesh(wallG, FM.woodDark, x, H + 0.22, z, g);
    mesh(railG, FM.wood, x, H + 0.85, z, g);
  }
  for (const [x, z] of [[-1.66, -1.66], [1.66, -1.66], [-1.66, 1.66], [1.66, 1.66], [0, 1.66], [0, -1.66], [1.66, 0], [-1.66, 0]]) {
    mesh(boxGeo(0.12, 0.9, 0.12), FM.wood, x, H + 0.45, z, g);
  }
  // Rope ladder
  for (const x of [-0.3, 0.3]) mesh(boxGeo(0.04, H, 0.04), FM.rope, x, H / 2, 1.8, g);
  for (let i = 0; i < 6; i++) mesh(boxGeo(0.64, 0.05, 0.08), FM.woodDark, 0, 0.4 + i * 0.6, 1.8, g);
  // Leaves
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  for (const [x, y, z, s] of [[0.3, H + 3.4, -2.0, 2.2], [-1.4, H + 2.7, -1.5, 1.7], [1.5, H + 2.5, -1.2, 1.5]]) {
    const l = mesh(leafGeo, FM.leaf, x, y, z, g);
    l.scale.set(s, s * 0.7, s);
  }
  const flag = addFlag(g, 1.55, H + 0.8, -1.4, color, 2.4);
  return { group: g, height: H, flag };
}

// A taller treehouse with a lower deck and a bucket on a pulley.
function skyFort(color) {
  const s = treehouse(color, 5.4);
  const g = s.group;
  mesh(boxGeo(2.8, 0.2, 2.2), FM.wood, 0, 2.6, -1.4, g);
  for (const x of [-1.3, 1.3]) mesh(boxGeo(0.18, 2.6, 0.18), FM.post, x, 1.3, -2.4, g);
  mesh(boxGeo(0.03, 2.6, 0.03), FM.rope, 1.95, 5.4 - 1.3, 1.1, g);
  mesh(cylGeo(0.22, 0.17, 0.3, 10), FM.metal, 1.95, 5.4 - 2.7, 1.1, g);
  mesh(boxGeo(0.7, 0.1, 0.1), FM.woodDark, 1.75, 5.4 + 0.9, 1.1, g);
  addFlag(g, -1.55, 5.4 + 0.8, 1.5, 0xffd02e, 1.6);
  return s;
}

// The best fort on the street: a painted-cardboard castle with turrets and a slide.
function megaFort(color) {
  const g = new THREE.Group();
  const H = 6;
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) mesh(boxGeo(0.4, H, 0.4), FM.post, x, H / 2, z, g);
  mesh(boxGeo(4.4, 0.3, 4.4), FM.wood, 0, H - 0.15, 0, g);
  // Castle skirt around the bottom (painted boxes), door in the front
  mesh(boxGeo(4.2, 2.4, 0.12), FM.grey, 0, 1.2, -2.05, g);
  mesh(boxGeo(0.12, 2.4, 4.2), FM.grey, -2.05, 1.2, 0, g);
  mesh(boxGeo(0.12, 2.4, 4.2), FM.grey, 2.05, 1.2, 0, g);
  for (const x of [-1.4, 1.4]) mesh(boxGeo(1.4, 2.4, 0.12), FM.grey, x, 1.2, 2.05, g);
  mesh(boxGeo(1.4, 0.6, 0.12), FM.grey, 0, 2.1, 2.05, g);
  // Battlements
  for (let i = -2; i <= 2; i++) {
    const o = i * 0.9;
    mesh(boxGeo(0.45, 0.6, 0.25), FM.greyDark, o, H + 0.3, 2.1, g);
    mesh(boxGeo(0.45, 0.6, 0.25), FM.greyDark, o, H + 0.3, -2.1, g);
    mesh(boxGeo(0.25, 0.6, 0.45), FM.greyDark, 2.1, H + 0.3, o, g);
    mesh(boxGeo(0.25, 0.6, 0.45), FM.greyDark, -2.1, H + 0.3, o, g);
  }
  // Corner turrets with pointy roofs
  const roof = new THREE.ConeGeometry(0.65, 1, 8);
  let flag = null;
  [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([x, z], i) => {
    mesh(cylGeo(0.45, 0.45, 1.6, 10), FM.grey, x, H + 0.8, z, g);
    mesh(roof, FM.red, x, H + 2.1, z, g);
    const f = addFlag(g, x, H + 2.5, z, i % 2 ? 0xffd02e : color, 1.1);
    if (!flag) flag = f;
  });
  // Slide down the back
  const slide = new THREE.Group();
  slide.position.set(0, 0, -2.2);
  const len = 5.9;
  const ang = 1.33;
  const bed = mesh(boxGeo(0.9, 0.08, len), FM.slide, 0, H / 2 + 0.1, -0.7, slide);
  bed.rotation.x = -(Math.PI / 2 - ang);
  for (const x of [-0.45, 0.45]) {
    const rail = mesh(boxGeo(0.06, 0.25, len), FM.slide, x, H / 2 + 0.2, -0.7, slide);
    rail.rotation.x = bed.rotation.x;
  }
  g.add(slide);
  // Ladder
  for (const x of [-0.35, 0.35]) mesh(boxGeo(0.08, H, 0.08), FM.woodDark, x, H / 2, 2.25, g);
  for (let i = 0; i < 9; i++) mesh(boxGeo(0.7, 0.06, 0.06), FM.woodDark, 0, 2.6 + i * 0.4, 2.25, g);
  return { group: g, height: H, flag };
}

const STRUCTURES = [cardboardFort, palletFort, treehouse, skyFort, megaFort];

// ---------- weapons (all face +z) ----------
function buildWeapon(key) {
  const g = new THREE.Group();
  const r = { group: g, muzzle: new THREE.Vector3(0, 0.8, 0.5) };
  if (key === 'slingshot') {
    mesh(cylGeo(0.3, 0.36, 0.3, 8), FM.woodDark, 0, 0.15, 0, g);
    mesh(cylGeo(0.07, 0.08, 0.6, 6), FM.wood, 0, 0.6, 0.1, g);
    for (const s of [-1, 1]) {
      const p = mesh(cylGeo(0.05, 0.06, 0.55, 6), FM.wood, s * 0.16, 1.1, 0.1, g);
      p.rotation.z = -s * 0.4;
      const band = mesh(boxGeo(0.04, 0.04, 0.5), FM.band, s * 0.14, 1.3, -0.1, g);
      band.rotation.y = s * 0.55;
    }
    mesh(boxGeo(0.16, 0.12, 0.12), FM.rubber, 0, 1.3, -0.32, g);
    r.muzzle.set(0, 1.3, 0.25);
  } else if (key === 'balloon') {
    mesh(boxGeo(1.0, 0.25, 1.3), FM.wood, 0, 0.125, 0, g);
    for (const s of [-1, 1]) mesh(boxGeo(0.1, 0.75, 0.1), FM.woodDark, s * 0.35, 0.6, 0, g);
    const axle = mesh(cylGeo(0.05, 0.05, 0.8, 6), FM.metal, 0, 0.85, 0, g);
    axle.rotation.z = Math.PI / 2;
    const arm = new THREE.Group();
    arm.position.set(0, 0.85, 0);
    mesh(boxGeo(0.12, 0.12, 1.3), FM.woodDark, 0, 0, -0.65, arm);
    mesh(cylGeo(0.24, 0.16, 0.22, 10), FM.red, 0, 0.1, -1.3, arm);
    const ammo = mesh(new THREE.SphereGeometry(0.22, 12, 10), FM.balloon, 0, 0.3, -1.3, arm);
    arm.rotation.x = -0.3;
    g.add(arm);
    r.arm = arm;
    r.ammo = ammo;
    r.muzzle.set(0, 1.9, 0.3);
  } else if (key === 'rocket') {
    mesh(boxGeo(0.9, 0.35, 0.9), FM.woodDark, 0, 0.175, 0, g);
    const rack = new THREE.Group();
    rack.position.set(0, 0.45, 0);
    rack.rotation.x = -0.6;
    const tipMats = [FM.red, FM.yellow, FM.blue];
    [-0.24, 0, 0.24].forEach((x, i) => {
      const b = mesh(cylGeo(0.11, 0.11, 0.8, 8), FM.bottle, x, 0, 0.2, rack);
      b.rotation.x = Math.PI / 2;
      const tip = mesh(new THREE.ConeGeometry(0.08, 0.22, 6), tipMats[i], x, 0, 0.7, rack);
      tip.rotation.x = Math.PI / 2;
    });
    g.add(rack);
    r.muzzle.set(0, 0.95, 0.65);
  } else if (key === 'dart') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = mesh(cylGeo(0.03, 0.03, 0.8, 5), FM.metal, Math.cos(a) * 0.25, 0.35, Math.sin(a) * 0.25, g);
      leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    }
    mesh(boxGeo(0.45, 0.35, 0.7), FM.orange, 0, 0.8, 0, g);
    const spin = new THREE.Group();
    spin.position.set(0, 0.8, 0.35);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = mesh(cylGeo(0.04, 0.04, 0.8, 6), FM.blue, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.4, spin);
      b.rotation.x = Math.PI / 2;
    }
    g.add(spin);
    const drum = mesh(cylGeo(0.22, 0.22, 0.22, 12), FM.yellow, 0.35, 0.8, -0.05, g);
    drum.rotation.z = Math.PI / 2;
    mesh(boxGeo(0.1, 0.3, 0.12), FM.rubber, 0, 0.55, -0.25, g);
    r.spin = spin;
    r.muzzle.set(0, 0.8, 1.2);
  } else if (key === 'magnifier') {
    mesh(cylGeo(0.3, 0.36, 0.3, 8), FM.woodDark, 0, 0.15, 0, g);
    mesh(cylGeo(0.05, 0.05, 0.8, 6), FM.metal, 0, 0.7, 0, g);
    const lens = new THREE.Group();
    lens.position.set(0, 1.35, 0.1);
    lens.rotation.x = 0.25;
    const rim = mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 24), FM.rubber, 0, 0, 0, lens);
    rim.castShadow = false;
    const glassDisc = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24), FM.lens);
    lens.add(glassDisc);
    const handle = mesh(boxGeo(0.1, 0.5, 0.1), FM.woodDark, 0, -0.7, 0, lens);
    handle.rotation.z = 0;
    g.add(lens);
    r.muzzle.set(0, 1.35, 0.2);
  } else if (key === 'zapper') {
    mesh(cylGeo(0.06, 0.06, 0.6, 6), FM.metal, 0, 0.3, 0, g);
    mesh(boxGeo(0.7, 0.1, 0.7), FM.rubber, 0, 0.62, 0, g);
    const glow = mesh(boxGeo(0.5, 0.7, 0.5), FM.zapGlow, 0, 1.02, 0, g);
    glow.castShadow = false;
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) mesh(boxGeo(0.06, 0.75, 0.06), FM.rubber, x, 1.02, z, g);
    for (let i = 0; i < 4; i++) mesh(boxGeo(0.62, 0.03, 0.62), FM.metal, 0, 0.75 + i * 0.18, 0, g);
    mesh(boxGeo(0.75, 0.12, 0.75), FM.rubber, 0, 1.42, 0, g);
    for (const s of [-1, 1]) {
      const ant = mesh(cylGeo(0.02, 0.02, 0.5, 4), FM.metal, s * 0.2, 1.7, 0, g);
      ant.rotation.z = s * -0.4;
    }
    r.glow = glow;
    r.muzzle.set(0, 1.1, 0.35);
  } else if (key === 'salt') {
    mesh(boxGeo(1.0, 0.3, 1.0), FM.woodDark, 0, 0.15, 0, g);
    const tube = new THREE.Group();
    tube.position.set(0, 0.55, 0);
    tube.rotation.x = -0.75;
    mesh(cylGeo(0.36, 0.3, 1.0, 12), FM.saltBin, 0, 0.4, 0, tube);
    mesh(cylGeo(0.38, 0.38, 0.12, 12), FM.white, 0, 0.55, 0, tube);
    g.add(tube);
    mesh(boxGeo(0.45, 0.55, 0.3), FM.white, 0.55, 0.55, -0.35, g).rotation.y = 0.3;
    r.muzzle.set(0, 1.1, 0.55);
  }
  return r;
}

// ---------- labels ----------
let LABELS = null;
function labels() {
  if (LABELS) return LABELS;
  const make = (text, bg) =>
    new THREE.SpriteMaterial({
      map: canvasTexture(360, 110, (x, w, h) => {
        x.fillStyle = bg;
        x.beginPath();
        x.roundRect(6, 6, w - 12, h - 12, 32);
        x.fill();
        x.lineWidth = 6;
        x.strokeStyle = '#1b1a22';
        x.stroke();
        x.fillStyle = '#fff';
        x.font = '900 44px Nunito, Arial, sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(text, w / 2, h / 2 + 3);
      }),
      depthTest: false,
      transparent: true,
    });
  LABELS = { noBoy: make('NEEDS A BOY', '#d8342c'), onWay: make('ON THE WAY…', '#e08a1a'), chores: make('DOING CHORES', '#7a5cd6'), home: make('STUCK AT HOME', '#8a5a2b'), scared: make('SCARED STIFF!', '#b8327a'), goof: make('GOOFING OFF', '#2e9c6a'), banned: make('CONFISCATED', '#555060') };
  return LABELS;
}

// Where each kid stands on the weapon platform (seat 0, seat 1).
const SEATS = [
  [0.7, 0, -0.45],
  [-0.75, 0, -0.35],
];

const beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true);
beamGeo.rotateX(Math.PI / 2);
beamGeo.translate(0, 0, 0.5);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.85, depthWrite: false });
const beamCore = new THREE.MeshBasicMaterial({ color: 0xffffff });
const _tmp = new THREE.Vector3();

// ---------- the Fort ----------
export class Fort {
  constructor(game, x, z, key) {
    this.game = game;
    // base: the weapon as built. weapon: what it is now (changes if it gets specialised).
    this.base = WEAPONS[key];
    this.weapon = this.base;
    this.spec = null;
    this.level = 0;
    this.wlevel = 0;
    this.crew = [];
    this.cooldown = 0.3;
    this.targeting = 'first';
    this.spent = this.weapon.cost;
    this.kills = 0;
    this.kick = 0;
    this.spinV = 0;
    this.beamT = 0;
    this.beamTarget = null;
    this.flagColor = FLAG_COLORS[Math.floor(Math.random() * FLAG_COLORS.length)];

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    this.group.userData.fort = this;

    this.pivot = new THREE.Group();
    this.pivot.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(this.pivot);
    this.w = buildWeapon(key);
    this.pivot.add(this.w.group);

    this.indicator = new THREE.Sprite(labels().noBoy);
    this.indicator.scale.set(2.8, 0.86, 1);
    this.indicator.renderOrder = 40;
    this.group.add(this.indicator);

    if (this.weapon.beam) {
      this.beam = new THREE.Group();
      this.beam.add(new THREE.Mesh(beamGeo, beamMat));
      const core = new THREE.Mesh(beamGeo, beamCore);
      core.scale.set(0.4, 0.4, 1);
      this.beam.add(core);
      this.beam.visible = false;
      game.scene.add(this.beam);
    }

    this.buildStructure();
    game.scene.add(this.group);
  }

  get pos() {
    return this.group.position;
  }

  // Kids up on the platform right now (not walking over, not at chores).
  get mannedCrew() {
    return this.crew.filter((b) => b.fort === this && b.state === 'manning');
  }

  get manned() {
    return this.mannedCrew.length > 0;
  }

  get maxCrew() {
    return this.level >= TEAM_LEVEL ? 2 : 1;
  }

  // Kept for code that only cares about "the" kid.
  get boy() {
    return this.crew[0] || null;
  }

  seatFor(boy) {
    const i = Math.max(0, this.crew.indexOf(boy));
    return SEATS[i] || SEATS[0];
  }

  buildStructure() {
    if (this.structure) this.group.remove(this.structure);
    const s = STRUCTURES[this.level](this.flagColor);
    this.structure = s.group;
    this.height = s.height;
    this.flag = s.flag;
    this.group.add(s.group);
    this.pivot.position.y = s.height;
  }

  stats() {
    const w = this.weapon;
    const fl = FORT_LEVELS[this.level];
    const wl = WEAPON_LEVELS[this.wlevel];
    const on = this.mannedCrew;
    const m = this.game.mods;
    let range = w.range * fl.rangeMul * m.range;
    let damage = w.damage * fl.dmgMul * wl.dmg * m.dmg;
    let rate = w.rate * wl.rate * m.rate;
    for (const b of on) {
      range *= b.trait.range || 1;
      damage *= b.trait.dmg || 1;
      rate *= b.trait.rate || 1;
      if (b.tired) rate *= 0.8;
      // Show-offs try harder with another fort close enough to watch.
      if (b.trait.showoff && this.game.forts.some((f) => f !== this && f.manned && f.pos.distanceToSquared(this.pos) < 12 * 12)) rate *= b.trait.showoff;
    }
    // A bossy kid on this fort or one nearby barks orders: +10% damage (doesn't stack).
    if (this.game.forts.some((f) => f.pos.distanceToSquared(this.pos) < 12 * 12 && f.mannedCrew.some((b) => b.trait.aura))) damage *= 1.1;
    const day = this.game.dayMods;
    damage *= day.dmg;
    rate *= day.rate;
    const team = on.length >= 2;
    if (team) {
      damage *= TEAM_BONUS.dmg;
      rate *= TEAM_BONUS.rate;
    }
    return { range, damage, rate, team };
  }

  sellValue() {
    return Math.floor(this.spent * 0.7);
  }

  upgradeStructure() {
    this.level++;
    this.buildStructure();
  }

  upgradeWeapon() {
    this.wlevel++;
    this.w.group.scale.setScalar(1 + 0.1 * this.wlevel);
  }

  specialise(spec) {
    const w = { ...this.base, name: spec.name, short: spec.name, icon: spec.icon, desc: spec.desc };
    for (const [k, v] of Object.entries(spec.mul || {})) w[k] = (this.base[k] || 0) * v;
    Object.assign(w, spec.set || {});
    this.weapon = w;
    this.spec = spec.key;
    if (spec.targeting) this.targeting = spec.targeting;
    this.w.group.scale.setScalar(1.7);
  }

  // Extra targets for multi-shot weapons: the best few in range, main target first.
  extraTargets(main, range, n) {
    const r2 = range * range;
    const { x, z } = this.group.position;
    return this.game.golems
      .filter((g) => g !== main && g.targetable && !(g.def.flying && this.weapon.arc) && (g.pos.x - x) ** 2 + (g.pos.z - z) ** 2 <= r2)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, n);
  }

  findTarget(range) {
    let best = null;
    let bestScore = -Infinity;
    const r2 = range * range;
    const { x, z } = this.group.position;
    for (const g of this.game.golems) {
      if (!g.targetable || (g.def.flying && this.weapon.arc)) continue;
      const dx = g.pos.x - x;
      const dz = g.pos.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const score = this.targeting === 'first' ? -g.remaining : this.targeting === 'strong' ? g.hp : -d2;
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }
    return best;
  }

  update(dt) {
    this.cooldown -= dt;
    this.kick = Math.max(0, this.kick - dt * 3);
    const w = this.w;
    if (w.arm) w.arm.rotation.x = -0.3 + 2.2 * Math.sin((this.kick * Math.PI) / 2);
    if (w.ammo) w.ammo.visible = this.kick < 0.25;
    if (w.spin) {
      w.spin.rotation.z += dt * this.spinV;
      this.spinV = Math.max(0, this.spinV - dt * 25);
    }
    if (w.glow) w.glow.material = this.kick > 0.5 ? FM.zapHot : FM.zapGlow;
    if (!w.arm) w.group.position.z = -0.12 * this.kick;
    if (this.flag) this.flag.rotation.y = Math.sin(this.game.time * 3 + this.group.position.x) * 0.35;

    const manned = this.manned;
    const night = this.game.phase === 'dusk' || this.game.phase === 'night';
    const banned = this.game.banned === this.base.key;
    this.indicator.visible = (!manned || banned) && !night;
    if (!manned || banned) {
      const L = labels();
      const c = this.crew;
      this.indicator.material = banned && c.length ? L.banned : !c.length ? L.noBoy : c.every((b) => b.away) ? L.home : c.some((b) => b.drifting) && c.every((b) => b.drifting || b.onChore || b.away) ? L.goof : c.every((b) => b.onChore || b.away) ? L.chores : L.onWay;
      this.indicator.position.y = this.height + 2.4 + Math.sin(performance.now() * 0.005) * 0.15;
      this.stopBeam();
      return;
    }

    // A drop bear landed on the fort: the kids freeze for a few seconds.
    if (this.game.time < (this.scaredUntil || 0)) {
      this.indicator.visible = true;
      this.indicator.material = labels().scared;
      this.indicator.position.y = this.height + 2.4 + Math.sin(performance.now() * 0.02) * 0.2;
      return this.stopBeam();
    }

    const st = this.stats();
    const target = this.findTarget(st.range);
    if (!target) return this.stopBeam();
    const want = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z) - this.group.rotation.y;
    this.pivot.rotation.y = angleLerp(this.pivot.rotation.y, want, Math.min(1, dt * 12));
    if (this.weapon.key === 'dart') this.spinV = 30;
    const aimed = Math.abs(angleDiff(this.pivot.rotation.y, want)) < 0.35;
    if (this.weapon.beam) return aimed ? this.burn(target, st, dt) : this.stopBeam();
    if (this.cooldown <= 0 && aimed) this.fire(target, st);
  }

  scare(time) {
    time *= Math.max(1, ...this.mannedCrew.map((b) => b.trait.scare || 1));
    this.scaredUntil = this.game.time + time;
    const kid = this.mannedCrew[0];
    if (kid) this.game.chatter.say(kid, 'scared', {}, { force: true });
    const p = this.pos.clone().setY(this.height + 1.5);
    this.game.effects.float('DROP BEAR!', p, 'big');
    this.game.effects.burst(p, 0x8e8f94, 14, { speed: 4, up: 5, size: 0.2 });
    this.game.audio.play('scared');
  }

  muzzleWorld() {
    this.group.updateMatrixWorld(true);
    return this.w.group.localToWorld(this.w.muzzle.clone());
  }

  // Magnifying glass: a continuous beam that heats up the longer it stays on one golem.
  burn(target, st, dt) {
    if (this.beamTarget !== target) {
      this.beamTarget = target;
      this.beamT = 0;
    }
    this.beamT += dt;
    this.lastAction = this.game.time;
    if (Math.random() < dt * 0.25) this.game.chatter.sfx(this);
    const w = this.weapon;
    const heat = 1 + Math.min(this.beamT, w.heatTime || 3) * (w.heatRate || 0.7); // normally up to 3.1× after 3 seconds
    this.heat = heat;
    target.takeDamage(st.damage * st.rate * heat * dt, w.dmgType, this, true);
    // Prism: split the beam onto nearby creatures at half strength.
    if (w.prism) {
      const near = this.game.golems
        .filter((g) => g !== target && g.targetable && (g.pos.x - target.pos.x) ** 2 + (g.pos.z - target.pos.z) ** 2 < 30)
        .slice(0, w.prism);
      for (const g of near) {
        g.takeDamage(st.damage * st.rate * heat * 0.5 * dt, w.dmgType, this, true);
        if (Math.random() < dt * 10) this.game.effects.bolt([target.aimPoint(), g.aimPoint()], 0xfff2a0);
      }
    }
    const from = this.muzzleWorld();
    const to = target.aimPoint(_tmp);
    this.beam.visible = true;
    this.beam.position.copy(from);
    this.beam.lookAt(to);
    this.beam.scale.set(0.6 + heat * 0.4, 0.6 + heat * 0.4, from.distanceTo(to));
    beamMat.color.setHex(heat > 4 ? 0xff8ad8 : heat > 2.5 ? 0xffffff : heat > 1.8 ? 0xffd27a : 0xfff2a0);
    if (Math.random() < dt * 12) this.game.effects.burst(to, heat > 2 ? 0xff7a2f : 0xffd23e, 1, { speed: 2, up: 3, size: 0.12, life: 0.4 });
    this.game.audio.play('sizzle');
  }

  stopBeam() {
    if (this.beam) this.beam.visible = false;
    this.beamTarget = null;
    this.beamT = 0;
  }

  fire(target, st) {
    this.cooldown = 1 / st.rate;
    this.kick = 1;
    this.lastAction = this.game.time;
    // Every so often the kids do the sound effects themselves.
    if (Math.random() < Math.min(0.12, 0.25 / st.rate)) this.game.chatter.sfx(this);
    const from = this.muzzleWorld();
    if (this.weapon.chain) this.zap(target, st, from);
    else {
      this.game.projectiles.fire(this, target, from, st);
      if (this.weapon.multi) for (const t of this.extraTargets(target, st.range, this.weapon.multi - 1)) this.game.projectiles.fire(this, t, from, st);
    }
    this.game.audio.play(this.weapon.key);
  }

  // Bug zapper: hit the target, then arc to nearby golems with falling damage.
  zap(target, st, from) {
    const hit = [target];
    const pts = [from, target.aimPoint()];
    let cur = target;
    const w = this.weapon;
    for (let i = 0; i < w.chain; i++) {
      let next = null;
      let bd = (w.chainR || 4.5) ** 2;
      for (const g of this.game.golems) {
        if (!g.targetable || hit.includes(g)) continue;
        const d = (g.pos.x - cur.pos.x) ** 2 + (g.pos.z - cur.pos.z) ** 2;
        if (d < bd) {
          bd = d;
          next = g;
        }
      }
      if (!next) break;
      hit.push(next);
      pts.push(next.aimPoint());
      cur = next;
    }
    this.game.effects.bolt(pts, 0x8fe8ff);
    hit.forEach((g, i) => {
      g.takeDamage(st.damage * Math.pow(w.falloff || 0.65, i), w.dmgType, this);
      if (w.stun) g.applySlow(1, w.stun, true);
      this.game.effects.burst(pts[i + 1], 0xbff4ff, 3, { speed: 3, up: 3, size: 0.1, life: 0.3 });
    });
  }

  destroy() {
    this.game.scene.remove(this.group);
    if (this.beam) this.game.scene.remove(this.beam);
  }
}
