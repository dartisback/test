// C.E.D ITA - selezione personaggi e anagrafe

const RISORSA = typeof GetParentResourceName === "function" ? GetParentResourceName() : "ced_personaggi";

const stato = {
	personaggi: [],
	slot: 3,
	puoiEliminare: true,
	regole: { lunghezzaNome: { min: 2, max: 16 }, eta: { min: 18, max: 90 }, altezza: { min: 140, max: 210 } },
	selezionato: null,
	slotNuovo: null,
	sesso: "m",
	occupato: false,
};

const $ = (id) => document.getElementById(id);
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

async function invia(nome, dati = {}) {
	try {
		const risposta = await fetch(`https://${RISORSA}/${nome}`, {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=UTF-8" },
			body: JSON.stringify(dati),
		});
		return await risposta.json();
	} catch (e) {
		return null;
	}
}

function el(tag, classe, testo) {
	const nodo = document.createElement(tag);
	if (classe) nodo.className = classe;
	if (testo !== undefined) nodo.textContent = testo;
	return nodo;
}

function iniziali(p) {
	return ((p.nome || "?")[0] + (p.cognome || "")[0]).toUpperCase();
}

function eta(nascita) {
	const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(nascita || "");
	if (!m) return null;
	const oggi = new Date();
	let anni = oggi.getFullYear() - Number(m[3]);
	const mese = oggi.getMonth() + 1;
	if (mese < Number(m[2]) || (mese === Number(m[2]) && oggi.getDate() < Number(m[1]))) anni--;
	return anni;
}

function caricamento(attivo, testo) {
	stato.occupato = attivo;
	$("testo-caricamento").textContent = testo || "Ingresso in città...";
	$("caricamento").classList.toggle("attivo", attivo);
}

// =====================================================================
//  selezione
// =====================================================================

function trova(id) {
	return stato.personaggi.find((p) => p.id === id);
}

function disegnaLista() {
	const lista = $("lista-personaggi");
	lista.textContent = "";

	const massimo = Math.max(stato.slot, ...stato.personaggi.map((p) => p.id), 0);
	$("conteggio").textContent = `${stato.personaggi.length} / ${stato.slot}`;

	for (let id = 1; id <= massimo; id++) {
		const p = trova(id);
		const card = el("div", "card");
		card.style.animationDelay = `${(id - 1) * 70}ms`;

		if (p) {
			card.classList.toggle("selezionata", stato.selezionato === id);
			if (p.disabilitato) card.classList.add("bloccata");

			card.append(el("div", `avatar ${p.sesso}`, iniziali(p)));
			const testo = el("div", "card-testo");
			testo.append(el("b", null, `${p.nome} ${p.cognome}`));
			testo.append(el("span", null, p.grado ? `${p.lavoro} · ${p.grado}` : p.lavoro));
			card.append(testo);
			card.addEventListener("click", () => seleziona(id));
		} else {
			card.classList.add("vuota");
			if (id > stato.slot) card.classList.add("bloccata");
			card.append(el("div", "avatar", "+"));
			const testo = el("div", "card-testo");
			testo.append(el("b", null, "Nuovo cittadino"));
			testo.append(el("span", null, id > stato.slot ? "Spazio non disponibile" : "Registrati all'anagrafe"));
			card.append(testo);
			if (id <= stato.slot) card.addEventListener("click", () => apriAnagrafe(id));
		}

		lista.append(card);
	}
}

function disegnaScheda() {
	const scheda = $("scheda");
	scheda.textContent = "";
	scheda.style.animation = "none";
	void scheda.offsetWidth;
	scheda.style.animation = "";

	const p = trova(stato.selezionato);

	if (!p) {
		scheda.append(el("span", "etichetta", "Benvenuto"));
		scheda.append(el("h2", null, "Nessun cittadino"));
		scheda.append(el("p", "vuoto-testo", "Non hai ancora un personaggio. Scegli uno spazio libero a sinistra e registrati all'Ufficio Anagrafe di Los Santos."));
		const azioni = el("div", "azioni");
		const crea = el("button", "bottone primario", "Crea il tuo cittadino");
		crea.addEventListener("click", () => {
			for (let id = 1; id <= stato.slot; id++) if (!trova(id)) return apriAnagrafe(id);
		});
		azioni.append(crea);
		scheda.append(azioni);
		return;
	}

	scheda.append(el("span", "etichetta", `Cittadino n. ${p.id}`));
	scheda.append(el("h2", null, `${p.nome} ${p.cognome}`));
	scheda.append(el("p", "lavoro", p.grado ? `${p.lavoro} · ${p.grado}` : p.lavoro));

	const anni = eta(p.nascita);
	const dati = el("div", "dati");
	const voci = [
		["Nato il", p.nascita || "—"],
		["Età", anni !== null ? `${anni} anni` : "—"],
		["Sesso", p.sesso === "f" ? "Femmina" : "Maschio"],
		["Statura", p.altezza ? `${p.altezza} cm` : "—"],
		["Contanti", euro.format(p.contanti || 0), "soldi"],
		["Banca", euro.format(p.banca || 0), "soldi"],
	];
	for (const [titolo, valore, classe] of voci) {
		const dato = el("div", `dato ${classe || ""}`);
		dato.append(el("span", null, titolo), el("b", null, valore));
		dati.append(dato);
	}
	scheda.append(dati);

	const azioni = el("div", "azioni");
	const gioca = el("button", "bottone primario", p.disabilitato ? "Personaggio bloccato" : "Entra in città");
	gioca.disabled = p.disabilitato;
	gioca.addEventListener("click", () => entra(p.id));
	azioni.append(gioca);

	if (stato.puoiEliminare) {
		const elimina = el("button", "bottone elimina", "Elimina");
		elimina.addEventListener("click", () => chiediEliminazione(p));
		azioni.append(elimina);
	}
	scheda.append(azioni);
}

