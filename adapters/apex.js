// Apex Timing (widget de réservation de L'Autre Usine, Cholet) : liste publique des horaires, sans compte.
// club.platformId = { center, product } : centre Apex et produit « Padel 1h30 ».
// Vérifié le 1er novembre 2026 depuis un vrai navigateur : la réponse « load_schedules » ne liste que les
// horaires encore réservables (les horaires pris disparaissent), avec début, fin et prix du terrain.
// Le nombre de terrains libres n'est pas donné (« places_available » vaut toujours 0).
const URL_SCHEDULES = 'https://www.apex-timing.com/gokarts/functions/request_session_booking.php';

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function parseSchedules(text, date) {
  const rows = JSON.parse(String(text).trim());
  if (!Array.isArray(rows)) throw new Error('Apex : réponse inattendue');
  return rows.map((r) => ({
    court: null,
    start: `${date}T${r.start_hour}`,
    duration: toMin(r.end_hour) - toMin(r.start_hour),
    price: r.price != null ? Number(r.price) : null,
  }));
}

async function fetchDay(club, date) {
  const body = new URLSearchParams({
    type: 'load_schedules', center_id: String(club.platformId.center), product_id: String(club.platformId.product),
    date: date.replace(/-/g, '/'), people_number: '1', kart_id: '',
  });
  const res = await fetch(URL_SCHEDULES, {
    method: 'POST', body, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`Apex HTTP ${res.status}`);
  return parseSchedules(await res.text(), date);
}

async function fetchRange(club, dates) {
  const out = [];
  for (let i = 0; i < dates.length; i += 4) { // 4 jours en parallèle au maximum
    const chunk = await Promise.all(dates.slice(i, i + 4).map((d) => fetchDay(club, d)));
    chunk.forEach((s) => out.push(...s));
  }
  return out;
}

module.exports = { fetchRange, parseSchedules };
