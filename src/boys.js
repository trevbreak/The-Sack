import * as THREE from 'three';
import { mulberry32, hashStr, std, mesh, boxGeo } from './util.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xf4f4f4, 0x34495e, 0xff6fa8];
const SHORTS = [0x2c3e50, 0x3b5998, 0x6b4f2a, 0x444444, 0x1f6f4a, 0x7a2a2a];
const SKIN = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xd9a47a];
const CAPS = [0xd8342c, 0x1f4e9c, 0x111111, 0xf4f4f4, 0x2e8b57, 0xffb000];

const headGeo = new THREE.SphereGeometry(0.2, 12, 10);
const capGeo = new THREE.SphereGeometry(0.212, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const eyeMat = std(0x111111);
const shoeMat = std(0x222222);

export class Boy {
  constructor(game, id, name, trait, slot) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.trait = trait;
    this.slot = slot;
    this.fort = null;
    this.state = 'idle';
    this.route = [];
    this.task = null;
    this.onChore = false;
    this.away = null; // 'grounded' (home all day) or 'late' (out later this arvo)
    this.choreT = 0;
    this.home = new THREE.Vector3();
    this.phase = Math.random() * 6;
    this.speed = 7.5;
    const rnd = mulberry32(hashStr(name) + id * 31);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    this.colors = { shirt: pick(SHIRTS), shorts: pick(SHORTS), skin: pick(SKIN), cap: pick(CAPS), backwards: rnd() < 0.5 };
    this.shirtCss = '#' + this.colors.shirt.toString(16).padStart(6, '0');
    this.build();
    game.scene.add(this.mesh);
  }

  build() {
    const c = this.colors;
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const skin = std(c.skin);
    const shirt = std(c.shirt);
    const shorts = std(c.shorts);
    const cap = std(c.cap);
    const L = { body };
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.12, 0.55, 0);
      mesh(boxGeo(0.16, 0.3, 0.18), shorts, 0, -0.15, 0, leg);
      mesh(boxGeo(0.12, 0.24, 0.13), skin, 0, -0.4, 0, leg);
      mesh(boxGeo(0.15, 0.08, 0.25), shoeMat, 0, -0.52, 0.03, leg);
      body.add(leg);
      L[s < 0 ? 'legL' : 'legR'] = leg;

      const arm = new THREE.Group();
      arm.position.set(s * 0.29, 0.98, 0);
      mesh(boxGeo(0.13, 0.18, 0.15), shirt, 0, -0.09, 0, arm);
      mesh(boxGeo(0.1, 0.27, 0.11), skin, 0, -0.3, 0, arm);
      body.add(arm);
      L[s < 0 ? 'armL' : 'armR'] = arm;
    }
    mesh(boxGeo(0.46, 0.46, 0.28), shirt, 0, 0.78, 0, body);
    mesh(headGeo, skin, 0, 1.22, 0, body);
    mesh(capGeo, cap, 0, 1.25, 0, body);
    mesh(boxGeo(0.26, 0.03, 0.2), cap, 0, 1.27, c.backwards ? -0.26 : 0.26, body);
    for (const s of [-1, 1]) mesh(boxGeo(0.04, 0.05, 0.02), eyeMat, s * 0.075, 1.22, 0.195, body);
    root.scale.setScalar(1.1);
    this.mesh = root;
    this.limbs = L;
  }

  hangoutPos() {
    const h = this.game.world.hangout;
    const a = this.slot * 2.39996;
    const r = 1.2 + Math.sqrt(this.slot) * 1.3;
    return new THREE.Vector3(h.x + Math.cos(a) * r, 0, h.z + Math.sin(a) * r);
  }

  placeAtHangout() {
    this.mesh.position.copy(this.hangoutPos());
  }

  // Climb down off a fort (if on one) back into the world.
  detach() {
    if (this.mesh.parent !== this.game.scene) this.game.scene.attach(this.mesh);
    this.mesh.position.y = 0;
    this.mesh.rotation.set(0, this.mesh.rotation.y, 0);
    this.mesh.visible = true;
  }

  walkTo(dest, task) {
    this.task = task;
    this.state = 'walking';
    this.route = this.game.world.route(this.mesh.position.clone(), dest);
  }

  goTo(fort) {
    this.detach();
    this.fort = fort;
    this.onChore = false;
    this.walkTo(fort.pos.clone().setY(0), 'fort');
    // Stop at the foot of the ladder rather than inside the fort.
    const route = this.route;
    const last = route[route.length - 1];
    const prev = route.length > 1 ? route[route.length - 2] : this.mesh.position;
    const dir = new THREE.Vector3().subVectors(last, prev).setY(0);
    if (dir.lengthSq() > 0.01) last.addScaledVector(dir.normalize(), -1.7);
  }

  goHome() {
    this.detach();
    this.fort = null;
    this.onChore = false;
    this.walkTo(this.hangoutPos(), 'hangout');
  }

  walkFrom(pos) {
    this.mesh.position.copy(pos);
    this.walkTo(this.hangoutPos(), 'hangout');
  }

  // A parent called him in for chores. He keeps his fort, but leaves it for a bit.
  callForChore(time) {
    this.detach();
    this.onChore = true;
    this.choreT = time;
    this.walkTo(this.home, 'chore');
  }

  // Dinner time: everyone walks home and goes inside.
  goToBed() {
    this.detach();
    this.onChore = false;
    this.walkTo(this.home, 'bed');
  }

  // Next morning: out the front door and back to his fort (or the sack).
  wakeUp() {
    this.mesh.visible = true;
    this.mesh.position.copy(this.home);
    this.state = 'idle';
    if (this.fort) this.goTo(this.fort);
    else this.walkTo(this.hangoutPos(), 'hangout');
  }

  // Parents kept him in this morning. He stays hidden at home.
  stayHome(kind) {
    this.detach();
    this.away = kind;
    this.state = 'asleep';
    this.route = [];
    this.mesh.visible = false;
    this.mesh.position.copy(this.home);
  }

  comeOut() {
    this.away = null;
    this.wakeUp();
  }

  get asleep() {
    return this.state === 'asleep';
  }

  arrive() {
    switch (this.task) {
      case 'fort':
        this.state = 'manning';
        this.fort.pivot.add(this.mesh);
        this.mesh.position.set(...this.fort.seatFor(this));
        this.mesh.rotation.set(0, 0, 0);
        this.game.audio.play('click');
        this.game.effects.burst(this.fort.pos.clone().setY(this.fort.height + 0.5), 0xfff2c0, 6, { speed: 2, up: 3, size: 0.12 });
        break;
      case 'chore':
        this.state = 'inside';
        this.mesh.visible = false;
        break;
      case 'bed':
        this.state = 'asleep';
        this.mesh.visible = false;
        break;
      default:
        this.state = 'idle';
    }
  }

  update(dt) {
    const L = this.limbs;
    const p = this.mesh.position;
    if (this.state === 'walking') {
      const t = this.route[0];
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        p.x = t.x;
        p.z = t.z;
        this.route.shift();
        if (!this.route.length) this.arrive();
      } else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        this.mesh.rotation.y = Math.atan2(dx, dz);
      }
      this.phase += dt * 14;
      const s = Math.sin(this.phase);
      L.legL.rotation.x = s * 0.8;
      L.legR.rotation.x = -s * 0.8;
      L.armL.rotation.x = -s * 0.7;
      L.armR.rotation.x = s * 0.7;
      L.body.position.y = Math.abs(Math.cos(this.phase)) * 0.08;
    } else if (this.state === 'inside') {
      this.choreT -= dt;
      if (this.choreT <= 0) {
        this.onChore = false;
        this.mesh.visible = true;
        if (this.fort) this.goTo(this.fort);
        else this.goHome();
      }
    } else if (this.state === 'asleep') {
      // Zzz
    } else if (this.state === 'manning') {
      const k = this.fort ? this.fort.kick : 0;
      L.legL.rotation.x = L.legR.rotation.x = 0;
      L.armL.rotation.x = -1.3 + k * 0.4;
      L.armR.rotation.x = -1.1 - k * 0.6;
      L.body.position.y = k * 0.05;
    } else {
      this.phase += dt * 3;
      L.legL.rotation.x = L.legR.rotation.x = 0;
      L.armL.rotation.x = Math.sin(this.phase) * 0.1;
      L.armR.rotation.x = -Math.sin(this.phase) * 0.1;
      L.body.position.y = Math.max(0, Math.sin(this.phase + this.slot)) * 0.06;
      const h = this.game.world.hangout;
      this.mesh.rotation.y = Math.atan2(h.x - p.x, h.z - p.z);
    }
  }
}
