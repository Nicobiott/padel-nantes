// Extrait les identifiants Doinsport d'un club à partir de l'URL de sa page de réservation.
//   node doinsport-ids.js "https://xxx.doinsport.club/select-booking?guid=...&activitySelectedId=..."
// Ouvre la page de réservation padel du club dans un navigateur, choisis le padel, puis copie l'adresse.
const raw = process.argv[2];
if (!raw) { console.log('Usage : node doinsport-ids.js "<URL de la page de réservation>"'); process.exit(1); }
const url = new URL(raw);
const clean = (v) => (v ? decodeURIComponent(v).replace(/"/g, '') : null);
const clubId = clean(url.searchParams.get('guid'));
const activityId = clean(url.searchParams.get('activitySelectedId'));
if (!clubId || !activityId) { console.log('guid ou activitySelectedId absent de cette URL.'); process.exit(1); }
console.log('À coller dans clubs.json, champ "platformId" :');
console.log(JSON.stringify({ clubId, activityId }));
console.log('Et dans "bookingUrl" :');
console.log(JSON.stringify(raw));
