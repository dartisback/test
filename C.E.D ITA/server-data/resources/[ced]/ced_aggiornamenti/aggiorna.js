// C.E.D ITA - aggiornamento automatico quando parte il server (FXServer o txAdmin).
//
// Esegue strumenti/aggiorna.ps1 e ASPETTA che finisca: in server.cfg questa risorsa
// parte per prima, poi "refresh" trova le risorse nuove ed "exec risorse.cfg"
// legge l'elenco aggiornato. Cosi' le novita' sono attive gia' a questo avvio.
//
// Per disattivarlo: file NON_AGGIORNARE.txt nella cartella principale,
// oppure in server.cfg (prima di "ensure ced_aggiornamenti"):  set ced_aggiornamenti false

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const PREFISSO = "^5[C.E.D ITA]^7";

function cercaCartellaPrincipale(partenza) {
	let cartella = path.resolve(partenza);
	for (let i = 0; i < 8; i++) {
		if (fs.existsSync(path.join(cartella, "strumenti", "aggiorna.ps1"))) return cartella;
		const sopra = path.dirname(cartella);
		if (sopra === cartella) break;
		cartella = sopra;
	}
	return null;
}

function impronta(file) {
	try {
		return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
	} catch (e) {
		return null;
	}
}

function aggiorna() {
	if (GetConvar("ced_aggiornamenti", "true") === "false") {
		return console.log(`${PREFISSO} aggiornamento automatico disattivato.`);
	}
	if (process.platform !== "win32") {
		return console.log(`${PREFISSO} aggiornamento automatico disponibile solo su Windows.`);
	}

	const radice = cercaCartellaPrincipale(GetResourcePath(GetCurrentResourceName()));
	if (!radice) {
		return console.log(`${PREFISSO} non trovo strumenti/aggiorna.ps1: aggiornamento saltato.`);
	}

	const serverCfg = path.join(radice, "server-data", "server.cfg");
	const prima = impronta(serverCfg);

	console.log(`${PREFISSO} controllo aggiornamenti...`);
	const esito = spawnSync(
		"powershell.exe",
		["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(radice, "strumenti", "aggiorna.ps1")],
		{ encoding: "utf8", timeout: 10 * 60 * 1000, windowsHide: true }
	);

	const testo = `${esito.stdout || ""}${esito.stderr || ""}`;
	for (const riga of testo.split(/\r?\n/)) {
		if (riga.trim() && !riga.includes("----------")) console.log(`${PREFISSO} ${riga.trim()}`);
	}
	if (esito.error) {
		console.log(`${PREFISSO} ^1aggiornamento non riuscito: ${esito.error.message}^7`);
	}

	if (prima && impronta(serverCfg) !== prima) {
		console.log(`${PREFISSO} ^3server.cfg e' stato aggiornato: RIAVVIA il server una volta per applicare tutto.^7`);
	}
}

aggiorna();
