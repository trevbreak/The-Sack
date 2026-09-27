import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const angleLerp = (a, b, t) => a + angleDiff(a, b) * t;

export const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });

// Geometry cache so dozens of forts don't each allocate their own boxes.
const geoCache = new Map();
export function boxGeo(w, h, d) {
  const k = `b${w},${h},${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function cylGeo(rt, rb, h, seg = 8) {
  const k = `c${rt},${rb},${h},${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(k);
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A flat range indicator: thin outline ring plus a faint filled disc, radius 1.
export function makeRangeRing(color) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false });
  const discMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 96), ringMat);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), discMat);
  ring.rotation.x = disc.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  disc.position.y = 0.1;
  ring.renderOrder = disc.renderOrder = 2;
  g.add(disc, ring);
  g.userData.setColor = (c) => {
    ringMat.color.setHex(c);
    discMat.color.setHex(c);
  };
  return g;
}
