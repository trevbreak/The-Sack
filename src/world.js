import * as THREE from 'three';
import { mulberry32, std, mesh, boxGeo, cylGeo, canvasTexture } from './util.js';
import { allTrailCurves, RIFTS, spurPath } from './path.js';

// Houses sit in a ring around the sack, angle 0 = north (-z).
export const RING_HOUSES = [-140, -100, -60, -20, 20, 105, 145];
const HOUSE_R = 24;

const WALLS = [0xf1e3c8, 0xd9a58a, 0xc8d8e0, 0xe8d6a8, 0xbfcfb0, 0xf0c8b8, 0xd8d0e8, 0xe6d2b5, 0xcfd6c4, 0xf2d9a0, 0xd4b8a8];
const ROOFS = [0x7a3b2e, 0x4a4f57, 0x8c5a3c, 0x3f5a6b, 0x6b3a3a, 0x555555, 0x7d6b5a];
const DOORS = [0x8b2d2d, 0x2d4f8b, 0x2f6b3f, 0x5a3a1e, 0xd9a520];
const CARS = [0xc0392b, 0xf2f2f2, 0x2c3e50, 0x2e86c1, 0xd4ac0d, 0x7f8c8d];

const asphalt = std(0x3d4046, { roughness: 0.95, flatShading: false });
const concrete = std(0xcfc9bc, { flatShading: false });
const kerb = std(0xe6e1d6, { flatShading: false });
const fenceMat = std(0x5d6657);
const trim = std(0xf5f2ea);
const glass = std(0x8fb8cc, { roughness: 0.2, metalness: 0.1, emissive: 0x16242c });
const dark = std(0x2a2a2a);

export function buildWorld(scene, path) {
  const world = {
    blockers: [], // circles forts can't be built on
    houseCircles: [], // circles boys walk around
    gaps: [], // points between houses the boys use to get out the back
    doors: [],
    hangout: new THREE.Vector3(-6, 0, 7),
    animated: [],
    houses: [],
    glass,
    scene,
  };

  world.sky = addSky(scene);
  addGround(scene);
  addStreet(scene, world);

  RING_HOUSES.forEach((deg, i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const x = Math.sin(a) * HOUSE_R;
    const z = -Math.cos(a) * HOUSE_R;
    addHouse(scene, world, x, z, Math.atan2(-x, -z), i, 5.8, true);
  });
  [[14, 40, -1], [-14, 40, 1], [14, 62, -1], [-14, 62, 1]].forEach(([x, z, s], i) =>
    addHouse(scene, world, x, z, (s * Math.PI) / 2, i + 7, 4.3, false),
  );

  const angs = [...RING_HOUSES, RING_HOUSES[0] + 360];
  for (let i = 0; i < RING_HOUSES.length; i++) {
    const a = THREE.MathUtils.degToRad((angs[i] + angs[i + 1]) / 2);
    world.gaps.push(new THREE.Vector3(Math.sin(a) * 28, 0, -Math.cos(a) * 28));
  }

  world.trail = addTrail(scene, path);
  world.setTrail = (p) => {
    scene.remove(world.trail);
    disposeTree(world.trail);
    world.trail = addTrail(scene, p);
  };
  world.previewTrail = (p) => {
    if (world.preview) {
      scene.remove(world.preview);
      disposeTree(world.preview);
      world.preview = null;
    }
    if (!p) return;
    const pts = p.curve.getSpacedPoints(Math.round(p.length * 1.5));
    world.preview = new THREE.Group();
    ribbon(pts, 0, 2.1, 0.12, previewMat, world.preview);
    scene.add(world.preview);
  };
  addTrees(scene, world, allTrailCurves());
  // Rifts: the first is open, the rest sit dormant in the bush until their week comes.
  world.rifts = RIFTS.map((r, i) => {
    const sp = spurPath(r);
    const from = sp ? sp.curve.getPointAt(0) : path.curve.getPointAt(0);
    const next = sp ? sp.curve.getPointAt(0.05) : path.curve.getPointAt(0.02);
    return addRift(scene, world, from, next, i > 0);
  });
  world.spurs = [];
  world.addSpur = (sp) => world.spurs.push(addTrail(scene, sp));
  addTrailSign(scene, world);
  addHangout(scene, world);

  world.route = (a, b) => route(world, a, b);
  world.setDamage = buildDamage(world);
  return world;
}