function seleziona(id) {
	if (stato.occupato || stato.selezionato === id) return;
	stato.selezionato = id;
	disegnaLista();
	disegnaScheda();
	invia("anteprima", { id });
}

async function entra(id) {
	if (stato.occupato) return;
	caricamento(true, "Ingresso in città...");
	const ok = await invia("gioca", { id });
	if (!ok) caricamento(false);
}

// ---------------- eliminazione ----------------

function chiediEliminazione(p) {
	$("elimina-nome").textContent = `${p.nome} ${p.cognome}`;
	$("finestra-elimina").classList.add("aperta");
	$("elimina-conferma").onclick = async () => {
		$("finestra-elimina").classList.remove("aperta");
		caricamento(true, "Eliminazione...");
		const lista = await invia("elimina", { id: p.id });
		caricamento(false);
		if (Array.isArray(lista)) {
			stato.personaggi = lista;
			stato.selezionato = lista.length ? lista[0].id : null;
			disegnaLista();
			disegnaScheda();
		}
	};
}
$("elimina-annulla").addEventListener("click", () => $("finestra-elimina").classList.remove("aperta"));

// =====================================================================
//  anagrafe (identity)
// =====================================================================

const campi = {
	nome: $("campo-nome"),
	cognome: $("campo-cognome"),
	giorno: $("campo-giorno"),
	mese: $("campo-mese"),
	anno: $("campo-anno"),
	altezza: $("campo-altezza"),
};

function mostraSchermata(nome) {
	$("schermata-selezione").classList.toggle("attiva", nome === "selezione");
	$("schermata-anagrafe").classList.toggle("attiva", nome === "anagrafe");
	$("sottotitolo").textContent = nome === "anagrafe" ? "Ufficio Anagrafe di Los Santos" : "Seleziona il tuo cittadino";
}

function numeroDocumento() {
	const lettere = "ABCDEFGHJKLMNPRSTUVWXYZ";
	const l = () => lettere[Math.floor(Math.random() * lettere.length)];
	return `CA${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}${l()}${l()}`;
}

function apriAnagrafe(id) {
	if (stato.occupato) return;
	stato.slotNuovo = id;
	for (const campo of Object.values(campi)) {
		campo.classList.remove("sbagliato");
		if (campo !== campi.altezza) campo.value = "";
	}
	campi.altezza.min = stato.regole.altezza.min;
	campi.altezza.max = stato.regole.altezza.max;
	campi.altezza.value = 175;
	$("errore").textContent = "";
	$("carta-numero").textContent = numeroDocumento();
	impostaSesso("m");
	aggiornaCarta();
	mostraSchermata("anagrafe");
	setTimeout(() => campi.nome.focus(), 50);
}

function chiudiAnagrafe() {
	mostraSchermata("selezione");
	invia("anteprima", { id: stato.selezionato });
}

function impostaSesso(sesso) {
	stato.sesso = sesso;
	document.querySelectorAll(".scelta").forEach((b) => b.classList.toggle("attiva", b.dataset.sesso === sesso));
	aggiornaCarta();
	invia("anteprima", { sesso });
}
document.querySelectorAll(".scelta").forEach((b) => b.addEventListener("click", () => impostaSesso(b.dataset.sesso)));

