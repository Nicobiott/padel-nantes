// Alertes : prévient sur l'iPhone quand un créneau correspondant à une « veille » apparaît.
// Les veilles sont dans watches.json. Les notifications passent par ntfy.sh (app gratuite, sans compte).
// Principe : on compare les créneaux de cette collecte à ceux de la précédente (la version publiée).
// Un créneau qui n'existait pas avant = annulation de quelqu'un, ou nouveau jour ouvert à la réservation.

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// Jour de la semaine d'une date "YYYY-MM-DD" : 1 = lundi … 7 = dimanche
function weekday(date) {
  const d = new Date(date + 'T12:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}

function matches(watch, clubId, slot, now = new Date()) {
  const date = slot.start.slice(0, 10);
  // withinDays : seulement les créneaux des N prochains jours (ignore les nouveaux jours ouverts loin devant)
  if (watch.withinDays) {
    const limit = new Date(now.getTime() + watch.withinDays * 86400000).toISOString().slice(0, 10);
    if (date > limit) return false;
  }
  const t = toMin(slot.start.slice(11, 16));
  if (watch.clubs && watch.clubs.length && !watch.clubs.includes(clubId)) return false;
  if (watch.dates && watch.dates.length && !watch.dates.includes(date)) return false;
  if (watch.days && watch.days.length && !watch.days.includes(weekday(date))) return false;
  if (watch.from && t < toMin(watch.from)) return false;
  if (watch.to && t + slot.duration > toMin(watch.to)) return false; // la partie doit finir avant « to »
  if (watch.duration && slot.duration !== watch.duration) return false;
  return true;
}

const key = (clubId, s) => `${clubId}|${s.start}|${s.duration}`;

// Renvoie, pour chaque veille, les créneaux nouveaux qui lui correspondent.
// prev/next : contenu de data.json. Sans collecte précédente, rien n'est signalé (évite une avalanche au 1er lancement).
function findNewMatches(prev, next, watches, now = new Date()) {
  if (!prev || !prev.availability) return [];
  const prevOk = new Map(prev.availability.map((a) => [a.id, a]));
  const known = new Set();
  for (const a of prev.availability) for (const s of a.slots) known.add(key(a.id, s));
  const nowParis = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(now).replace(' ', 'T');
  const out = [];
  for (const watch of watches) {
    const hits = [];
    for (const a of next.availability) {
      if (a.status !== 'ok') continue;
      // Un club qui était en erreur la fois précédente : tous ses créneaux sembleraient nouveaux. On l'ignore ce tour-ci.
      if (prevOk.get(a.id)?.status !== 'ok') continue;
      for (const s of a.slots) {
        if (s.start <= nowParis) continue;
        if (!known.has(key(a.id, s)) && matches(watch, a.id, s, now)) hits.push({ clubId: a.id, ...s });
      }
    }
    // Un seul signalement par club et par horaire (plusieurs terrains ou durées = une ligne)
    const seen = new Set();
    const unique = hits.filter((h) => { const k = `${h.clubId}|${h.start}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (unique.length) out.push({ watch, hits: unique.sort((x, y) => x.start.localeCompare(y.start)) });
  }
  return out;
}

function formatMessage(result, clubs, pageUrl) {
  const name = (id) => clubs.find((c) => c.id === id)?.name || id;
  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const lines = result.hits.slice(0, 8).map((h) => {
    const d = fmt.format(new Date(h.start.slice(0, 10) + 'T12:00:00Z'));
    return `${d} ${h.start.slice(11, 16)} · ${name(h.clubId)}`;
  });
  if (result.hits.length > 8) lines.push(`… et ${result.hits.length - 8} autres`);
  return {
    title: `🎾 ${result.watch.name || 'Créneau libre'} : ${result.hits.length} créneau${result.hits.length > 1 ? 'x' : ''}`,
    message: lines.join('\n'),
    click: pageUrl || undefined,
  };
}

async function notify(topic, msg) {
  const res = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, tags: ['tennis'], ...msg }), // msg.tags remplace l'icône si fourni
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}

// Canal ntfy d'une veille : le secret GitHub nommé dans "notify" (ex. "NTFY_TOPIC_PAUL"), sinon NTFY_TOPIC.
// Dans GitHub Actions, tous les secrets du dépôt arrivent dans la variable SECRETS (JSON).
function resolveTopic(watch, env) {
  let secrets = {};
  try { secrets = JSON.parse(env.SECRETS || '{}'); } catch {}
  const name = watch.notify || 'NTFY_TOPIC';
  return secrets[name] || env[name] || null;
}

// Surveillance des clubs : une panne est signalée au 2e échec consécutif (évite les fausses alertes d'un simple raté),
// puis un message quand le club refonctionne. data.availability[].fails = nombre d'échecs consécutifs.
function clubIncidents(prev, next, clubs) {
  const name = (id) => clubs.find((c) => c.id === id)?.name || id;
  const prevById = new Map((prev?.availability || []).map((a) => [a.id, a]));
  const out = [];
  for (const a of next.availability) {
    const p = prevById.get(a.id);
    if (a.status === 'erreur' && a.fails === 2) out.push({ title: `⚠️ Pistas 12 : ${name(a.id)} ne répond plus`, message: `Les créneaux de ${name(a.id)} ne sont plus récupérés (${a.error}). L'appli affiche « Récupération impossible » pour ce club.`, tags: ['warning'] });
    if (a.status === 'ok' && (p?.fails || 0) >= 2) out.push({ title: `✅ Pistas 12 : ${name(a.id)} refonctionne`, message: `Les créneaux de ${name(a.id)} sont de nouveau à jour.`, tags: ['white_check_mark'] });
  }
  return out;
}

module.exports = { findNewMatches, formatMessage, notify, matches, weekday, resolveTopic, clubIncidents };
