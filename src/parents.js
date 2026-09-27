import * as THREE from 'three';
import { std, mesh, boxGeo } from './util.js';

const TOPS = [0xc0392b, 0x8e44ad, 0x16a085, 0x2c3e50, 0xd35400, 0x7f8c8d, 0xe84393];
const PANTS = [0x2c3e50, 0x34495e, 0x5d4037, 0x1e272e];
const SKIN = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIR = [0x3b2a1a, 0x111111, 0x8a5a2b, 0xc9a86b, 0x9a9a9a];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// A mum or dad at the front gate, waving an arm and yelling.
export class Parent {
  constructor(game, pos, line, life = Infinity) {
    this.game = game;
    this.t = 0;
    this.life = life;
    this.done = false;
    const root = new THREE.Group();
    const skin = std(pick(SKIN));
    const top = std(pick(TOPS));
    const pants = std(pick(PANTS));
    const hair = std(pick(HAIR));
    for (const s of [-1, 1]) mesh(boxGeo(0.2, 0.8, 0.22), pants, s * 0.13, 0.4, 0, root);
    mesh(boxGeo(0.56, 0.7, 0.32), top, 0, 1.15, 0, root);
    mesh(new THREE.SphereGeometry(0.21, 12, 10), skin, 0, 1.72, 0, root);
    mesh(boxGeo(0.44, 0.2, 0.44), hair, 0, 1.86, -0.03, root);
    // Hand on hip
    const hip = mesh(boxGeo(0.14, 0.55, 0.16), top, -0.36, 1.1, 0, root);
    hip.rotation.z = -0.5;
    // Waving arm
    this.arm = new THREE.Group();
    this.arm.position.set(0.34, 1.45, 0);
    mesh(boxGeo(0.14, 0.62, 0.16), top, 0, 0.3, 0, this.arm);
    mesh(boxGeo(0.12, 0.14, 0.12), skin, 0, 0.66, 0, this.arm);
    root.add(this.arm);
    root.position.copy(pos);
    root.rotation.y = Math.atan2(-pos.x, -pos.z);
    root.scale.setScalar(1.2);
    this.root = root;
    game.scene.add(root);

    this.el = document.createElement('div');
    this.el.className = 'bubble';
    this.el.textContent = line;
    document.getElementById('floaters').appendChild(this.el);
    this.v = new THREE.Vector3();
  }

  update(dt) {
    this.t += dt;
    this.arm.rotation.z = -0.4 + Math.sin(this.t * 10) * 0.35;
    if (this.t > this.life) this.dispose();
  }

  // Runs every frame (even paused) so the speech bubble tracks the camera.
  place() {
    const cam = this.game.camera;
    this.v.copy(this.root.position);
    this.v.y += 3;
    this.v.project(cam);
    if (this.v.z > 1) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = '';
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    this.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    this.game.scene.remove(this.root);
    this.el.remove();
  }
}