// ---------- routing for the boys ----------
function segBlocked(world, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz || 1;
  for (const c of world.houseCircles) {
    let t = ((c.x - a.x) * abx + (c.z - a.z) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t - c.x;
    const pz = a.z + abz * t - c.z;
    if (px * px + pz * pz < c.r * c.r) return true;
  }
  return false;
}

function route(world, a, b) {
  if (!segBlocked(world, a, b)) return [b.clone()];
  let best = null;
  let bestD = Infinity;
  for (const g of world.gaps) {
    const penalty = segBlocked(world, a, g) || segBlocked(world, g, b) ? 1000 : 0;
    const d = a.distanceTo(g) + g.distanceTo(b) + penalty;
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return [best.clone(), b.clone()];
}

// ---------- sky / ground ----------
function addSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f86d8) },
      mid: { value: new THREE.Color(0x9cc8ec) },
      bottom: { value: new THREE.Color(0xffd7a3) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = normalize(vP).y;
        vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.6, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.renderOrder = -1;
  scene.add(sky);
  return mat.uniforms;
}

function addGround(scene) {
  const g = new THREE.PlaneGeometry(340, 340, 90, 90);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = [];
  const rnd = mulberry32(7);
  const lush = new THREE.Color(0x6aa545);
  const dry = new THREE.Color(0x8f9352);
  const shade = new THREE.Color(0x55733a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const t = THREE.MathUtils.smoothstep(r, 30, 46);
    c.copy(lush).lerp(dry, t).lerp(shade, rnd() * 0.35);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---------- street ----------
function flat(geo, mat, x, y, z, scene) {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function addStreet(scene, world) {
  flat(new THREE.CircleGeometry(12.5, 64), asphalt, 0, 0.03, 0, scene);
  flat(new THREE.PlaneGeometry(8, 160), asphalt, 0, 0.03, 80, scene);
  flat(new THREE.RingGeometry(12.5, 14.8, 64), concrete, 0, 0.02, 0, scene);
  flat(new THREE.RingGeometry(12.5, 12.85, 64), kerb, 0, 0.045, 0, scene);
  for (const s of [-1, 1]) {
    flat(new THREE.PlaneGeometry(2.4, 150), concrete, s * 5.3, 0.02, 88, scene);
    mesh(boxGeo(0.3, 0.08, 150), kerb, s * 4.1, 0.04, 88, scene);
  }
  // Dashed centre line down the road.
  const lineMat = std(0xf2f0e6, { flatShading: false });
  for (let z = 18; z < 160; z += 6) flat(new THREE.PlaneGeometry(0.2, 2.6), lineMat, 0, 0.04, z, scene);

  // Street name sign.
  const tex = canvasTexture(512, 128, (x, w, h) => {
    x.fillStyle = '#1f6b3a';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#fff';
    x.lineWidth = 8;
    x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#fff';
    x.font = '900 70px Nunito, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('WATTLE CT', w / 2, h / 2 + 4);
  });
  const sign = new THREE.Group();
  mesh(cylGeo(0.06, 0.06, 3, 6), std(0x9aa0a6, { metalness: 0.5 }), 0, 1.5, 0, sign);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  plate.position.set(0, 2.8, 0);
  plate.rotation.y = Math.PI / 2;
  sign.add(plate);
  sign.position.set(6.8, 0, 17);
  scene.add(sign);
}

// ---------- houses ----------
function addHouse(scene, world, x, z, yaw, idx, driveLen, ring) {
  const rnd = mulberry32(idx * 101 + 5);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const wall = std(WALLS[idx % WALLS.length]);
  const roofM = std(ROOFS[idx % ROOFS.length]);
  const house = { group: g, windows: [], fences: [] };

  mesh(boxGeo(8, 3.2, 7), wall, 0, 1.6, 0, g);
  const roof = mesh(new THREE.ConeGeometry(6.3, 2.4, 4, 1), roofM, 0, 4.4, 0, g);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.92);
  // Garage
  mesh(boxGeo(3.8, 2.7, 5.2), wall, 5.9, 1.35, 0.9, g);
  mesh(boxGeo(4.2, 0.22, 5.6), roofM, 5.9, 2.8, 0.9, g);
  mesh(boxGeo(3.1, 2.1, 0.06), trim, 5.9, 1.05, 3.52, g);
  // Front door, windows (front and back)
  house.door = mesh(boxGeo(1, 2.1, 0.08), std(DOORS[idx % DOORS.length]), -1.2, 1.05, 3.52, g);
  for (const wx of [-3, 1.6]) {
    house.windows.push(mesh(boxGeo(1.7, 1.1, 0.08), glass, wx, 1.9, 3.52, g));
    mesh(boxGeo(1.9, 0.12, 0.14), trim, wx, 1.3, 3.55, g);
    mesh(boxGeo(1.7, 1.1, 0.08), glass, wx, 1.9, -3.52, g);
  }
  // Driveway and front path
  mesh(boxGeo(3.4, 0.04, driveLen), concrete, 5.9, 0.02, 3.5 + driveLen / 2, g);
  mesh(boxGeo(1.1, 0.04, driveLen), concrete, -1.2, 0.02, 3.5 + driveLen / 2, g);
  // Letterbox
  const lb = new THREE.Group();
  lb.position.set(-3, 0, 3.5 + driveLen - 0.6);
  mesh(boxGeo(0.1, 0.9, 0.1), dark, 0, 0.45, 0, lb);
  mesh(boxGeo(0.45, 0.35, 0.55), std(DOORS[(idx + 2) % DOORS.length]), 0, 1.05, 0, lb);
  g.add(lb);
  house.letterbox = lb;

  if (rnd() < 0.6) addCar(g, 5.9, 3.5 + driveLen * 0.55, CARS[idx % CARS.length]);

  const localBlockers = [
    [0, 0, 5.3],
    [5.9, 0.9, 3.2],
  ];

  if (ring) {
    // Colorbond back fence
    house.fences.push(mesh(boxGeo(13.6, 1.8, 0.08), fenceMat, 0.9, 0.9, -10.5, g));
    house.fences.push(mesh(boxGeo(0.08, 1.8, 7), fenceMat, -5.9, 0.9, -7, g));
    house.fences.push(mesh(boxGeo(0.08, 1.8, 7), fenceMat, 7.7, 0.9, -7, g));
    world.houses.push(house);
    for (let fx = -5.9; fx <= 7.7; fx += 1.5) localBlockers.push([fx, -10.5, 0.6]);
    for (let fz = -4; fz >= -10.5; fz -= 1.5) {
      localBlockers.push([-5.9, fz, 0.6]);
      localBlockers.push([7.7, fz, 0.6]);
    }
    // A backyard prop
    const r = rnd();
    if (r < 0.34) {
      addTrampoline(g, 0.5, -7.2);
      localBlockers.push([0.5, -7.2, 1.8]);
    } else if (r < 0.67) {
      addHillsHoist(g, -1.5, -7.2);
      localBlockers.push([-1.5, -7.2, 1.6]);
    } else {
      mesh(boxGeo(2.2, 2, 2), std(0x9aa3a8, { metalness: 0.3 }), 4.8, 1, -8.4, g);
      localBlockers.push([4.8, -8.4, 1.6]);
    }
  }

  scene.add(g);
  g.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  for (const [lx, lz, r] of localBlockers) {
    v.set(lx, 0, lz).applyMatrix4(g.matrixWorld);
    world.blockers.push({ x: v.x, z: v.z, r });
  }
  v.set(0.9, 0, 0.5).applyMatrix4(g.matrixWorld);
  world.houseCircles.push({ x: v.x, z: v.z, r: 6.2 });
  world.doors.push(new THREE.Vector3(-1.2, 0, 6.8).applyMatrix4(g.matrixWorld));
}

function addCar(parent, x, z, color) {
  const car = new THREE.Group();
  const paint = std(color, { roughness: 0.4, metalness: 0.2 });
  mesh(boxGeo(1.8, 0.7, 4), paint, 0, 0.65, 0, car);
  mesh(boxGeo(1.6, 0.6, 2.1), paint, 0, 1.25, -0.2, car);
  mesh(boxGeo(1.62, 0.45, 2.0), glass, 0, 1.27, -0.2, car);
  for (const [wx, wz] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
    const w = mesh(cylGeo(0.35, 0.35, 0.25, 12), dark, wx, 0.35, wz, car);
    w.rotation.z = Math.PI / 2;
  }
  car.position.set(x, 0, z);
  parent.add(car);
}

function addTrampoline(parent, x, z) {
  const t = new THREE.Group();
  mesh(cylGeo(1.6, 1.6, 0.06, 24), dark, 0, 0.8, 0, t);
  const rim = mesh(new THREE.TorusGeometry(1.65, 0.08, 6, 24), std(0x2e7bcf), 0, 0.82, 0, t);
  rim.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    mesh(cylGeo(0.04, 0.04, 0.8, 5), std(0x888888), Math.cos(a) * 1.5, 0.4, Math.sin(a) * 1.5, t);
  }
  t.position.set(x, 0, z);
  parent.add(t);
}

function addHillsHoist(parent, x, z) {
  const h = new THREE.Group();
  const metal = std(0xb8bcc0, { metalness: 0.6, roughness: 0.4 });
  mesh(cylGeo(0.06, 0.06, 2.2, 6), metal, 0, 1.1, 0, h);
  for (let i = 0; i < 4; i++) {
    const arm = mesh(boxGeo(3.2, 0.05, 0.05), metal, 0, 2.15, 0, h);
    arm.rotation.y = (i * Math.PI) / 4;
  }
  const shirt = mesh(boxGeo(0.5, 0.6, 0.02), std(0xe74c3c), 1.1, 1.8, 0, h);
  shirt.rotation.y = 0.3;
  const towel = mesh(boxGeo(0.02, 0.8, 0.6), std(0x3498db), -0.2, 1.75, 1.2, h);
  towel.rotation.y = 0.2;
  h.position.set(x, 0, z);
  h.rotation.y = 0.4;
  parent.add(h);
}

// ---------- fire trail ----------
function ribbon(pts, offset, halfW, y, mat, scene, wobble = 0) {
  const pos = [];
  const idx = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const nx = -tz;
    const nz = tx;
    const w = halfW + Math.sin(i * 0.37) * wobble;
    const cx = p.x + nx * offset;
    const cz = p.z + nz * offset;
    pos.push(cx + nx * w, y, cz + nz * w, cx - nx * w, y, cz - nz * w);
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

const previewMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });

