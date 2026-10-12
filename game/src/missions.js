import { Q, insideQuestura } from './layout.js';

export const STAGES = ['goto', 'duty', 'uniform', 'weapons', 'keys', 'car', 'patrol'];

const CALLS = [
  { text: 'Segnalazione di persona sospetta', poi: 'martiri' },
  { text: 'Richiesta di controllo alla stazione', poi: 'station' },
  { text: 'Disturbo al Parco Città di Bologna', poi: 'bologna' },
  { text: "Controllo al Parco dell'Artigliere", poi: 'artigliere' },
  { text: 'Supporto al Palazzo di Giustizia', poi: 'giustizia' },
];

/**
 * Flusso di gioco:
 * cittadino → Questura → entra in servizio → divisa → armi → scegli volante → pattuglia
 */
export class Missions {
  constructor(game) {
    this.g = game;
    this.reset();
  }

  reset() {
    this.stage = 0;
    this.onDuty = false;
    this.uniform = false;
    this.armed = false;
    this.assigned = null;
    this.call = null;
    this.callTimer = 40;
    this.callsDone = 0;
    this.prompt = null;
  }

  get stageName() { return STAGES[this.stage]; }

  /** Imposta la fase direttamente (admin / inizio già in servizio) */
  setStage(n, silent = false) {
    const g = this.g;
    this.stage = Math.max(0, Math.min(STAGES.length - 1, n));
    this.onDuty = this.stage >= 2;
    this.uniform = this.stage >= 3;
    this.armed = this.stage >= 4;
    g.player.char.setOutfit(this.uniform ? 'uniform' : 'civil');
    if (this.armed) g.player.giveWeapons(); else g.player.clearWeapons();
    if (this.stage >= 5) { g.vehicles.forEach((v) => (v.locked = false)); }
    else g.vehicles.forEach((v) => (v.locked = true));
    if (this.stage < 5) this.assigned = null;
    else if (!this.assigned) this.assigned = g.vehicles[0];
    if (!silent) g.ui.toast(`Fase: ${this.objective().title}`, 'ok');
  }

  objective() {
    switch (this.stageName) {
      case 'goto': return { title: 'Raggiungi la Questura di Belluno', sub: 'Segui il segnale giallo sulla mappa. Ingresso su Via Attilio Tissi.' };
      case 'duty': return { title: 'Entra in servizio', sub: 'Vai al banco accoglienza e timbra il cartellino.' };
      case 'uniform': return { title: 'Indossa la divisa', sub: 'Segui il segnale fino allo spogliatoio (porta a sinistra).' };
      case 'weapons': return { title: 'Ritira le armi in armeria', sub: 'Porta a destra dell\'atrio. Pistola, taser e manganello.' };
      case 'keys': return { title: 'Scegli la volante', sub: 'Bacheca chiavi nella sala operativa, in fondo.' };
      case 'car': return { title: 'Raggiungi la volante', sub: 'Esci dalla porta sul retro. Premi F vicino all\'auto per salire.' };
      default:
        if (this.call) return { title: this.call.text, sub: `Raggiungi ${this.call.poiName} (segnale giallo).` };
        return { title: 'Pattuglia libera', sub: 'Guida per Belluno. Q = sirena · attendi chiamate dalla centrale.' };
    }
  }

  blips() {
    const out = [];
    const mk = (x, z, label, color) => out.push({ x, z, label, color });
    switch (this.stageName) {
      case 'goto': mk(Q.doorX, Q.z1 + 3, 'Questura'); break;
      case 'duty': mk(Q.desk.x, Q.desk.z + 2.0, 'Accoglienza'); break;
      case 'uniform': mk(Q.lockers.x, Q.lockers.z, 'Spogliatoio'); break;
      case 'weapons': mk(Q.armory.x, Q.armory.z, 'Armeria'); break;
      case 'keys': mk(Q.keys.x, Q.keys.z, 'Chiavi volanti'); break;
      case 'car': if (this.assigned) mk(this.assigned.x, this.assigned.z, 'Volante', '#6fa8ff'); break;
      default: if (this.call) mk(this.call.x, this.call.z, this.call.poiName); break;
    }
    return out;
  }

  /** Punti di interazione validi in questo momento */
  interactables() {
    const s = this.stageName;
    const list = [
      { id: 'duty', pos: Q.desk, r: 2.8, minStage: 1 },
      { id: 'uniform', pos: Q.lockers, r: 2.8, minStage: 2 },
      { id: 'weapons', pos: Q.armory, r: 2.8, minStage: 3 },
      { id: 'keys', pos: Q.keys, r: 2.8, minStage: 4 },
    ];
    return list;
  }

