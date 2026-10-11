const $ = (id) => document.getElementById(id);
const TYPE_LABEL = { day: 'Day', week: 'Week', lifetime: 'Lifetime' };
let me = null;
let current = null;

const fmtDate = (t) => (t ? new Date(t).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
function remaining(exp) {
  if (!exp) return 'Mai (lifetime)';
  const ms = exp - Date.now();
  if (ms <= 0) return 'Scaduta';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}g ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

async function boot() {
  const r = await api('/api/me');
  if (!r.user) return (location.href = '/');
  me = r.user;
  $('userName').textContent = me.username;
  $('roleBadge').textContent = me.role;
  $('roleBadge').className = 'badge ' + me.role;
  $('avatarSlot').innerHTML = me.avatar
    ? `<img class="avatar" src="${esc(me.avatar)}" alt="">`
    : `<div class="avatar avatar-ph">${esc(me.username[0] || '?').toUpperCase()}</div>`;
  $('admin').hidden = me.role !== 'owner';
  if (me.role === 'owner') loadAdmin();
  await refresh();
  setInterval(refresh, 4000);
}

async function refresh() {
  try {
    const { license, all } = await api('/api/license');
    current = license;
    renderLicense(license, all);
    renderControls(license);
  } catch (e) {
    if (e.status === 401) location.href = '/';
  }
}

function renderLicense(lic, all) {
  if (!lic) {
    $('licCard').innerHTML = `
      <div class="sect-title" style="font-size:18px"><i></i>Nessuna licenza attiva</div>
      <p class="sub" style="margin-top:8px">${all.length ? 'Le tue licenze sono scadute.' : 'Inserisci una chiave ricevuta dall\'owner per attivare il servizio.'}</p>
      <div class="field"><input class="input mono" id="redeemKey" placeholder="FLUX-XXXX-XXXX-XXXX-XXXX"><button class="btn btn-primary" id="redeemBtn">Riscatta</button></div>`;
    $('redeemBtn').onclick = redeem;
    $('redeemKey').onkeydown = (e) => e.key === 'Enter' && redeem();
    return;
  }
  const keep = document.activeElement?.id === 'redeemKey2' ? $('redeemKey2').value : '';
  $('licCard').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div class="sect-title" style="font-size:18px"><i></i>La tua licenza ${lic.staffKey ? '<span class="badge staff">key staff</span>' : ''}</div>
      <span class="badge ${lic.connected ? 'good' : 'bad'}">${lic.connected ? 'server connesso' : 'in attesa del server'}</span>
    </div>
    <div class="keybox" id="keybox" style="margin-top:16px" title="Clicca per copiare">${esc(lic.key)}</div>
    <div class="kv">
      <div><b>${TYPE_LABEL[lic.type]}</b><span>Tipo</span></div>
      <div><b>${remaining(lic.expiresAt)}</b><span>Scade tra</span></div>
      <div><b>${lic.bots}/${lic.maxBots}</b><span>Bot attivi</span></div>
      <div><b>${lic.pending}</b><span>Comandi in coda</span></div>
    </div>
    <div class="field-note" style="margin-top:14px">Endpoint per la risorsa FiveM: <span class="mono">POST ${location.origin}/api/fivem/poll</span> con header <span class="mono">x-license</span>.</div>
    <div class="field"><input class="input mono" id="redeemKey2" placeholder="Hai un'altra chiave? Riscattala qui" value="${esc(keep)}"><button class="btn btn-ghost" id="redeemBtn2">Riscatta</button></div>`;
  $('keybox').onclick = () => navigator.clipboard?.writeText(lic.key).then(() => toast('Chiave copiata'));
  $('redeemBtn2').onclick = () => redeem($('redeemKey2').value);
}

async function redeem(arg) {
  const key = typeof arg === 'string' ? arg : $('redeemKey').value;
  try {
    await api('/api/redeem', { method: 'POST', body: { key } });
    toast('Licenza riscattata!');
    refresh();
  } catch (e) { toast(e.message, true); }
}

function renderControls(lic) {
  $('controls').hidden = !lic;
  if (!lic) return;
  $('botCount').textContent = `${lic.bots}/${lic.maxBots} bot attivi`;
  $('botList').innerHTML = lic.botList.length
    ? lic.botList.map((b) => `<span class="chip">${esc(b.name)} <small>#${b.id}</small></span>`).join('')
    : '<div class="empty" style="width:100%">Nessun bot attivo</div>';
  $('log').innerHTML = lic.log.length
    ? [...lic.log].reverse().map((l) => `<div><span class="dim">${new Date(l.t).toLocaleTimeString('it-IT')}</span> ${esc(l.m)}</div>`).join('')
    : '<div class="dim">Nessuna attività</div>';
}

async function cmd(body, okMsg) {
  try {
    await api('/api/license/cmd', { method: 'POST', body });
    toast(okMsg || 'Comando in coda — live in ~5s');
    refresh();
  } catch (e) { toast(e.message, true); }
}

$('addBtn').onclick = () => cmd({ cmd: 'add_bot', count: Number($('addCount').value) });
$('rmBtn').onclick = () => { cmd({ cmd: 'remove_bot', id: Number($('rmId').value) }); $('rmId').value = ''; };
$('rmAllBtn').onclick = () => confirm('Rimuovere TUTTI i bot?') && cmd({ cmd: 'remove_all' });
$('applyBtn').onclick = () => cmd({ cmd: 'set_names', names: $('names').value });
$('genBtn').onclick = async () => {
  try { $('names').value = (await api('/api/names?count=8')).names.join(', '); } catch (e) { toast(e.message, true); }
};

$('logout').onclick = async () => { await api('/auth/logout', { method: 'POST' }); location.href = '/'; };

// ---------- admin ----------
async function loadAdmin() {
  const { licenses } = await api('/api/admin/licenses');
  $('licRows').innerHTML = licenses.length ? licenses.map((l) => `
    <tr>
      <td class="key">${esc(l.key)}</td>
      <td>${TYPE_LABEL[l.type]}${l.staffKey ? ' <span class="badge staff">staff</span>' : ''}</td>
      <td>${l.expired ? '<span class="badge bad">scaduta</span>' : l.redeemedBy ? '<span class="badge good">attiva</span>' : '<span class="badge">libera</span>'}</td>
      <td>${esc(l.redeemedByName || '—')}</td>
      <td>${l.redeemedBy ? esc(remaining(l.expiresAt)) : '—'}</td>
      <td>${esc(l.note || '')}</td>
      <td><button class="btn btn-danger btn-sm" data-del="${esc(l.key)}">Elimina</button></td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty">Nessuna licenza</td></tr>';
  document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`Eliminare ${b.dataset.del}?`)) return;
    try { await api('/api/admin/licenses/' + encodeURIComponent(b.dataset.del), { method: 'DELETE' }); toast('Licenza eliminata'); loadAdmin(); refresh(); }
    catch (e) { toast(e.message, true); }
  }));
}

$('createBtn').onclick = async () => {
  try {
    const { licenses } = await api('/api/admin/licenses', { method: 'POST', body: { type: $('newType').value, count: Number($('newCount').value), note: $('newNote').value } });
    $('createdBox').innerHTML = 'Create: ' + licenses.map((l) => `<span class="mono" style="color:var(--p-3)">${esc(l.key)}</span>`).join(' · ');
    $('newNote').value = '';
    toast(`${licenses.length} licenza/e creata/e`);
    loadAdmin();
  } catch (e) { toast(e.message, true); }
};

boot();
