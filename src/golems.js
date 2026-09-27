import * as THREE from 'three';
import { ELITES, GOLEMS } from './config.js';
import { BODIES, extraMats } from './creatures.js';

const limb = new THREE.BoxGeometry(0.42, 1, 0.44);
limb.translate(0, -0.5, 0);
const flame = new THREE.ConeGeometry(0.2, 0.7, 5);
flame.translate(0, 0.35, 0);
const crystal = new THREE.OctahedronGeometry(0.3, 0);
crystal.scale(0.6, 1.7, 0.6);

const GEO = {
  torso: new THREE.DodecahedronGeometry(0.75, 0),
  head: new THREE.BoxGeometry(0.62, 0.52, 0.56),
  limb,
  fist: new THREE.DodecahedronGeometry(0.3, 0),
  eye: new THREE.BoxGeometry(0.14, 0.08, 0.05),
  core: new THREE.OctahedronGeometry(0.22, 0),
  flame,
  crystal,
  spark: new THREE.IcosahedronGeometry(0.12, 0),
  moss: new THREE.BoxGeometry(0.55, 0.14, 0.5),
  crack: new THREE.BoxGeometry(0.5, 0.08, 0.05),
  blob: new THREE.SphereGeometry(1, 8, 6),
  antenna: new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5),
  panel: new THREE.BoxGeometry(0.6, 0.45, 0.1),
  pad: new THREE.BoxGeometry(0.55, 0.3, 0.6),
  leaf: new THREE.IcosahedronGeometry(1, 0),
};

const HP_BG = new THREE.PlaneGeometry(1.5, 0.22);
const HP_FG = new THREE.PlaneGeometry(1.4, 0.13);
HP_FG.translate(0.7, 0, 0);
const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false });

const typeMats = {};
function mats(key) {
  if (typeMats[key]) return typeMats[key];
  const d = GOLEMS[key];
  let extra = d.body ? new THREE.MeshStandardMaterial({ color: d.extraColor || d.color, roughness: 0.9, flatShading: true }) : null;
  switch (d.extra) {
    case 'flames':
    case 'magma':
      extra = new THREE.MeshBasicMaterial({ color: 0xff8a1a });
      break;
    case 'crystals':
      extra = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0x2a6a8a, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
      break;
    case 'moss':
      extra = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1, flatShading: true });
      break;
    case 'sparks':
      extra = new THREE.MeshBasicMaterial({ color: 0xfff35c });
      break;
    case 'goop':
      extra = new THREE.MeshStandardMaterial({ color: 0x8ff07f, roughness: 0.15, transparent: true, opacity: 0.8 });
      break;
    case 'robot':
      extra = new THREE.MeshStandardMaterial({ color: 0x3d4550, metalness: 0.7, roughness: 0.35, flatShading: true });
      break;
    case 'wood':
      extra = new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 1, flatShading: true });
      break;
  }
  typeMats[key] = {
    body: new THREE.MeshStandardMaterial({
      color: d.color,
      emissive: d.emissive,
      roughness: d.metal ? 0.35 : d.opacity ? 0.2 : 0.85,
      metalness: d.metal ? 0.65 : 0,
      transparent: !!d.opacity,
      opacity: d.opacity || 1,
      flatShading: true,
    }),
    glow: new THREE.MeshBasicMaterial({ color: d.glow }),
    extra,
  };
  return typeMats[key];
}

