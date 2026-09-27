// All the tunable numbers for The Sack live here.
import { mulberry32 } from './util.js';

export const START = { points: 175, sackHp: 20, boys: 2 };

// Difficulty picked on the title screen. Pro is the standard game.
export const DIFFICULTIES = [
  { key: 'rookie', name: 'Rookie', icon: '🧃', desc: 'Weak creatures, lots of pocket money, a tough sack.', hp: 0.55, count: 0.7, reward: 1.3, points: 1.7, sack: 30, trouble: 0.3 },
  { key: 'beginner', name: 'Beginner', icon: '🛹', desc: 'A gentler holidays while you learn the ropes.', hp: 0.78, count: 0.85, reward: 1.12, points: 1.3, sack: 25, trouble: 0.6 },
  { key: 'pro', name: 'Pro', icon: '🏏', desc: 'The standard game.', hp: 1, count: 1, reward: 1, points: 1, sack: 20, trouble: 1 },
  { key: 'good', name: 'Really Good', icon: '🔥', desc: 'Tougher creatures, tighter pocket money, stricter parents.', hp: 1.3, count: 1.15, reward: 0.9, points: 0.9, sack: 15, trouble: 1.3 },
  { key: 'impossible', name: 'Impossible', icon: '💀', desc: 'Good luck. No overnight repairs either.', hp: 1.8, count: 1.35, reward: 0.8, points: 0.75, sack: 10, trouble: 1.7, noRepair: true },
];
export let DIFF = DIFFICULTIES[2];
export function setDifficulty(key) {
  DIFF = DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[2];
  return DIFF;
}
export const MAX_BOYS = 20;
export const RECRUIT_COSTS = [60, 90, 130, 175, 225, 285, 350, 420, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400];

// Damage types the boys' weapons deal.
export const DMG_TYPES = {
  impact: { label: 'Impact' },
  water: { label: 'Water' },
  fire: { label: 'Fire' },
  foam: { label: 'Foam' },
  zap: { label: 'Zap' },
  salt: { label: 'Salt' },
};

