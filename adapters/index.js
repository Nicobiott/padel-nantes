// Chaque adaptateur expose : async fetchRange(club, dates) -> [{ court, start, duration, price }]
//   dates  = liste de "YYYY-MM-DD" consécutives
//   start  = "YYYY-MM-DDTHH:MM" (heure locale Paris), duration en minutes, price en euros (ou null)
const adapters = {
  anybuddy: require('./anybuddy'),
  doinsport: require('./doinsport'),
  playtomic: require('./playtomic'),
  apex: require('./apex'),
  mymobileapp: require('./mymobileapp'),
};
const mock = require('./mock');

module.exports = function getAdapter(platform) {
  if (process.env.MOCK === '1') return mock;
  return adapters[platform] || null; // null = plateforme pas encore branchée
};