function normalizzaNome(testo) {
	return testo
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/(^|[ '\-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}

function scriviCarta(id, valore) {
	const nodo = $(id);
	if (nodo.textContent === valore) return;
	nodo.textContent = valore;
	nodo.classList.remove("aggiornato");
	void nodo.offsetWidth;
	nodo.classList.add("aggiornato");
}

function aggiornaCarta() {
	$("errore").textContent = "";
	scriviCarta("carta-nome", normalizzaNome(campi.nome.value) || "—");
	scriviCarta("carta-cognome", normalizzaNome(campi.cognome.value) || "—");
	const g = campi.giorno.value, m = campi.mese.value, a = campi.anno.value;
	scriviCarta("carta-nascita", g || m || a ? `${g.padStart(2, "_")}/${m.padStart(2, "_")}/${a.padEnd(4, "_")}` : "—");
	scriviCarta("carta-sesso", stato.sesso === "f" ? "F" : "M");
	scriviCarta("carta-altezza", `${campi.altezza.value} cm`);
	$("valore-altezza").textContent = `${campi.altezza.value} cm`;
}

for (const campo of [campi.nome, campi.cognome]) {
	campo.addEventListener("input", () => {
		campo.value = campo.value.replace(/[^\p{L}' \-]/gu, "");
		campo.classList.remove("sbagliato");
		aggiornaCarta();
	});
}

// data: solo numeri, passa da sola al campo successivo
[[campi.giorno, campi.mese], [campi.mese, campi.anno], [campi.anno, null]].forEach(([campo, successivo]) => {
	campo.addEventListener("input", () => {
		campo.value = campo.value.replace(/\D/g, "");
		campo.classList.remove("sbagliato");
		if (successivo && campo.value.length === campo.maxLength) successivo.focus();
		aggiornaCarta();
	});
	campo.addEventListener("keydown", (e) => {
		if (e.key === "Backspace" && campo.value === "" && campo !== campi.giorno) {
			const precedente = campo === campi.mese ? campi.giorno : campi.mese;
			precedente.focus();
		}
	});
});

campi.altezza.addEventListener("input", aggiornaCarta);

function validaModulo() {
	const r = stato.regole;
	const nome = normalizzaNome(campi.nome.value);
	const cognome = normalizzaNome(campi.cognome.value);
	const errore = (campo, testo) => {
		if (campo) campo.classList.add("sbagliato");
		return { errore: testo };
	};

	if ([...nome].length < r.lunghezzaNome.min || [...nome].length > r.lunghezzaNome.max) return errore(campi.nome, `Il nome deve avere da ${r.lunghezzaNome.min} a ${r.lunghezzaNome.max} lettere.`);
	if ([...cognome].length < r.lunghezzaNome.min || [...cognome].length > r.lunghezzaNome.max) return errore(campi.cognome, `Il cognome deve avere da ${r.lunghezzaNome.min} a ${r.lunghezzaNome.max} lettere.`);

	const g = Number(campi.giorno.value), m = Number(campi.mese.value), a = Number(campi.anno.value);
	if (campi.anno.value.length !== 4 || !g || !m) return errore(campi.giorno, "Completa la data di nascita (gg/mm/aaaa).");
	const giorniMese = new Date(a, m, 0).getDate();
	if (m < 1 || m > 12 || g < 1 || g > giorniMese) return errore(campi.giorno, "Questa data non esiste.");

	const nascita = `${String(g).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
	const anni = eta(nascita);
	if (anni < r.eta.min || anni > r.eta.max) return errore(campi.anno, `L'età deve essere tra ${r.eta.min} e ${r.eta.max} anni.`);

	return { identita: { nome, cognome, nascita, sesso: stato.sesso, altezza: Number(campi.altezza.value) } };
}

function mostraErrore(testo) {
	const nodo = $("errore");
	nodo.textContent = testo;
	nodo.classList.remove("vibra");
	void nodo.offsetWidth;
	nodo.classList.add("vibra");
}

$("modulo").addEventListener("submit", async (e) => {
	e.preventDefault();
	if (stato.occupato) return;

	const risultato = validaModulo();
	if (risultato.errore) return mostraErrore(risultato.errore);

	caricamento(true, "Registrazione in corso...");
	const risposta = await invia("crea", { id: stato.slotNuovo, identita: risultato.identita });
	if (!risposta || !risposta.ok) {
		caricamento(false);
		mostraErrore((risposta && risposta.errore) || "Registrazione non riuscita, riprova.");
	}
});

$("annulla").addEventListener("click", chiudiAnagrafe);

document.addEventListener("keydown", (e) => {
	if (e.key !== "Escape" || stato.occupato) return;
	if ($("finestra-elimina").classList.contains("aperta")) return $("finestra-elimina").classList.remove("aperta");
	if ($("schermata-anagrafe").classList.contains("attiva") && stato.personaggi.length) chiudiAnagrafe();
});

// =====================================================================
//  messaggi dal gioco
// =====================================================================

window.addEventListener("message", (evento) => {
	const { azione, dati } = evento.data || {};

	if (azione === "apri") {
		stato.personaggi = dati.personaggi || [];
		stato.slot = dati.slot || 3;
		stato.puoiEliminare = dati.puoiEliminare !== false;
		if (dati.regole) stato.regole = dati.regole;
		if (dati.documento) {
			$("carta-comune").textContent = dati.documento.comune || "LOS SANTOS";
			$("carta-cittadinanza").textContent = dati.documento.cittadinanza || "ITALIANA";
		}
		stato.selezionato = stato.personaggi.length ? stato.personaggi[0].id : null;

		caricamento(false);
		$("app").classList.remove("nascosto");
		disegnaLista();
		disegnaScheda();

		if (stato.personaggi.length) mostraSchermata("selezione");
		else apriAnagrafe(1);
	}

	if (azione === "chiudi") {
		$("app").classList.add("nascosto");
		$("finestra-elimina").classList.remove("aperta");
		setTimeout(() => caricamento(false), 400);
	}
});