// Elemental golems. `resist` is a damage multiplier per damage type (missing = 1).
export const GOLEMS = {
  fire: {
    name: 'Fire Golem', icon: '🔥', hp: 60, speed: 3.2, reward: 8, size: 1.0, damage: 1,
    color: 0x8a3a1c, emissive: 0x3a0e00, glow: 0xffb13d, extra: 'flames',
    resist: { water: 2.0, fire: 0.25 },
    tip: 'Fire golems hate 🎈 water balloons.',
  },
  ice: {
    name: 'Ice Golem', icon: '❄️', hp: 85, speed: 2.6, reward: 9, size: 1.05, damage: 1,
    color: 0xa8dcf0, emissive: 0x0b2a3a, glow: 0x7ff3ff, extra: 'crystals', slowImmune: true,
    resist: { fire: 2.0, water: 0.4 },
    tip: 'Ice golems melt under 🎆 bottle rockets and can\'t be slowed.',
  },
  stone: {
    name: 'Stone Golem', icon: '🪨', hp: 180, speed: 1.9, reward: 14, size: 1.3, damage: 2,
    color: 0x8b847a, emissive: 0x000000, glow: 0x9dff6a, extra: 'moss',
    resist: { water: 1.6, foam: 0.3, impact: 0.6, fire: 0.8, zap: 0.5 },
    tip: 'Stone golems shrug off foam darts. Water wears them down.',
  },
  storm: {
    name: 'Storm Golem', icon: '⚡', hp: 45, speed: 4.6, reward: 7, size: 0.85, damage: 1,
    color: 0x3d3566, emissive: 0x120a2a, glow: 0xfff35c, extra: 'sparks',
    resist: { impact: 1.8, water: 0.5, foam: 1.2, zap: 0.2 },
    tip: 'Storm golems are fast. 🎯 Slingshot rocks ground them.',
  },
  goop: {
    name: 'Goop Golem', icon: '🟢', hp: 90, speed: 2.4, reward: 9, size: 1.05, damage: 1,
    color: 0x5fd35a, emissive: 0x0d3a0a, glow: 0xf4ff6a, extra: 'goop', opacity: 0.85, split: 'gooplet',
    resist: { impact: 0.4, foam: 0.5, water: 0.6, salt: 2.5, fire: 1.4 },
    tip: 'Goop golems split in two when smashed. 🧂 Salt melts them.',
  },
  gooplet: {
    name: 'Gooplet', icon: '🟢', hp: 28, speed: 3.2, reward: 3, size: 0.55, damage: 1, hidden: true,
    color: 0x7be676, emissive: 0x0d3a0a, glow: 0xf4ff6a, extra: 'goop', opacity: 0.85,
    resist: { impact: 0.4, foam: 0.5, water: 0.6, salt: 2.5, fire: 1.4 },
  },
  robot: {
    name: 'Robot Golem', icon: '🤖', hp: 150, speed: 2.2, reward: 13, size: 1.15, damage: 2,
    color: 0x9aa3ad, emissive: 0x05080c, glow: 0xff3b3b, extra: 'robot', metal: true, armor: 8,
    resist: { zap: 2.2, water: 1.5, impact: 0.7, fire: 0.8, foam: 0.6 },
    tip: 'Robot golems have armour: weak hits barely scratch them. 🔌 Zap shorts them out.',
  },
  wood: {
    name: 'Wood Golem', icon: '🪵', hp: 130, speed: 2.0, reward: 12, size: 1.2, damage: 1,
    color: 0x6b4a2b, emissive: 0x000000, glow: 0x9dff6a, extra: 'wood', regen: 0.05,
    resist: { fire: 2.2, water: 0.5, impact: 0.8, salt: 0.6 },
    tip: 'Wood golems regrow if you stop hitting them. 🔍🎆 Fire burns them down.',
  },
  // ---- Not golems: other things from the bush ----
  spider: {
    name: 'Huntsman Spider', icon: '🕷️', hp: 55, speed: 3.4, reward: 8, size: 0.95, damage: 1,
    color: 0x5a4330, emissive: 0x000000, glow: 0xff3b3b, body: 'spider', extraColor: 0x3a2a1c,
    hop: { every: 3.2, dist: 7 },
    resist: { foam: 1.6, fire: 1.5, impact: 0.7, zap: 1.2 },
    tip: 'Huntsman spiders pounce forward past forts. Sticky 🔫 foam and 🔍 fire work well.',
  },
  lion: {
    name: 'Sky Lion', icon: '🦁', hp: 110, speed: 2.8, reward: 14, size: 1.1, damage: 2,
    color: 0xd9a441, emissive: 0x1a0e00, glow: 0xfff2a0, body: 'lion', extraColor: 0x8a4b1a, flying: true,
    resist: { zap: 1.8, impact: 1.3, water: 0.7 },
    tip: 'Sky lions fly above the trail. 🎈🧂 Lobbed weapons can\'t reach them. 🔌🎯🎆 can.',
  },
  dropbear: {
    name: 'Drop Bear', icon: '🐨', hp: 140, speed: 2.4, reward: 12, size: 1.0, damage: 1,
    color: 0x8e8f94, emissive: 0x000000, glow: 0xff2a2a, body: 'dropBear', extraColor: 0xd9d6cf, pounce: 4,
    resist: { impact: 0.6, water: 1.4, fire: 1.2 },
    tip: 'Drop bears leap onto forts and scare the kids stiff for a few seconds.',
  },
  bunyip: {
    name: 'Bunyip', icon: '🐊', hp: 200, speed: 2.0, reward: 16, size: 1.25, damage: 2,
    color: 0x3f4a2e, emissive: 0x000000, glow: 0xffe45c, body: 'bunyip', extraColor: 0x6b5a3a,
    burrow: { every: 6, time: 2.5 },
    resist: { water: 0.3, salt: 1.8, fire: 1.3, zap: 1.5 },
    tip: 'Bunyips dive underground where nothing can hit them. Water does nothing; 🧂 salt stings.',
  },
  magma: {
    name: 'Magma Titan', icon: '🌋', hp: 1000, speed: 1.35, reward: 120, size: 2.4, damage: 6, boss: true,
    color: 0x2b2222, emissive: 0x2a0800, glow: 0xff5a1a, extra: 'magma',
    resist: { water: 1.5, fire: 0.1, impact: 0.8, foam: 0.5, zap: 0.8, salt: 0.8 },
    tip: 'A boss! Throw everything wet you\'ve got at it.',
  },
};

