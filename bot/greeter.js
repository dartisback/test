// Gestisce i saluti uno alla volta: mentre una persona sente il SUO saluto, tutti gli altri
// (che l'hanno già sentito) vengono messi in "Silenzia server" per pochi secondi, poi ripristinati.
// Lo staff non viene mai silenziato. Gli ID silenziati vengono salvati su file: se il bot si
// ferma a metà, chi era silenziato viene ripristinato appena rientra in un canale vocale.
const fs = require('fs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createGreeter({ getChannel, isStaff, playGreeting, greetMs, stateFile, settleMs = 400, tailMs = 1200, log = console }) {
  let silenced = new Set();
  try {
    silenced = new Set(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
  } catch {}
  const save = () => {
    try { fs.writeFileSync(stateFile, JSON.stringify([...silenced])); } catch {}
  };

  const queue = [];
  let processing = false;
  let current = null;
  let chain = Promise.resolve();
  let warned = false;

  async function setSilenced(member, on) {
    try {
      await member.voice.setDeaf(on, 'Saluto del bot');
    } catch (e) {
      if (!warned) {
        warned = true;
        log.error(
          `!! Non riesco a silenziare/ripristinare ${member.user?.tag ?? member.id} (${e.message}). ` +
            'Il bot ha bisogno del permesso "Escludi l\'audio dei membri".',
        );
      }
      return false;
    }
    if (on) silenced.add(member.id);
    else silenced.delete(member.id);
    save();
    return true;
  }

  // Allinea chi è silenziato a chi deve esserlo (tutti tranne target, staff, bot). target=null -> nessuno
  function sync(target) {
    chain = chain.then(() => doSync(target)).catch((e) => log.error(e));
    return chain;
  }

  async function doSync(target) {
    const channel = getChannel();
    if (!channel) return false;
    const members = [...channel.members.values()];
    const want = new Set();
    if (target !== null) {
      for (const m of members) {
        if (m.user.bot || m.id === target || isStaff(m)) continue;
        if (m.voice.serverDeaf && !silenced.has(m.id)) continue; // già silenziato da altri: non lo tocchiamo
        want.add(m.id);
      }
    }
    let changed = false;
    for (const m of members) {
      if (want.has(m.id) && !silenced.has(m.id)) {
        if (await setSilenced(m, true)) changed = true;
      } else if (!want.has(m.id) && silenced.has(m.id)) {
        await setSilenced(m, false);
      }
    }
    return changed;
  }

  async function run() {
    if (processing) return;
    processing = true;
    try {
      while (queue.length) {
        const id = queue.shift();
        if (!getChannel()?.members.get(id)) continue; // se n'è già andato
        current = id;
        if (await sync(id)) await sleep(settleMs); // lascia a Discord il tempo di applicare il silenzio
        await playGreeting();
        await sleep(greetMs() + tailMs);
      }
    } catch (e) {
      log.error(e);
    } finally {
      current = null;
      processing = false;
      await sync(null); // tutti ripristinati
      if (queue.length) run();
    }
  }

  return {
    // Una persona è entrata nel canale d'attesa
    async onJoin(member) {
      if (silenced.has(member.id)) await chain.then(() => setSilenced(member, false));
      queue.push(member.id);
      if (processing && current !== null) sync(current); // silenzia subito il nuovo arrivato durante il saluto di un altro
      run();
    },
    // Qualcuno è entrato in un altro canale: se era rimasto silenziato dal bot, lo ripristina
    async releaseIfStale(member) {
      if (silenced.has(member.id)) await chain.then(() => setSilenced(member, false));
    },
    // Dopo un riavvio: ripristina chi è nel canale e risultava silenziato
    async releaseAllIn(channel) {
      for (const m of channel.members.values()) if (silenced.has(m.id)) await setSilenced(m, false);
    },
    clear() {
      queue.length = 0;
    },
    _silenced: () => silenced,
  };
}

module.exports = { createGreeter };
