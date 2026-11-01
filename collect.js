// Récupère les créneaux de tous les clubs sur 30 jours.
//   node collect.js                 -> écrit public/data.json (utilisé par GitHub Actions)
//   require('./collect').collect()  -> renvoie les données (utilisé par server.js)
const fs = require('fs');
const path = require('path');
const getAdapter = require('./adapters');

const DAYS = 30;
// Seuls les clubs d'au moins MIN_COURTS terrains sont affichés (nombre inconnu = exclu). Mettre 0 pour tout voir.
const MIN_COURTS = 4;
const clubs = JSON.parse(fs.readFileSync(path.join(__dirname, 'clubs.json'), 'utf8')).filter((c) => c.always || (c.courts || 0) >= MIN_COURTS); // "always": club gardé quel que soit son nombre de terrains

function nextDays(n) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

async function collectClub(club, days) {
  const base = { id: club.id };
  const adapter = getAdapter(club.platform);
  if (club.membersOnly && !adapter?.mock) return { ...base, status: 'adherents', slots: [] };
  if (!adapter || (!adapter.mock && !club.platformId)) return { ...base, status: 'non-branche', slots: [] };
  try {
    const slots = await adapter.fetchRange(club, days);
    slots.sort((a, b) => a.start.localeCompare(b.start));
    const horizon = slots.length ? slots[slots.length - 1].start.slice(0, 10) : null;
    return { ...base, status: adapter.mock ? 'fictif' : 'ok', horizon, slots };
  } catch (e) {
    return { ...base, status: 'erreur', error: e.message, slots: [] };
  }
}

async function collect() {
  const days = nextDays(DAYS);
  const results = await Promise.all(clubs.map((c) => collectClub(c, days)));
  return { generatedAt: new Date().toISOString(), days, clubs, availability: results };
}

module.exports = { collect };

// Charge la collecte précédente : un fichier local, ou la version publiée (URL).
async function loadPrevious(src) {
  if (!src) return null;
  try {
    if (/^https?:/.test(src)) {
      const res = await fetch(src, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      return res.ok ? await res.json() : null;
    }
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  } catch { return null; }
}

if (require.main === module) {
  (async () => {
    const out = path.join(__dirname, 'public', 'data.json');
    const prevSrc = process.env.PREVIOUS_DATA || (fs.existsSync(out) ? out : null);
    const previous = await loadPrevious(prevSrc);
    const data = await collect();
    fs.writeFileSync(out, JSON.stringify(data));
    for (const a of data.availability) {
      const name = clubs.find((c) => c.id === a.id).name;
      console.log(`${a.status.padEnd(11)} ${name}${a.status === 'ok' ? ` : ${a.slots.length} créneaux, jusqu'au ${a.horizon}` : a.error ? ` : ${a.error}` : ''}`);
    }

    // Alertes
    const { findNewMatches, formatMessage, notify, resolveTopic } = require('./alerts');
    const watchesFile = path.join(__dirname, 'watches.json');
    const watches = fs.existsSync(watchesFile) ? JSON.parse(fs.readFileSync(watchesFile, 'utf8')) : [];
    const results = findNewMatches(previous, data, watches);
    console.log(previous ? `Alertes : ${results.length} veille(s) déclenchée(s)` : 'Alertes : pas de collecte précédente, rien à comparer');
    for (const r of results) {
      const msg = formatMessage(r, clubs, process.env.PAGE_URL);
      console.log(`  ${msg.title}\n    ${msg.message.replace(/\n/g, '\n    ')}`);
      const topic = resolveTopic(r.watch, process.env);
      if (topic) {
        try { await notify(topic, msg); } catch (e) { console.log(`  Envoi impossible : ${e.message}`); }
      } else console.log(`  Pas de canal ntfy configuré pour cette veille (${r.watch.notify || 'NTFY_TOPIC'}).`);
    }

    // Échec du job seulement si tous les clubs branchés sont en erreur (pour être prévenu par e-mail).
    const live = data.availability.filter((a) => ['ok', 'erreur'].includes(a.status));
    if (live.length && live.every((a) => a.status === 'erreur')) process.exit(1);
  })();
}