// Each fort kit is a fort + the weapon mounted on it.
export const WEAPONS = {
  slingshot: {
    key: 'slingshot', name: 'Slingshot Fort', short: 'Slingshot', icon: '🎯', cost: 50,
    dmgType: 'impact', damage: 13, rate: 1.5, range: 11, projSpeed: 30,
    desc: 'Cheap and reliable. Rocks away.',
  },
  balloon: {
    key: 'balloon', name: 'Water Balloon Fort', short: 'Balloon Catapult', icon: '🎈', cost: 85,
    dmgType: 'water', damage: 20, rate: 0.55, range: 12.5, projSpeed: 15, splash: 2.8, arc: true,
    slow: 0.45, slowTime: 1.8,
    desc: 'Lobs splashy balloons that soak and slow.',
  },
  rocket: {
    key: 'rocket', name: 'Bottle Rocket Fort', short: 'Bottle Rockets', icon: '🎆', cost: 110,
    dmgType: 'fire', damage: 32, rate: 0.65, range: 15, projSpeed: 20, splash: 2.4,
    desc: 'Long range fireworks that go boom.',
  },
  dart: {
    key: 'dart', name: 'Foam Dart Fort', short: 'Dart Gatling', icon: '🔫', cost: 130,
    dmgType: 'foam', damage: 5, rate: 7, range: 10, projSpeed: 45,
    desc: 'Hoses golems with foam darts.',
  },
  magnifier: {
    key: 'magnifier', name: 'Magnifying Glass Fort', short: 'Magnifying Glass', icon: '🔍', cost: 120,
    dmgType: 'fire', damage: 14, rate: 1, range: 11, beam: true,
    desc: 'A burning sun beam. Gets hotter the longer it stares.',
  },
  zapper: {
    key: 'zapper', name: 'Bug Zapper Fort', short: 'Bug Zapper', icon: '🔌', cost: 140,
    dmgType: 'zap', damage: 17, rate: 0.85, range: 11, chain: 2,
    desc: 'Zaps one golem, then arcs to the ones next to it.',
  },
  salt: {
    key: 'salt', name: 'Salt Mortar Fort', short: 'Salt Mortar', icon: '🧂', cost: 150,
    dmgType: 'salt', damage: 28, rate: 0.35, range: 16, projSpeed: 12, splash: 3.4, arc: true,
    desc: 'Slow, long range salt bombs with a big splash.',
  },
};

export const WEAPON_LEVELS = [
  { dmg: 1, rate: 1 },
  { dmg: 1.45, rate: 1.12 },
  { dmg: 2.1, rate: 1.25 },
  { dmg: 2.9, rate: 1.38 },
  { dmg: 3.9, rate: 1.5 },
];
const WEAPON_UP_MUL = [1.1, 1.8, 2.8, 4.0];
export const weaponUpgradeCost = (w, lvl) => Math.round((w.cost * WEAPON_UP_MUL[lvl]) / 5) * 5;

export const FORT_LEVELS = [
  { name: 'Cardboard Box Fort', rangeMul: 1.0, dmgMul: 1.0, cost: 0 },
  { name: 'Pallet Fort', rangeMul: 1.15, dmgMul: 1.2, cost: 75 },
  { name: 'Treehouse Tower', rangeMul: 1.35, dmgMul: 1.45, cost: 160 },
  { name: 'Sky Fort', rangeMul: 1.5, dmgMul: 1.7, cost: 280 },
  { name: 'Mega Fort', rangeMul: 1.65, dmgMul: 2.0, cost: 450 },
];

// Two kids on one fort work as a team: one loads, one fires.
export const TEAM_LEVEL = 1; // Pallet Fort and up fit a second kid
export const TEAM_BONUS = { rate: 1.5, dmg: 1.25 };

