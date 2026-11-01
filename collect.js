// Récupère les créneaux de tous les clubs sur 60 jours.
//   node collect.js                 -> écrit public/data.json (utilisé par GitHub Actions)
//   require('./collect').collect()  -> renvoie les données (utilisé par server.js)
const fs = require('fs');
const path = require('path');
const getAdapter = require('./adapters');
const { pack, unpack } = require('./format');

const DAYS = 60;
// Seuls les clubs d'au moins MIN_COURTS terrains sont affichés (nombre inconnu = exclu). Mettre 0 pour tout voir.
const MIN_COURTS = 4;
// "always" : club gardé quel que soit son nombre de terrains. Seuls les clubs dont on lit le planning en direct sont affichés.
const clubs = JSON.parse(fs.readFileSync(path.join(__dirname, 'clubs.json'), 'utf8'))
  .filter((c) => c.always || (c.courts || 0) >= MIN_COURTS)
  .filter((c) => getAdapter.isConnected(c) || c.dayUrl); // exception : clubs avec un lien direct vers leur planning du jour (Urban)

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
      return res.ok ? unpack(await res.json()) : null;
    }
    return unpack(JSON.parse(fs.readFileSync(src, 'utf8')));
  } catch { return null; }
}

if (require.main === module) {
  (async () => {
    const out = path.join(__dirname, 'public', 'data.json');
    const prevSrc = process.env.PREVIOUS_DATA || (fs.existsSync(out) ? out : null);
    const previous = await loadPrevious(prevSrc);
    const data = await collect();
    // Compteur d'échecs consécutifs par club (conservé d'une collecte à l'autre) pour la surveillance
    const prevById = new Map((previous?.availability || []).map((a) => [a.id, a]));
    for (const a of data.availability) {
      const p = prevById.get(a.id);
      a.fails = a.status === 'erreur' ? (p?.fails || 0) + 1 : 0;
    }
    fs.writeFileSync(out, JSON.stringify(pack(data)));
    console.log(`data.json : ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`);
    for (const a of data.availability) {
      const name = clubs.find((c) => c.id === a.id).name;
      console.log(`${a.status.padEnd(11)} ${name}${a.status === 'ok' ? ` : ${a.slots.length} créneaux, jusqu'au ${a.horizon}` : a.error ? ` : ${a.error}` : ''}`);
      if (a.status === 'ok') {
        // Contrôle de couverture : horaires distincts en soirée (≥ 18h, en semaine) et le week-end
        const wd = (d) => new Date(d + 'T12:00:00Z').getUTCDay();
        const uniq = (f) => new Set(a.slots.filter(f).map((s) => s.start)).size;
        const soir = uniq((s) => wd(s.start.slice(0, 10)) % 6 !== 0 && s.start.slice(11, 13) >= '18');
        const we = uniq((s) => wd(s.start.slice(0, 10)) % 6 === 0);
        const last = a.slots.reduce((m, s) => (s.start.slice(11, 16) > m ? s.start.slice(11, 16) : m), '00:00');
        console.log(`            soirs semaine (≥18h) : ${soir} horaires · week-end : ${we} horaires · dernier départ : ${last}`);
      }
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

    // Surveillance : prévient (ntfy, NTFY_TOPIC) quand un club tombe en panne 2 fois de suite, puis quand il remarche.
    const { clubIncidents } = require('./alerts');
    const incidents = clubIncidents(previous, data, clubs);
    for (const msg of incidents) {
      console.log(`Surveillance : ${msg.title}`);
      const topic = resolveTopic({}, process.env);
      if (topic) { try { await notify(topic, { ...msg, click: process.env.PAGE_URL || undefined }); } catch (e) { console.log(`  Envoi impossible : ${e.message}`); } }
    }

    // Échec du job seulement si tous les clubs branchés sont en erreur (pour être prévenu par e-mail).
    const live = data.availability.filter((a) => ['ok', 'erreur'].includes(a.status));
    if (live.length && live.every((a) => a.status === 'erreur')) process.exit(1);
  })();
}
