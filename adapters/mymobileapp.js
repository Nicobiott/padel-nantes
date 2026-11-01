// MyMobileApp / LiveXperience (La Cancha, Cholet) : planning public, sans compte.
// club.platformId = { host, sport, durations } ex. { host: "lacancha.mymobileapp.fr", sport: 2, durations: [60, 90] }.
// Vérifié le 1er novembre 2026 : « loadcalendrier_capsule.asp » renvoie, même sans être connecté,
// le même planning que l'app (comparé à l'écran). Chaque horaire libre est un bouton
// choosePop('JJ/MM/AAAA HH:MM:SS', '999;idTerrain1;idTerrain2', '999;prix1;prix2', ...).
// La date doit être au format JJ/MM/AAAA.

function parseCalendar(html, duration) {
  const out = [];
  const re = /choosePop\('(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):\d{2}','([^']*)','([^']*)'/g;
  let m;
  while ((m = re.exec(html))) {
    const [, dd, mm, yyyy, hh, mi, courtsRaw, pricesRaw] = m;
    const courts = courtsRaw.split(';').slice(1); // le premier élément (999) n'est pas un terrain
    const prices = pricesRaw.split(';').slice(1).map((p) => Number(p.replace(',', '.')));
    courts.forEach((id, i) => out.push({
      court: id, start: `${yyyy}-${mm}-${dd}T${hh}:${mi}`, duration, price: Number.isFinite(prices[i]) ? prices[i] : null,
    }));
  }
  return out;
}

async function fetchDay(club, date, duration) {
  const [y, m, d] = date.split('-');
  const body = new URLSearchParams({ myDate: `${d}/${m}/${y}`, duree: String(duration), id_sport: String(club.platformId.sport), dd: String(Date.now()) });
  const res = await fetch(`https://${club.platformId.host}/loadcalendrier_capsule.asp`, {
    method: 'POST', body, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`MyMobileApp HTTP ${res.status}`);
  const html = await res.text();
  if (/runtime error/i.test(html)) throw new Error('MyMobileApp : erreur du serveur');
  return parseCalendar(html, duration);
}

async function fetchRange(club, dates) {
  const durations = club.platformId.durations || [90];
  const jobs = dates.flatMap((d) => durations.map((du) => [d, du]));
  const out = [];
  for (let i = 0; i < jobs.length; i += 4) { // 4 requêtes en parallèle au maximum
    const chunk = await Promise.all(jobs.slice(i, i + 4).map(([d, du]) => fetchDay(club, d, du)));
    chunk.forEach((s) => out.push(...s));
  }
  return out;
}

module.exports = { fetchRange, parseCalendar };