export const TRAITS = [
  { key: 'arm', name: 'Good Arm', desc: '+15% range', range: 1.15, weight: 3 },
  { key: 'quick', name: 'Quick Hands', desc: '+20% fire rate', rate: 1.2, weight: 3 },
  { key: 'eye', name: 'Eagle Eye', desc: '+20% damage', dmg: 1.2, weight: 3 },
  { key: 'brave', name: 'Fearless', desc: '+10% everything', range: 1.1, rate: 1.1, dmg: 1.1, weight: 1 },
];

// The main crew, in the order they join: AJ and Kai start the game, Jimmy is the
// first recruit. Everyone after that gets a random name from BOY_NAMES.
export const MAIN_BOYS = ['AJ', 'Kai', 'Jimmy'];
export const BOY_NAMES = [
  'Jacko', 'Tommo', 'Rhys', 'Ollie', 'Harrison', 'Nate', 'Lachie',
  'Mitch', 'Benny', 'Sammy', 'Coops', 'Robbo', 'Finn', 'Davo', 'Zac',
  'Mikey', 'Jonno', 'Leo', 'Hudson', 'Charlie', 'Max', 'Billy', 'Oscar',
];

// The holidays never end on their own: they last until the golems take the sack.
// Each week something new turns up. `rift` is the index of a rift in RIFTS (path.js).
export const STAGES = [
  { day: 1, golem: 'fire', text: 'Fire golems are crawling out of the western bush.' },
  { day: 4, golem: 'storm', text: 'Storm golems! Small, fast and sparky.' },
  { day: 5, golem: 'spider', text: 'Huntsman spiders! Big hairy ones that pounce down the trail.' },
  { day: 8, golem: 'ice', rift: 1, text: 'Week 2: a second rift has torn open in the north-east bush. Ice golems are coming.' },
  { day: 11, golem: 'lion', text: 'SKY LIONS! They fly high above the trail. Balloons and salt can\'t reach them.' },
  { day: 15, golem: 'stone', text: 'Week 3: Stone golems. Slow, and very hard to knock over.' },
  { day: 18, golem: 'goop', text: 'Goop golems! Smash one and you get two.' },
  { day: 22, golem: 'robot', rift: 2, text: 'Week 4: a third rift has opened in the east paddock, right near the houses. Robot golems too.' },
  { day: 25, golem: 'dropbear', text: 'Drop bears! They leap onto forts and scare the kids stiff.' },
  { day: 29, golem: 'wood', text: 'Week 5: Wood golems. They grow back if you stop hitting them.' },
  { day: 32, golem: 'bunyip', text: 'Something has crawled out of the creek. Bunyips dive underground where nothing can hit them.' },
  { day: 36, rift: 3, text: 'Week 6: a fourth rift has opened down by the creek. They\'re coming from everywhere now.' },
];
export const BOSS_EVERY = 7; // a Magma Titan to finish each week

export const weekOf = (n) => Math.floor((n - 1) / 7) + 1;
export const riftsOpenOn = (n) => 1 + STAGES.filter((s) => s.rift && s.day <= n).length;

