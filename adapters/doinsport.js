// Doinsport : API publique, sans compte. Une requête par jour.
// club.platformId = { clubId, activityId } (identifiants visibles dans l'URL du site du club).
// Méthode reprise du projet public github.com/Paddadie/ResaPadel (Sporting Nantes).
const API = 'https://api-v3.doinsport.club';

function parsePlanning(json, activityId, date) {
  const playgrounds = Array.isArray(json) ? json : json && json['hydra:member'];
  if (!Array.isArray(playgrounds)) throw new Error('Doinsport : réponse inattendue');
  const out = [];
  for (const pg of playgrounds) {
    for (const act of pg.activities || []) {
      if (act.id !== activityId) continue;
      for (const slot of act.slots || []) {
        for (const p of slot.prices || []) {
          if (p.bookable !== true) continue; // comme le site : seuls les tarifs réservables
          out.push({
            court: pg.name,
            start: `${date}T${slot.startAt}`,
            duration: Math.round(p.duration / 60),
            price: (p.pricePerParticipant * p.participantCount) / 100,
          });
        }
      }
    }
  }
  return out;
}

async function fetchDay(club, date) {
  const { clubId, activityId } = club.platformId;
  const params = new URLSearchParams({
    'club.id': clubId, from: '00:00:00', to: '23:59:59', 'activities.id': activityId, bookingType: 'unique',
  });
  const res = await fetch(`${API}/clubs/playgrounds/plannings/${date}?${params}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Doinsport HTTP ${res.status}`);
  return parsePlanning(await res.json(), activityId, date);
}

// Plage de dates : un appel par jour, 4 en parallèle au maximum pour ménager l'API.
async function fetchRange(club, dates) {
  const out = [];
  for (let i = 0; i < dates.length; i += 4) {
    const chunk = await Promise.all(dates.slice(i, i + 4).map((d) => fetchDay(club, d)));
    chunk.forEach((s) => out.push(...s));
  }
  return out;
}

module.exports = { fetchRange, parsePlanning };
