// Tonight on Wattle Court: some nights something comes up at the dinner table,
// and the crew has to decide. Consequences land tomorrow (or the day after).
import { LITTLE } from './config.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LITTLE_NAMES = ['Mia', 'Ruby', 'Pip', 'Tilly', 'Alfie', 'Bea', 'Ned', 'Lulu'];

// Each event: when(g) -> can it happen, make(g) -> { icon, text, options: [{ label, cost?, apply }] }
const EVENTS = [
  {
    key: 'sleepover',
    when: (g) => g.crewKids().length >= 2,
    make(g) {
      const [a, b] = g.pickKids(2);
      return {
        icon: '🛏️',
        text: `${a.name} wants to sleep over at ${b.name}'s.`,
        options: [
          { label: 'Sure! (both tired tomorrow, but never bored)', apply: () => g.plan(1, () => [a, b].forEach((k) => { k.tired = true; k.boredLock = true; })) },
          { label: 'Nah, not tonight (they sulk)', apply: () => g.plan(1, () => [a, b].forEach((k) => (k.bored = 0.6))) },
        ],
      };
    },
  },
  {
    key: 'mud',
    when: (g) => g.crewKids().length >= 1,
    make(g) {
      const [a] = g.pickKids(1);
      const cost = 30 + g.wave * 3;
      return {
        icon: '👟',
        text: `${a.name} tracked mud right through the lounge room.`,
        options: [
          { label: `Let him cop it (grounded tomorrow)`, apply: () => g.plan(1, () => a.stayHome('grounded')) },
          { label: 'Clean it up before Mum sees', cost, apply: () => {} },
        ],
      };
    },
  },
  {
    key: 'window',
    when: (g) => g.forts.length > 0,
    make(g) {
      const f = pick(g.forts);
      const w = f.base;
      const cost = 60 + g.wave * 5;
      return {
        icon: '🪟',
        text: `Something from the ${w.short} went straight through Mrs Patterson's window.`,
        options: [
          { label: 'Own up and pay for it', cost, apply: () => {} },
          { label: `Blame the golems (Mum confiscates every ${w.short} tomorrow)`, apply: () => g.plan(1, () => (g.banned = w.key)) },
        ],
      };
    },
  },
  {
    key: 'telly',
    when: (g) => g.crewKids().length >= 4,
    make(g) {
      return {
        icon: '📺',
        text: 'The monster movie marathon is on telly tonight.',
        options: [
          { label: 'Stay up and watch (3 kids out late, everyone +15% damage acting it out)', apply: () => g.plan(1, () => { g.pickKids(3).forEach((k) => k.stayHome('late')); g.dayMods.dmg *= 1.15; }) },
          { label: 'Bed on time', apply: () => {} },
        ],
      };
    },
  },
  {
    key: 'carwash',
    when: (g) => g.wave >= 3,
    make(g) {
      const pay = 50 + g.wave * 6;
      return {
        icon: '🚗',
        text: 'Dad will pay the whole crew to wash the car tomorrow.',
        options: [
          { label: `Wash the car (+⭐${pay}, everyone out late)`, apply: () => { g.points += pay; g.plan(1, () => g.crewKids().forEach((k) => k.stayHome('late'))); } },
          { label: 'No way, we\'re busy', apply: () => {} },
        ],
      };
    },
  },
  {
    key: 'sister',
    when: (g) => g.crewKids().length >= 1,
    make(g) {
      const [a] = g.pickKids(1);
      const sib = pick(LITTLE_NAMES);
      return {
        icon: '🧸',
        text: `Mum says ${a.name}'s little sister ${sib} has to play with you tomorrow.`,
        options: [
          { label: `Fine… (${sib} joins for the day, ${a.name} gets bored twice as fast)`, apply: () => g.plan(1, () => { g.addLittle(sib, a); a.annoyed = true; }) },
          { label: `Tell Mum she's too little (${a.name} stuck playing Barbies, out late)`, apply: () => g.plan(1, () => a.stayHome('late')) },
        ],
      };
    },
  },
  {
    key: 'grandparents',
    when: (g) => g.crewKids().length >= 2,
    make(g) {
      const [a] = g.pickKids(1);
      const gift = 40 + g.wave * 4;
      return {
        icon: '👵',
        text: `${a.name}'s grandparents are visiting tomorrow.`,
        options: [
          { label: `Stay in and be nice (home all day, Nan slips him ⭐${gift})`, apply: () => g.plan(1, () => { a.stayHome('grounded'); g.points += gift; }) },
          { label: 'Sneak out (grounded the day after)', apply: () => g.plan(2, () => a.stayHome('grounded')) },
        ],
      };
    },
  },
  {
    key: 'newkid',
    when: (g) => g.boys.length < g.maxBoys,
    weight: 0.5,
    make(g) {
      return {
        icon: '👀',
        text: 'A new family moved in. There\'s a kid peering over the back fence.',
        options: [
          { label: 'Ask him to play (free recruit tomorrow)', apply: () => g.plan(1, () => { if (g.boys.length < g.maxBoys) { g.addBoy(false); g.ui.renderRoster(); } }) },
          { label: 'Nah, he looks weird', apply: () => {} },
        ],
      };
    },
  },
  {
    key: 'frog',
    when: (g) => g.crewKids().some((k) => k.trait.key === 'ratbag'),
    make(g) {
      const a = pick(g.crewKids().filter((k) => k.trait.key === 'ratbag'));
      return {
        icon: '🐸',
        text: `${a.name} put a frog in his sister's bed. Everyone heard the scream.`,
        options: [
          { label: 'Classic. (grounded tomorrow, the crew thinks he\'s a legend: +10% damage)', apply: () => g.plan(1, () => { a.stayHome('grounded'); g.dayMods.dmg *= 1.1; }) },
          { label: 'Take the frog back to the creek (costs an apology)', cost: 25 + g.wave * 2, apply: () => {} },
        ],
      };
    },
  },
];

// From day 3, a bit over half of nights have something going on.
export function rollNightEvent(g) {
  if (g.wave < 3 || Math.random() > 0.55) return null;
  const ok = EVENTS.filter((e) => e.when(g) && e.key !== g.lastNightEvent);
  if (!ok.length) return null;
  const total = ok.reduce((a, e) => a + (e.weight ?? 1), 0);
  let r = Math.random() * total;
  const e = ok.find((x) => (r -= x.weight ?? 1) < 0) || ok[0];
  g.lastNightEvent = e.key;
  return e.make(g);
}

export { LITTLE };
