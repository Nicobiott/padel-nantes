// Créneaux fictifs (mode test : MOCK=1 node server.js), stables pour un club et une date donnés.
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

async function fetchRange(club, dates) {
  const horizon = 7 + (club.id.length % 3) * 7; // chaque club ouvre plus ou moins loin à l'avance
  const slots = [];
  dates.slice(0, horizon).forEach((date) => {
    const rand = seeded(club.id + date);
    for (let c = 1; c <= (club.courts || 2); c++) {
      for (let m = 9 * 60; m <= 21 * 60 + 30; m += 90) {
        if (rand() < 0.3) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0');
          const mm = String(m % 60).padStart(2, '0');
          slots.push({ court: `Terrain ${c}`, start: `${date}T${hh}:${mm}`, duration: 90, price: m >= 18 * 60 ? 48 : 36 });
        }
      }
    }
  });
  return slots;
}

module.exports = { fetchRange, mock: true };
