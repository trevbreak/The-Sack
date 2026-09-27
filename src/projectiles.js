import * as THREE from 'three';
import { std } from './util.js';

const rocketBody = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6);
rocketBody.rotateX(Math.PI / 2);
const rocketTip = new THREE.ConeGeometry(0.08, 0.18, 6);
rocketTip.rotateX(Math.PI / 2);
rocketTip.translate(0, 0, 0.3);
const dartBody = new THREE.CylinderGeometry(0.05, 0.05, 0.32, 6);
dartBody.rotateX(Math.PI / 2);
const dartTip = new THREE.SphereGeometry(0.06, 6, 4);
dartTip.translate(0, 0, 0.17);

const PG = {
  rock: new THREE.DodecahedronGeometry(0.17, 0),
  balloon: new THREE.SphereGeometry(0.3, 12, 10),
  salt: new THREE.IcosahedronGeometry(0.3, 0),
};
const PM = {
  rock: std(0x8a7a66),
  balloon: std(0x3fa9ff, { roughness: 0.25, flatShading: false }),
  rocket: std(0xd8342c),
  tip: std(0xffd02e),
  dart: new THREE.MeshBasicMaterial({ color: 0x2a7fd4 }),
  dartTip: new THREE.MeshBasicMaterial({ color: 0xff8c1a }),
  salt: std(0xf6f6f0),
};

function makeMesh(kind) {
  switch (kind) {
    case 'slingshot':
      return new THREE.Mesh(PG.rock, PM.rock);
    case 'balloon':
      return new THREE.Mesh(PG.balloon, PM.balloon);
    case 'salt':
      return new THREE.Mesh(PG.salt, PM.salt);
    case 'rocket': {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(rocketBody, PM.rocket), new THREE.Mesh(rocketTip, PM.tip));
      return g;
    }
    default: {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(dartBody, PM.dart), new THREE.Mesh(dartTip, PM.dartTip));
      return g;
    }
  }
}

const tmp = new THREE.Vector3();

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  fire(fort, target, from, st) {
    const w = fort.weapon;
    const m = makeMesh(w.key);
    m.position.copy(from);
    this.game.scene.add(m);
    const p = {
      kind: w.key,
      mesh: m,
      target,
      aim: target.aimPoint(),
      speed: w.projSpeed,
      damage: st.damage,
      dmgType: w.dmgType,
      splash: (w.splash || 0) * this.game.mods.splash,
      slow: w.slow || 0,
      slowTime: w.slowTime || 0,
      hitSlow: w.hitSlow || 0,
      freeze: w.freeze || 0,
      fort,
      t: 0,
      smoke: 0,
    };
    if (w.arc) {
      const dist = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
      const T = Math.max(0.5, dist / w.projSpeed);
      p.arc = true;
      p.start = from.clone();
      p.end = target.predict(target.curSpeed * T, new THREE.Vector3()).setY(0.3);
      p.dur = T;
      p.arcH = 2.5 + dist * 0.25;
    }
    this.list.push(p);
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      let done = false;
      if (p.arc) {
        const s = Math.min(1, p.t / p.dur);
        p.mesh.position.lerpVectors(p.start, p.end, s);
        p.mesh.position.y += p.arcH * 4 * s * (1 - s);
        p.mesh.rotation.x += dt * 6;
        if (s >= 1) {
          this.impact(p, p.end);
          done = true;
        }
      } else {
        if (p.target && p.target.targetable) p.target.aimPoint(p.aim);
        else p.target = null;
        tmp.subVectors(p.aim, p.mesh.position);
        const len = tmp.length();
        const step = p.speed * dt;
        if (len <= step + 0.35) {
          p.mesh.position.copy(p.aim);
          this.impact(p, p.aim);
          done = true;
        } else {
          p.mesh.position.addScaledVector(tmp, step / len);
          p.mesh.lookAt(p.aim);
          if (p.kind === 'slingshot') p.mesh.rotation.x += p.t * 20;
        }
        if (p.kind === 'rocket') {
          p.smoke -= dt;
          if (p.smoke <= 0) {
            p.smoke = 0.03;
            this.game.effects.burst(p.mesh.position, 0xd9d4cc, 1, { speed: 0.4, up: 0.6, life: 0.45, size: 0.16, gravity: -1 });
          }
        }
        if (p.t > 4) done = true;
      }
      if (done) {
        this.game.scene.remove(p.mesh);
        this.list.splice(i, 1);
      }
    }
  }

  impact(p, at) {
    const game = this.game;
    const fx = game.effects;
    if (p.splash > 0) {
      for (const g of game.golems) {
        if (!g.targetable) continue;
        // Lobbed shots land on the ground: they can't splash fliers.
        if (p.arc && g.def.flying) continue;
        const d = Math.hypot(g.pos.x - at.x, g.pos.z - at.z);
        const r = p.splash + g.size * 0.4;
        if (d <= r) {
          g.takeDamage(p.damage * (d < r * 0.4 ? 1 : 0.6), p.dmgType, p.fort);
          if (p.slow) g.applySlow(p.slow, p.slowTime);
          if (p.freeze) g.applySlow(1, p.freeze, true);
        }
      }
      if (p.kind === 'balloon') {
        fx.burst(at, 0x6cc4ff, 16, { speed: 5, up: 4, size: 0.16, life: 0.6 });
        fx.ring(at, 0x6cc4ff, p.splash);
        game.audio.play('splash');
      } else if (p.kind === 'salt') {
        fx.burst(at, 0xffffff, 20, { speed: 5, up: 5, size: 0.14, life: 0.7 });
        fx.ring(at, 0xf0f0e6, p.splash);
        game.audio.play('splash');
      } else {
        fx.burst(at, 0xffb13d, 12, { speed: 6, up: 6, size: 0.2, life: 0.55 });
        fx.burst(at, 0xff4a2a, 8, { speed: 4, up: 8, size: 0.14, life: 0.7 });
        fx.burst(at, 0x5ee0ff, 5, { speed: 5, up: 9, size: 0.1, life: 0.8 });
        fx.ring(at, 0xffb13d, p.splash);
        game.audio.play('boom');
      }
    } else if (p.target && p.target.targetable) {
      p.target.takeDamage(p.damage, p.dmgType, p.fort);
      if (p.hitSlow) p.target.applySlow(p.hitSlow, p.slowTime);
      fx.burst(at, p.kind === 'dart' ? 0xff8c1a : 0x9a8a76, p.kind === 'dart' ? 1 : 3, { speed: 2, up: 2, size: 0.1, life: 0.3 });
      game.audio.play('hit');
    }
  }
}
