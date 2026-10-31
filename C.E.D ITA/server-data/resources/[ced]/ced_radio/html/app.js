// C.E.D ITA - radio

const RISORSA = typeof GetParentResourceName === "function" ? GetParentResourceName() : "ced_radio";
const $ = (id) => document.getElementById(id);

const stato = {
	aperta: false,
	accesa: false,
	chiave: 0,
	volume: 40,
	canali: [],
	libere: { min: 200, max: 999.9 },
	inserimento: "",
	trasmette: false,
};
let timerMembri = null;

async function invia(nome, dati = {}) {
	try {
		const r = await fetch(`https://${RISORSA}/${nome}`, {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=UTF-8" },
			body: JSON.stringify(dati),
		});
		return await r.json();
	} catch (e) {
		return null;
	}
}

function el(tag, classe, testo) {
	const n = document.createElement(tag);
	if (classe) n.className = classe;
	if (testo !== undefined) n.textContent = testo;
	return n;
}

const formatta = (frequenza) => Number(frequenza).toFixed(1);
const canaleDi = (chiave) => stato.canali.find((c) => c.chiave === chiave);

// ---------------------------------------------------------------------
//  disegno
// ---------------------------------------------------------------------

function disegnaDisplay() {
	const display = $("display");
	display.classList.toggle("spento", !stato.accesa);
	document.querySelector(".corpo").classList.toggle("disattivato", !stato.accesa);
	document.querySelector(".accensione").classList.toggle("acceso", stato.accesa);
	$("volume-livello").style.width = `${stato.volume}%`;
	$("tx").classList.toggle("attivo", stato.accesa && stato.trasmette);

	const frequenza = document.querySelector(".frequenza");
	frequenza.classList.toggle("inserimento", stato.inserimento !== "");

	if (!stato.accesa) {
		$("frequenza").textContent = "---.-";
		$("sigla").textContent = "";
		$("nome-canale").textContent = "Radio spenta";
	} else if (stato.inserimento !== "") {
		const cifre = stato.inserimento.padEnd(4, "_");
		$("frequenza").textContent = `${cifre.slice(0, 3)}.${cifre.slice(3)}`;
		$("sigla").textContent = "";
		$("nome-canale").textContent = "Digita e premi OK";
	} else if (stato.chiave === 0) {
		$("frequenza").textContent = "---.-";
		$("sigla").textContent = "";
		$("nome-canale").textContent = "Scegli un canale";
	} else {
		const c = canaleDi(stato.chiave);
		$("frequenza").textContent = formatta(stato.chiave / 10);
		$("sigla").textContent = c ? c.sigla : "";
		$("nome-canale").textContent = c ? c.nome : "Frequenza libera";
	}

	disegnaMini();
	disegnaCanali();
}

function disegnaMini() {
	const mini = $("mini");
	const visibile = stato.accesa && stato.chiave !== 0 && !stato.aperta;
	mini.classList.toggle("nascosto", !visibile);
	mini.classList.toggle("trasmette", stato.trasmette);
	if (!visibile) return;
	const c = canaleDi(stato.chiave);
	$("mini-frequenza").textContent = formatta(stato.chiave / 10);
	$("mini-nome").textContent = c ? `${c.sigla} · ${c.nome.split(" - ").pop()}` : "Frequenza libera";
}

function disegnaCanali() {
	const lista = $("lista-canali");
	lista.textContent = "";

	if (!stato.canali.length) {
		lista.append(el("p", "vuoto", "Nessun canale riservato per il tuo lavoro. Usa una frequenza libera con il tastierino."));
		return;
	}

	for (const c of stato.canali) {
		const riga = el("div", "canale");
		riga.style.setProperty("--colore", c.colore || "#3b82f6");
		riga.classList.toggle("attivo", c.chiave === stato.chiave);
		riga.append(el("span", "tag", c.sigla));
		const testo = el("div", "testo");
		testo.append(el("b", null, c.nome), el("span", null, `${formatta(c.frequenza)} MHz`));
		riga.append(testo);
		if (c.presenti) riga.append(el("span", "presenti", `${c.presenti} 👤`));
		riga.addEventListener("click", () => sintonizza(c.frequenza));
		lista.append(riga);
	}
}

function disegnaMembri(membri) {
	const lista = $("lista-membri");
	lista.textContent = "";
	$("conteggio-membri").textContent = membri.length ? `(${membri.length})` : "";

	if (!stato.accesa || stato.chiave === 0) {
		lista.append(el("p", "vuoto", "Sintonizzati su un canale."));
		return;
	}
	if (!membri.length) {
		lista.append(el("p", "vuoto", "Nessuno in ascolto."));
		return;
	}
	for (const m of membri) {
		const riga = el("div", "membro");
		riga.append(el("span", "sigla-membro", m.sigla || "—"), el("span", null, m.nome));
		lista.append(riga);
	}
}

