// Anybuddy : endpoint public des disponibilités (sans compte).
// club.platformId = slug du club (ex. "le-set-le-bignon", tel qu'il apparaît dans l'URL Anybuddy).
// Vérifié le 1er novembre 2026 depuis un vrai navigateur :
//  - l'API refuse les périodes de plus de 7 jours (« Paramètres de disponibilités invalides ») : on découpe ;
//  - chaque « service » d'un horaire correspond à un terrain libre (même id = même terrain), décliné par durée ;
//  - le prix est en centimes, pour le terrain entier.
// Méthode d'origine : github.com/RolandVrignon/paris-padel-anybotty (licence MIT).

const MAX_DAYS_PER_CALL = 7;

function parseAvailability(body) {
  if (!body || !Array.isArray(body.data)) throw new Error('Anybuddy : réponse inattendue');
  const out = [];
  for (const row of body.data) {
    for (const s of row.services || []) {
      out.push({ court: s.id, start: row.startDateTime.slice(0, 16), duration: s.duration, price: s.price / 100 });
    }
  }
  return out;
}

async function fetchRange(club, dates) {
  const out = [];
  for (let i = 0; i < dates.length; i += MAX_DAYS_PER_CALL) {
    const chunk = dates.slice(i, i + MAX_DAYS_PER_CALL);
    const url = new URL('https://www.anybuddyapp.com/api/v1/availabilities');
    url.search = new URLSearchParams({
      clubSlug: club.platformId, dateFrom: chunk[0], dateTo: `${chunk[chunk.length - 1]}T23:59`, activity: 'padel',
    });
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Anybuddy HTTP ${res.status}`);
    out.push(...parseAvailability(await res.json()));
  }
  return out;
}

module.exports = { fetchRange, parseAvailability };
