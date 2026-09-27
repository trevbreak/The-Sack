import * as THREE from 'three';

// The fire trail is built from pieces. Pieces with a `key` can be swapped for a
// longer detour the boys dig with Trail Works.
const PIECES = [
  { base: [[-80, -4], [-64, -12]] },
  { key: 'west', base: [[-52, -27]], detour: [[-74, -22], [-82, -38], [-74, -54], [-58, -58], [-46, -52]] },
  { base: [[-38, -41], [-18, -50]] },
  { key: 'north', base: [], detour: [[-22, -66], [-16, -82], [-4, -84], [3, -70]] },
  { base: [[4, -51], [25, -46], [41, -34]] },
  { key: 'east', base: [[48, -20]], detour: [[54, -46], [70, -40], [74, -24], [64, -12], [52, -8]] },
  { base: [[40, -11], [27, -8], [15, -4], [6, -1], [1, 0]] },
];

export const DETOURS = [
  { key: 'north', icon: '⛰️', name: 'Hairpin up the Ridge', desc: 'Sends golems up the ridge and straight back down. A fort in the middle covers both sides.', focus: [-8, -68] },
  { key: 'west', icon: '🏞️', name: 'Creek Bend', desc: 'A long swing out past the creek before the trail even reaches the houses.', focus: [-66, -40] },
  { key: 'east', icon: '🔁', name: 'Big Loop past the Dam', desc: 'One last big loop out east before the gap into the sack.', focus: [60, -28] },
];
export const DETOUR_COSTS = [350, 600, 900];

export function waypointsFor(detours) {
  return PIECES.flatMap((p) => (p.key && detours.has(p.key) ? p.detour : p.base));
}

// Rifts where golems climb out. The first one starts the main trail. The others
// open as the weeks go by, each with a spur trail that joins the main trail
// at its last point.
export const RIFTS = [
  { key: 'west', name: 'the western bush', openDay: 1 },
  { key: 'northeast', name: 'the north-east bush', openDay: 8, spur: [[52, -90], [47, -76], [37, -61], [25, -46]] },
  { key: 'east', name: 'the east paddock, right near the houses', openDay: 22, spur: [[86, 22], [72, 11], [56, -1], [40, -11]] },
  { key: 'creek', name: 'down by the creek', openDay: 36, spur: [[-68, 50], [-64, 30], [-69, 9], [-64, -12]] },
];

export function spurPath(rift) {
  return rift.spur ? new TrailPath(new Set(), rift.spur) : null;
}

// Every trail that could ever exist, so the bush can leave room for detours and spurs.
export function allTrailCurves() {
  return [
    new TrailPath(),
    ...DETOURS.map((d) => new TrailPath(new Set([d.key]))),
    ...RIFTS.filter((r) => r.spur).map(spurPath),
  ];
}

export class TrailPath {
  constructor(detours = new Set(), points = null) {
    this.detours = new Set(detours);
    this.curve = new THREE.CatmullRomCurve3(
      (points || waypointsFor(this.detours)).map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'centripetal',
    );
    this.length = this.curve.getLength();
    this.samples = this.curve.getSpacedPoints(Math.round(this.length * 3));
  }

  pointAt(d, target = new THREE.Vector3()) {
    return this.curve.getPointAt(THREE.MathUtils.clamp(d / this.length, 0, 1), target);
  }

  tangentAt(d, target = new THREE.Vector3()) {
    return this.curve.getTangentAt(THREE.MathUtils.clamp(d / this.length, 0, 1), target);
  }

  // How far along the trail the point nearest (x, z) is.
  nearestDist(x, z) {
    let best = Infinity;
    let bi = 0;
    this.samples.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    });
    return (bi / (this.samples.length - 1)) * this.length;
  }

  distanceTo(x, z) {
    let best = Infinity;
    for (const p of this.samples) {
      const dx = p.x - x;
      const dz = p.z - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}
