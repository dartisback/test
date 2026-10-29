/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2022-2026 ESX Framework
 * Grafica C.E.D ITA: notifiche animate (stessa API di esx_notify).
 */

const BRAND = "C.E.D ITA";
const MAX_PER_CONTAINER = 6;

const ICONS = {
	success: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
	error: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
	info: '<svg viewBox="0 0 24 24"><path d="M12 11v6"/><circle class="solid" cx="12" cy="7.2" r="1.5"/></svg>',
	warning: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle class="solid" cx="12" cy="17" r="1.2"/></svg>',
	polizia: '<svg viewBox="0 0 24 24"><path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V5.8z"/><path class="solid" d="M12 7.4l1.25 2.55 2.8.4-2.03 1.98.48 2.8L12 13.8l-2.5 1.33.48-2.8-2.03-1.98 2.8-.4z"/></svg>',
	carabinieri: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15.6" r="5.4"/><path d="M8.2 15.6h7.6"/><path class="solid" d="M12 9.4c-2.7-.5-3.7-2.9-2.1-5.4.3 1.1 1 1.5 1.5 1 .1-1.3.8-2.4 2-3.2-.3 1.5.5 2.6 1.3 3.5 1.1 1.4.5 3.6-2.7 4.1z"/></svg>',
};

// colore principale, colore chiaro, titolo di default, suono [frequenza1, frequenza2]
const TYPES = {
	success: { accent: "#16a34a", accent2: "#4ade80", title: "Successo", tones: [660, 990] },
	error: { accent: "#dc2626", accent2: "#f87171", title: "Errore", tones: [330, 220] },
	info: { accent: "#2563eb", accent2: "#60a5fa", title: "Informazione", tones: [620, 820] },
	warning: { accent: "#d97706", accent2: "#fbbf24", title: "Attenzione", tones: [520, 440] },
	polizia: { accent: "#1d4ed8", accent2: "#7dd3fc", title: "Polizia Di Stato", tones: [880, 660] },
	carabinieri: { accent: "#9f1239", accent2: "#fb7185", title: "Arma Dei Carabinieri", tones: [784, 587] },
};

// codici colore GTA (~r~ ~g~ ...)
const CODES = {
	"~r~": "#f87171",
	"~b~": "#60a5fa",
	"~g~": "#4ade80",
	"~y~": "#facc15",
	"~p~": "#c084fc",
	"~c~": "#9ca3af",
	"~m~": "#6b7280",
	"~u~": "#111827",
	"~o~": "#fb923c",
	"~w~": "#ffffff",
};

const hexToRgba = (hex, alpha) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const escapeHTML = (str) => {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
};

// trasforma ~r~testo~s~ in span colorati e <br> in a capo, dopo aver neutralizzato l'HTML
const formatText = (raw) => {
	let html = escapeHTML(String(raw));
	html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>").replace(/~n~/g, "<br>");

	let open = 0;
	html = html.replace(/~[a-z]~/g, (code) => {
		if (code === "~s~") {
			if (open > 0) {
				open--;
				return "</span>";
			}
			return "";
		}
		const color = CODES[code];
		if (!color) return "";
		open++;
		return `<span style="color:${color}">`;
	});

	return html + "</span>".repeat(open);
};

let audioContext;

const playSound = (tones) => {
	try {
		audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
		const now = audioContext.currentTime;

		tones.forEach((freq, i) => {
			const osc = audioContext.createOscillator();
			const gain = audioContext.createGain();
			const start = now + i * 0.09;

			osc.type = "sine";
			osc.frequency.setValueAtTime(freq, start);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

			osc.connect(gain);
			gain.connect(audioContext.destination);
			osc.start(start);
			osc.stop(start + 0.2);
		});
	} catch (e) {
		// audio non disponibile: nessun problema
	}
};

const closeSlot = (slot) => {
	if (slot.dataset.closing) return;
	slot.dataset.closing = "1";
	// fissa l'altezza attuale cosi' la transizione verso 0 parte dal valore reale
	slot.style.maxHeight = `${slot.scrollHeight}px`;
	void slot.offsetHeight;
	slot.classList.add("closing");
	setTimeout(() => slot.remove(), 460);
};

const notify = (data) => {
	const type = TYPES[data.type] ? data.type : "info";
	const cfg = TYPES[type];
	const length = Number(data.length) > 0 ? Number(data.length) : 4000;
	const container = document.getElementById(data.position) || document.getElementById("middle-right");

	const slot = document.createElement("div");
	slot.className = "ced-slot";

	const card = document.createElement("div");
	card.className = "ced-notify";
	card.dataset.type = type;
	card.style.setProperty("--accent", cfg.accent);
	card.style.setProperty("--accent-2", cfg.accent2);
	card.style.setProperty("--accent-soft", hexToRgba(cfg.accent, 0.2));
	card.style.setProperty("--accent-shadow", hexToRgba(cfg.accent, 0.55));
	card.style.setProperty("--duration", `${length}ms`);

	const title = data.title ? formatText(data.title) : cfg.title;
	const message = data.message !== undefined && data.message !== null ? formatText(data.message) : "";

	card.innerHTML = `
		<div class="ced-icon"><span class="ring"></span>${ICONS[type]}</div>
		<div class="ced-body">
			<div class="ced-head">
				<span class="ced-title">${title}</span>
				<span class="ced-brand"><span class="ced-flag"><i></i><i></i><i></i></span>${BRAND}</span>
			</div>
			<div class="ced-msg">${message}</div>
		</div>
		<div class="ced-progress"><span></span></div>
	`;

	slot.appendChild(card);
	container.appendChild(slot);

	// troppe notifiche nello stesso angolo: chiude le piu' vecchie
	const open = container.querySelectorAll(".ced-slot:not([data-closing])");
	for (let i = 0; i < open.length - MAX_PER_CONTAINER; i++) closeSlot(open[i]);

	if (data.notificationSoundEnabled) playSound(cfg.tones);

	setTimeout(() => closeSlot(slot), length);
};

window.addEventListener("message", (event) => {
	const data = event.data;
	if (!data || typeof data !== "object" || data.message === undefined) return;
	notify(data);
});
