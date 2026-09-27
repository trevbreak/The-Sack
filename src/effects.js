import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const RING = new THREE.RingGeometry(0.85, 1, 40);
const MAX_PARTS = 700;

export class Effects {
  constructor(game) {
    this.game = game;
    this.parts = [];
    this.pool = [];
    this.mats = new Map();
    this.rings = [];
    this.bolts = [];
    this.floaters = [];
    this.root = document.getElementById('floaters');
    this.v = new THREE.Vector3();
  }

  mat(color) {
    if (!this.mats.has(color)) this.mats.set(color, new THREE.MeshBasicMaterial({ color }));
    return this.mats.get(color);
  }

  burst(pos, color, count = 8, o = {}) {
    for (let i = 0; i < count && this.parts.length < MAX_PARTS; i++) {
      const m = this.pool.pop() || new THREE.Mesh(BOX);
      m.material = this.mat(color);
      m.position.copy(pos);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const sp = (o.speed ?? 4) * (0.4 + Math.random() * 0.8);
      const a = Math.random() * Math.PI * 2;
      const size = (o.size ?? 0.18) * (0.6 + Math.random() * 0.8);
      const life = (o.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      m.scale.setScalar(size);
      this.game.scene.add(m);
      this.parts.push({
        m, size, life, max: life,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: (o.up ?? 4) * (0.5 + Math.random() * 0.8),
        g: o.gravity ?? 14,
      });
    }
  }

  ring(pos, color, radius = 3, life = 0.45) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(RING, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.15, pos.z);
    this.game.scene.add(m);
    this.rings.push({ m, t: 0, life, radius });
  }

  // A jagged lightning bolt through a list of points.
  bolt(pts, color, life = 0.16) {
    for (let k = 0; k < 2; k++) {
      const verts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        for (let j = 0; j <= 5; j++) {
          const t = j / 5;
          const jit = j === 0 || j === 5 ? 0 : 0.35;
          verts.push(
            a.x + (b.x - a.x) * t + (Math.random() - 0.5) * jit,
            a.y + (b.y - a.y) * t + (Math.random() - 0.5) * jit,
            a.z + (b.z - a.z) * t + (Math.random() - 0.5) * jit,
          );
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: k ? 0xffffff : color, transparent: true }));
      line.renderOrder = 20;
      this.game.scene.add(line);
      this.bolts.push({ line, t: 0, life });
    }
  }

  float(text, pos, cls = '') {
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    this.root.appendChild(el);
    this.floaters.push({ el, pos: pos.clone(), t: 0, life: 1.1 });
    if (this.floaters.length > 40) this.floaters.shift().el.remove();
  }

  update(dt, raw) {
    const scene = this.game.scene;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.m);
        this.pool.push(p.m);
        this.parts.splice(i, 1);
        continue;
      }
      p.vy -= p.g * dt;
      const m = p.m;
      m.position.x += p.vx * dt;
      m.position.y += p.vy * dt;
      m.position.z += p.vz * dt;
      if (m.position.y < 0.05) {
        m.position.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      m.rotation.x += dt * 5;
      m.scale.setScalar(p.size * Math.sqrt(p.life / p.max));
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const s = r.t / r.life;
      if (s >= 1) {
        scene.remove(r.m);
        r.m.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      r.m.scale.setScalar(0.3 + s * r.radius);
      r.m.material.opacity = 0.8 * (1 - s);
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += raw;
      b.line.material.opacity = 1 - b.t / b.life;
      if (b.t >= b.life) {
        scene.remove(b.line);
        b.line.geometry.dispose();
        b.line.material.dispose();
        this.bolts.splice(i, 1);
      }
    }

    const cam = this.game.camera;
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += raw;
      if (f.t >= f.life) {
        f.el.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      this.v.copy(f.pos);
      this.v.y += f.t * 1.6;
      this.v.project(cam);
      if (this.v.z > 1) {
        f.el.style.display = 'none';
        continue;
      }
      f.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * W;
      const y = (-this.v.y * 0.5 + 0.5) * H;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(1 - Math.max(0, (f.t / f.life - 0.6) / 0.4));
    }
  }
}
