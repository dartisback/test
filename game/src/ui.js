import { settings, saveSettings, resetSettings, DEFAULTS } from './settings.js';
import { CAR_TYPES } from './vehicle.js';
import { FACTIONS, FACTION_IDS } from './napoli.js';

const $ = (id) => document.getElementById(id);

const TIPS = [
  'Suggerimento: premi R per aprire la radio e chiedere rinforzi, ambulanza o vigili del fuoco.',
  'Suggerimento: Q attiva la sirena italiana. Le auto in strada ti lasciano passare.',
  'Suggerimento: grida «Fermo!» con X: i sospetti possono arrendersi.',
  'Suggerimento: per gli arresti usa il taser (2), poi ammanetta con E e consegna in sede.',
  'Suggerimento: la Croce Rossa deve stabilizzare i pazienti tenendo premuto E.',
  'Suggerimento: i Vigili del Fuoco usano la lancia (1): tieni premuto il tasto sinistro.',
  'Suggerimento: premi M per aprire la mappa di Napoli. F1 per il Menu Admin.',
];

const SETTINGS_SCHEMA = [
  { tab: 'Generale', items: [
    { key: 'mouseSens', label: 'Sensibilità mouse', type: 'range', min: 0.2, max: 3, step: 0.05 },
    { key: 'padSens', label: 'Sensibilità controller', type: 'range', min: 0.3, max: 3, step: 0.05 },
    { key: 'invertY', label: 'Inverti asse Y', type: 'toggle' },
    { key: 'fov', label: 'Campo visivo (FOV)', type: 'range', min: 50, max: 100, step: 1, fmt: (v) => `${v}°` },
    { key: 'crosshair', label: 'Mirino', type: 'toggle' },
    { key: 'showFps', label: 'Mostra FPS', type: 'toggle' },
  ] },
  { tab: 'Grafica', items: [
    { key: 'shadows', label: 'Ombre', type: 'select', options: [['off', 'Disattivate'], ['low', 'Basse'], ['high', 'Alte']] },
    { key: 'resolution', label: 'Risoluzione di rendering', type: 'range', min: 0.5, max: 1.5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'viewDist', label: 'Distanza visiva', type: 'range', min: 0.4, max: 1.6, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  ] },
  { tab: 'Audio', items: [
    { key: 'master', label: 'Volume generale', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'sfx', label: 'Effetti', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'engine', label: 'Motore', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
    { key: 'sirenVol', label: 'Sirena', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  ] },
];

const CONTROLS = [
  ['A piedi', [['W A S D / Mouse', 'Muoviti / guarda'], ['Shift · Spazio · C', 'Corri · Salta · Accovacciati'], ['E', 'Interagisci (tieni premuto per soccorrere)'], ['F', 'Sali / scendi dal veicolo'], ['1 · 2 · 3 · 0', 'Equipaggiamento / riponi'], ['Tasto destro / sinistro', 'Mira / usa (spara, spruzza)'], ['X', 'Grida «Fermo!» (forze dell\'ordine)'], ['R', 'Radio: rinforzi, ambulanza, VVF'], ['Y / N', 'Accetta / rifiuta la chiamata'], ['M · F1 · F2', 'Mappa · Admin · Aiuto']]],
  ['In veicolo', [['W / S · A / D', 'Accelera-frena-retro · Sterza'], ['Spazio', 'Freno a mano'], ['Q', 'Sirena italiana'], ['H · L · V', 'Clacson · Fari · Riallinea camera'], ['F', 'Scendi'], ['R', 'Radio']]],
  ['Controller', [['Stick sx / dx', 'Muovi · Camera'], ['A', 'Salta / freno a mano'], ['B', 'Accovacciati'], ['X', 'Interagisci'], ['Y', 'Sali / scendi'], ['RT / LT', 'Accelera, usa / frena, mira'], ['LB / RB', 'Sirena / fari'], ['L3', 'Corri']]],
];

export class UI {
  constructor() {
    this.game = null;
    this.screen = 'home';
    this.context = 'home'; // da dove sono stati aperti impostazioni/admin/comandi
    this.spawnSel = null;
    this.toastTimer = 0;
    this.adminTimer = null;
    this._bind();
    this._buildControls();
    this._buildSettings();
  }

  // ---------- navigazione ----------
  show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    const el = $('screen-' + name);
    if (el) {
      el.classList.remove('hidden');
      el.classList.toggle('ingame', this.context !== 'home' && ['settings', 'admin', 'controls'].includes(name));
    }
    this.screen = name;
    if (name !== 'admin' && this.adminTimer) { clearInterval(this.adminTimer); this.adminTimer = null; }
    if (name === 'admin') this._buildAdmin();
    if (name === 'spawn') this._buildSpawn();
    if (name === 'faction') this._buildFaction();
  }
  hideAll() { document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden')); this.screen = null; }
  get hudEl() { return $('hud'); }
  showHud(on) { $('hud').classList.toggle('hidden', !on); }

  back() { this.show(this.context === 'pause' ? 'pause' : 'home'); }

  _bind() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.game && this.game.audio.ui('click');
      const act = b.dataset.act;
      switch (act) {
        case 'new': this.context = 'home'; this.show('faction'); break;
        case 'home': this.context = 'home'; this.show('home'); break;
        case 'settings': this.show('settings'); break;
        case 'admin': this.show('admin'); break;
        case 'controls': this.show('controls'); break;
        case 'credits': this.show('credits'); break;
        case 'resume': this.game.resume(); break;
        case 'quit': this.game.quitToMenu(); break;
        default: break;
      }
    });
    $('settings-back').onclick = () => { saveSettings(); this.back(); };
    $('settings-reset').onclick = () => { resetSettings(); this._buildSettings(); this.game && this.game.applySettings(); };
    $('admin-back').onclick = () => { if (this.context === 'game') this.game.closeAdmin(); else this.back(); };
    $('controls-back').onclick = () => this.back();
    $('keys-cancel').onclick = () => this.game.closeKeys();
    $('click-go').onclick = () => this.game.beginPlay();
    $('spawn-go').onclick = () => {
      if (!this.spawnSel) return;
      this.game.startNewGame(this.factionSel, this.spawnSel, $('spawn-duty').checked);
    };
    const sm = $('spawn-map');
    sm.addEventListener('click', (e) => {
      const r = sm.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * sm.width, py = ((e.clientY - r.top) / r.height) * sm.height;
      const w = this.game && this.game.mapR.pickWorld(px, py);
      if (!w) return;
      let best = null, bd = 1e9;
      for (const s of this._spawns()) { const d = Math.hypot(s.x - w.x, s.z - w.z); if (d < bd) { bd = d; best = s; } }
      if (best && bd < 120) this.selectSpawn(best.id);
    });
  }

  // ---------- loading ----------
  setProgress(p, text) {
    $('loading-bar').style.width = `${Math.round(p * 100)}%`;
    if (text) $('loading-text').textContent = text;
  }
  startLoading() {
    this.show('loading');
    $('loading-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.setProgress(0, 'Caricamento…');
  }

  // ---------- corpo ----------
  _buildFaction() {
    const wrap = $('faction-cards'); wrap.innerHTML = '';
    for (const id of FACTION_IDS) {
      const f = FACTIONS[id];
      const card = document.createElement('button');
      card.className = 'faction-card'; card.style.setProperty('--fc', f.color);
      const icon = { polizia: '🚓', carabinieri: '🚔', croce_rossa: '🚑', vvf: '🚒' }[id];
      card.innerHTML = `<div class="fc-icon">${icon}</div><h3>${f.name}</h3><p>${f.desc}</p><div class="fc-meta">Sede: ${f.hq}</div>`;
      card.onclick = () => { this.game.audio.ui('click'); this.factionSel = id; this.show('spawn'); };
      wrap.appendChild(card);
    }
  }

  // ---------- spawn ----------
  _spawns() {
    const f = FACTIONS[this.factionSel || 'polizia'];
    return this.game.world.city.spawns.map((s) => (s.hq ? { ...s, x: f.door.x - 3, z: f.door.z + 12, name: `Davanti a: ${f.hq}` } : s));
  }
  _buildSpawn() {
    const list = $('spawn-list'); list.innerHTML = '';
    const sp = this._spawns();
    $('spawn-title').textContent = `Scegli dove iniziare · ${FACTIONS[this.factionSel].name}`;
    sp.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'spawn-item'; b.dataset.id = s.id;
      b.innerHTML = `${i + 1}. ${s.name}<small>${s.desc}</small>`;
      b.onclick = () => { this.game.audio.ui('click'); this.selectSpawn(s.id); };
      list.appendChild(b);
    });
    if (!this.spawnSel || !sp.find((x) => x.id === this.spawnSel)) this.spawnSel = sp[0].id;
    this.selectSpawn(this.spawnSel);
  }
  selectSpawn(id) {
    this.spawnSel = id;
    const sp = this._spawns();
    document.querySelectorAll('.spawn-item').forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
    const s = sp.find((x) => x.id === id);
    $('spawn-info').textContent = s ? s.desc : '';
    const c = $('spawn-map');
    const f = FACTIONS[this.factionSel];
    this.game.mapR.drawFull(c.getContext('2d'), c.width, c.height, { spawns: sp, selected: id, icons: [{ x: f.door.x, z: f.door.z, color: f.color }] });
  }

  // ---------- impostazioni ----------
  _buildSettings() {
    const tabs = $('settings-tabs'), body = $('settings-body');
    tabs.innerHTML = '';
    const render = (idx) => {
      [...tabs.children].forEach((t, i) => t.classList.toggle('on', i === idx));
      body.innerHTML = '';
      for (const it of SETTINGS_SCHEMA[idx].items) {
        const row = document.createElement('div'); row.className = 'set-row';
        const label = document.createElement('label'); label.textContent = it.label; row.appendChild(label);
        const val = document.createElement('div'); val.className = 'set-val';
        const apply = (v) => { settings[it.key] = v; saveSettings(); this.game && this.game.applySettings(); };
        if (it.type === 'range') {
          const inp = document.createElement('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = settings[it.key];
          const fmt = it.fmt || ((v) => (+v).toFixed(2));
          val.textContent = fmt(settings[it.key]);
          inp.oninput = () => { apply(parseFloat(inp.value)); val.textContent = fmt(inp.value); };
          row.appendChild(inp); row.appendChild(val);
        } else if (it.type === 'toggle') {
          const w = document.createElement('label'); w.className = 'sw';
          w.innerHTML = `<input type="checkbox" ${settings[it.key] ? 'checked' : ''}><span></span>`;
          w.querySelector('input').onchange = (e) => apply(e.target.checked);
          row.appendChild(w); row.appendChild(val);
        } else if (it.type === 'select') {
          const sel = document.createElement('select');
          for (const [v, t] of it.options) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (settings[it.key] === v) o.selected = true; sel.appendChild(o); }
          sel.onchange = () => apply(sel.value);
          row.appendChild(sel); row.appendChild(val);
        }
        body.appendChild(row);
      }
    };
    SETTINGS_SCHEMA.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'tab'; b.textContent = t.tab; b.onclick = () => render(i); tabs.appendChild(b);
    });
    render(0);
  }

  _buildControls() {
    const html = CONTROLS.map(([title, rows]) => `<div><h3>${title}</h3>${rows.map(([k, d]) => `<div class="k"><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</div>`).join('');
    $('controls-body').innerHTML = `<div class="ctrl-grid">${html}</div>`;
    $('help-panel').innerHTML = '<b>COMANDI RAPIDI</b><br>WASD muovi · Shift corri · Spazio salta · C accovacciati<br>E interagisci · F veicolo · 1/2/3 equipaggiamento · M mappa<br>Q sirena · H clacson · L fari · X «Fermo!» · <b>R radio</b><br>Y/N accetta/rifiuta chiamata · F1 admin · F2 chiudi';
    $('click-help').innerHTML = '<p class="muted" style="margin-top:18px">WASD muovi · Mouse guarda · Shift corri · Spazio salta · C accovacciati · E interagisci · F auto</p>';
  }

  // ---------- admin ----------
  _buildAdmin() {
    const g = this.game, A = g.admin;
    const body = $('admin-body');
    const pois = [...g.world.city.spawns.filter((s) => !s.hq).map((s) => [s.id, s.name]), ...FACTION_IDS.map((id) => ['hq_' + id, FACTIONS[id].hq]), ['hq_in', 'Dentro la tua sede']];
    const callBtns = (g.faction.law ? [['scippo', 'Scippo'], ['inseguimento', 'Inseguimento'], ['rapina', 'Rapina'], ['controllo', 'Controllo'], ['rissa', 'Rissa']] : g.faction.id === 'croce_rossa' ? [['malore', 'Malore'], ['incidente', 'Incidente'], ['trasporto', 'Trasporto']] : [['incendio', 'Incendio'], ['autofiamme', 'Auto in fiamme']]);
    body.innerHTML = `
    <div class="adm">
      <div class="card"><h3>Corpo</h3>
        <div class="btns">${FACTION_IDS.map((id) => `<button class="btn small" data-adm="fac-${id}">${FACTIONS[id].name}</button>`).join('')}</div>
        <div class="line"><select id="adm-tp">${pois.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select><button class="btn small" id="adm-tp-go">Teletrasporta</button></div>
      </div>
      <div class="card"><h3>Giocatore</h3>
        <div class="btns">
          <button class="btn small" data-adm="duty">In servizio</button><button class="btn small" data-adm="uniform">+ Divisa</button>
          <button class="btn small" data-adm="weapons">+ Attrezzatura</button><button class="btn small" data-adm="all">Kit completo</button>
          <button class="btn small" data-adm="civil">Torna cittadino</button><button class="btn small" data-adm="reset">Azzera partita</button>
        </div>
        <div class="line"><span>Velocità</span><input type="range" id="adm-speed" min="0.5" max="5" step="0.1" value="${g.player.speedMul}"><span id="adm-speed-v">${g.player.speedMul}×</span></div>
        <div class="line"><span>Salto</span><input type="range" id="adm-jump" min="1" max="4" step="0.1" value="${g.player.jumpMul}"><span id="adm-jump-v">${g.player.jumpMul}×</span></div>
        <div class="line"><label class="check" style="margin:0"><input type="checkbox" id="adm-noclip" ${g.player.noclip ? 'checked' : ''}> Volo / noclip</label></div>
      </div>
      <div class="card"><h3>Chiamate (test)</h3>
        <div class="btns">${callBtns.map(([id, n]) => `<button class="btn small" data-adm="call-${id}">${n}</button>`).join('')}</div>
        <div class="btns" style="margin-top:8px"><button class="btn small" data-adm="backup">Rinforzi ora</button></div>
      </div>
      <div class="card"><h3>Veicoli</h3>
        <div class="btns">${Object.values(CAR_TYPES).filter((t) => t.faction).map((t) => `<button class="btn small" data-adm="car-${t.id}">${t.name.split('(')[0].trim()}</button>`).join('')}
          <button class="btn small" data-adm="unlock">Sblocca tutti</button><button class="btn small" data-adm="carhere">Porta il mezzo qui</button></div>
        <div class="line"><span>Potenza</span><input type="range" id="adm-car" min="0.5" max="3" step="0.1" value="${g.carMul}"><span id="adm-car-v">${g.carMul}×</span></div>
      </div>
      <div class="card"><h3>Mondo</h3>
        <div class="line"><span>Ora</span><input type="range" id="adm-hour" min="0" max="24" step="0.1" value="${g.world.hour.toFixed(1)}"><span id="adm-hour-v">${g.world.hour.toFixed(1)}</span></div>
        <div class="line"><span>Scorrere tempo</span><select id="adm-ts">${[[0, 'Fermo'], [20, 'Lento'], [120, '×120'], [600, '×600']].map(([v, t]) => `<option value="${v}" ${g.timeScale === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="btns"><button class="btn small" data-adm="h6">Alba</button><button class="btn small" data-adm="h12">Mezzogiorno</button><button class="btn small" data-adm="h19">Tramonto</button><button class="btn small" data-adm="h23">Notte</button></div>
        <div class="line"><label class="check" style="margin:0"><input type="checkbox" id="adm-fps" ${settings.showFps ? 'checked' : ''}> Mostra FPS</label></div>
      </div>
      <div class="card"><h3>Fase turno</h3>
        <div class="btns">${['Sede', 'Servizio', 'Divisa', 'Attrezzatura', 'Chiavi', 'Veicolo', 'Pattuglia'].map((n, i) => `<button class="btn small" data-adm="stage-${i}">${i}. ${n}</button>`).join('')}</div>
      </div>
      <div class="card"><h3>Info</h3><div class="info" id="adm-info"></div></div>
    </div>`;
    const inRange = (id, fn, fmt = (v) => `${v}×`) => { const el = $(id); el.oninput = () => { fn(parseFloat(el.value)); $(id + '-v').textContent = fmt(el.value); }; };
    inRange('adm-speed', (v) => (g.player.speedMul = v));
    inRange('adm-jump', (v) => (g.player.jumpMul = v));
    inRange('adm-car', (v) => (g.carMul = v));
    inRange('adm-hour', (v) => A.setHour(v), (v) => (+v).toFixed(1));
    $('adm-ts').onchange = (e) => (g.timeScale = parseFloat(e.target.value));
    $('adm-noclip').onchange = (e) => A.setNoclip(e.target.checked);
    $('adm-fps').onchange = (e) => { settings.showFps = e.target.checked; saveSettings(); g.applySettings(); };
    $('adm-tp-go').onclick = () => A.teleport($('adm-tp').value);
    body.querySelectorAll('[data-adm]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.adm;
        if (k.startsWith('stage-')) A.stage(parseInt(k.slice(6), 10));
        else if (k.startsWith('car-')) A.spawnCar(k.slice(4));
        else if (k.startsWith('fac-')) { A.faction(k.slice(4)); this._buildAdmin(); }
        else if (k.startsWith('call-')) A.call(k.slice(5));
        else if (/^h\d+$/.test(k)) { A.setHour(parseInt(k.slice(1), 10)); $('adm-hour').value = parseInt(k.slice(1), 10); }
        else A.action(k);
      };
    });
    const upd = () => { const el = $('adm-info'); if (el) el.innerHTML = A.info().replace(/\n/g, '<br>'); };
    upd();
    this.adminTimer = setInterval(upd, 400);
  }

  // ---------- chiavi veicoli ----------
  openKeys(typeIds) {
    const wrap = $('car-cards'); wrap.innerHTML = '';
    for (const id of typeIds) {
      const t = CAR_TYPES[id];
      const card = document.createElement('div'); card.className = 'car-card';
      const stats = { giulia: [92, 84, 66], giulietta: [78, 72, 88], cc_giulia: [92, 84, 66], cc_giulietta: [78, 72, 88], ambulanza: [58, 50, 60], autopompa: [40, 34, 38] }[id] || [60, 60, 60];
      card.innerHTML = `<canvas width="360" height="150"></canvas><h3>${t.name}</h3><div class="muted">${t.desc}</div>
        ${['Velocità', 'Accelerazione', 'Maneggevolezza'].map((n, i) => `<div class="car-stat"><span>${n}</span><div class="b"><i style="width:${stats[i]}%"></i></div></div>`).join('')}
        <button class="btn primary" style="margin-top:12px;width:100%">Prendi le chiavi</button>`;
      card.querySelector('button').onclick = () => { this.game.audio.ui('ok'); this.game.closeKeys(); this.game.missions.chooseCar(t.id); };
      wrap.appendChild(card);
      this._drawCarPreview(card.querySelector('canvas'), t);
    }
    this.show('keys');
    this.game.onModalOpen();
  }
  _drawCarPreview(cv, t) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const sc = 60 * 0.72, ox = W / 2, oy = H - 38;
    const col = '#' + t.color.toString(16).padStart(6, '0');
    const draw = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => { const x = ox + p[0] * sc, y = oy - p[1] * sc; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); };
    if (t.shape === 'sedan') {
      draw(t.lower, col); draw(t.cabin, '#0f1a28');
      g.fillStyle = t.livery === 'carabinieri' ? '#f3f5f7' : '#f3f5f7'; g.beginPath(); g.moveTo(ox - 2.0 * sc, oy - 0.62 * sc); g.lineTo(ox + 2.1 * sc, oy - 0.76 * sc); g.lineTo(ox + 2.1 * sc, oy - 0.56 * sc); g.lineTo(ox - 2.0 * sc, oy - 0.5 * sc); g.fill();
      g.fillStyle = t.livery === 'carabinieri' ? '#c4202a' : '#17489c'; g.font = 'italic bold 13px Arial'; g.textAlign = 'center'; g.fillText(t.livery === 'carabinieri' ? 'CARABINIERI' : 'POLIZIA', ox, oy - 0.57 * sc + 5);
    } else if (t.shape === 'van') {
      draw([[-3, 0.4], [2.9, 0.4], [3.0, 1.0], [2.0, 1.3], [1.5, 2.1], [1.35, 2.5], [-3, 2.5]], '#f3f3f0');
      g.fillStyle = '#d9202a'; g.fillRect(ox - 3 * sc, oy - 1.0 * sc, 6 * sc, 0.3 * sc);
      g.fillStyle = '#0f1a28'; g.beginPath(); g.moveTo(ox + 1.5 * sc, oy - 2.05 * sc); g.lineTo(ox + 2.0 * sc, oy - 1.35 * sc); g.lineTo(ox + 1.45 * sc, oy - 1.35 * sc); g.fill();
    } else {
      draw([[1.7, 0.6], [3.9, 0.6], [3.95, 1.5], [3.25, 2.95], [1.7, 2.95]], col);
      g.fillStyle = col; g.fillRect(ox - 3.9 * sc, oy - 2.5 * sc, 5.6 * sc, 1.9 * sc);
      g.fillStyle = '#aeb4ba'; g.fillRect(ox - 3.5 * sc, oy - 2.8 * sc, 4.8 * sc, 0.12 * sc);
    }
    const wl = t.shape === 'truck' ? [2.9, -1.2, -2.5] : [t.wb / 2, -t.wb / 2];
    const r = (t.shape === 'truck' ? 0.52 : 0.35) * sc;
    for (const wz of wl) { g.beginPath(); g.arc(ox + wz * sc, oy - r, r, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill(); g.beginPath(); g.arc(ox + wz * sc, oy - r, r * 0.6, 0, Math.PI * 2); g.fillStyle = '#b5b9bf'; g.fill(); }
  }

  // ---------- HUD ----------
  toast(text, type = '') {
    const wrap = $('toasts');
    const d = document.createElement('div'); d.className = `toast ${type}`; d.textContent = text;
    wrap.appendChild(d);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => d.classList.add('out'), 4200);
    setTimeout(() => d.remove(), 4800);
  }
  setScore(n) { const el = $('score'); if (el) el.textContent = `★ ${n}`; }
  setCallPrompt(p) { this.callPrompt = p; }
  showRadio(on, opts = []) {
    const el = $('radio'); if (!el) return;
    el.classList.toggle('hidden', !on);
    if (on) el.innerHTML = '<b>RADIO</b>' + opts.map((o, i) => `<div><kbd>${i + 1}</kbd> ${o.label}</div>`).join('') + '<div class="muted">R per chiudere</div>';
  }
  setObjective(title, sub) { $('obj-text').textContent = title; $('obj-sub').textContent = sub || ''; }
  setPrompt(p) {
    const el = $('prompt');
    if (!p) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.classList.toggle('deny', !!p.deny);
    el.innerHTML = p.key ? `<b>${p.key}</b>${p.text}` : p.text;
  }
}

export { DEFAULTS };
