import { settings, saveSettings, resetSettings, DEFAULTS } from './settings.js';
import { CAR_TYPES } from './vehicle.js';

const $ = (id) => document.getElementById(id);

const TIPS = [
  'Suggerimento: nella sala operativa trovi la bacheca con le chiavi delle volanti.',
  'Suggerimento: premi Q in auto per attivare la sirena bitonale.',
  'Suggerimento: premi F2 in partita per rivedere i comandi.',
  'Suggerimento: dal Menu Admin (F1) puoi cambiare ora del giorno e teletrasportarti.',
  'Suggerimento: con il tasto destro del mouse puoi mirare con pistola e taser.',
  'Suggerimento: premi M per aprire la mappa di Belluno.',
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
  ['A piedi', [['W A S D', 'Muoviti'], ['Mouse', 'Guarda intorno'], ['Shift', 'Corri'], ['Spazio', 'Salta'], ['C / Ctrl', 'Accovacciati'], ['E', 'Interagisci'], ['F', 'Sali / scendi dall\'auto'], ['1 · 2 · 3', 'Pistola · Taser · Manganello'], ['0', 'Riponi l\'arma'], ['Tasto destro', 'Mira (pistola/taser)'], ['Click sinistro', 'Spara / colpisci'], ['M', 'Mappa'], ['F1 / F2', 'Admin / Aiuto']]],
  ['In auto', [['W / S', 'Accelera / frena e retro'], ['A / D', 'Sterza'], ['Spazio', 'Freno a mano'], ['Q', 'Sirena'], ['H', 'Clacson'], ['L', 'Fari'], ['V', 'Riallinea camera'], ['Rotella', 'Distanza camera (a piedi)'], ['F', 'Scendi']]],
  ['Controller', [['Stick sx / dx', 'Muovi · Camera'], ['A', 'Salta / freno a mano'], ['B', 'Accovacciati'], ['X', 'Interagisci'], ['Y', 'Sali / scendi'], ['RT / LT', 'Accelera, spara / frena, mira'], ['LB / RB', 'Sirena / fari'], ['L3', 'Corri'], ['Croce', 'Armi']]],
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
        case 'new': this.context = 'home'; this.show('spawn'); break;
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
      this.game.startNewGame(this.spawnSel, $('spawn-duty').checked);
    };
    const sm = $('spawn-map');
    sm.addEventListener('click', (e) => {
      const r = sm.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * sm.width, py = ((e.clientY - r.top) / r.height) * sm.height;
      const w = this.game && this.game.mapR.pickWorld(px, py);
      if (!w) return;
      let best = null, bd = 1e9;
      for (const s of this.game.world.layout.spawns) { const d = Math.hypot(s.x - w.x, s.z - w.z); if (d < bd) { bd = d; best = s; } }
      if (best && bd < 60) this.selectSpawn(best.id);
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

  // ---------- spawn ----------
  _buildSpawn() {
    const g = this.game, L = g.world.layout;
    const list = $('spawn-list'); list.innerHTML = '';
    L.spawns.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'spawn-item'; b.dataset.id = s.id;
      b.innerHTML = `${i + 1}. ${s.name}<small>${s.desc}</small>`;
      b.onclick = () => { g.audio.ui('click'); this.selectSpawn(s.id); };
      list.appendChild(b);
    });
    if (!this.spawnSel) this.spawnSel = L.spawns[0].id;
    this.selectSpawn(this.spawnSel);
  }
  selectSpawn(id) {
    this.spawnSel = id;
    const L = this.game.world.layout;
    document.querySelectorAll('.spawn-item').forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
    const s = L.spawns.find((x) => x.id === id);
    $('spawn-info').textContent = s ? s.desc : '';
    const c = $('spawn-map');
    this.game.mapR.drawFull(c.getContext('2d'), c.width, c.height, { spawns: L.spawns, selected: id });
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
    $('help-panel').innerHTML = '<b>COMANDI RAPIDI</b><br>WASD muovi · Shift corri · Spazio salta · C accovacciati<br>E interagisci · F auto · 1/2/3 armi · M mappa<br>Q sirena · H clacson · L fari · F1 admin · F2 chiudi';
    $('click-help').innerHTML = '<p class="muted" style="margin-top:18px">WASD muovi · Mouse guarda · Shift corri · Spazio salta · C accovacciati · E interagisci · F auto</p>';
  }

  // ---------- admin ----------
  _buildAdmin() {
    const g = this.game, A = g.admin;
    const body = $('admin-body');
    const pois = [...g.world.layout.spawns.map((s) => [s.id, s.name]), ['questura_in', 'Dentro la Questura'], ['yard', 'Piazzale volanti'], ['martiri2', 'Piazza dei Martiri (centro)']];
    body.innerHTML = `
    <div class="adm">
      <div class="card"><h3>Giocatore</h3>
        <div class="line"><select id="adm-tp">${pois.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select><button class="btn small" id="adm-tp-go">Teletrasporta</button></div>
        <div class="btns">
          <button class="btn small" data-adm="duty">In servizio</button>
          <button class="btn small" data-adm="uniform">+ Divisa</button>
          <button class="btn small" data-adm="weapons">+ Armi</button>
          <button class="btn small" data-adm="all">Kit completo</button>
          <button class="btn small" data-adm="civil">Torna cittadino</button>
          <button class="btn small" data-adm="reset">Reset missione</button>
        </div>
        <div class="line"><span>Velocità</span><input type="range" id="adm-speed" min="0.5" max="5" step="0.1" value="${g.player.speedMul}"><span id="adm-speed-v">${g.player.speedMul}×</span></div>
        <div class="line"><span>Salto</span><input type="range" id="adm-jump" min="1" max="4" step="0.1" value="${g.player.jumpMul}"><span id="adm-jump-v">${g.player.jumpMul}×</span></div>
        <div class="line"><label class="check" style="margin:0"><input type="checkbox" id="adm-noclip" ${g.player.noclip ? 'checked' : ''}> Volo / noclip (Spazio sale, Ctrl scende)</label></div>
      </div>
      <div class="card"><h3>Veicoli</h3>
        <div class="btns">
          <button class="btn small" data-adm="car-giulia">Genera Giulia</button>
          <button class="btn small" data-adm="car-giulietta">Genera Giulietta</button>
          <button class="btn small" data-adm="unlock">Sblocca tutte</button>
          <button class="btn small" data-adm="carhere">Porta l'auto qui</button>
        </div>
        <div class="line"><span>Potenza motore</span><input type="range" id="adm-car" min="0.5" max="3" step="0.1" value="${g.carMul}"><span id="adm-car-v">${g.carMul}×</span></div>
      </div>
      <div class="card"><h3>Mondo</h3>
        <div class="line"><span>Ora</span><input type="range" id="adm-hour" min="0" max="24" step="0.1" value="${g.world.hour.toFixed(1)}"><span id="adm-hour-v">${g.world.hour.toFixed(1)}</span></div>
        <div class="line"><span>Scorrere tempo</span><select id="adm-ts">${[[0, 'Fermo'], [30, 'Lento (×30)'], [120, '×120'], [600, '×600']].map(([v, t]) => `<option value="${v}" ${g.timeScale === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="btns"><button class="btn small" data-adm="h6">Alba</button><button class="btn small" data-adm="h12">Mezzogiorno</button><button class="btn small" data-adm="h19">Tramonto</button><button class="btn small" data-adm="h23">Notte</button></div>
        <div class="line"><label class="check" style="margin:0"><input type="checkbox" id="adm-fps" ${settings.showFps ? 'checked' : ''}> Mostra FPS</label></div>
      </div>
      <div class="card"><h3>Fase missione</h3>
        <div class="btns">${['Raggiungi Questura', 'Servizio', 'Divisa', 'Armi', 'Chiavi', 'Volante', 'Pattuglia'].map((n, i) => `<button class="btn small" data-adm="stage-${i}">${i}. ${n}</button>`).join('')}</div>
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
        else if (/^h\d+$/.test(k)) { A.setHour(parseInt(k.slice(1), 10)); $('adm-hour').value = parseInt(k.slice(1), 10); }
        else A.action(k);
      };
    });
    const upd = () => { const el = $('adm-info'); if (el) el.innerHTML = A.info().replace(/\n/g, '<br>'); };
    upd();
    this.adminTimer = setInterval(upd, 400);
  }

  // ---------- chiavi volanti ----------
  openKeys() {
    const wrap = $('car-cards'); wrap.innerHTML = '';
    for (const t of Object.values(CAR_TYPES)) {
      const card = document.createElement('div'); card.className = 'car-card';
      const stats = t.id === 'giulia' ? [['Velocità', 92], ['Accelerazione', 84], ['Maneggevolezza', 66]] : [['Velocità', 78], ['Accelerazione', 72], ['Maneggevolezza', 88]];
      card.innerHTML = `<canvas width="360" height="150"></canvas><h3>${t.name}</h3><div class="muted">${t.desc}</div>
        ${stats.map(([n, v]) => `<div class="car-stat"><span>${n}</span><div class="b"><i style="width:${v}%"></i></div></div>`).join('')}
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
    const sc = 60, ox = W / 2, oy = H - 38;
    const draw = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = [ox + p[0] * sc * 0.72, oy - p[1] * sc * 0.72]; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); };
    draw(t.lower, '#1b3a8a'); draw(t.cabin, '#0f1a28');
    g.fillStyle = '#f3f5f7'; g.beginPath(); g.moveTo(ox - 2.0 * sc * 0.72, oy - 0.62 * sc * 0.72); g.lineTo(ox + 2.1 * sc * 0.72, oy - 0.76 * sc * 0.72); g.lineTo(ox + 2.1 * sc * 0.72, oy - 0.56 * sc * 0.72); g.lineTo(ox - 2.0 * sc * 0.72, oy - 0.5 * sc * 0.72); g.fill();
    g.fillStyle = '#17489c'; g.font = 'italic bold 15px Arial'; g.textAlign = 'center'; g.fillText('POLIZIA', ox, oy - 0.57 * sc * 0.72 + 5);
    for (const wz of [-t.wb / 2, t.wb / 2]) {
      g.beginPath(); g.arc(ox + wz * sc * 0.72, oy - 0.335 * sc * 0.72, 0.335 * sc * 0.72, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill();
      g.beginPath(); g.arc(ox + wz * sc * 0.72, oy - 0.335 * sc * 0.72, 0.2 * sc * 0.72, 0, Math.PI * 2); g.fillStyle = '#b5b9bf'; g.fill();
    }
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
