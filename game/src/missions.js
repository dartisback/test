import { CAR_TYPES } from './vehicle.js';

export const STAGES = ['goto', 'duty', 'uniform', 'equip', 'keys', 'car', 'patrol'];

/**
 * Flusso del turno (uguale per tutti i corpi):
 * cittadino → sede → entra in servizio → divisa → attrezzatura → scegli veicolo → pattuglia (chiamate)
 */
export class Missions {
  constructor(game) { this.g = game; this.reset(); }

  reset() {
    this.stage = 0; this.onDuty = false; this.uniform = false; this.equipped = false;
    this.assigned = null; this.prompt = null;
  }
  get stageName() { return STAGES[this.stage]; }
  get hq() { return this.g.hq; }

  setStage(n, silent = false) {
    const g = this.g, f = g.faction;
    this.stage = Math.max(0, Math.min(STAGES.length - 1, n));
    this.onDuty = this.stage >= 2; this.uniform = this.stage >= 3; this.equipped = this.stage >= 4;
    g.player.char.setOutfit(this.uniform ? f.outfit : 'civil');
    if (this.equipped) g.player.giveEquipment(f); else g.player.clearEquipment();
    g.vehicles.forEach((v) => { if (v.tag === 'hq') v.locked = this.stage < 5; });
    if (this.stage < 5) this.assigned = null; else if (!this.assigned) this.assigned = g.vehicles.find((v) => v.tag === 'hq') || null;
    if (!silent) g.ui.toast(`Fase: ${this.objective().title}`, 'ok');
  }

  objective() {
    const f = this.g.faction;
    switch (this.stageName) {
      case 'goto': return { title: `Raggiungi: ${f.hq}`, sub: 'Segui il segnale giallo sulla mappa e sulla minimappa.' };
      case 'duty': return { title: 'Entra in servizio', sub: 'Vai al banco accoglienza e timbra il cartellino.' };
      case 'uniform': return { title: 'Indossa la divisa', sub: 'Spogliatoio: porta a sinistra dell\'atrio.' };
      case 'equip': return { title: `Ritira l'attrezzatura (${f.equip.toLowerCase()})`, sub: 'Porta a destra dell\'atrio.' };
      case 'keys': return { title: 'Scegli il veicolo', sub: 'Bacheca chiavi nella sala operativa, in fondo.' };
      case 'car': return { title: 'Raggiungi il veicolo', sub: 'Esci dal retro. Premi F vicino al mezzo per salire.' };
      default: return null; // il dispatcher fornisce l'obiettivo
    }
  }

  blips() {
    const hq = this.hq, I = hq.interact, out = [];
    const mk = (x, z, label, color) => out.push({ x, z, label, color });
    switch (this.stageName) {
      case 'goto': mk(hq.door.x, hq.door.z + 3, this.g.faction.short); break;
      case 'duty': mk(I.desk.x, I.desk.z + 2.0, 'Accoglienza'); break;
      case 'uniform': mk(I.lockers.x, I.lockers.z, 'Spogliatoio'); break;
      case 'equip': mk(I.equip.x, I.equip.z, this.g.faction.equip); break;
      case 'keys': mk(I.keys.x, I.keys.z, 'Chiavi'); break;
      case 'car': if (this.assigned) mk(this.assigned.x, this.assigned.z, 'Veicolo', '#6fa8ff'); break;
      default: break;
    }
    return out;
  }

  update(dt, a) {
    const g = this.g, p = g.player, hq = this.hq;
    this.prompt = null;
    if (p.vehicle) return;
    const px = p.pos.x, pz = p.pos.z;
    if (this.stage === 0 && hq.inside(px, pz)) {
      this.stage = 1; g.ui.toast(`Benvenuto: ${g.faction.hq}. Vai al banco accoglienza.`, 'ok'); g.audio.ui('ok');
    }
    if (!hq.inside(px, pz) && this.stage < 5 && !p.vehicle) { /* fuori: nessuna interazione di turno */ }
    const I = hq.interact;
    const list = [
      { id: 'duty', pos: I.desk, r: 2.8, minStage: 1 }, { id: 'uniform', pos: I.lockers, r: 2.8, minStage: 2 },
      { id: 'equip', pos: I.equip, r: 2.8, minStage: 3 }, { id: 'keys', pos: I.keys, r: 2.8, minStage: 4 },
    ];
    for (const it of list) {
      if (Math.hypot(px - it.pos.x, pz - it.pos.z) > it.r) continue;
      const cur = (it.id === 'duty' && this.stage === 1) || (it.id === 'uniform' && this.stage === 2) || (it.id === 'equip' && this.stage === 3) || (it.id === 'keys' && this.stage === 4);
      if (cur) {
        const txt = { duty: 'Entra in servizio', uniform: 'Indossa la divisa', equip: `Ritira: ${g.faction.equip.toLowerCase()}`, keys: 'Scegli il veicolo' }[it.id];
        this.prompt = { key: 'E', text: txt };
        if (a.interact) this.act(it.id);
      } else if (this.stage < it.minStage) {
        const need = { duty: 'Prima raggiungi il banco accoglienza.', uniform: 'Prima entra in servizio.', equip: 'Prima indossa la divisa.', keys: 'Prima ritira l\'attrezzatura.' }[it.id];
        this.prompt = { key: '', text: need, deny: true };
        if (a.interact) { g.ui.toast(need, 'err'); g.audio.ui('err'); }
      } else if (it.id === 'keys' && this.stage >= 5) {
        this.prompt = { key: 'E', text: 'Cambia veicolo' };
        if (a.interact) this.act('keys');
      }
      break;
    }
  }

  act(id) {
    const g = this.g, f = g.faction;
    if (id === 'duty') g.fadeTransition(() => { this.onDuty = true; this.stage = 2; g.ui.toast('Sei in servizio. Buon turno!', 'ok'); });
    else if (id === 'uniform') g.fadeTransition(() => { this.uniform = true; this.stage = 3; g.player.char.setOutfit(f.outfit); g.ui.toast('Divisa indossata.', 'ok'); });
    else if (id === 'equip') g.fadeTransition(() => { this.equipped = true; this.stage = 4; g.player.giveEquipment(f); g.ui.toast(f.equipMsg, 'ok'); });
    else if (id === 'keys') g.ui.openKeys(f.vehicles.filter((v, i, a) => a.indexOf(v) === i));
  }

  chooseCar(typeId) {
    const g = this.g;
    const v = g.vehicles.find((x) => x.tag === 'hq' && x.typeId === typeId && !x.occupied) || g.vehicles.find((x) => x.tag === 'hq');
    this.assigned = v;
    g.vehicles.forEach((x) => { if (x.tag === 'hq') x.locked = false; });
    if (this.stage < 5) this.stage = 5;
    g.ui.toast(`Veicolo assegnato: ${CAR_TYPES[typeId].name}. Esci dal retro.`, 'ok'); g.audio.ui('ok');
  }

  onEnterVehicle(v) {
    if (this.stage === 5 && v.tag === 'hq') {
      this.stage = 6;
      this.g.ui.toast('Pattuglia iniziata. Q = sirena, R = radio. Attendi le chiamate della Centrale.', 'ok');
      this.g.dispatcher.start();
    }
  }
}
