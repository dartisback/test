(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const chat = $('chat'), messages = $('messages'), input = $('input');
    const sugBox = $('suggestions'), inputBox = $('inputbox'), counter = $('counter');
    const inIconImg = $('in-icon-img');

    const resource = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'fancy_chat';
    const post = (name, data) =>
        fetch(`https://${resource}/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data || {}),
        }).catch(() => {});

    const cfg = { maxLength: 200, displayTime: 9000, maxMessages: 100 };
    let isOpen = false;
    let suggestions = [];
    let matches = [];
    let selected = -1;
    const history = [];
    let histIdx = -1;

    // ----------------------------------------------------------------
    //  Colori
    // ----------------------------------------------------------------
    const hslToHex = (h, s, l) => {
        s /= 100; l /= 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    };

    // Colore stabile generato dal nome (cosi' ogni lavoro ha il suo senza configurare nulla)
    const colorFromSeed = (seed) => {
        let h = 0;
        for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        return hslToHex(h % 360, 72, 52);
    };

    const normColor = (c) => {
        if (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) {
            return c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c;
        }
        return null;
    };
    const rgbOf = (hex) => `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };

    const isPhoto = (src) => /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(src) || /^https?:\/\//i.test(src);
    const safeSrc = (src) => (typeof src === 'string' && /^(img\/|https?:\/\/)/i.test(src) ? src : 'img/chat.svg');

    // ----------------------------------------------------------------
    //  Messaggi
    // ----------------------------------------------------------------
    const richText = (target, text) => {
        // evidenzia #hashtag e @menzioni (come un tweet), sempre via textContent
        text.split(/(\s+)/).forEach((part) => {
            if (/^[#@][\p{L}\p{N}_]{2,}$/u.test(part)) target.appendChild(el('span', 'tagword', part));
            else target.appendChild(document.createTextNode(part));
        });
    };

    const addMessage = (m) => {
        const color = normColor(m.color) || colorFromSeed(m.colorSeed || m.title || m.type || 'chat');
        const duration = cfg.displayTime;

        const wrap = el('div', 'wrap');
        const msg = el('div', 'msg' + (m.fx ? ' fx-' + String(m.fx).replace(/[^a-z]/gi, '') : '') + (m.compact ? ' compact' : ''));
        msg.style.setProperty('--c', color);
        msg.style.setProperty('--rgb', rgbOf(color));
        msg.style.setProperty('--dur', duration + 'ms');

        // icona
        const src = safeSrc(m.icon);
        const icon = el('div', 'icon' + (isPhoto(src) ? ' photo' : ''));
        const img = el('img');
        img.src = src;
        img.alt = '';
        img.onerror = () => { icon.classList.remove('photo'); img.src = 'img/jobs/default.svg'; img.onerror = null; };
        icon.appendChild(img);
        msg.appendChild(icon);

        // contenuto
        const content = el('div', 'content');
        const head = el('div', 'head');
        if (m.title) head.appendChild(el('span', 'tag', m.title));
        if (m.author) head.appendChild(el('span', 'author', m.author));
        if (m.handle) head.appendChild(el('span', 'handle', m.handle));
        if (m.subtitle) head.appendChild(el('span', 'sub', '· ' + m.subtitle));
        const t = m.time || new Date().toTimeString().slice(0, 5);
        head.appendChild(el('span', 'time', t));
        content.appendChild(head);

        const text = el('div', 'text');
        if (m.rich) richText(text, String(m.text || '')); else text.textContent = String(m.text || '');
        content.appendChild(text);
        msg.appendChild(content);

        msg.appendChild(el('div', 'life'));
        wrap.appendChild(msg);
        wrap.dataset.exp = String(Date.now() + duration);

        messages.appendChild(wrap);
        wrap.style.maxHeight = wrap.scrollHeight + 'px';

        while (messages.children.length > cfg.maxMessages) messages.removeChild(messages.firstChild);
        messages.scrollTop = messages.scrollHeight;

        setTimeout(refresh, duration + 60);
    };

    // mostra i messaggi recenti (o tutti se la chat e' aperta), nasconde gli altri con animazione
    const refresh = () => {
        const now = Date.now();
        for (const wrap of messages.children) {
            const visible = isOpen || now < Number(wrap.dataset.exp);
            if (visible) wrap.style.maxHeight = wrap.scrollHeight + 'px';
            wrap.classList.toggle('gone', !visible);
        }
        if (isOpen) messages.scrollTop = messages.scrollHeight;
    };

    // ----------------------------------------------------------------
    //  Suggerimenti
    // ----------------------------------------------------------------
    const updateSuggestions = () => {
        const value = input.value;
        sugBox.textContent = '';
        matches = [];
        selected = -1;

        if (value[0] === '/') {
            const [first, ...rest] = value.slice(1).split(' ');
            const typedArgs = rest.length > 0;
            const key = first.toLowerCase();
            matches = suggestions
                .filter((s) => (typedArgs ? s.name === key : s.name.startsWith(key)))
                .slice(0, 6);
        }

        const current = matches.find((s) => value.slice(1).split(' ')[0].toLowerCase() === s.name) || matches[0];
        setAccent(current ? current.color : null, current ? current.icon : null);

        if (!matches.length) { sugBox.classList.remove('show'); return; }

        matches.forEach((s, i) => {
            const row = el('div', 'sug');
            row.style.setProperty('--c', s.color || '#38bdf8');
            row.style.animationDelay = i * 35 + 'ms';
            const ic = el('div', 's-icon');
            const im = el('img');
            im.src = safeSrc(s.icon);
            ic.appendChild(im);
            row.appendChild(ic);
            row.appendChild(el('span', 's-name', '/' + s.name));
            const params = (s.params || []).map((p) => `[${p.name}]`).join(' ');
            if (params) row.appendChild(el('span', 's-params', params));
            if (s.help) row.appendChild(el('span', 's-help', s.help));
            row.addEventListener('mousedown', (e) => { e.preventDefault(); complete(i); });
            sugBox.appendChild(row);
        });
        sugBox.classList.add('show');
    };

    const setAccent = (color, icon) => {
        const c = normColor(color) || '#38bdf8';
        inputBox.style.setProperty('--c', c);
        inIconImg.src = safeSrc(icon || 'img/chat.svg');
    };

    const select = (i) => {
        const rows = sugBox.children;
        if (!rows.length) return;
        selected = (i + rows.length) % rows.length;
        [...rows].forEach((r, n) => r.classList.toggle('sel', n === selected));
    };

    const complete = (i) => {
        const s = matches[i >= 0 ? i : 0];
        if (!s) return;
        input.value = '/' + s.name + ' ';
        onInput();
    };

    // ----------------------------------------------------------------
    //  Input
    // ----------------------------------------------------------------
    const onInput = () => {
        const len = [...input.value].length;
        counter.textContent = `${len}/${cfg.maxLength}`;
        counter.className = len >= cfg.maxLength ? 'max' : len > cfg.maxLength * 0.8 ? 'warn' : '';
        updateSuggestions();
    };
    input.addEventListener('input', onInput);

    const open = () => {
        isOpen = true;
        chat.classList.add('open');
        input.maxLength = cfg.maxLength;
        input.value = '';
        histIdx = -1;
        onInput();
        refresh();
        setTimeout(() => { input.value = ''; input.focus(); }, 40);
    };

    const close = () => {
        isOpen = false;
        chat.classList.remove('open');
        input.blur();
        sugBox.classList.remove('show');
        refresh();
    };

    const submit = () => {
        const text = input.value.trim();
        if (!text) { post('close'); return; }
        history.unshift(text);
        if (history.length > 40) history.pop();
        post('submit', { text });
    };

    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        switch (e.key) {
            case 'Escape': e.preventDefault(); post('close'); break;
            case 'Enter': e.preventDefault(); submit(); break;
            case 'Tab': e.preventDefault(); if (matches.length) complete(selected); break;
            case 'ArrowUp':
                e.preventDefault();
                if (matches.length) select(selected < 0 ? matches.length - 1 : selected - 1);
                else if (histIdx < history.length - 1) { input.value = history[++histIdx]; onInput(); }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (matches.length) select(selected + 1);
                else if (histIdx > 0) { input.value = history[--histIdx]; onInput(); }
                else { histIdx = -1; input.value = ''; onInput(); }
                break;
            case 'PageUp': e.preventDefault(); messages.scrollBy({ top: -messages.clientHeight * .8, behavior: 'smooth' }); break;
            case 'PageDown': e.preventDefault(); messages.scrollBy({ top: messages.clientHeight * .8, behavior: 'smooth' }); break;
        }
    });

    // ----------------------------------------------------------------
    //  Messaggi da Lua
    // ----------------------------------------------------------------
    window.addEventListener('message', ({ data }) => {
        switch (data.action) {
            case 'config': Object.assign(cfg, { maxLength: data.maxLength, displayTime: data.displayTime, maxMessages: data.maxMessages }); break;
            case 'suggestions': suggestions = data.list || []; if (isOpen) updateSuggestions(); break;
            case 'add': addMessage(data.msg || {}); break;
            case 'open': open(); break;
            case 'close': close(); break;
            case 'clear': messages.textContent = ''; break;
            case 'visible': chat.classList.toggle('off', !data.state); break;
        }
    });

    post('ready');
})();
