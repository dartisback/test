(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const chat = $('#chat');
  const messages = $('#messages');
  const input = $('#input');
  const inputBar = $('#inputBar');
  const chip = $('#chip');
  const counter = $('#counter');
  const sugBox = $('#suggestions');
  const banner = $('#banner');

  const state = {
    open: false,
    cfg: { fadeTime: 8000, maxMessages: 100, bannerTime: 7000 },
    maxLength: 200,
    channels: [],
    extra: [],
    history: [],
    histIdx: -1,
    draft: '',
    sel: 0,
    bannerTimer: null,
  };

  const post = (name, data = {}) =>
    fetch(`https://${typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'nr_chat'}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    }).catch(() => {});

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---------------- messaggi ---------------- */
  function scheduleFade(node) {
    clearTimeout(node._t);
    node._t = setTimeout(() => { if (!state.open) node.classList.add('faded'); }, state.cfg.fadeTime);
  }

  function addMessage(m) {
    const node = el('div', `msg ${m.style || m.channel || ''}`);
    if (m.color) node.style.setProperty('--c', m.color);

    const head = el('div', 'head');
    const badge = el('span', 'badge');
    badge.append(el('span', 'ico', m.icon || '💬'), el('span', '', m.label || ''));
    head.append(badge);
    if (m.author) head.append(el('span', 'author', m.author));
    if (m.real) head.append(el('span', 'real', `(${m.real})`));
    if (m.time) head.append(el('span', 'time', m.time));
    node.append(head, el('div', 'text', m.text || ''));

    messages.append(node);
    node._born = Date.now();
    while (messages.children.length > state.cfg.maxMessages) messages.firstChild.remove();
    messages.scrollTop = messages.scrollHeight;
    if (!state.open) scheduleFade(node);

    if (m.banner) showBanner(m);
  }

  function showBanner(m) {
    clearTimeout(state.bannerTimer);
    banner.className = '';
    banner.replaceChildren();
    const box = el('div', 'bn');
    const text = el('div');
    text.append(el('div', 't', 'Annuncio dello staff'), el('div', 'm', m.text), el('div', 'a', `— ${m.author || 'Staff'}`));
    box.append(el('div', 'ico', m.icon || '📢'), text);
    banner.append(box);
    void banner.offsetWidth; // riavvia l'animazione
    banner.classList.add('show');
    state.bannerTimer = setTimeout(() => {
      banner.classList.remove('show');
      banner.classList.add('hide');
    }, state.cfg.bannerTime);
  }

  /* ---------------- apertura / chiusura ---------------- */
  function open(prefill) {
    state.open = true;
    chat.classList.add('open');
    messages.querySelectorAll('.msg').forEach((n) => { clearTimeout(n._t); n.classList.remove('faded'); });
    input.value = prefill || '';
    state.histIdx = -1;
    refresh();
    setTimeout(() => {
      input.focus();
      input.value = prefill || ''; // scarta il carattere del tasto usato per aprire
      refresh();
      messages.scrollTop = messages.scrollHeight;
    }, 60);
  }

  function close() {
    state.open = false;
    chat.classList.remove('open');
    input.blur();
    sugBox.replaceChildren();
    messages.querySelectorAll('.msg').forEach((n) => {
      const left = Math.max(1200, state.cfg.fadeTime - (Date.now() - (n._born || 0)));
      clearTimeout(n._t);
      n._t = setTimeout(() => { if (!state.open) n.classList.add('faded'); }, left);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  /* ---------------- suggerimenti ---------------- */
  const allCommands = () => [
    ...state.channels.map((c) => ({ name: c.command, help: c.help, icon: c.icon, color: c.color })),
    ...state.extra.filter((e) => !state.channels.some((c) => c.command === e.name.replace(/^\//, ''))).map((e) => ({
      name: e.name.replace(/^\//, ''), help: e.help || '', icon: '⌨️', color: '#8b93a7',
    })),
  ];

  function refresh() {
    const v = input.value;
    const len = v.length;
    counter.textContent = `${len}/${state.maxLength}`;
    counter.className = len >= state.maxLength ? 'max' : len > state.maxLength * 0.85 ? 'warn' : '';

    const m = v.match(/^\/(\S*)/);
    const token = m ? m[1].toLowerCase() : null;
    const exact = token !== null && state.channels.find((c) => c.command === token);

    if (exact && /^\/\S+\s/.test(v)) {
      inputBar.style.setProperty('--c', exact.color);
      chip.style.setProperty('--c', exact.color);
      chip.textContent = `${exact.icon} ${exact.label}`;
      chip.classList.add('show');
    } else {
      inputBar.style.removeProperty('--c');
      chip.classList.remove('show');
    }

    sugBox.replaceChildren();
    sugBox._list = [];
    if (token === null || /^\/\S+\s/.test(v)) return;
    const list = allCommands().filter((c) => c.name.toLowerCase().startsWith(token)).slice(0, 7);
    state.sel = Math.min(state.sel, Math.max(0, list.length - 1));
    list.forEach((c, i) => {
      const row = el('div', `sug${i === state.sel ? ' sel' : ''}`);
      row.style.setProperty('--c', c.color);
      row.style.setProperty('--i', i);
      row.append(el('span', 'ico', c.icon), el('span', 'name', `/${c.name}`), el('span', 'help', c.help));
      row.addEventListener('mousedown', (e) => { e.preventDefault(); complete(c.name); });
      sugBox.append(row);
    });
    sugBox._list = list;
  }

  function complete(name) {
    input.value = `/${name} `;
    input.focus();
    refresh();
  }

  /* ---------------- tastiera ---------------- */
  input.addEventListener('input', () => { state.sel = 0; refresh(); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      post('close');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { close(); return post('close'); }
      state.history.push(text);
      if (state.history.length > 50) state.history.shift();
      close();
      post('chatResult', { message: text });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const list = sugBox._list || [];
      if (list.length) complete(list[state.sel].name);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const list = sugBox.children.length ? sugBox._list || [] : [];
      if (list.length) {
        state.sel = (state.sel + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
        refresh();
        return;
      }
      if (!state.history.length) return;
      if (state.histIdx === -1) state.draft = input.value;
      state.histIdx += e.key === 'ArrowUp' ? 1 : -1;
      state.histIdx = Math.max(-1, Math.min(state.history.length - 1, state.histIdx));
      input.value = state.histIdx === -1 ? state.draft : state.history[state.history.length - 1 - state.histIdx];
      refresh();
    } else if (input.value.length >= state.maxLength && e.key.length === 1 && !e.ctrlKey) {
      inputBar.classList.remove('shake');
      void inputBar.offsetWidth;
      inputBar.classList.add('shake');
    }
  });

  messages.addEventListener('wheel', (e) => { if (!state.open) e.preventDefault(); }, { passive: false });

  /* ---------------- messaggi dal client Lua ---------------- */
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    switch (d.action) {
      case 'config':
        Object.assign(state.cfg, d.config || {});
        if (d.maxLength) { state.maxLength = d.maxLength; input.maxLength = d.maxLength; }
        break;
      case 'open': open(d.prefill); break;
      case 'close': close(); break;
      case 'addMessage': addMessage(d.message || {}); break;
      case 'channels': state.channels = d.channels || []; if (state.open) refresh(); break;
      case 'suggestions':
        (d.list || []).forEach((s) => { if (!state.extra.some((x) => x.name === s.name)) state.extra.push(s); });
        break;
      case 'clear': messages.replaceChildren(); break;
      case 'visible': chat.classList.toggle('hidden', !d.value); break;
    }
  });

  post('ready');
})();