function disposeTree(obj) {
  obj.traverse((o) => o.geometry && o.geometry.dispose());
}

function addTrail(scene, path) {
  const group = new THREE.Group();
  const all = path.curve.getSpacedPoints(Math.round(path.length * 2.2));
  const cut = all.findIndex((p) => Math.hypot(p.x, p.z) < 14);
  const pts = cut > 0 ? all.slice(0, cut) : all;
  const dirt = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1, side: THREE.DoubleSide });
  const rut = new THREE.MeshStandardMaterial({ color: 0x8f6c43, roughness: 1, side: THREE.DoubleSide });
  ribbon(pts, 0, 2.1, 0.05, dirt, group, 0.25);
  ribbon(pts, 0.8, 0.22, 0.06, rut, group);
  ribbon(pts, -0.8, 0.22, 0.06, rut, group);

  // Pebbles along the edges.
  const rnd = mulberry32(99);
  const count = Math.round(path.length);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.25, 0), std(0x9b9186), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const p = pts[Math.floor(rnd() * pts.length)];
    const side = rnd() < 0.5 ? -1 : 1;
    const ang = rnd() * Math.PI * 2;
    const off = 2.3 + rnd() * 1.2;
    q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
    const s = 0.5 + rnd() * 1.2;
    m.compose(
      new THREE.Vector3(p.x + Math.cos(ang) * off * side, 0.05, p.z + Math.sin(ang) * off * side),
      q,
      new THREE.Vector3(s, s * 0.6, s),
    );
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);
  scene.add(group);
  return group;
}

