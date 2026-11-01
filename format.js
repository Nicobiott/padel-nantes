// Format compact de data.json (fmt 2) : réduit fortement la taille du fichier chargé par le téléphone.
//   créneau objet {court, start:'YYYY-MM-DDTHH:MM', duration, price}
//   créneau compact [indexJour, minutesDepuisMinuit, duration, price, indexTerrain]
//   avec data.days = liste des jours et a.courts = liste des terrains du club.
function pack(data) {
  const dayIdx = new Map(data.days.map((d, i) => [d, i]));
  return {
    ...data,
    fmt: 2,
    availability: data.availability.map((a) => {
      if (!a.slots || !a.slots.length) return { ...a, slots: [] };
      const courts = [];
      const cIdx = new Map();
      const slots = a.slots.map((s) => {
        const key = s.court == null ? null : String(s.court);
        if (key != null && !cIdx.has(key)) { cIdx.set(key, courts.length); courts.push(key); }
        const [h, m] = s.start.slice(11, 16).split(':').map(Number);
        return [dayIdx.get(s.start.slice(0, 10)), h * 60 + m, s.duration, s.price ?? null, key == null ? null : cIdx.get(key)];
      });
      return { ...a, courts, slots };
    }),
  };
}

function unpack(data) {
  if (!data || data.fmt !== 2) return data; // ancien format : déjà des objets
  const pad = (n) => String(n).padStart(2, '0');
  return {
    ...data,
    availability: data.availability.map((a) => ({
      ...a,
      slots: (a.slots || []).map(([d, t, duration, price, c]) => ({
        court: c == null ? null : a.courts[c],
        start: `${data.days[d]}T${pad(Math.floor(t / 60))}:${pad(t % 60)}`,
        duration,
        price,
      })),
    })),
  };
}

module.exports = { pack, unpack };