// Build the spawn list for day n. Each entry: { type, gap, rift } where gap is the
// delay (seconds) before the next golem and rift is where it climbs out.
export function makeWave(n) {
  const rnd = mulberry32(n * 7919 + 13);
  const hpScale = (1 + 0.08 * (n - 1) + 0.0065 * (n - 1) ** 2) * DIFF.hp;
  const rewardScale = (1 + 0.04 * (n - 1)) * DIFF.reward;
  const rifts = riftsOpenOn(n);

  const pool = STAGES.filter((st) => st.golem && st.day <= n).map((st) => st.golem);
  const intro = STAGES.find((st) => st.golem && st.day === n)?.golem;

  const total = Math.max(3, Math.round((5 + Math.floor(n * 1.5)) * DIFF.count));
  const nGroups = Math.min(pool.length, 1 + Math.floor(n / 6));
  const types = intro ? [intro] : [];
  while (types.length < nGroups) {
    const t = pool[Math.floor(rnd() * pool.length)];
    if (!types.includes(t)) types.push(t);
  }

  const gapMul = Math.max(0.35, 1 - n * 0.018);
  const baseGap = { fire: 1.1, ice: 1.1, stone: 1.6, storm: 0.7, goop: 1.3, robot: 1.5, wood: 1.4, spider: 0.8, lion: 1.4, dropbear: 1.2, bunyip: 1.6 };
  const WEIGHT = { stone: 0.6, goop: 0.7, robot: 0.7, wood: 0.8, lion: 0.6, dropbear: 0.7, bunyip: 0.6 };
  const weights = types.map((t) => WEIGHT[t] || 1);
  const wsum = weights.reduce((a, b) => a + b, 0);

  let list = [];
  types.forEach((t, gi) => {
    const cnt = Math.max(2, Math.round((total * weights[gi]) / wsum));
    // Each group comes out of one rift, so new rifts bring whole packs at once.
    const rift = Math.floor(rnd() * rifts);
    for (let i = 0; i < cnt; i++) list.push({ type: t, gap: baseGap[t] * gapMul, rift: rnd() < 0.8 ? rift : Math.floor(rnd() * rifts) });
    list[list.length - 1].gap += 2.5;
  });

  // Later on golems come mixed together instead of in tidy groups.
  if (n >= 18) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  if (n % BOSS_EVERY === 0) {
    list[list.length - 1].gap += 3;
    const bosses = 1 + Math.floor(n / 21);
    for (let b = 0; b < bosses; b++) list.push({ type: 'magma', gap: 5, rift: b % rifts });
  }

  return { n, list, hpScale, rewardScale, rifts };
}

// Parents cause trouble more often as the holidays drag on.
export function troubleFor(n) {
  const week = weekOf(n);
  const k = DIFF.trouble;
  const t = {
    grounded: n >= 8 ? Math.min(0.14, 0.03 * (week - 1)) : 0, // stuck home all day
    late: n >= 3 ? Math.min(0.22, 0.04 + 0.03 * week) : 0, // out mid-afternoon
    chores: n >= 3 ? Math.min(4, 0.4 + 0.35 * week) : 0, // expected mid-day calls
  };
  return { grounded: t.grounded * k, late: t.late * k, chores: t.chores * k };
}

export const GROUNDED_LINES = [
  '{NAME} is grounded for kicking the footy through the window.',
  '{NAME} is grounded for eating the whole packet of Tim Tams.',
  '{NAME} is grounded for giving his sister a haircut.',
  '{NAME} is grounded for tracking mud all through the house.',
  '{NAME} is grounded for "borrowing" Dad\'s ladder for the fort.',
];
export const LATE_LINES = [
  '{NAME} has to finish his holiday homework first.',
  '{NAME} has to tidy his room before he can come out.',
  '{NAME} is stuck at the dentist this arvo.',
  '{NAME} has to mow the lawn first.',
  '{NAME} has to visit his Nan first.',
];

export function summarizeWave(w) {
  const counts = new Map();
  for (const it of w.list) counts.set(it.type, (counts.get(it.type) || 0) + 1);
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

// What parents yell. {NAME} gets swapped for the boy's name.
export const DINNER_LINES = [
  '{NAME}! DINNER!',
  '{NAME}! TEA\'S ON THE TABLE!',
  '{NAME}! THE STREETLIGHTS ARE ON!',
  '{NAME}, INSIDE. NOW.',
  '{NAME}! BATH TIME!',
  'DON\'T MAKE ME COME OUT THERE, {NAME}!',
  '{NAME}! YOUR DINNER\'S GOING COLD!',
];
export const CHORE_LINES = [
  '{NAME}! BINS NEED TO GO OUT!',
  '{NAME}! COME CLEAN YOUR ROOM!',
  '{NAME}! YOU LEFT THE HOSE ON!',
  '{NAME}! FEED THE DOG!',
  '{NAME}! YOUR NAN\'S ON THE PHONE!',
  '{NAME}! HANG THE WASHING OUT!',
  '{NAME}! WHO LEFT THEIR BIKE ON THE DRIVEWAY?',
];
export const CHORE_TIME = 14; // seconds a boy spends inside doing chores