// ---------- the bush ----------
function addTrees(scene, world, curves) {
  const rnd = mulberry32(1337);
  const trees = [];
  const spawn = curves[0].curve.getPointAt(0);
  const trailDist = (x, z) => Math.min(...curves.map((c) => c.distanceTo(x, z)));
  for (let k = 0; k < 7000 && trees.length < 330; k++) {
    const x = (rnd() * 2 - 1) * 140;
    const z = (rnd() * 2 - 1) * 140;
    const r = Math.hypot(x, z);
    if (r < 36) continue;
    if (Math.abs(x) < 24 && z > 10 && z < 78) continue;
    if (Math.abs(x) < 7 && z > 0) continue;
    if (Math.hypot(x - spawn.x, z - spawn.z) < 9) continue;
    if (trailDist(x, z) < 4.8) continue;
    if (!trees.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > 12)) continue;
    trees.push({ x, z });
  }
  // A few street trees in front yards.
  for (const deg of [-120, -80, -40, 0, 125]) {
    const a = THREE.MathUtils.degToRad(deg);
    trees.push({ x: Math.sin(a) * 17, z: -Math.cos(a) * 17, street: true });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, std(0xffffff), trees.length);
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std(0xffffff), trees.length * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const barks = [0xd8d0bf, 0xc4b8a2, 0xe6e0d2, 0xa89a86];
  const leaves = [0x6f8c4c, 0x5f7d45, 0x7f9a5a, 0x8a9a5e, 0x54703d];
  trees.forEach((t, i) => {
    const h = t.street ? 4.5 : 6 + rnd() * 6;
    const tw = 0.9 + rnd() * 0.5;
    q.setFromEuler(e.set((rnd() - 0.5) * 0.12, rnd() * 6, (rnd() - 0.5) * 0.12));
    m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(tw, h, tw));
    trunks.setMatrixAt(i, m);
    trunks.setColorAt(i, c.setHex(barks[Math.floor(rnd() * barks.length)]));
    for (let j = 0; j < 3; j++) {
      const s = (t.street ? 1.3 : 1.6) + rnd() * 1.4;
      q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
      m.compose(
        new THREE.Vector3(t.x + (rnd() - 0.5) * 2.6, h * (0.72 + 0.13 * j), t.z + (rnd() - 0.5) * 2.6),
        q,
        new THREE.Vector3(s, s * 0.7, s),
      );
      canopy.setMatrixAt(i * 3 + j, m);
      canopy.setColorAt(i * 3 + j, c.setHex(leaves[Math.floor(rnd() * leaves.length)]));
    }
    world.blockers.push({ x: t.x, z: t.z, r: 1.1 });
  });
  for (const im of [trunks, canopy]) {
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }

  // Low scrub
  const shrubN = 480;
  const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std(0xffffff), shrubN);
  const scrub = [0x4e6b35, 0x6b7f3f, 0x7d8a4a, 0x5a7a3a, 0x8c8a55];
  let n = 0;
  for (let k = 0; k < 5000 && n < shrubN; k++) {
    const x = (rnd() * 2 - 1) * 150;
    const z = (rnd() * 2 - 1) * 150;
    if (Math.hypot(x, z) < 33) continue;
    if (Math.abs(x) < 24 && z > 10 && z < 78) continue;
    if (Math.abs(x) < 7 && z > 0) continue;
    if (trailDist(x, z) < 3.2) continue;
    const s = 0.5 + rnd() * 0.9;
    q.setFromEuler(e.set(0, rnd() * 6, 0));
    m.compose(new THREE.Vector3(x, s * 0.2, z), q, new THREE.Vector3(s * 1.3, s * 0.7, s * 1.3));
    shrubs.setMatrixAt(n, m);
    shrubs.setColorAt(n, c.setHex(scrub[Math.floor(rnd() * scrub.length)]));
    n++;
  }
  shrubs.count = n;
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  scene.add(shrubs);
}