const tmpV = new THREE.Vector3();
const ELITE_RING = new THREE.RingGeometry(0.85, 1.1, 28).rotateX(-Math.PI / 2);
const SHIELD_GEO = new THREE.IcosahedronGeometry(1.5, 1);
const eliteMats = {};
function eliteMat(key) {
  return (eliteMats[key] ||= new THREE.MeshBasicMaterial({ color: ELITES[key].color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
}
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.22, depthWrite: false, wireframe: false });

export class Golem {
  constructor(game, key, hpScale = 1, rewardScale = 1, rift = 0, opts = {}) {
    this.game = game;
    // Golems from a later rift walk its spur trail first, then join the main trail.
    this.rift = rift;
    this.onSpur = !!game.spurs[rift];
    // Ability timers
    const d0 = GOLEMS[key];
    this.hopT = d0.hop ? d0.hop.every * (0.5 + Math.random() * 0.5) : 0;
    this.hopping = 0;
    this.burrowT = d0.burrow ? d0.burrow.every * (0.4 + Math.random() * 0.6) : 0;
    this.submerged = 0;
    this.pounced = false;
    this.lift = 0;
    this.hpScale = hpScale;
    this.rewardScale = rewardScale;
    this.sinceHit = 0;
    this.key = key;
    const d = (this.def = GOLEMS[key]);
    // Weekly twists, then any tougher-variant rolls (giant, speedy, shielded, brood).
    const mods = game.mods;
    this.elite = opts.elite || [];
    this.mini = !!opts.mini;
    let hp = d.hp * hpScale * (mods.golemHp['*'] || 1) * (mods.golemHp[key] || 1);
    let reward = d.reward * rewardScale * mods.reward;
    let size = d.size;
    this.baseSpeed = game.golemSpeed(key, this.elite);
    for (const e of this.elite) {
      const E = ELITES[e];
      hp *= E.hp || 1;
      reward *= E.reward || 1;
      size *= E.size || 1;
    }
    if (this.mini) {
      hp *= 0.3;
      reward *= 0.25;
      size *= 0.55;
      this.baseSpeed *= 1.2;
    }
    this.size = size;
    this.maxHp = Math.round(hp);
    this.hp = this.maxHp;
    this.shield = this.elite.includes('shielded') ? this.maxHp * ELITES.shielded.shield : 0;
    this.maxShield = this.shield;
    this.reward = Math.max(1, Math.round(reward));
    this.dist = 0;
    this.lateral = (Math.random() - 0.5) * (d.boss ? 0.4 : 1.6);
    this.alive = true;
    this.done = false;
    this.slowAmt = 0;
    this.slowUntil = 0;
    this.flash = 0;
    this.phase = Math.random() * 6;
    this.curSpeed = this.baseSpeed;
    this.emerge = 0;
    this.pos = new THREE.Vector3();
    this.tan = new THREE.Vector3();
    this.build();
    this.buildElite();
    this.buildHp();
    this.update(0);
  }

  build() {
    const d = this.def;
    const m = mats(this.key);
    this.bodyMat = m.body.clone();
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    if (d.body) {
      // Not a golem: a lion, spider, drop bear or bunyip.
      const P = BODIES[d.body](body, { body: this.bodyMat, glow: m.glow, extra: m.extra, ...extraMats });
      this.parts = { body, ...P };
      root.scale.setScalar(this.size);
      root.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      this.root = root;
      this.game.scene.add(root);
      return;
    }

    const torso = new THREE.Mesh(GEO.torso, this.bodyMat);
    torso.position.y = 1.45;
    torso.scale.set(1, 1.1, 0.8);
    const head = new THREE.Mesh(GEO.head, this.bodyMat);
    head.position.y = 2.28;
    body.add(torso, head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(GEO.eye, m.glow);
      eye.position.set(s * 0.14, 2.32, 0.29);
      body.add(eye);
    }
    const core = new THREE.Mesh(GEO.core, m.glow);
    core.position.set(0, 1.5, 0.58);
    body.add(core);

    const parts = { body };
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.9, 1.95, 0);
      const a = new THREE.Mesh(GEO.limb, this.bodyMat);
      a.scale.set(0.95, 1.05, 0.95);
      const fist = new THREE.Mesh(GEO.fist, this.bodyMat);
      fist.position.y = -1.1;
      arm.add(a, fist);
      body.add(arm);
      parts[s < 0 ? 'armL' : 'armR'] = arm;

      const leg = new THREE.Group();
      leg.position.set(s * 0.36, 0.95, 0);
      const l = new THREE.Mesh(GEO.limb, this.bodyMat);
      l.scale.set(1.1, 0.95, 1.1);
      leg.add(l);
      body.add(leg);
      parts[s < 0 ? 'legL' : 'legR'] = leg;
    }
    this.parts = parts;

    // Elemental decorations
    if (d.extra === 'flames' || d.extra === 'magma') {
      this.flames = [];
      const spots = [[0, 2.55, 0, 1], [-0.6, 2.05, -0.1, 0.7], [0.6, 2.05, -0.1, 0.7], [0, 1.9, -0.45, 0.9]];
      for (const [x, y, z, s] of spots) {
        const f = new THREE.Mesh(GEO.flame, m.extra);
        f.position.set(x, y, z);
        f.scale.setScalar(s);
        f.userData.base = s;
        body.add(f);
        this.flames.push(f);
      }
      if (d.extra === 'magma') {
        for (const [x, y, z, r] of [[0.2, 1.2, 0.56, 0.4], [-0.25, 1.75, 0.55, -0.5], [0.3, 1.0, -0.55, 0.2], [0, 2.2, 0.3, 0.1]]) {
          const c = new THREE.Mesh(GEO.crack, m.glow);
          c.position.set(x, y, z);
          c.rotation.z = r;
          body.add(c);
        }
      }
    } else if (d.extra === 'crystals') {
      for (const [x, y, z, rx, rz] of [[-0.75, 2.2, 0, 0, 0.5], [0.75, 2.2, 0, 0, -0.5], [0, 1.9, -0.55, -0.6, 0], [0.25, 2.65, -0.1, -0.2, -0.3], [-0.3, 1.4, -0.55, -0.8, 0.3]]) {
        const c = new THREE.Mesh(GEO.crystal, m.extra);
        c.position.set(x, y, z);
        c.rotation.set(rx, 0, rz);
        body.add(c);
      }
    } else if (d.extra === 'moss') {
      for (const [x, y, z] of [[-0.8, 2.0, 0], [0.8, 2.0, 0], [0, 2.56, 0], [0.1, 1.95, -0.4]]) {
        const c = new THREE.Mesh(GEO.moss, m.extra);
        c.position.set(x, y, z);
        body.add(c);
      }
    } else if (d.extra === 'sparks') {
      this.sparks = new THREE.Group();
      this.sparks.position.y = 2.3;
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(GEO.spark, m.extra);
        const a = (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.85, (i - 1) * 0.2, Math.sin(a) * 0.85);
        this.sparks.add(s);
      }
      body.add(this.sparks);
    } else if (d.extra === 'goop') {
      // Drips and blobs
      for (const [x, y, z, r] of [[-0.5, 1.2, 0.45, 0.22], [0.45, 0.9, 0.4, 0.18], [0.2, 2.5, 0.1, 0.2], [-0.8, 1.6, -0.2, 0.16], [0.6, 1.8, -0.4, 0.2]]) {
        const b = new THREE.Mesh(GEO.blob, m.extra);
        b.position.set(x, y, z);
        b.scale.set(r, r * 1.4, r);
        body.add(b);
      }
    } else if (d.extra === 'robot') {
      const ant = new THREE.Mesh(GEO.antenna, m.extra);
      ant.position.set(0.15, 2.75, 0);
      const tip = new THREE.Mesh(GEO.spark, m.glow);
      tip.position.set(0.15, 3.0, 0);
      const panel = new THREE.Mesh(GEO.panel, m.extra);
      panel.position.set(0, 1.35, 0.55);
      body.add(ant, tip, panel);
      for (const s of [-1, 1]) {
        const pad = new THREE.Mesh(GEO.pad, m.extra);
        pad.position.set(s * 0.9, 2.05, 0);
        body.add(pad);
      }
      this.blink = tip;
    } else if (d.extra === 'wood') {
      for (const [x, y, z, sc] of [[0, 2.7, 0, 0.55], [-0.85, 2.15, 0, 0.35], [0.8, 2.2, -0.1, 0.4], [0.3, 2.85, -0.3, 0.35]]) {
        const l = new THREE.Mesh(GEO.leaf, m.extra);
        l.position.set(x, y, z);
        l.scale.setScalar(sc);
        body.add(l);
      }
      const twig = new THREE.Mesh(GEO.antenna, this.bodyMat);
      twig.position.set(-0.3, 2.7, 0);
      twig.rotation.z = 0.6;
      body.add(twig);
    }

    root.scale.setScalar(this.size);
    root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.root = root;
    this.game.scene.add(root);
  }

  // Coloured rings at the feet (one per variant) and a bubble for shielded ones.
  buildElite() {
    this.elite.forEach((e, i) => {
      const ring = new THREE.Mesh(ELITE_RING, eliteMat(e));
      ring.position.y = 0.06 + i * 0.02;
      ring.scale.setScalar(1 + i * 0.3);
      ring.renderOrder = 5;
      this.root.add(ring);
    });
    if (this.shield > 0) {
      this.shieldMesh = new THREE.Mesh(SHIELD_GEO, shieldMat);
      this.shieldMesh.position.y = 1.35;
      this.root.add(this.shieldMesh);
    }
  }

  buildHp() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(HP_BG, hpBgMat);
    this.hpMat = new THREE.MeshBasicMaterial({ color: 0x5ee05e, depthTest: false, transparent: true });
    const fg = new THREE.Mesh(HP_FG, this.hpMat);
    fg.position.set(-0.7, 0, 0.001);
    bg.renderOrder = 30;
    fg.renderOrder = 31;
    g.add(bg, fg);
    g.scale.setScalar(this.def.boss ? 2 : 1);
    g.visible = false;
    this.hpFg = fg;
    this.hpGroup = g;
    this.game.scene.add(g);
  }

  get trail() {
    return this.onSpur ? this.game.spurs[this.rift] : this.game.path;
  }

  // Can forts see and hit it right now?
  get targetable() {
    return this.alive && !this.retreating && this.emerge >= 0.8 && !this.submerged;
  }

  // Where shots should aim (flying creatures are up in the air).
  aimPoint(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.lift + this.size * 1.3, this.pos.z);
  }

  // How far this golem still has to walk to reach the sack.
  get remaining() {
    const g = this.game;
    if (this.onSpur) return g.spurs[this.rift].length - this.dist + g.path.length - g.joinDists[this.rift];
    return g.path.length - this.dist;
  }

  // Position along the trail (with this golem's sideways offset).
  placeAt(dist, out, tan) {
    let p = this.trail;
    if (this.onSpur && dist > p.length) {
      dist = this.game.joinDists[this.rift] + dist - p.length;
      p = this.game.path;
    }
    p.pointAt(dist, out);
    p.tangentAt(dist, tan);
    const lat = this.lateral * Math.min(1, (p.length - dist) / 12, dist / 6 + 0.2);
    out.x += -tan.z * lat;
    out.z += tan.x * lat;
    return out;
  }

  predict(extra, out) {
    return this.placeAt(Math.min(this.dist + extra, this.trail.length + (this.onSpur ? this.game.path.length : 0)), out, tmpV);
  }

  headPos() {
    return new THREE.Vector3(this.pos.x, this.lift + 2.7 * this.size, this.pos.z);
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    const d = this.def;
    if (this.retreating) {
      // Sink back into the ground and slink off into the bush.
      this.emerge -= dt * 0.8;
      this.root.position.y = -(1 - this.emerge) * 2.6 * this.size;
      this.hpGroup.visible = false;
      if (this.emerge <= 0) {
        this.alive = false;
        this.done = true;
      }
      return;
    }
    if (this.emerge < 1) this.emerge = Math.min(1, this.emerge + dt * 0.9);
    if (g.time > this.slowUntil) this.slowAmt = 0;
    this.curSpeed = this.baseSpeed * (1 - this.slowAmt) * (this.emerge < 1 ? 0.5 : 1) * (this.submerged ? 1.3 : 1);
    this.dist += this.curSpeed * dt;
    this.abilities(dt);
    if (this.onSpur && this.dist >= this.trail.length) {
      this.dist = g.joinDists[this.rift] + this.dist - this.trail.length;
      this.onSpur = false;
    }
    if (this.dist >= g.path.length) {
      this.alive = false;
      this.done = true;
      g.golemReachedSack(this);
      return;
    }
    this.placeAt(this.dist, this.pos, this.tan);
    // Height: fliers soar, pouncing spiders arc through the air, bunyips sink.
    let y = -(1 - this.emerge) * 2.6 * this.size;
    if (d.flying) y += Math.min(1, this.emerge * 1.5) * (4.2 + Math.sin(this.phase * 0.5) * 0.3);
    if (this.hopping > 0) y += Math.sin((1 - this.hopping / 0.4) * Math.PI) * 2.2;
    if (d.burrow) this.sink = THREE.MathUtils.lerp(this.sink || 0, this.submerged ? 1 : 0, Math.min(1, dt * 6));
    if (this.sink) y -= this.sink * 1.6 * this.size;
    this.lift = Math.max(0, y);
    this.root.position.set(this.pos.x, y, this.pos.z);
    this.root.rotation.y = Math.atan2(this.tan.x, this.tan.z);

    // Stompy walk
    this.phase += (dt * this.curSpeed * 2.2) / this.size;
    const s = Math.sin(this.phase);
    const P = this.parts;
    if (P.legL) {
      P.legL.rotation.x = s * 0.55;
      P.legR.rotation.x = -s * 0.55;
      P.armL.rotation.x = -s * 0.45;
      P.armR.rotation.x = s * 0.45;
    }
    if (P.legs) P.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase * 2 + i * 1.3) * 0.35));
    if (P.wings) for (const w of P.wings) w.rotation.z = w.userData.side * Math.sin(g.time * 9 + this.phase) * 0.6;
    P.body.position.y = Math.abs(Math.cos(this.phase)) * 0.1;
    P.body.rotation.z = s * 0.05;
    if (this.flames) for (const f of this.flames) f.scale.y = f.userData.base * (0.75 + Math.random() * 0.5);
    if (this.sparks) this.sparks.rotation.y += dt * 4;

    this.sinceHit += dt;
    if (d.regen && this.sinceHit > 1.5 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * d.regen * dt);
      if (Math.random() < dt * 4) this.game.effects.burst(this.headPos(), 0x7dff6a, 1, { speed: 0.5, up: 2, size: 0.12, gravity: -2 });
    }
    if (this.shieldMesh) {
      this.shieldMesh.visible = this.shield > 0;
      this.shieldMesh.rotation.y += dt * 0.8;
      this.shieldMesh.scale.setScalar(0.85 + 0.15 * (this.shield / this.maxShield) + Math.sin(g.time * 5) * 0.03);
    }
    if (this.elite.includes('speedy') && Math.random() < dt * 14) {
      this.game.effects.burst(this.pos.clone().setY(this.lift + 0.4), 0xbff8ff, 1, { speed: 0.3, up: 0.5, size: 0.14, life: 0.35, gravity: 0 });
    }
    if (this.blink) this.blink.visible = Math.sin(this.phase * 3) > 0;
    this.flash = Math.max(0, this.flash - dt);
    this.bodyMat.emissive.setHex(this.flash > 0 ? 0xffffff : this.slowAmt >= 1 ? 0x3a8ad0 : this.slowAmt > 0 ? 0x123e70 : d.emissive);

    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpGroup.visible = ratio < 0.999 && this.emerge >= 1 && !this.submerged;
    if (this.hpGroup.visible) {
      this.hpGroup.position.set(this.pos.x, this.lift + 3.0 * this.size + 0.2, this.pos.z);
      this.hpGroup.quaternion.copy(g.camera.quaternion);
      this.hpFg.scale.x = Math.max(0.001, ratio);
      this.hpMat.color.setHex(ratio > 0.5 ? 0x5ee05e : ratio > 0.25 ? 0xffd23e : 0xff4a3a);
    }
  }

  abilities(dt) {
    const d = this.def;
    const g = this.game;
    // Huntsman: every few seconds, pounce forward down the trail.
    if (this.hopping > 0) {
      this.hopping = Math.max(0, this.hopping - dt);
      if (d.hop) this.dist += (d.hop.dist / 0.4) * dt;
    }
    if (d.hop) {
      if (this.hopping > 0) {
        // mid-air
      } else if (this.emerge >= 1 && (this.hopT -= dt) <= 0) {
        this.hopT = d.hop.every;
        this.hopping = 0.4;
        g.audio.play('hop');
      }
    }
    // Bunyip: dive underground for a bit where nothing can hit it.
    if (d.burrow && this.emerge >= 1) {
      if (this.submerged > 0) {
        this.submerged = Math.max(0, this.submerged - dt);
        if (Math.random() < dt * 10) g.effects.burst(this.pos.clone().setY(0.2), 0x5a4a2a, 1, { speed: 2, up: 2, size: 0.2 });
      } else if ((this.burrowT -= dt) <= 0) {
        this.burrowT = d.burrow.every;
        this.submerged = d.burrow.time;
        g.effects.burst(this.pos.clone().setY(0.3), 0x6b5a3a, 10, { speed: 3, up: 4, size: 0.25 });
        g.audio.play('dig');
      }
    }
    // Drop bear: leap onto the first manned fort it passes and scare the kids.
    if (d.pounce && !this.pounced && this.emerge >= 1) {
      for (const f of g.forts) {
        if (!f.manned || (f.pos.x - this.pos.x) ** 2 + (f.pos.z - this.pos.z) ** 2 > 49) continue;
        this.pounced = true;
        this.hopping = 0.4;
        f.scare(d.pounce);
        break;
      }
    }
  }

  retreat() {
    this.retreating = true;
    this.emerge = Math.min(this.emerge, 1);
  }

  // force: stuns and freezes work even on creatures that can't be slowed.
  applySlow(amt, time, force = false) {
    if ((this.def.slowImmune && !force) || !this.alive) return;
    const now = this.game.time;
    // A weaker slow never cuts short (or stretches) a stronger one.
    if (now < this.slowUntil && amt < this.slowAmt) return;
    if (force) {
      // Stuns and freezes: a short breather afterwards so nothing gets stun-locked, bosses shrug most of it off.
      if (now < (this.stunImmune || 0)) return;
      if (this.def.boss) time *= 0.3;
      this.stunImmune = now + time + 1.2;
    }
    this.slowAmt = amt;
    this.slowUntil = now + time;
  }

  // quiet: continuous damage (beams) — no hit flash, and armour doesn't apply.
  takeDamage(amount, type, fort, quiet = false) {
    if (!this.alive || this.retreating || this.submerged) return;
    const mult = (this.def.resist[type] ?? 1) * (this.game.mods.dmgType[type] || 1);
    let dmg = amount * mult;
    if (fort && fort.weapon.bonusVs) dmg *= fort.weapon.bonusVs[this.key] || 1;
    if (this.def.armor && !quiet) dmg = Math.max(dmg * 0.25, dmg - this.def.armor);
    // Shielded: the bubble soaks damage first. Zaps pop it three times as fast.
    if (this.shield > 0) {
      const pop = type === 'zap' ? 3 : 1;
      const soak = Math.min(this.shield, dmg * pop);
      this.shield -= soak;
      dmg -= soak / pop;
      if (this.shield <= 0) {
        this.game.effects.burst(this.headPos(), 0x8fb8ff, 16, { speed: 5, up: 4, size: 0.14, life: 0.5 });
        this.game.effects.float('POP!', this.headPos(), 'weak');
        this.game.audio.play('pop');
      }
      this.sinceHit = 0;
      if (dmg <= 0) {
        if (!quiet) this.flash = 0.05;
        return;
      }
    }
    this.hp -= dmg;
    this.sinceHit = 0;
    if (quiet) {
      if (this.hp <= 0) this.die(fort);
      return;
    }
    this.flash = 0.07;
    const fx = this.game.effects;
    if (mult >= 1.5 && Math.random() < 0.15) fx.float('WEAK!', this.headPos(), 'weak');
    else if (mult <= 0.4 && Math.random() < 0.12) fx.float('resist', this.headPos(), 'resist');
    if (this.hp <= 0) this.die(fort);
  }

  die(fort) {
    this.alive = false;
    this.done = true;
    const fx = this.game.effects;
    const c = this.root.position.clone();
    c.y += 1.3 * this.size;
    fx.burst(c, this.def.color, this.def.boss ? 40 : 14, { speed: 5 * this.size, up: 6, size: 0.3 * this.size, life: 0.9 });
    fx.burst(c, this.def.glow, this.def.boss ? 20 : 6, { speed: 4, up: 7, size: 0.18, life: 0.7 });
    this.game.golemKilled(this, fort);
    // Brood: bursts into little ones.
    if (this.elite.includes('brood')) {
      for (let i = 0; i < ELITES.brood.brood; i++) {
        const off = (i - 1) * 0.9;
        const g = this.game.spawnGolem(this.key, this.hpScale, this.rewardScale, this.rift, { mini: true });
        g.onSpur = this.onSpur;
        g.dist = Math.max(0, this.dist + off);
        g.lateral = this.lateral + off * 0.6;
        g.emerge = 1;
        g.update(0);
      }
    }
    // Goop splits into gooplets.
    if (this.def.split && !this.mini) {
      for (const off of [-0.8, 0.8]) {
        const g = this.game.spawnGolem(this.def.split, this.hpScale, this.rewardScale, this.rift);
        g.onSpur = this.onSpur;
        g.dist = Math.max(0, this.dist + off);
        g.lateral = this.lateral + off;
        g.emerge = 1;
        g.update(0);
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.root, this.hpGroup);
    this.bodyMat.dispose();
    this.hpMat.dispose();
  }
}
