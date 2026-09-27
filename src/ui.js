import { WEAPONS, GOLEMS, FORT_LEVELS, WEAPON_LEVELS, TEAM_LEVEL, TEAM_BONUS, weaponUpgradeCost, MAX_BOYS, makeWave, summarizeWave, weekOf, DIFFICULTIES } from './config.js';
import { DETOURS } from './path.js';

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
        <span class="cost">⭐ ${w.cost}</span>
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
    this.e.mute.addEventListener('click', () => g.toggleMute());
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
        case 'upFort': g.upgradeFort(f); break;
        case 'upWeapon': g.upgradeWeapon(f); break;
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
    $('againBtn').addEventListener('click', () => location.reload());
    $('endlessBtn').addEventListener('click', () => g.continueEndless());
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
    setText(e.pause, g.paused ? '▶' : '⏸');

    const key = `${g.points}|${g.boys.length}|${g.recruits}|${g.detours.size}|${g.phase}`;
    if (key !== this.cardKey) {
      this.cardKey = key;
      for (const c of this.cards) {
        if (c.dataset.build) c.classList.toggle('poor', g.points < WEAPONS[c.dataset.build].cost);
        else if (c.dataset.trail) {
          const done = g.detours.size >= DETOURS.length;
          c.classList.toggle('poor', done || g.phase !== 'morning' || g.points < g.detourCost());
          setText($('trailCost'), done ? 'All dug' : `⭐ ${g.detourCost()}`);
          if (this.trailOpen) this.updateTrail();
        } else {
          const full = g.boys.length >= MAX_BOYS;
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
    else if (g.buildKey) h = `Click out in the bush to build a <b>${WEAPONS[g.buildKey].name}</b> · <b>Shift</b>-click to keep building · Right-click/<b>Esc</b> to cancel`;
    else if (!g.started) h = '';
    else if (g.phase === 'dusk' || g.phase === 'night') h = '🍝 The parents are calling everyone in. Press <b>Space</b> to skip to tomorrow.';
    else if (!g.forts.length) h = 'Pick a fort from the bar below (<b>1–7</b>) and build it near the fire trail behind the houses.';
    else {
      const un = g.forts.filter((f) => !f.crew.length).length;
      if (un) h = `⚠️ ${un} fort${un > 1 ? 's have' : ' has'} nobody in ${un > 1 ? 'them' : 'it'}. Click it and send a boy, or recruit one (<b>R</b>).`;
      else if (g.phase === 'morning') h = 'Morning! Build, upgrade, dig the trail (<b>T</b>), then press <b>Space</b> to head out.';
    }
    setHTML(this.e.hint, h);
    this.e.hint.classList.toggle('hidden', !h);
  }

  setWavePreview() {
    const g = this.g;
    const n = g.phase === 'morning' ? g.wave + 1 : g.wave;
    const w = makeWave(n);
    const sum = summarizeWave(w);
    setText(this.e.waveTitle, `${g.phase === 'morning' ? 'This arvo · ' : ''}Day ${n} · Week ${weekOf(n)}`);
    const chips = sum
      .map(({ type, count }) => `<span class="chip el-${type}">${GOLEMS[type].icon} ${GOLEMS[type].name} ×${count}</span>`)
      .join('');
    const tips = sum.map(({ type }) => `<li>${GOLEMS[type].tip}</li>`).join('');
    const riftChip = w.rifts > 1 ? `<span class="chip el-rift">🌀 ${w.rifts} rifts</span>` : '';
    this.e.waveInfo.innerHTML = `<div class="chips">${riftChip}${chips}</div><ul class="tips">${tips}</ul>`;
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
        ? `<button class="small boybtn" disabled><span class="dot" style="background:${b.shirtCss}"></span>${b.name}<em>${away[b.away]}</em></button>`
        : `<button class="small boybtn" data-boy="${b.id}"><span class="dot" style="background:${b.shirtCss}"></span>${verb} ${b.name}<em>${extra}</em></button>`;
    let crew = f.crew
      .map((b, i) => `<div class="crewmate"><span class="dot" style="background:${b.shirtCss}"></span><div><b>${b.name}</b> <em>${b.trait.name}</em><small id="fp-cm-${i}"></small></div><button class="x" data-a="home" data-who="${b.id}" title="Send ${b.name} back to the sack">✕</button></div>`)
      .join('');
    if (f.crew.length < f.maxCrew) {
      const pool = freeBoys.length ? freeBoys.map((b) => boyBtn(b, 'Send', b.trait.name)) : others.filter((b) => !f.crew.includes(b)).map((b) => boyBtn(b, 'Move', `from ${b.fort.weapon.short}`));
      if (f.crew.length) crew += `<div class="teamnote">🤝 Room for one more! Two kids work as a team: ${pct(TEAM_BONUS.rate)} fire rate, ${pct(TEAM_BONUS.dmg)} damage, and both their skills count.</div>`;
      if (!freeBoys.length) crew += `<div class="warn">No free boys. Recruit one (<b>R</b>)${pool.length ? ' or pull one from another fort:' : '.'}</div>`;
      if (pool.length) crew += `<div class="sendlist">${pool.join('')}</div>`;
    } else if (f.maxCrew === 1) {
      crew += `<div class="teamnote strong">👥 Only fits one kid. Build it up to a ${FORT_LEVELS[TEAM_LEVEL].name} (<b>U</b>) to fit a second kid. Two kids work as a team.</div>`;
    }

    this.e.panel.innerHTML = `
      <div class="ph">
        <div><h3>${fl.name}</h3><div class="sub">${w.icon} ${w.short} <span class="stars">${stars(f.wlevel)}</span></div></div>
        <button class="x" data-a="close" title="Close (Esc)">✕</button>
      </div>
      <div class="crewline" id="fp-crew"></div>
      ${crew}
      <div class="stats">
        <div><span>Range</span><b id="fp-range"></b></div>
        <div><span>Damage</span><b id="fp-dmg"></b></div>
        <div><span>${w.beam ? 'Heat' : 'Shots/sec'}</span><b id="fp-rate"></b></div>
        <div><span>Takedowns</span><b id="fp-kills"></b></div>
      </div>
      <div class="ups">
        ${next
          ? `<button data-a="upFort" id="fp-upFort"><b>🔨 Build it up → ${next.name}</b><small>More range and damage · U</small><span class="cost">⭐ ${next.cost}</span></button>`
          : `<div class="maxed">🏆 Best fort on the street</div>`}
        ${f.wlevel < MAX_W
          ? `<button data-a="upWeapon" id="fp-upW"><b>⚙️ Upgrade ${w.short} ${stars(f.wlevel + 1)}</b><small>Hits harder, fires faster · G</small><span class="cost">⭐ ${weaponUpgradeCost(w, f.wlevel)}</span></button>`
          : `<div class="maxed">🏆 ${w.short} maxed out</div>`}
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
      else if (b.task === 'bed' || b.asleep) t = '🍝 Home for dinner';
      else if (b.state === 'manning' && b.fort === f) t = `✅ On the job · ${b.trait.desc}`;
      else t = '🏃 Running over…';
      setText($(`fp-cm-${i}`), t);
    });
    setText($('fp-range'), st.range.toFixed(1));
    setText($('fp-dmg'), st.damage.toFixed(0));
    setText($('fp-rate'), f.weapon.beam ? `${(1 + Math.min(f.beamT, 3) * 0.7).toFixed(1)}×` : st.rate.toFixed(2));
    setText($('fp-kills'), f.kills);
    const up = $('fp-upFort');
    if (up) up.classList.toggle('poor', g.points < FORT_LEVELS[f.level + 1].cost);
    const uw = $('fp-upW');
    if (uw) uw.classList.toggle('poor', g.points < weaponUpgradeCost(f.weapon, f.wlevel));
  }

  // ---------- roster ----------
  renderRoster() {
    this.e.roster.innerHTML = this.g.boys
      .map(
        (b) => `<div class="boy" data-boy="${b.id}">
          <span class="dot" style="background:${b.shirtCss}"></span>
          <div><b>${b.name}</b> <em>${b.trait.name}</em><small id="bs-${b.id}"></small></div>
        </div>`,
      )
      .join('');
  }

  updateRoster() {
    for (const b of this.g.boys) {
      let s;
      if (b.away === 'grounded') s = '😠 Grounded today';
      else if (b.away === 'late') s = '⏰ Out later this arvo';
      else if (b.state === 'asleep') s = 'Home for dinner 🍝';
      else if (b.task === 'bed') s = 'Heading home for dinner';
      else if (b.onChore) s = b.state === 'inside' ? `Doing chores (${Math.ceil(b.choreT)}s)` : 'Called home for chores';
      else if (b.fort) s = b.state === 'manning' ? `Manning the ${b.fort.weapon.short}` : `Running to the ${b.fort.weapon.short}`;
      else s = b.state === 'walking' ? 'Heading to the sack' : 'Chilling in the sack';
      setText($(`bs-${b.id}`), s);
    }
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
    $('endText').textContent = `The golems took over Wattle Court on day ${g.wave}. The holidays are over, and it's back to school.${record ? ' Longest holidays ever!' : ''}`;
    $('endStats').innerHTML = `
      <div><b>${g.wave}</b><span>days of holidays</span></div>
      <div><b>${g.best}</b><span>best on ${g.diff.name}</span></div>
      <div><b>${g.stats.kills}</b><span>golems smashed</span></div>
      <div><b>${g.boys.length}</b><span>boys in the crew</span></div>`;
    $('endlessBtn').classList.add('hidden');
    this.e.end.classList.toggle('win', record);
    this.e.end.classList.remove('hidden');
  }

  renderDifficulty() {
    const g = this.g;
    $('diffs').innerHTML = DIFFICULTIES.map(
      (d) => `<button data-diff="${d.key}" class="${d.key === g.diffKey ? 'on' : ''}"><span>${d.icon}</span>${d.name}</button>`,
    ).join('');
    const d = g.diff;
    $('diffDesc').innerHTML = `${d.desc}${g.best ? ` <b>Best: day ${g.best}</b>` : ''}`;
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
    if (on) setText($('fadeDay'), `Day ${nextDay}`);
    this.e.fade.classList.toggle('on', on);
  }

  hideEnd() {
    this.e.end.classList.add('hidden');
  }
}