// ---------- the rift where golems come from ----------
function addRift(scene, world, p, next, dormant) {
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  // Turn so the boulders sit behind the rift, away from the trail.
  g.rotation.y = Math.atan2(-(next.z - p.z), next.x - p.x);
  const rockMat = std(0x4a4540);
  const rnd = mulberry32(5 + Math.round(p.x));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const s = 0.7 + rnd() * 0.9;
    const r = mesh(new THREE.DodecahedronGeometry(s, 0), rockMat, Math.cos(a) * 3.8, s * 0.4, Math.sin(a) * 3.8, g);
    r.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
  for (const [x, z, s] of [[-6, -3, 3.4], [-5, 4, 2.8], [-8.5, 0.5, 4]]) {
    const r = mesh(new THREE.DodecahedronGeometry(s, 0), std(0x3b3632), x, s * 0.5, z, g);
    r.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x1c0a26 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.3, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.07;
  g.add(floor);
  const swirl = (color, start, y) => {
    const s = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 3.0, 40, 1, start, Math.PI * 1.3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = y;
    g.add(s);
    return s;
  };
  const s1 = swirl(0xff7a2f, 0, 0.09);
  const s2 = swirl(0x9b5cff, Math.PI, 0.1);
  const light = new THREE.PointLight(0xff7a2f, 80, 26, 2);
  light.position.y = 2.5;
  g.add(light);
  scene.add(g);
  world.blockers.push({ x: p.x, z: p.z, r: 5 });

  // A dormant rift is just a dark crack in a ring of rocks, faintly glowing.
  const rift = { group: g, pos: new THREE.Vector3(p.x, 0, p.z), open: !dormant };
  const setOpen = (open) => {
    rift.open = open;
    s1.visible = s2.visible = light.visible = open;
    floorMat.color.setHex(open ? 0x1c0a26 : 0x120c16);
  };
  setOpen(!dormant);
  rift.activate = () => setOpen(true);
  world.animated.push((t) => {
    if (rift.open) {
      s1.rotation.z = t * 1.5;
      s2.rotation.z = -t * 2.1;
      light.intensity = 70 + Math.sin(t * 6) * 20;
    } else {
      floorMat.color.setHSL(0.8, 0.5, 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t * 1.5)));
    }
  });
  return rift;
}