  update(dt, a) {
    const g = this.g, p = g.player;
    this.prompt = null;
    if (p.vehicle) {
      // in auto: gestisci solo le chiamate
      this.updateCalls(dt);
      return;
    }
    const px = p.pos.x, pz = p.pos.z;

    // fase 0: entra in Questura
    if (this.stage === 0 && insideQuestura(px, pz)) {
      this.stage = 1;
      g.ui.toast('Benvenuto in Questura. Vai al banco accoglienza.', 'ok');
      g.audio.ui('ok');
    }

    // interazioni
    for (const it of this.interactables()) {
      const d = Math.hypot(px - it.pos.x, pz - it.pos.z);
      if (d > it.r) continue;
      const isCurrent = (it.id === 'duty' && this.stage === 1) || (it.id === 'uniform' && this.stage === 2) ||
        (it.id === 'weapons' && this.stage === 3) || (it.id === 'keys' && this.stage === 4);
      if (isCurrent) {
        const txt = { duty: 'Entra in servizio', uniform: 'Indossa la divisa', weapons: 'Ritira le armi', keys: 'Scegli la volante' }[it.id];
        this.prompt = { key: 'E', text: txt };
        if (a.interact) this.act(it.id);
      } else if (this.stage < it.minStage) {
        const need = { duty: 'Prima raggiungi il banco accoglienza.', uniform: 'Prima entra in servizio.', weapons: 'Prima indossa la divisa.', keys: 'Prima ritira le armi.' }[it.id];
        this.prompt = { key: '', text: need, deny: true };
        if (a.interact) { g.ui.toast(need, 'err'); g.audio.ui('err'); }
      } else if (it.id === 'keys' && this.stage >= 5) {
        this.prompt = { key: 'E', text: 'Cambia volante' };
        if (a.interact) this.act('keys');
      }
      break;
    }

    // auto vicina
    if (!this.prompt) {
      const v = g.nearestVehicle(3.6);
      if (v) {
        if (v.locked) this.prompt = { key: '', text: 'Volante di servizio: devi prima completare l\'ingresso in servizio.', deny: true };
        else this.prompt = { key: 'F', text: `Sali sulla ${v.type.name}` };
      }
    }

    this.updateCalls(dt);
  }

  act(id) {
    const g = this.g;
    if (id === 'duty') {
      g.fadeTransition(() => {
        this.onDuty = true; this.stage = 2;
        g.ui.toast('Sei in servizio. Buon turno, Agente!', 'ok');
      });
    } else if (id === 'uniform') {
      g.fadeTransition(() => {
        this.uniform = true; this.stage = 3;
        g.player.char.setOutfit('uniform');
        g.ui.toast('Divisa indossata.', 'ok');
      });
    } else if (id === 'weapons') {
      g.fadeTransition(() => {
        this.armed = true; this.stage = 4;
        g.player.giveWeapons();
        g.ui.toast('Armi ritirate: [1] Pistola  [2] Taser  [3] Manganello  [0] Riponi', 'ok');
      });
    } else if (id === 'keys') {
      g.ui.openKeys();
    }
  }

  /** Chiamata dalla UI quando il giocatore sceglie un'auto */
  chooseCar(typeId) {
    const g = this.g;
    const v = g.vehicles.find((x) => x.typeId === typeId && !x.occupied) || g.vehicles[0];
    this.assigned = v;
    g.vehicles.forEach((x) => (x.locked = false));
    if (this.stage < 5) this.stage = 5;
    g.ui.toast(`Volante assegnata: ${v.type.name}. Esci dal retro.`, 'ok');
    g.audio.ui('ok');
  }

  onEnterVehicle(v) {
    if (this.stage === 5) {
      this.stage = 6;
      this.callTimer = 25;
      this.g.ui.toast('Pattuglia iniziata. Q = sirena, H = clacson, L = fari.', 'ok');
    }
  }

  updateCalls(dt) {
    if (this.stage < 6) return;
    const g = this.g;
    if (!this.call) {
      this.callTimer -= dt;
      if (this.callTimer <= 0) {
        const c = CALLS[Math.floor(Math.random() * CALLS.length)];
        const poi = g.world.layout.pois.find((p) => p.id === c.poi);
        const cp = poi.call || poi;
        this.call = { text: c.text, x: cp.x, z: cp.z, poiName: poi.name };
        g.ui.toast(`📻 Centrale: ${c.text} — ${poi.name}`, 'radio');
        g.audio.ui('ok');
      }
    } else {
      const pos = g.player.vehicle ? { x: g.player.vehicle.x, z: g.player.vehicle.z } : g.player.pos;
      if (Math.hypot(pos.x - this.call.x, pos.z - this.call.z) < 16) {
        this.callsDone++;
        g.ui.toast('📻 Intervento concluso. Ottimo lavoro!', 'ok');
        g.audio.ui('ok');
        this.call = null;
        this.callTimer = 45;
      }
    }
  }
}
