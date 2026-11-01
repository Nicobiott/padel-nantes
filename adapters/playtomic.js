// Playtomic : endpoint public du calendrier, une requête par jour.
// club.platformId = tenant_id Playtomic du club.
// Méthode reprise du projet public github.com/RolandVrignon/paris-padel-anybotty (licence MIT).

function parseDay(rows, date) {
  if (!Array.isArray(rows)) throw new Error('Playtomic : réponse inattendue');
  const out = [];
  for (const r of rows) {
    for (const s of r.slots || []) {
      const m = /^(\d+(?:\.\d+)?) EUR$/.exec(s.price || '');
      out.push({ court: r.resource_name || null, start: `${date}T${s.start_time.slice(0, 5)}`, duration: s.duration, price: m ? Number(m[1]) : null });
    }
  }
  return out;
}

async function fetchRange(club, dates) {
  const out = [];
  for (const date of dates) {
    const url = new URL('https://playtomic.com/api/clubs/availability');
    url.search = new URLSearchParams({ tenant_id: club.platformId, date, sport_id: 'PADEL' });
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Playtomic HTTP ${res.status}`);
    out.push(...parseDay(await res.json(), date));
  }
  return out;
}

module.exports = { fetchRange, parseDay };