function addTrailSign(scene, world) {
  const tex = canvasTexture(512, 256, (x, w, h) => {
    x.fillStyle = '#f4c430';
    x.fillRect(0, 0, w, h);
    x.lineWidth = 14;
    x.strokeStyle = '#1b1b1b';
    x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#1b1b1b';
    x.textAlign = 'center';
    x.font = '900 86px Nunito, Arial, sans-serif';
    x.fillText('FIRE TRAIL', w / 2, 118);
    x.fillStyle = '#b3221b';
    x.font = '900 40px Nunito, Arial, sans-serif';
    x.fillText('NO GOLEMS PAST HERE', w / 2, 196);
  });
  const g = new THREE.Group();
  const wood = std(0x6e4a2a);
  mesh(boxGeo(0.14, 2.4, 0.14), wood, -1.1, 1.2, 0, g);
  mesh(boxGeo(0.14, 2.4, 0.14), wood, 1.1, 1.2, 0, g);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  board.position.set(0, 1.9, 0.08);
  board.castShadow = true;
  g.add(board);
  const x = 31;
  const z = -18;
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-x, -z);
  scene.add(g);
  world.blockers.push({ x, z, r: 1.4 });
}

// ---------- the boys' hangout ----------
function addHangout(scene, world) {
  // Basketball hoop on the footpath.
  const hoop = new THREE.Group();
  const pole = std(0x3a3f45, { metalness: 0.4 });
  mesh(cylGeo(0.09, 0.09, 3.2, 8), pole, 0, 1.6, 0, hoop);
  mesh(boxGeo(0.1, 0.1, 0.8), pole, 0, 3.1, 0.4, hoop);
  mesh(boxGeo(1.8, 1.1, 0.08), std(0xf5f5f5), 0, 3.3, 0.8, hoop);
  mesh(boxGeo(0.6, 0.45, 0.09), std(0xd8342c), 0, 3.15, 0.8, hoop);
  const rim = mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 16), std(0xff6a1a), 0, 3.0, 1.15, hoop);
  rim.rotation.x = Math.PI / 2;
  hoop.position.set(-10.6, 0, 8.6);
  hoop.rotation.y = Math.atan2(10.6, -8.6);
  scene.add(hoop);
  world.blockers.push({ x: -10.6, z: 8.6, r: 1 });
  // Ball
  mesh(new THREE.SphereGeometry(0.25, 12, 8), std(0xe06a1a), -7.5, 0.25, 9.4, scene);
  // Bikes dumped on the road.
  addBike(scene, -3.5, 10.5, 0.6, 0x2e86c1);
  addBike(scene, -9, 3.5, -1.1, 0xc0392b);
}

function addBike(scene, x, z, yaw, color) {
  const b = new THREE.Group();
  const frame = std(color, { roughness: 0.4 });
  const tyre = std(0x1e1e1e);
  for (const wz of [-0.55, 0.55]) mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 16), tyre, 0, 0, wz, b).rotation.y = Math.PI / 2;
  const top = mesh(boxGeo(0.05, 0.05, 1.0), frame, 0, 0.3, 0, b);
  top.rotation.x = 0.2;
  mesh(boxGeo(0.05, 0.4, 0.05), frame, 0, 0.15, -0.1, b);
  mesh(boxGeo(0.5, 0.04, 0.04), frame, 0, 0.5, 0.5, b);
  b.rotation.set(0, yaw, Math.PI / 2 - 0.05);
  b.position.set(x, 0.1, z);
  scene.add(b);
}

