// Sunday-night picks: at the start of each week (from week 2) the crew chooses
// one of three cards. Each one changes the rest of the holidays through game.mods.

export function baseMods() {
  return {
    fortCost: 1, upCost: 1, reward: 1,
    rate: 1, dmg: 1, range: 1, splash: 1,
    run: 1, chore: 1, trouble: 1, extraBoys: 0,
    dmgType: {}, // damage type -> multiplier
    golemHp: {}, // creature key (or '*') -> multiplier
    golemSpeed: {}, // creature key (or '*') -> multiplier
  };
}

const mulType = (m, type, x) => (m.dmgType[type] = (m.dmgType[type] || 1) * x);
const mulGolem = (table, key, x) => (table[key] = (table[key] || 1) * x);

export const PERKS = [
  { key: 'garage', icon: '🏷️', name: 'Garage Sale', text: 'New forts cost 20% less.', apply: (m) => (m.fortCost *= 0.8) },
  { key: 'hardware', icon: '🔧', name: 'Hardware Store Run', text: 'Upgrades and specialisations cost 20% less.', apply: (m) => (m.upCost *= 0.8) },
  { key: 'pocket', icon: '💰', name: 'Pocket Money', text: '+20% points for every takedown.', apply: (m) => (m.reward *= 1.2) },
  { key: 'sugar', icon: '🍭', name: 'Sugar Rush', text: 'Every fort fires 12% faster.', apply: (m) => (m.rate *= 1.12) },
  { key: 'binoculars', icon: '🔭', name: "Dad's Binoculars", text: 'Every fort gets +12% range.', apply: (m) => (m.range *= 1.12) },
  { key: 'bikes', icon: '🚲', name: 'New Bikes', text: 'Kids get to forts 50% faster, and chores take less time.', apply: (m) => { m.run *= 1.5; m.chore *= 0.6; } },
  { key: 'report', icon: '📜', name: 'Good Report Card', text: 'The kids get in trouble half as often.', apply: (m) => (m.trouble *= 0.5) },
  {
    key: 'fence', icon: '🪵', name: 'Dad Fixes the Fence', text: '+5 max sack health, and patch 5 now.',
    apply: (m, g) => { g.maxSackHp += 5; g.sackHp = Math.min(g.maxSackHp, g.sackHp + 5); g.world.setDamage(1 - g.sackHp / g.maxSackHp); },
  },
  {
    key: 'cousin', icon: '🧒', name: 'Cousin Comes to Stay', text: 'A free extra kid joins the crew (even past 20).',
    apply: (m, g) => { m.extraBoys++; g.addBoy(false); g.ui.renderRoster(); },
  },
  { key: 'hose', icon: '🚿', name: 'Garden Hose', text: 'Water damage +30%.', apply: (m) => mulType(m, 'water', 1.3) },
  { key: 'crackers', icon: '🧨', name: 'Cracker Night Stash', text: 'Fire damage +30% (rockets and magnifiers).', apply: (m) => mulType(m, 'fire', 1.3) },
  { key: 'batteries', icon: '🔋', name: 'Fresh Batteries', text: 'Zap damage +30%.', apply: (m) => mulType(m, 'zap', 1.3) },
  { key: 'pebbles', icon: '🪨', name: 'Creek Pebbles', text: 'Slingshot damage +30%.', apply: (m) => mulType(m, 'impact', 1.3) },
  { key: 'foam', icon: '🧽', name: 'Foam Party', text: 'Foam dart damage +30%.', apply: (m) => mulType(m, 'foam', 1.3) },
  { key: 'bulk', icon: '🧂', name: 'Bulk Salt', text: 'Salt damage +30%.', apply: (m) => mulType(m, 'salt', 1.3) },
  // Twists: something good, something bad.
  {
    key: 'heatwave', icon: '🥵', name: 'Heatwave', twist: true, text: 'Fire golems are 25% faster, but water damage +50% and balloons splash 30% wider.',
    apply: (m) => { mulGolem(m.golemSpeed, 'fire', 1.25); mulType(m, 'water', 1.5); m.splash *= 1.3; },
  },
  {
    key: 'coldsnap', icon: '🥶', name: 'Cold Snap', twist: true, text: 'Ice golems are 40% tougher, but every other creature moves 10% slower.',
    apply: (m) => { mulGolem(m.golemHp, 'ice', 1.4); mulGolem(m.golemSpeed, '*', 0.9); mulGolem(m.golemSpeed, 'ice', 1 / 0.9); },
  },
  {
    key: 'stormseason', icon: '⛈️', name: 'Storm Season', twist: true, text: 'Storm golems are 50% tougher, but zap damage +60%.',
    apply: (m) => { mulGolem(m.golemHp, 'storm', 1.5); mulType(m, 'zap', 1.6); },
  },
  {
    key: 'treasure', icon: '🪙', name: 'Buried Treasure', twist: true, text: '+400 points right now, but every creature is 8% tougher from here on.',
    apply: (m, g) => { g.points += 400; mulGolem(m.golemHp, '*', 1.08); },
  },
  {
    key: 'sleepover', icon: '🛌', name: 'Big Sleepover', twist: true, text: 'Kids do +15% damage, but they get in trouble twice as often.',
    apply: (m) => { m.dmg *= 1.15; m.trouble *= 2; },
  },
];

// Three different cards the crew hasn't already taken, at least one of them a plain perk.
export function drawPerks(taken, n = 3) {
  const pool = PERKS.filter((p) => !taken.includes(p.key));
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  if (out.length && out.every((p) => p.twist)) {
    const plain = pool.filter((p) => !p.twist);
    if (plain.length) out[0] = plain[Math.floor(Math.random() * plain.length)];
  }
  return out;
}
