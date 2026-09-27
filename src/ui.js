import { WEAPONS, GOLEMS, FORT_LEVELS, WEAPON_LEVELS, TEAM_LEVEL, TEAM_BONUS, makeWave, summarizeWave, summarizeElites, ELITES, SPECS, weekOf, DIFFICULTIES, STAGES, holidayOf, holidayLabel } from './config.js';
import { DETOURS } from './path.js';
import { PERKS } from './perks.js';
import { fetchScores, submitScore, lastName, boardHTML } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const stars = (lvl) => '★'.repeat(lvl + 1) + '☆'.repeat(WEAPON_LEVELS.length - 1 - lvl);
const MAX_W = WEAPON_LEVELS.length - 1;
const pct = (m) => `+${Math.round((m - 1) * 100)}%`;
const TARGETS = [['first', 'First'], ['strong', 'Strongest'], ['close', 'Closest']];

function setText(el, v) {
  if (!el) return;
  const s = String(v);
  if (el._v !== s) {
    el._v = s;
    el.textContent = s;
  }
}
function setHTML(el, v) {
  if (el._h !== v) {
    el._h = v;
    el.innerHTML = v;
  }
}

// Which golems a weapon is strong/weak against, from their resistances.
function matchups(w) {
  const strong = [];
  const weak = [];
  for (const g of Object.values(GOLEMS)) {
    if (g.boss || g.hidden) continue;
    const m = g.resist[w.dmgType] ?? 1;
    if (m >= 1.5) strong.push(g.icon);
    if (m <= 0.5) weak.push(g.icon);
  }
  return { strong, weak };
}

export class UI {
  constructor(game) {
    this.g = game;
    this.e = {
      points: $('points'), hp: $('hp'), wave: $('wave'), boys: $('boys'),
      waveBtn: $('waveBtn'), waveInfo: $('waveInfo'), waveTitle: $('waveTitle'),
      build: $('buildbar'), panel: $('fortPanel'), roster: $('rosterList'),
      toasts: $('toasts'), hint: $('hint'), speed: $('speedBtn'), mute: $('muteBtn'),
      pause: $('pauseBtn'), flash: $('dmgFlash'), title: $('title'), end: $('end'),
      trail: $('trailPanel'), fade: $('nightFade'), clock: $('clock'), dayFill: $('dayFill'),
    };
    this.panelFort = null;
    this.toastLast = new Map();
    this.buildCards();
    this.bind();
    this.renderDifficulty();
    this.refreshBoards();
  }

  buildCards() {
    const cards = Object.values(WEAPONS).map((w, i) => {
      const { strong, weak } = matchups(w);
      return `<button class="card" data-build="${w.key}">
        <span class="key">${i + 1}</span>
        <span class="icon">${w.icon}</span>
        <span class="name">${w.name}</span>
        <span class="desc">${w.desc}</span>
        <span class="vs">${strong.length ? `<i class="good">Strong vs ${strong.join('')}</i>` : ''}${weak.length ? `<i class="bad">Weak vs ${weak.join('')}</i>` : ''}</span>
        <span class="cost" id="cost-${w.key}">⭐ ${w.cost}</span>
      </button>`;
    });
    cards.push(`<button class="card trailcard" data-trail="1">
        <span class="key">T</span>
        <span class="icon">🚧</span>
        <span class="name">Trail Works</span>
        <span class="desc">Dig a detour so golems walk further. Mornings only.</span>
        <span class="vs"></span>
        <span class="cost" id="trailCost">⭐ 350</span>
      </button>`);
    cards.push(`<button class="card recruit" data-recruit="1">
        <span class="key">R</span>
        <span class="icon">👦</span>
        <span class="name">Recruit a Boy</span>
        <span class="desc">Knock on a door. A fort only fires with a boy in it.</span>
        <span class="vs"></span>
        <span class="cost" id="recruitCost">⭐ 60</span>
      </button>`);
    this.e.build.innerHTML = cards.join('');
    this.cards = [...this.e.build.querySelectorAll('.card')];
  }