// ---------- the street taking a beating ----------
// As the sack loses health the houses get wrecked, bit by bit, spread evenly
// across the street: windows smash, fences fall, letterboxes get flattened,
// front doors hang off, roofs get holes and start smoking, walls crack.
const brokenGlass = std(0x121416, { roughness: 1 });
const plankMat = std(0x8a6a44);
const crackMat = std(0x2a2522);
const holeMat = std(0x141010);
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x55504a, transparent: true, opacity: 0.55, depthWrite: false });

function buildDamage(world) {
  const kinds = ['window0', 'fence0', 'letterbox', 'window1', 'roof', 'door', 'fence1', 'crack', 'fence2'];
  const slots = [];
  for (const k of kinds) {
    for (const h of world.houses) {
      const slot = makeSlot(world, h, k);
      if (slot) slots.push(slot);
    }
  }
  let current = -1;
  return (frac) => {
    const n = Math.round(Math.max(0, Math.min(1, frac)) * slots.length);
    if (n === current) return;
    current = n;
    slots.forEach((s, i) => s(i < n));
  };
}

function makeSlot(world, h, kind) {
  const g = h.group;
  if (kind.startsWith('window')) {
    const w = h.windows[+kind.slice(-1)];
    const orig = w.material;
    const plank = mesh(boxGeo(1.9, 0.18, 0.06), plankMat, w.position.x, w.position.y, w.position.z + 0.06, g);
    plank.rotation.z = 0.35;
    plank.visible = false;
    return (on) => {
      w.material = on ? brokenGlass : orig;
      plank.visible = on;
    };
  }
  if (kind.startsWith('fence')) {
    const f = h.fences[+kind.slice(-1)];
    const { x, y, z } = f.rotation;
    const py = f.position.y;
    const along = f.geometry.parameters.width > 1; // long side runs along x
    return (on) => {
      if (on) {
        if (along) f.rotation.x = 1.25;
        else f.rotation.z = 1.25;
        f.position.y = 0.25;
      } else {
        f.rotation.set(x, y, z);
        f.position.y = py;
      }
    };
  }
  if (kind === 'letterbox') {
    return (on) => {
      h.letterbox.rotation.z = on ? 1.4 : 0;
      h.letterbox.position.y = on ? 0.1 : 0;
    };
  }
  if (kind === 'door') {
    const d = h.door;
    const px = d.position.x;
    return (on) => {
      d.rotation.y = on ? 1.1 : 0;
      d.position.x = on ? px - 0.35 : px;
    };
  }
  if (kind === 'crack') {
    const c = new THREE.Group();
    [[3.0, 2.3, 0.6], [3.3, 1.8, -0.7], [3.1, 1.3, 0.5]].forEach(([x, y, r]) => {
      const m = mesh(boxGeo(0.7, 0.07, 0.04), crackMat, x, y, 3.53, c);
      m.rotation.z = r;
    });
    c.visible = false;
    g.add(c);
    return (on) => (c.visible = on);
  }
  if (kind === 'roof') {
    const hole = mesh(boxGeo(1.6, 0.35, 1.3), holeMat, 1.2, 4.1, 1.7, g);
    hole.rotation.x = -0.45;
    const rubble = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const r = mesh(boxGeo(0.4, 0.1, 0.3), h.group.children[1].material, 0.5 + Math.random() * 2, 0.05, 4.2 + Math.random() * 1.5, rubble);
      r.rotation.set(Math.random(), Math.random() * 3, Math.random());
    }
    g.add(rubble);
    // Smoke puffs drifting up out of the hole.
    const smoke = new THREE.Group();
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), smokeMat);
      smoke.add(p);
      puffs.push(p);
    }
    smoke.position.set(1.2, 4.3, 1.7);
    g.add(smoke);
    const parts = [hole, rubble, smoke];
    parts.forEach((p) => (p.visible = false));
    world.animated.push((t) => {
      if (!smoke.visible) return;
      puffs.forEach((p, i) => {
        const k = (t * 0.35 + i / puffs.length) % 1;
        p.position.set(Math.sin(i * 2.1) * 0.3 + k * 0.8, k * 4, Math.cos(i * 1.7) * 0.3);
        p.scale.setScalar(0.4 + k * 1.3);
      });
    });
    return (on) => parts.forEach((p) => (p.visible = on));
  }
  return null;
}