async function aggiornaMembri() {
	if (!stato.aperta) return;
	disegnaMembri(stato.accesa && stato.chiave !== 0 ? (await invia("membri")) || [] : []);
}

// ---------------------------------------------------------------------
//  azioni
// ---------------------------------------------------------------------

async function sintonizza(frequenza) {
	if (!stato.accesa) return;
	stato.inserimento = "";
	const ok = await invia("sintonizza", { frequenza });
	if (ok) stato.chiave = Math.round(frequenza * 10);
	disegnaDisplay();
	setTimeout(aggiornaMembri, 400);
}

function scorri(direzione) {
	if (!stato.accesa || !stato.canali.length) return;
	const ordinati = [...stato.canali].sort((a, b) => a.chiave - b.chiave);
	let indice = ordinati.findIndex((c) => c.chiave === stato.chiave);
	if (indice === -1) indice = direzione > 0 ? -1 : 0;
	const prossimo = ordinati[(indice + direzione + ordinati.length) % ordinati.length];
	sintonizza(prossimo.frequenza);
}

function cambiaVolume(delta) {
	if (!stato.accesa) return;
	stato.volume = Math.max(0, Math.min(100, stato.volume + delta));
	invia("volume", { valore: stato.volume });
	disegnaDisplay();
}

function premiCifra(cifra) {
	if (!stato.accesa || stato.inserimento.length >= 4) return;
	stato.inserimento += cifra;
	disegnaDisplay();
}

function confermaInserimento() {
	if (!stato.accesa || stato.inserimento.length < 4) return;
	const frequenza = Number(`${stato.inserimento.slice(0, 3)}.${stato.inserimento.slice(3)}`);
	sintonizza(frequenza);
}

async function accendiSpegni() {
	stato.inserimento = "";
	await invia(stato.accesa ? "spegni" : "accendi");
}

function chiudi() {
	stato.aperta = false;
	stato.inserimento = "";
	$("radio").classList.add("nascosto");
	clearInterval(timerMembri);
	invia("chiudi");
	disegnaMini();
}

document.querySelectorAll("[data-cifra]").forEach((b) => b.addEventListener("click", () => premiCifra(b.dataset.cifra)));

document.querySelectorAll("[data-azione]").forEach((b) =>
	b.addEventListener("click", () => {
		switch (b.dataset.azione) {
			case "accendi": return accendiSpegni();
			case "su": return scorri(1);
			case "giu": return scorri(-1);
			case "vol+": return cambiaVolume(10);
			case "vol-": return cambiaVolume(-10);
			case "cancella":
				stato.inserimento = stato.inserimento.slice(0, -1);
				return disegnaDisplay();
			case "invio": return confermaInserimento();
			case "chiudi": return chiudi();
		}
	})
);

document.addEventListener("keydown", (e) => {
	if (!stato.aperta) return;
	if (e.key === "Escape") return chiudi();
	if (/^[0-9]$/.test(e.key)) return premiCifra(e.key);
	if (e.key === "Backspace") { stato.inserimento = stato.inserimento.slice(0, -1); return disegnaDisplay(); }
	if (e.key === "Enter") return confermaInserimento();
	if (e.key === "ArrowUp") return scorri(1);
	if (e.key === "ArrowDown") return scorri(-1);
});

// ---------------------------------------------------------------------
//  messaggi dal gioco
// ---------------------------------------------------------------------

window.addEventListener("message", (evento) => {
	const { azione, dati } = evento.data || {};

	if (azione === "apri") {
		stato.aperta = true;
		stato.canali = dati.canali || [];
		stato.libere = dati.libere || stato.libere;
		Object.assign(stato, dati.stato || {});
		$("aiuto-libere").textContent = `${formatta(stato.libere.min)} - ${formatta(stato.libere.max)} MHz`;
		$("radio").classList.remove("nascosto");
		disegnaDisplay();
		aggiornaMembri();
		clearInterval(timerMembri);
		timerMembri = setInterval(aggiornaMembri, 3000);
	}

	if (azione === "stato") {
		Object.assign(stato, dati);
		disegnaDisplay();
		aggiornaMembri();
	}

	if (azione === "trasmissione") {
		stato.trasmette = !!dati;
		disegnaDisplay();
	}
});