  bind() {
    const g = this.g;
    this.e.build.addEventListener('click', (ev) => {
      const c = ev.target.closest('.card');
      if (!c) return;
      if (c.dataset.build) g.setBuild(c.dataset.build);
      else if (c.dataset.trail) this.toggleTrail();
      else g.recruit();
    });
    this.e.waveBtn.addEventListener('click', () => g.mainAction());
    this.e.speed.addEventListener('click', () => g.toggleSpeed());
    $('crewHead').addEventListener('click', () => this.toggleRoster());
    try { if (localStorage.getItem('theSack.crewMin')) document.body.classList.add('crew-min'); } catch {}
    $('crewBtn').addEventListener('click', () => document.body.classList.toggle('show-crew'));
    this.e.mute.addEventListener('click', () => g.toggleMute());
    $('musicBtn').addEventListener('click', () => g.music.toggle());
    this.e.pause.addEventListener('click', () => g.togglePause());
    this.e.panel.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      const f = this.panelFort;
      if (!b || !f) return;
      if (b.dataset.boy) {
        g.assignBoy(g.boys.find((x) => x.id === +b.dataset.boy), f);
        return;
      }
      switch (b.dataset.a) {
        case 'close': g.select(null); break;
        case 'home': g.sendHome(f, g.boys.find((x) => x.id === +b.dataset.who)); break;
        case 'callback': g.callBack(g.boys.find((x) => x.id === +b.dataset.who)); this.renderPanel(); break;
        case 'upFort': g.upgradeFort(f); break;
        case 'upWeapon': g.upgradeWeapon(f); break;
        case 'spec': g.specialise(f, +b.dataset.i); break;
        case 'sell': g.sellFort(f); break;
        case 'target':
          f.targeting = b.dataset.t;
          g.audio.play('click');
          this.renderPanel();
          break;
      }
    });
    this.e.roster.addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-boy]');
      if (!row) return;
      const boy = g.boys.find((x) => x.id === +row.dataset.boy);
      if (!boy) return;
      if (g.selected && boy.fort !== g.selected) g.assignBoy(boy, g.selected);
      else if (boy.fort) {
        g.select(boy.fort);
        g.focusOn(boy.fort.pos);
      }
    });
    this.e.trail.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.a === 'close') this.hideTrail();
      else if (b.dataset.detour) g.buyDetour(b.dataset.detour);
    });
    this.e.trail.addEventListener('pointerover', (ev) => {
      const b = ev.target.closest('[data-detour]');
      g.previewDetour(b ? b.dataset.detour : null);
    });
    this.e.trail.addEventListener('pointerleave', () => g.previewDetour(null));
    $('playBtn').addEventListener('click', () => g.start());
    $('diffs').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-diff]');
      if (!b) return;
      g.audio.ensure();
      g.audio.play('click');
      g.chooseDifficulty(b.dataset.diff);
      this.renderDifficulty();
    });
    $('perkCards').addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-perk]');
      if (c) g.takePerk(c.dataset.perk);
    });
    $('holNext').addEventListener('click', () => g.toTerm());
    $('termSkip').addEventListener('click', () => g.endTerm());
    $('nightOpts').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-opt]');
      if (b) g.resolveNight(+b.dataset.opt);
    });
    $('perkStrip').addEventListener('click', () => {
      for (const k of g.perks) {
        const p = PERKS.find((x) => x.key === k);
        this.toast(`${p.icon} ${p.name}: ${p.text}`);
      }
    });
    $('againBtn').addEventListener('click', () => location.reload());
    $('endlessBtn').addEventListener('click', () => g.continueEndless());
    $('scoreForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      this.saveScore();
    });
  }

  // ---------- per-frame ----------
  update() {
    const g = this.g;
    const e = this.e;
    setText(e.points, g.points);
    setText(e.hp, g.sackHp);
    setText(e.wave, Math.max(1, g.phase === 'morning' ? g.wave + 1 : g.wave));
    setText($('bestLbl'), g.best ? `${g.diff.name} · best ${g.best}` : `${g.diff.name} · day`);
    const free = g.boys.filter((b) => !b.fort).length;
    setText(e.boys, `${free}/${g.boys.length}`);
    setText(e.speed, `${g.speed}×`);
    setText(e.mute, g.audio.muted ? '🔇' : '🔊');
    $('musicBtn').classList.toggle('off', !g.music.on);
    setText(e.pause, g.paused ? '▶' : '⏸');

    const key = `${g.points}|${g.boys.length}|${g.recruits}|${g.detours.size}|${g.phase}|${g.perks.length}`;
    if (key !== this.cardKey) {
      this.cardKey = key;
      for (const c of this.cards) {
        if (c.dataset.build) {
          const cost = g.fortCost(c.dataset.build);
          c.classList.toggle('poor', g.points < cost);
          setText($(`cost-${c.dataset.build}`), `⭐ ${cost}`);
        }
        else if (c.dataset.trail) {
          const done = g.detours.size >= DETOURS.length;
          c.classList.toggle('poor', done || g.phase !== 'morning' || g.points < g.detourCost());
          setText($('trailCost'), done ? 'All dug' : `⭐ ${g.detourCost()}`);
          if (this.trailOpen) this.updateTrail();
        } else {
          const full = g.boys.length >= g.maxBoys;
          c.classList.toggle('poor', full || g.points < g.recruitCost());
          setText($('recruitCost'), full ? 'Full crew' : `⭐ ${g.recruitCost()}`);
        }
      }
    }

    if (g.phase === 'day') {
      const left = g.queue.length + g.golems.length;
      setHTML(e.waveBtn, left ? `${left} creature${left === 1 ? '' : 's'} about` : `🍝 All clear! Skip to Day ${g.wave + 1} <small>Space</small>`);
    } else if (g.phase === 'dusk' || g.phase === 'night') {
      setHTML(e.waveBtn, `⏭ Skip to Day ${g.wave + 1} <small>Space</small>`);
    } else {
      setHTML(e.waveBtn, `🎒 Head out · Day ${g.wave + 1} <small>Space</small>`);
    }
    e.waveBtn.disabled = !(g.phase === 'morning' || g.canSkip) || g.over || !g.started;
    setText(e.clock, g.clockText());
    const p = g.phase === 'day' ? Math.min(1, g.dayT / g.dayLen) : g.phase === 'morning' ? 0 : 1;
    e.dayFill.style.width = `${(p * 100).toFixed(1)}%`;

    if (this.panelFort) this.updatePanel();
    this.updateRoster();
    this.updateHint();
  }

  updateBuildActive() {
    for (const c of this.cards) c.classList.toggle('active', c.dataset.build === this.g.buildKey);
  }

  updateHint() {
    const g = this.g;
    let h = '';
    if (g.paused) h = '⏸ Paused — press <b>P</b> to keep going';
    else if (g.buildKey && g.touch) h = `Tap the map to place your <b>${WEAPONS[g.buildKey].name}</b>, tap again to build · tap the card to cancel`;
    else if (g.buildKey) h = `Click out in the bush to build a <b>${WEAPONS[g.buildKey].name}</b> · <b>Shift</b>-click to keep building · Right-click/<b>Esc</b> to cancel`;
    else if (!g.started) h = '';
    else if (g.phase === 'dusk' || g.phase === 'night') h = '🍝 The parents are calling everyone in. Press <b>Space</b> to skip to tomorrow.';
    else if (!g.forts.length) h = g.touch ? 'Tap a fort card below, then tap the map near the fire trail.' : 'Pick a fort from the bar below (<b>1–7</b>) and build it near the fire trail behind the houses.';
    else {
      const un = g.forts.filter((f) => !f.crew.length).length;
      if (un) h = `⚠️ ${un} fort${un > 1 ? 's have' : ' has'} nobody in ${un > 1 ? 'them' : 'it'}. Click it and send a boy, or recruit one (<b>R</b>).`;
      else if (g.phase === 'morning') h = g.touch ? 'Morning! Build and upgrade, then tap <b>Head out</b>.' : 'Morning! Build, upgrade, dig the trail (<b>T</b>), then press <b>Space</b> to head out.';
    }
    setHTML(this.e.hint, h);
    this.e.hint.classList.toggle('hidden', !h);
  }

  setWavePreview() {
    const g = this.g;
    const n = g.phase === 'morning' ? g.wave + 1 : g.wave;
    const w = g.waveFor(n);
    const sum = summarizeWave(w);
    const hol = holidayOf(n);
    setText(this.e.waveTitle, `${hol.icon} ${hol.short} · Day ${hol.dayIn} of ${hol.len}${hol.dayIn === hol.len ? ' · LAST DAY' : ''}`);
    const chips = sum
      .map(({ type, count }) => `<span class="chip el-${type}" title="${GOLEMS[type].name}">${GOLEMS[type].icon}<b>${count}</b></span>`)
      .join('');
    // Only explain creatures that are new (arrived in the last few days) or the boss.
    const fresh = g.phase === 'morning' || g.phase === 'day' ? g.newToday || new Set() : new Set();
    const tips = sum
      .filter(({ type }) => fresh.has(type) || GOLEMS[type].boss)
      .map(({ type }) => `<li><b>${fresh.has(type) ? 'NEW' : 'BOSS'}</b> ${GOLEMS[type].tip}</li>`)
      .join('');
    const elites = summarizeElites(w)
      .map(({ key, count }) => `<span class="chip el-elite" title="${ELITES[key].name}: ${ELITES[key].desc}">${ELITES[key].icon}<b>${count}</b></span>`)
      .join('');
    const riftChip = w.rifts > 1 ? `<span class="chip el-rift" title="${w.rifts} rifts open">🌀<b>${w.rifts}</b></span>` : '';
    this.e.waveInfo.innerHTML = `<div class="chips">${riftChip}${chips}${elites}</div>${tips ? `<ul class="tips">${tips}</ul>` : ''}`;
  }

  // ---------- fort panel ----------
  showFort(f) {
    if (this.trailOpen) this.hideTrail();
    this.panelFort = f;
    this.renderPanel();
    this.e.panel.classList.remove('hidden');
  }

  hideFort() {
    this.panelFort = null;
    this.e.panel.classList.add('hidden');
  }

  renderPanel() {
    const f = this.panelFort;
    if (!f) return;
    const g = this.g;
    const w = f.weapon;
    const fl = FORT_LEVELS[f.level];
    const next = FORT_LEVELS[f.level + 1];
    const freeBoys = g.boys.filter((b) => !b.fort);
    const others = g.boys.filter((b) => b.fort && b.fort !== f);

    const away = { grounded: '😠 Grounded today', late: '⏰ Out later' };
    const boyBtn = (b, verb, extra) =>
      b.away
        ? `<button class="small boybtn" disabled title="${b.name}: ${away[b.away]}"><span class="dot" style="background:${b.shirtCss}"></span><span><b>${b.name}</b><em>${away[b.away]}</em></span></button>`
        : `<button class="small boybtn" data-boy="${b.id}" title="${verb} ${b.name} (${extra})"><span class="dot" style="background:${b.shirtCss}"></span><span><b>${b.name}</b><em>${extra}</em></span></button>`;
    let crew = f.crew
      .map((b, i) => `<div class="crewmate"><span class="dot" style="background:${b.shirtCss}"></span><div><b>${b.name}</b> <em title="${b.trait.desc}">${b.trait.icon} ${b.trait.name}</em><small id="fp-cm-${i}"></small><div class="boredbar"><i id="fp-bb-${i}"></i></div></div>${b.drifting ? `<button class="small ice" data-a="callback" data-who="${b.id}" title="Bribe ${b.name} back with an icy pole">🍦 ⭐${g.iceCost()}</button>` : ''}<button class="x" data-a="home" data-who="${b.id}" title="Send ${b.name} back to the sack">✕</button></div>`)
      .join('');
    if (f.crew.length < f.maxCrew) {
      const pool = freeBoys.length ? freeBoys.map((b) => boyBtn(b, 'Send', `${b.trait.icon} ${b.trait.name}`)) : others.filter((b) => !f.crew.includes(b)).map((b) => boyBtn(b, 'Move', `from ${b.fort.weapon.short}`));
      if (f.crew.length) crew += `<div class="teamnote">🤝 Room for one more: a team gets ${pct(TEAM_BONUS.rate)} fire rate and ${pct(TEAM_BONUS.dmg)} damage.</div>`;
      if (!freeBoys.length) crew += `<div class="warn">No free boys. Recruit one (<b>R</b>)${pool.length ? ' or pull one from another fort:' : '.'}</div>`;
      if (pool.length) crew += `${freeBoys.length ? '<div class="sendhead">Send a kid:</div>' : ''}<div class="sendlist">${pool.join('')}</div>`;
    } else if (f.maxCrew === 1) {
      crew += `<div class="teamnote strong">👥 Only fits one kid. Build it up to a ${FORT_LEVELS[TEAM_LEVEL].name} (<b>U</b>) to fit a second kid. Two kids work as a team.</div>`;
    }

    this.e.panel.innerHTML = `
      <div class="ph">
        <div><h3>${fl.name}</h3><div class="sub">${w.icon} ${w.short} <span class="stars">${stars(f.wlevel)}</span></div></div>
        <button class="x" data-a="close" title="Close (Esc)">✕</button>
      </div>
      <div class="ups">
        ${next
          ? `<button data-a="upFort" id="fp-upFort"><b>🔨 Build it up → ${next.name}</b><small>More range and damage · U</small><span class="cost">⭐ ${g.fortUpCost(f)}</span></button>`
          : `<div class="maxed">🏆 Best fort on the street</div>`}
        ${f.wlevel < MAX_W
          ? `<button data-a="upWeapon" id="fp-upW"><b>⚙️ Upgrade ${w.short} ${stars(f.wlevel + 1)}</b><small>Hits harder, fires faster · G</small><span class="cost">⭐ ${g.weaponUpCost(f)}</span></button>`
          : f.spec
            ? `<div class="maxed">🏆 ${w.icon} ${w.short}: ${w.desc}</div>`
            : `<div class="spechead">🌟 All 5 stars! Pick a specialisation:</div>${(SPECS[f.base.key] || [])
                .map((sp, i) => `<button data-a="spec" data-i="${i}" class="spec"><b>${sp.icon} ${sp.name}</b><small>${sp.desc}</small><span class="cost">⭐ ${g.specCost(f)}</span></button>`)
                .join('')}`}
      </div>
      <div class="crewline" id="fp-crew"></div>
      ${crew}
      <div class="stats">
        <div><span>Range</span><b id="fp-range"></b></div>
        <div><span>Damage</span><b id="fp-dmg"></b></div>
        <div><span>${w.beam ? 'Heat' : 'Shots/s'}</span><b id="fp-rate"></b></div>
        <div><span>K.O.s</span><b id="fp-kills"></b></div>
      </div>
      <div class="targeting"><span>Aim at</span>${TARGETS.map(([t, l]) => `<button data-a="target" data-t="${t}" class="${f.targeting === t ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button data-a="sell" class="sell">Pull it down (+⭐ ${f.sellValue()})</button>
    `;
    this.e.panel._h = null;
    this.updatePanel();
  }

  updatePanel() {
    const f = this.panelFort;
    const g = this.g;
    const st = f.stats();
    let crew = '';
    if (!f.crew.length) crew = '⚠️ Nobody is manning this fort, so it won\'t fire!';
    else if (st.team) crew = '🤝 Teamwork bonus! Two kids on the job.';
    const crewEl = $('fp-crew');
    setText(crewEl, crew);
    crewEl.classList.toggle('bad', !f.crew.length);
    crewEl.classList.toggle('team', !!st.team);
    f.crew.forEach((b, i) => {
      let t;
      if (b.away === 'grounded') t = '😠 Grounded today';
      else if (b.away === 'late') t = '⏰ Not allowed out till later';
      else if (b.onChore) t = '🧹 Called in for chores';
      else if (b.drifting) t = `${b.drifting.label} (back in ${Math.ceil(b.driftT)}s)`;
      else if (b.task === 'bed' || b.asleep) t = '🍝 Home for dinner';
      else if (b.state === 'manning' && b.fort === f) t = b.bored > 0.7 ? '🥱 Sooo bored. Move him somewhere busier?' : g.banned === f.base.key ? '🚫 Mum confiscated it for today' : b.tired ? '😪 Tired from the sleepover' : '✅ On the job';
      else t = '🏃 Running over…';
      setText($(`fp-cm-${i}`), t);
      const bb = $(`fp-bb-${i}`);
      if (bb) {
        bb.style.width = `${Math.round(Math.min(1, b.bored) * 100)}%`;
        bb.parentNode.classList.toggle('hot', b.bored > 0.7);
      }
    });
    setText($('fp-range'), st.range.toFixed(1));
    setText($('fp-dmg'), st.damage.toFixed(0));
    setText($('fp-rate'), f.weapon.beam ? `${(f.beamT ? f.heat || 1 : 1).toFixed(1)}×` : st.rate.toFixed(2));
    setText($('fp-kills'), f.kills);
    const up = $('fp-upFort');
    if (up) up.classList.toggle('poor', g.points < g.fortUpCost(f));
    const uw = $('fp-upW');
    if (uw) uw.classList.toggle('poor', g.points < g.weaponUpCost(f));
    for (const b of this.e.panel.querySelectorAll('.spec')) b.classList.toggle('poor', g.points < g.specCost(f));
  }

  // ---------- roster ----------
  // One short line per kid so a full crew of 20 still fits.
  renderRoster() {
    this.e.roster.innerHTML = this.g.boys
      .map(
        (b) => `<div class="boy" data-boy="${b.id}" title="${b.name} · ${b.trait.name}: ${b.trait.desc}">
          <span class="dot" style="background:${b.shirtCss}"></span><b>${b.name}</b><i class="ptrait">${b.trait.icon}</i><small id="bs-${b.id}"></small>
        </div>`,
      )
      .join('');
  }

  updateRoster() {
    let free = 0;
    let busy = 0;
    for (const b of this.g.boys) {
      let s;
      if (b.away === 'grounded') s = '😠 Grounded';
      else if (b.away === 'late') s = '⏰ Out later';
      else if (b.state === 'asleep' || b.task === 'bed') s = '🍝 Dinner';
      else if (b.onChore) s = b.state === 'inside' ? `🧹 Chores ${Math.ceil(b.choreT)}s` : '🧹 Chores';
      else if (b.drifting) s = b.drifting.label;
      else if (b.state === 'manning' && b.bored > 0.7) s = '🥱 Bored';
      else if (b.fort) s = b.state === 'manning' ? `${b.fort.weapon.icon} ${b.fort.weapon.short}` : `🏃 ${b.fort.weapon.short}`;
      else s = '🙂 Free';
      if (b.fort) busy++;
      else if (!b.away) free++;
      setText($(`bs-${b.id}`), s);
    }
    setText($('crewSum'), `${busy} on forts · ${free} free`);
  }

  toggleRoster() {
    const on = document.body.classList.toggle('crew-min');
    try { localStorage.setItem('theSack.crewMin', on ? '1' : ''); } catch {}
  }

  // ---------- weekly picks ----------
  showPerks(cards, week) {
    const el = $('perkPick');
    setText($('perkWeek'), week);
    $('perkCards').innerHTML = cards
      .map((p, i) => `<button class="perk${p.twist ? ' twist' : ''}" data-perk="${p.key}">
          <span class="key">${i + 1}</span>
          <span class="picon">${p.icon}</span>
          <b>${p.name}</b>
          ${p.twist ? '<em>Twist</em>' : ''}
          <small>${p.text}</small>
        </button>`)
      .join('');
    el.classList.remove('hidden');
  }

  hidePerks() {
    $('perkPick').classList.add('hidden');
  }

  renderPerks() {
    const taken = this.g.perks.map((k) => PERKS.find((p) => p.key === k));
    const el = $('perkStrip');
    el.innerHTML = taken.map((p) => `<span title="${p.name}: ${p.text}">${p.icon}</span>`).join('');
    el.classList.toggle('hidden', !taken.length);
  }

  // ---------- end of the holidays / term time ----------
  showHolidayEnd(h, st) {
    const next = holidayOf(h.last + 1);
    $('holTitle').textContent = `${h.icon} ${h.name}: done!`;
    $('holText').textContent = h.key === 'christmas'
      ? `That's the whole school year${h.year > 1 ? ` (Year ${h.year})` : ''}. Back to school for a new year… and the ${next.name} are only a term away.`
      : `You held Wattle Court for the whole ${h.short.toLowerCase()} holidays. Now it's back to school for a term. Next up: the ${next.name}.`;
    $('holStats').innerHTML = `
      <div><b>${h.len}</b><span>days held</span></div>
      <div><b>${st.kills}</b><span>creatures smashed</span></div>
      <div><b>${st.leaked}</b><span>got into the sack</span></div>
      <div><b>${this.g.boys.length}</b><span>kids in the crew</span></div>`;
    $('holidayEnd').classList.remove('hidden');
  }

  hideHolidayEnd() {
    $('holidayEnd').classList.add('hidden');
  }

  showTerm(report, next) {
    $('termList').innerHTML = report.map((r) => `<li>${r}</li>`).join('');
    $('termSkip').textContent = `${next.icon} Start the ${next.name}!`;
    $('termNext').textContent = `${next.weeks} weeks. The sack's all fixed up. It starts easier than it ended, but it builds up faster.`;
    $('term').classList.remove('hidden');
  }

  hideTerm() {
    $('term').classList.add('hidden');
  }

  // ---------- tonight on Wattle Court ----------
  showNightEvent(ev) {
    $('nightIcon').textContent = ev.icon;
    $('nightText').textContent = ev.text;
    $('nightOpts').innerHTML = ev.options
      .map((o, i) => `<button data-opt="${i}" class="${o.cost && this.g.points < o.cost ? 'poor' : ''}"><span class="okey">${i + 1}</span><span class="olabel">${o.label}</span>${o.cost ? ` <span class="cost">⭐ ${o.cost}</span>` : ''}</button>`)
      .join('');
    $('nightEvent').classList.remove('hidden');
  }

  hideNightEvent() {
    $('nightEvent').classList.add('hidden');
  }

  // ---------- messages / overlays ----------
  toast(msg, kind = '') {
    const now = performance.now();
    if (now - (this.toastLast.get(msg) || 0) < 1500) return;
    this.toastLast.set(msg, now);
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    this.e.toasts.appendChild(el);
    while (this.e.toasts.children.length > 4) this.e.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3500);
  }

  damageFlash() {
    this.e.flash.style.opacity = '1';
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => (this.e.flash.style.opacity = '0'), 150);
  }

  hideTitle() {
    this.e.title.classList.add('hidden');
  }

  showEnd() {
    const g = this.g;
    const record = g.wave >= g.best;
    $('endTitle').textContent = 'Back to School!';
    const h = holidayOf(g.wave);
    $('endText').textContent = `The golems took over Wattle Court on day ${h.dayIn} of the ${h.year > 1 ? `Year ${h.year} ` : ''}${h.name}. It's back to school early.${record ? ' Longest run ever!' : ''}`;
    $('endStats').innerHTML = `
      <div><b>${g.wave}</b><span>days of holidays (${holidayLabel(g.wave)})</span></div>
      <div><b>${g.best}</b><span>best on ${g.diff.name}</span></div>
      <div><b>${g.stats.kills}</b><span>golems smashed</span></div>
      <div><b>${g.boys.length}</b><span>boys in the crew</span></div>`;
    $('endlessBtn').classList.add('hidden');
    $('scoreName').value = lastName();
    $('scoreForm').classList.remove('hidden');
    $('scoreSave').disabled = false;
    $('scoreSaved').classList.add('hidden');
    this.refreshBoards();
    setTimeout(() => $('scoreName').focus(), 300);
    this.e.end.classList.toggle('win', record);
    this.e.end.classList.remove('hidden');
  }

  renderDifficulty() {
    const g = this.g;
    $('diffs').innerHTML = DIFFICULTIES.map(
      (d) => `<button data-diff="${d.key}" class="${d.key === g.diffKey ? 'on' : ''}"><span>${d.icon}</span>${d.name}</button>`,
    ).join('');
    const d = g.diff;
    $('diffDesc').innerHTML = `${d.desc}${g.best ? ` <b>Your best: day ${g.best}</b>` : ''}`;
    if (this.scores) this.renderBoards();
  }

  // ---------- leaderboard ----------
  async refreshBoards(highlight = null) {
    const { scores, shared } = await fetchScores();
    this.scores = scores;
    this.sharedScores = shared;
    this.renderBoards(highlight);
  }

  renderBoards(highlight = null) {
    const g = this.g;
    const where = this.sharedScores ? 'Household leaderboard' : 'Leaderboard (this computer)';
    setText($('titleBoardTitle'), `🏆 ${where} · ${g.diff.name}`);
    $('titleBoard').innerHTML = boardHTML(this.scores, g.diffKey, { limit: 5 });
    $('endBoard').innerHTML = `<h4>🏆 ${where} · ${g.diff.name}</h4>${boardHTML(this.scores, g.diffKey, { limit: 10, highlight })}`;
  }

  async saveScore() {
    const g = this.g;
    const input = $('scoreName');
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    $('scoreSave').disabled = true;
    const { entry, shared } = await submitScore({ name, difficulty: g.diffKey, day: g.wave, kills: g.stats.kills });
    $('scoreForm').classList.add('hidden');
    await this.refreshBoards(entry.id);
    const place = this.scores.filter((s) => s.difficulty === g.diffKey).findIndex((s) => s.id === entry.id) + 1;
    const saved = $('scoreSaved');
    saved.textContent = `Saved! ${name} is #${place} on ${g.diff.name}${shared ? '' : ' (on this computer only: the leaderboard server wasn\'t reachable)'}.`;
    saved.classList.remove('hidden');
    g.audio.play(place === 1 ? 'win' : 'coin');
  }

  // ---------- trail works ----------
  toggleTrail() {
    if (this.trailOpen) this.hideTrail();
    else this.showTrail();
  }

  showTrail() {
    if (!this.g.started || this.g.over) return;
    this.g.select(null);
    this.g.cancelBuild();
    this.trailOpen = true;
    this.renderTrail();
    this.e.trail.classList.remove('hidden');
  }

  hideTrail() {
    this.trailOpen = false;
    this.e.trail.classList.add('hidden');
    this.g.previewDetour(null);
  }

  renderTrail() {
    const g = this.g;
    const rows = DETOURS.map((d) => {
      if (g.detours.has(d.key)) return `<div class="detour done"><span class="dicon">${d.icon}</span><div><b>${d.name}</b><small>Dug ✓</small></div></div>`;
      return `<button class="detour" data-detour="${d.key}"><span class="dicon">${d.icon}</span><div><b>${d.name}</b><small>${d.desc}</small><small class="gain">+${g.detourGain(d.key)}m of trail</small></div><span class="cost">⭐ ${g.detourCost()}</span></button>`;
    }).join('');
    this.e.trail.innerHTML = `
      <div class="ph"><div><h3>Trail Works</h3><div class="sub">Trail is ${Math.round(g.path.length)}m long. Hover to preview.</div></div><button class="x" data-a="close">✕</button></div>
      <div class="detours">${rows}</div>
      <div class="note" id="trailNote"></div>`;
    this.updateTrail();
  }

  updateTrail() {
    const g = this.g;
    const note = $('trailNote');
    if (!note) return;
    setText(note, g.phase !== 'morning' ? 'The boys can only dig in the morning, before heading out.' : 'Each detour costs more than the last. Forts in the way get packed up with a full refund.');
    for (const b of this.e.trail.querySelectorAll('[data-detour]')) b.classList.toggle('poor', g.phase !== 'morning' || g.points < g.detourCost());
  }

  night(on, nextDay) {
    if (on) {
      const h = holidayOf(nextDay);
      setText($('fadeDay'), `${h.short} · Day ${h.dayIn}`);
    }
    this.e.fade.classList.toggle('on', on);
  }

  hideEnd() {
    this.e.end.classList.add('hidden');
  }
}
