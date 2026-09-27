import * as THREE from 'three';

// Bodies for the non-golem creatures. Each builder fills `body` (a Group that
// bobs) and returns the parts the walk animation swings: legL/legR/armL/armR
// (for four-legged creatures, arms are the front legs), plus any extras.

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ball: new THREE.SphereGeometry(1, 12, 10),
  ico: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
};

function part(geo, mat, parent, [x, y, z], [sx, sy, sz], rot = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}

// A leg that hangs from a pivot so it can swing.
function leg(mat, parent, [x, y, z], [w, h, d]) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  part(G.box, mat, p, [0, -h / 2, 0], [w, h, d]);
  parent.add(p);
  return p;
}

// 🦁 A winged lion. Faces +z.
function lion(body, M) {
  part(G.box, M.body, body, [0, 1.3, 0], [0.9, 0.8, 1.7]);
  part(G.box, M.body, body, [0, 1.65, 1.05], [0.7, 0.65, 0.6]);
  part(G.ico, M.extra, body, [0, 1.7, 0.85], [0.75, 0.75, 0.55]);
  part(G.box, M.body, body, [0, 1.5, 1.45], [0.35, 0.28, 0.3]);
  for (const s of [-1, 1]) part(G.box, M.glow, body, [s * 0.17, 1.78, 1.36], [0.1, 0.07, 0.04]);
  const tail = part(G.box, M.body, body, [0, 1.55, -1.2], [0.1, 0.1, 0.8], [0.6, 0, 0]);
  part(G.ico, M.extra, tail, [0, 0, -0.5], [1.8, 1.8, 0.4]);
  const parts = {
    armL: leg(M.body, body, [-0.3, 1.0, 0.6], [0.24, 0.9, 0.26]),
    armR: leg(M.body, body, [0.3, 1.0, 0.6], [0.24, 0.9, 0.26]),
    legL: leg(M.body, body, [-0.3, 1.0, -0.6], [0.26, 0.9, 0.28]),
    legR: leg(M.body, body, [0.3, 1.0, -0.6], [0.26, 0.9, 0.28]),
  };
  parts.wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.45, 1.6, 0.2);
    part(G.box, M.wing, w, [s * 0.9, 0, 0], [1.8, 0.06, 0.9]);
    part(G.box, M.wing, w, [s * 1.9, 0, -0.25], [0.8, 0.05, 0.6]);
    w.userData.side = s;
    body.add(w);
    return w;
  });
  return parts;
}

// 🕷️ A giant huntsman spider. Faces +z.
function spider(body, M) {
  part(G.ball, M.body, body, [0, 0.9, 0.35], [0.45, 0.35, 0.5]);
  part(G.ball, M.body, body, [0, 1.05, -0.55], [0.6, 0.5, 0.7]);
  for (const [x, y] of [[-0.12, 1.02], [0.12, 1.02], [-0.22, 0.96], [0.22, 0.96]]) part(G.ball, M.glow, body, [x, y, 0.8], [0.06, 0.06, 0.06]);
  // Eight legs: two long boxes each, knees up.
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Group();
      p.position.set(s * 0.35, 0.95, 0.6 - i * 0.35);
      p.rotation.y = s * (0.5 - i * 0.35);
      part(G.box, M.body, p, [s * 0.45, 0.25, 0], [0.9, 0.08, 0.08], [0, 0, s * 0.55]);
      part(G.box, M.body, p, [s * 1.05, -0.35, 0], [0.08, 1.0, 0.08], [0, 0, -s * 0.35]);
      body.add(p);
      legs.push(p);
    }
  }
  return { legs };
}

// 🐨 A drop bear: a koala gone very wrong. Faces +z.
function dropBear(body, M) {
  part(G.ball, M.body, body, [0, 1.1, 0], [0.62, 0.72, 0.55]);
  part(G.ball, M.extra, body, [0, 1.0, 0.3], [0.4, 0.5, 0.3]);
  part(G.ball, M.body, body, [0, 1.95, 0.05], [0.5, 0.45, 0.45]);
  for (const s of [-1, 1]) {
    part(G.ball, M.body, body, [s * 0.5, 2.25, 0], [0.28, 0.28, 0.1]);
    part(G.ball, M.extra, body, [s * 0.5, 2.25, 0.04], [0.18, 0.18, 0.08]);
    part(G.ball, M.glow, body, [s * 0.17, 2.02, 0.42], [0.07, 0.07, 0.05]);
    part(G.cone, M.fang, body, [s * 0.07, 1.68, 0.44], [0.04, 0.14, 0.04], [Math.PI, 0, 0]);
  }
  part(G.ball, M.nose, body, [0, 1.85, 0.48], [0.13, 0.17, 0.1]);
  return {
    armL: leg(M.body, body, [-0.55, 1.5, 0.1], [0.22, 0.75, 0.24]),
    armR: leg(M.body, body, [0.55, 1.5, 0.1], [0.22, 0.75, 0.24]),
    legL: leg(M.body, body, [-0.28, 0.6, 0], [0.26, 0.6, 0.3]),
    legR: leg(M.body, body, [0.28, 0.6, 0], [0.26, 0.6, 0.3]),
  };
}

// 🐊 A bunyip: a tusked swamp monster from the creek. Faces +z.
function bunyip(body, M) {
  part(G.ball, M.body, body, [0, 0.95, -0.2], [0.8, 0.65, 1.3]);
  part(G.box, M.body, body, [0, 1.15, 1.15], [0.7, 0.5, 0.8]);
  part(G.box, M.extra, body, [0, 0.9, 1.2], [0.6, 0.18, 0.75]);
  for (const s of [-1, 1]) {
    part(G.cone, M.fang, body, [s * 0.25, 0.75, 1.5], [0.07, 0.35, 0.07], [Math.PI, 0, 0]);
    part(G.ball, M.glow, body, [s * 0.22, 1.42, 1.35], [0.08, 0.08, 0.06]);
  }
  for (let i = 0; i < 4; i++) part(G.cone, M.extra, body, [0, 1.6 - i * 0.05, 0.5 - i * 0.5], [0.12, 0.4, 0.12]);
  part(G.box, M.body, body, [0, 0.8, -1.7], [0.25, 0.2, 1.0], [0.3, 0, 0]);
  return {
    armL: leg(M.body, body, [-0.55, 0.7, 0.6], [0.3, 0.6, 0.35]),
    armR: leg(M.body, body, [0.55, 0.7, 0.6], [0.3, 0.6, 0.35]),
    legL: leg(M.body, body, [-0.55, 0.7, -0.8], [0.32, 0.6, 0.38]),
    legR: leg(M.body, body, [0.55, 0.7, -0.8], [0.32, 0.6, 0.38]),
  };
}

export const BODIES = { lion, spider, dropBear, bunyip };

// Extra materials some bodies need beyond body/glow/extra.
export const extraMats = {
  wing: new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }),
  fang: new THREE.MeshStandardMaterial({ color: 0xfffbe8, roughness: 0.4 }),
  nose: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.3 }),
};
