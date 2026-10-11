// Utility condivise tra landing e dashboard
const LOGO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 4h14v4H9.5v3H16v4H9.5v5H5V4z" fill="url(#lg)"/><defs><linearGradient id="lg" x1="5" y1="4" x2="19" y2="20"><stop stop-color="#e9d5ff"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>`;
document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = LOGO));

const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Errore ${res.status}`), { status: res.status });
  return data;
};

function toast(msg, isErr = false) {
  document.querySelector('.toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className: 'toast' + (isErr ? ' err' : ''), textContent: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), 3600);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// tema chiaro/scuro (preferenza per-utente, best effort)
try { const t = localStorage.getItem('flux-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('flux-theme', next); } catch {}
  })
);

// stato servizi nella navbar
api('/api/health').then(() => {
  document.querySelectorAll('.status').forEach((s) => { s.querySelector('.dot').classList.add('on'); s.querySelector('span').textContent = 'servizi online'; });
}).catch(() => {});
