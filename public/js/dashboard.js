const $ = (id) => document.getElementById(id);
const TYPE_LABEL = { day: 'Day', week: 'Week', lifetime: 'Lifetime' };
const VIEW_TITLE = { overview: 'panoramica', controls: 'controlli', bots: 'bot', activity: 'attività', settings: 'impostazioni', licenses: 'licenze', status: 'stato', discord: 'discord' };
const NEEDS_LICENSE = ['overview', 'controls', 'bots', 'activity', 'status'];
const GUILD_URL = 'https://discord.com/channels/1558906654974541834';

let me = null;
let state = { license: null, all: [] };
let currentView = null;
let mountedHasLicense = null;

const fmtDate = (t) => (t ? new Date(t).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ago = (t) => {
  if (!t) return 'mai';
  const s = Math.floor((Date.now() - t) / 1000);
  return s < 8 ? 'adesso' : s < 60 ? `${s}s fa` : s < 3600 ? `${Math.floor(s / 60)} min fa` : `${Math.floor(s / 3600)} h fa`;
};
function remaining(exp) {
  if (!exp) return 'mai';
  const ms = exp - Date.now();
  if (ms <= 0) return 'scaduta';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}g ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

// ---------- viste: mount() costruisce l'HTML una volta, update() aggiorna solo i dati ----------
const redeemCard = (id) => `
  <div class="card" id="${id}">
    <div class="sect-title" style="font-size:18px"><i></i>Attiva la tua licenza</div>
    <p class="sub" style="margin-top:8px">Inserisci la chiave ricevuta (anche da <span class="mono">/crealicense</span>) per sbloccare il pannello.</p>
    <div class="field"><input class="input mono" data-redeem placeholder="FLUX-XXXX-XXXX-XXXX-XXXX" autocomplete="off"><button class="btn btn-primary" data-redeem-btn>Riscatta</button></div>
  </div>`;

function bindRedeem(root) {
  const input = root.querySelector('[data-redeem]');
  const go = () => redeem(input.value);
  root.querySelector('[data-redeem-btn]').onclick = go;
  input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

const VIEWS = {
  overview: {
    mount: () => `
      <h1>Dashboard <span class="badge good" id="ovBadge">attiva</span></h1>
      <p class="sub"><span class="keytag mono" id="ovKey"></span> · controlli live — si aggiorna da solo (~5s)</p>
      <div class="stat-grid">
        <div class="card stat-card"><div class="sc-h"><span class="ico g3">🛡</span>Bot online</div><div class="sc-v"><b id="sBots">0</b><small id="sMaxTxt">/ 64</small></div><div class="bar"><i id="sBar"></i></div></div>
        <div class="card stat-card"><div class="sc-h"><span class="ico g6">▤</span>Bot massimi</div><div class="sc-v"><b id="sMax">64</b></div><small class="muted">limite licenza</small></div>
        <div class="card stat-card"><div class="sc-h"><span class="ico g1">◷</span>Scadenza</div><div class="sc-v"><b id="sExp" style="font-size:22px"></b></div><small class="muted" id="sExpDate"></small></div>
        <div class="card stat-card"><div class="sc-h"><span class="ico g4">✓</span>Server collegato</div><div class="sc-v"><b id="sLink" style="font-size:22px"></b></div><small class="muted" id="sLinkSub"></small></div>
      </div>
      <div class="card" style="margin-top:18px"><div class="dl">
        <div><span>Licenza</span><b><span class="keytag mono" id="dKey"></span> <span class="badge good" id="dState">attiva</span></b></div>
        <div><span>Tipo</span><b id="dType"></b></div>
        <div><span>Ultimo contatto</span><b id="dLast"></b></div>
        <div><span>Comandi in coda</span><b id="dQueue"></b></div>
        <div><span>Poll</span><b>~5s</b></div>
      </div></div>
      <div class="row" style="margin-top:18px"><a href="#/controls" class="btn btn-primary">Vai ai controlli →</a><a href="#/bots" class="btn btn-ghost">Vedi i bot</a></div>`,
    update(l) {
      $('ovKey').textContent = $('dKey').textContent = l.key;
      $('sBots').textContent = l.bots; $('sMaxTxt').textContent = `/ ${l.maxBots}`; $('sMax').textContent = l.maxBots;
      $('sBar').style.width = `${(l.bots / l.maxBots) * 100}%`;
      $('sExp').textContent = l.expiresAt ? remaining(l.expiresAt) : 'lifetime';
      $('sExpDate').textContent = l.expiresAt ? fmtDate(l.expiresAt) : 'nessuna scadenza';
      $('sLink').textContent = l.connected ? 'connesso' : 'in attesa';
      $('sLinkSub').textContent = l.connected ? `contatto ${ago(l.lastPoll)}` : 'nessun poll recente';
      $('dType').textContent = TYPE_LABEL[l.type] + (l.staffKey ? ' · key staff' : '');
      $('dLast').textContent = ago(l.lastPoll); $('dQueue').textContent = l.pending;
    },
  },

  controls: {
    mount: () => `
      <div class="sect-title"><i></i>Controlli server</div>
      <p class="hint">i comandi vengono messi in coda — il server li esegue al prossimo poll (~5s)</p>
      <div class="grid-2">
        <div class="card"><div class="card-head"><div class="ico g1">＋</div><h3>Aggiungi bot</h3></div><p>Riempi il server all'istante. Compaiono in ~5 secondi.</p>
          <div class="field"><input class="input" id="addCount" type="number" min="1" value="5"><button class="btn btn-primary" id="addBtn">Aggiungi</button></div><div class="field-note" id="botCount"></div></div>
        <div class="card"><div class="card-head"><div class="ico g3">－</div><h3>Rimuovi uno</h3></div><p>Espelli un singolo bot dal suo ID numerico.</p>
          <div class="field"><input class="input" id="rmId" type="number" placeholder="100001"><button class="btn btn-ghost" id="rmBtn">Rimuovi</button></div></div>
        <div class="card"><div class="card-head"><div class="ico g5">🗑</div><h3>Rimuovi tutti</h3></div><p>Svuota il server da ogni fake player in un colpo solo.</p>
          <div class="field"><button class="btn btn-danger" id="rmAllBtn">Rimuovi tutti i bot</button></div></div>
        <div class="card"><div class="card-head"><div class="ico g6">✎</div><h3>Nomi personalizzati</h3></div><p>Nomi separati da virgola — si mimetizzano con i giocatori reali.</p>
          <div class="field"><input class="input" id="names" placeholder="Marco_V, LucaRP, xXStefanoXx"><button class="btn btn-ghost" id="genBtn">Genera</button><button class="btn btn-primary" id="applyBtn">Applica</button></div></div>
      </div>`,
    bind() {
      $('addBtn').onclick = () => cmd({ cmd: 'add_bot', count: Number($('addCount').value) });
      $('rmBtn').onclick = () => { cmd({ cmd: 'remove_bot', id: Number($('rmId').value) }); $('rmId').value = ''; };
      $('rmAllBtn').onclick = () => confirm('Rimuovere TUTTI i bot?') && cmd({ cmd: 'remove_all' });
      $('applyBtn').onclick = () => cmd({ cmd: 'set_names', names: $('names').value });
      $('genBtn').onclick = async () => { try { $('names').value = (await api('/api/names?count=8')).names.join(', '); } catch (e) { toast(e.message, true); } };
    },
    update: (l) => ($('botCount').textContent = `${l.bots}/${l.maxBots} bot attivi`),
  },

  bots: {
    mount: () => `<div class="sect-title"><i></i>Bot attivi <span class="badge" id="bCount"></span></div>
      <p class="hint">clicca ✕ per rimuovere un singolo bot</p><div class="card"><div class="chips" id="botList" style="max-height:none"></div></div>`,
    update(l) {
      $('bCount').textContent = `${l.bots}/${l.maxBots}`;
      $('botList').innerHTML = l.botList.length
        ? l.botList.map((b) => `<span class="chip">${esc(b.name)} <small>#${b.id}</small> <button class="x" data-rm="${b.id}" title="Rimuovi">✕</button></span>`).join('')
        : '<div class="empty" style="width:100%">Nessun bot attivo — aggiungine dai Controlli</div>';
      document.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => cmd({ cmd: 'remove_bot', id: Number(b.dataset.rm) })));
    },
  },

  activity: {
    mount: () => `<div class="sect-title"><i></i>Attività</div><p class="hint">ultimi comandi eseguiti dal server</p><div class="card"><div class="log" id="log" style="max-height:none"></div></div>`,
    update: (l) => ($('log').innerHTML = l.log.length
      ? [...l.log].reverse().map((x) => `<div><span class="dim">${new Date(x.t).toLocaleTimeString('it-IT')}</span> ${esc(x.m)}</div>`).join('')
      : '<div class="dim">Nessuna attività</div>'),
  },

  status: {
    mount: () => `<div class="sect-title"><i></i>Stato</div><p class="hint">salute del servizio e del collegamento al tuo server</p>
      <div class="card"><div class="dl">
        <div><span>Pannello</span><b><span class="badge good">online</span></b></div>
        <div><span>Server FiveM</span><b id="stConn"></b></div>
        <div><span>Ultimo poll</span><b id="stLast"></b></div>
        <div><span>Comandi in coda</span><b id="stQ"></b></div>
        <div><span>Licenza</span><b id="stLic"></b></div>
      </div></div>
      <p class="field-note" style="margin-top:14px">Il server si collega con <span class="mono">POST ${location.origin}/api/fivem/poll</span> (header <span class="mono">x-license</span>). Dettagli nel <a href="/tutorial" style="color:var(--p-3)">tutorial</a>.</p>`,
    update(l) {
      $('stConn').innerHTML = l.connected ? '<span class="badge good">connesso</span>' : '<span class="badge bad">in attesa</span>';
      $('stLast').textContent = ago(l.lastPoll); $('stQ').textContent = l.pending;
      $('stLic').textContent = `${TYPE_LABEL[l.type]} · scade: ${remaining(l.expiresAt)}`;
    },
  },

  settings: {
    mount: () => `<div class="sect-title"><i></i>Impostazioni</div><p class="hint">account e licenze</p>
      <div class="grid-2">
        <div class="card"><h3>Account</h3><div class="dl" style="margin-top:12px">
          <div><span>Utente</span><b>${esc(me.username)}</b></div><div><span>Ruolo</span><b><span class="badge ${me.role}">${me.role}</span></b></div><div><span>Discord ID</span><b class="mono" style="font-size:13px">${esc(me.id)}</b></div></div>
          <div class="field"><button class="btn btn-danger btn-sm" id="logout2">Esci</button></div></div>
        <div class="card"><h3>Riscatta un'altra chiave</h3><p>Le licenze si sommano: viene usata quella con la scadenza più lontana.</p>
          <div class="field"><input class="input mono" data-redeem placeholder="FLUX-XXXX-XXXX-XXXX-XXXX" autocomplete="off"><button class="btn btn-ghost" data-redeem-btn>Riscatta</button></div></div>
      </div>
      <div class="card" style="margin-top:18px"><h3>Le tue licenze</h3><div class="table-wrap"><table><thead><tr><th>Chiave</th><th>Tipo</th><th>Stato</th><th>Scadenza</th></tr></thead><tbody id="myLics"></tbody></table></div></div>`,
    bind() { $('logout2').onclick = logout; bindRedeem($('view')); },
    update: () => ($('myLics').innerHTML = state.all.length
      ? state.all.map((l) => `<tr><td class="key">${esc(l.key)}</td><td>${TYPE_LABEL[l.type]}${l.staffKey ? ' <span class="badge staff">staff</span>' : ''}</td><td>${l.expired ? '<span class="badge bad">scaduta</span>' : '<span class="badge good">attiva</span>'}</td><td>${l.expiresAt ? fmtDate(l.expiresAt) : 'mai'}</td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">Nessuna licenza</td></tr>'),
  },

  discord: {
    mount: () => `<div class="sect-title"><i></i>Discord</div><p class="hint">supporto e comandi</p>
      <div class="grid-2">
        <div class="card"><h3>Server Discord</h3><p>Entra nel server per supporto, annunci e per richiedere una licenza allo staff.</p><div class="field"><a class="btn btn-primary" href="${GUILD_URL}" target="_blank" rel="noopener">Apri il server →</a></div></div>
        <div class="card"><h3>Comandi bot (staff / owner)</h3><div class="dl" style="margin-top:12px"><div><span>/crealicense</span><b style="font-weight:500;font-size:13px">crea licenze day / week / lifetime</b></div><div><span>/rimuovilicense</span><b style="font-weight:500;font-size:13px">elimina una licenza</b></div></div></div>
      </div>`,
  },

  licenses: {
    mount: () => `<div class="sect-title"><i></i>Gestione licenze <span class="badge owner">owner</span></div>
      <p class="hint">crea o elimina licenze day / week / lifetime — la durata parte dal riscatto</p>
      <div class="card"><div class="field" style="margin-top:0">
        <select class="input" id="newType" style="max-width:190px"><option value="day">Day (24h)</option><option value="week">Week (7 giorni)</option><option value="lifetime">Lifetime</option></select>
        <input class="input" id="newCount" type="number" min="1" max="50" value="1" style="max-width:100px" title="Quantità">
        <input class="input" id="newNote" placeholder="Nota (opzionale)" maxlength="80"><button class="btn btn-primary" id="createBtn">Crea licenza</button></div>
        <div id="createdBox" class="field-note"></div>
        <div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Chiave</th><th>Tipo</th><th>Stato</th><th>Riscattata da</th><th>Scadenza</th><th>Nota</th><th></th></tr></thead><tbody id="licRows"></tbody></table></div></div>`,
    bind() { $('createBtn').onclick = createLicense; loadAdmin(); },
  },
};

// ---------- router ----------
function route() {
  const v = (location.hash.replace(/^#\/?/, '') || 'overview');
  currentView = v === 'licenza' ? (state.license ? 'settings' : 'overview') : VIEWS[v] ? v : 'overview';
  if (currentView === 'licenses' && me.role !== 'owner') currentView = 'overview';
  mount();
}

function mount() {
  const name = currentView;
  const l = state.license;
  mountedHasLicense = !!l;
  document.querySelectorAll('#sideNav a[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  $('crumb').textContent = VIEW_TITLE[name];
  $('sidebar').classList.remove('open');
  const view = $('view');
  if (NEEDS_LICENSE.includes(name) && !l) {
    view.innerHTML = `<h1>Dashboard</h1><p class="sub">Per usare il pannello serve una licenza attiva.</p>` + redeemCard('gate') +
      (state.all.length ? '<p class="field-note" style="margin-top:12px">Le tue licenze precedenti sono scadute.</p>' : '');
    bindRedeem(view);
    if (location.hash === '#licenza') view.querySelector('[data-redeem]').focus();
    return;
  }
  view.innerHTML = VIEWS[name].mount();
  VIEWS[name].bind?.();
  update();
}

function update() {
  const v = VIEWS[currentView];
  if (!v?.update) return;
  if (NEEDS_LICENSE.includes(currentView) && !state.license) return;
  v.update(state.license);
}

async function refresh() {
  try {
    state = await api('/api/license');
    if (!!state.license !== mountedHasLicense) return mount(); // licenza appena attivata/scaduta → ricostruisci
    update();
    if (currentView === 'licenses') loadAdmin();
  } catch (e) { if (e.status === 401) location.href = '/'; }
}

// ---------- azioni ----------
async function redeem(key) {
  try {
    await api('/api/redeem', { method: 'POST', body: { key } });
    toast('Licenza attivata! 🎉');
    location.hash = '#/overview';
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function cmd(body, okMsg) {
  try { await api('/api/license/cmd', { method: 'POST', body }); toast(okMsg || 'Comando in coda — live in ~5s'); refresh(); }
  catch (e) { toast(e.message, true); }
}

async function logout() { await api('/auth/logout', { method: 'POST' }); location.href = '/'; }

async function loadAdmin() {
  const { licenses } = await api('/api/admin/licenses');
  const rows = $('licRows'); if (!rows) return;
  rows.innerHTML = licenses.length ? licenses.map((l) => `
    <tr><td class="key">${esc(l.key)}</td><td>${TYPE_LABEL[l.type]}${l.staffKey ? ' <span class="badge staff">staff</span>' : ''}</td>
    <td>${l.expired ? '<span class="badge bad">scaduta</span>' : l.redeemedBy ? '<span class="badge good">attiva</span>' : '<span class="badge">libera</span>'}</td>
    <td>${esc(l.redeemedByName || '—')}</td><td>${l.redeemedBy ? esc(remaining(l.expiresAt)) : '—'}</td><td>${esc(l.note || '')}</td>
    <td><button class="btn btn-danger btn-sm" data-del="${esc(l.key)}">Elimina</button></td></tr>`).join('')
    : '<tr><td colspan="7" class="empty">Nessuna licenza</td></tr>';
  rows.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`Eliminare ${b.dataset.del}?`)) return;
    try { await api('/api/admin/licenses/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' }); toast('Licenza eliminata'); loadAdmin(); refresh(); }
    catch (e) { toast(e.message, true); }
  }));
}

async function createLicense() {
  try {
    const { licenses } = await api('/api/admin/licenses', { method: 'POST', body: { type: $('newType').value, count: Number($('newCount').value), note: $('newNote').value } });
    $('createdBox').innerHTML = 'Create: ' + licenses.map((l) => `<span class="mono" style="color:var(--p-3)">${esc(l.key)}</span>`).join(' · ');
    $('newNote').value = ''; toast(`${licenses.length} licenza/e creata/e`); loadAdmin();
  } catch (e) { toast(e.message, true); }
}

// ---------- avvio ----------
(async function boot() {
  const r = await api('/api/me');
  if (!r.user) return (location.href = '/');
  me = r.user;
  $('userName').textContent = me.username;
  $('roleBadge').textContent = me.role;
  $('avatarSlot').innerHTML = me.avatar ? `<img class="avatar" src="${esc(me.avatar)}" alt="">` : `<div class="avatar avatar-ph">${esc(me.username[0] || '?').toUpperCase()}</div>`;
  $('adminNav').hidden = me.role !== 'owner';
  $('logout').onclick = logout;
  $('burger').onclick = () => $('sidebar').classList.toggle('open');
  state = await api('/api/license');
  window.addEventListener('hashchange', route);
  route();
  setInterval(refresh, 4000);
})();
