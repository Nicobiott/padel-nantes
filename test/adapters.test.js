const test = require('node:test');
const assert = require('node:assert');
const { parsePlanning } = require('../adapters/doinsport');
const { parseAvailability } = require('../adapters/anybuddy');
const { parseDay } = require('../adapters/playtomic');

const ACT = 'padel-act';

test('Doinsport : garde seulement les tarifs réservables, prix total en euros', () => {
  const json = { 'hydra:member': [
    { id: 'p1', name: 'Padel 1', activities: [{ id: ACT, slots: [
      { startAt: '18:00', prices: [
        { bookable: true, duration: 3600, pricePerParticipant: 1000, participantCount: 4 },
        { bookable: false, duration: 7200, pricePerParticipant: 1800, participantCount: 4 },
      ] },
    ] }, { id: 'autre-sport', slots: [{ startAt: '19:00', prices: [{ bookable: true, duration: 3600, pricePerParticipant: 500, participantCount: 2 }] }] }] },
  ] };
  assert.deepStrictEqual(parsePlanning(json, ACT, '2026-11-10'), [
    { court: 'Padel 1', start: '2026-11-10T18:00', duration: 60, price: 40 },
  ]);
});

test('Doinsport : accepte aussi un tableau JSON simple', () => {
  assert.deepStrictEqual(parsePlanning([], ACT, '2026-11-10'), []);
});

test('Doinsport : rejette une réponse inconnue', () => {
  assert.throws(() => parsePlanning({ foo: 1 }, ACT, '2026-11-10'));
});

test('Anybuddy : vraie réponse du Set (19/11/2026), un créneau par terrain et par durée', () => {
  const body = require('./fixtures/anybuddy-le-set-2026-11-19.json');
  const slots = parseAvailability(body);
  assert.strictEqual(slots.length, 12);
  const at2130 = slots.filter((s) => s.start === '2026-11-19T21:30');
  assert.strictEqual(new Set(at2130.map((s) => s.court)).size, 4); // 4 terrains libres à 21h30
  assert.deepStrictEqual(slots[0], { court: '3071deaf-7cc5-48d8-b16f-3ce44eac8983', start: '2026-11-19T16:30', duration: 90, price: 42 });
  assert.ok(slots.some((s) => s.duration === 120 && s.price === 76));
});

test('Anybuddy : rejette une réponse inconnue', () => {
  assert.throws(() => parseAvailability({}));
});

test('Playtomic : lit les créneaux et le prix en euros', () => {
  const rows = [{ resource_id: 'r1', resource_name: 'Piste 1', start_date: '2026-11-03', slots: [{ start_time: '19:30:00', duration: 90, price: '48 EUR' }] }];
  assert.deepStrictEqual(parseDay(rows, '2026-11-03'), [{ court: 'Piste 1', start: '2026-11-03T19:30', duration: 90, price: 48 }]);
});

test('Apex (L\'Autre Usine) : vraie réponse du 05/11/2026', () => {
  const { parseSchedules } = require('../adapters/apex');
  const fs = require('fs');
  const text = fs.readFileSync(__dirname + '/fixtures/apex-autre-usine-2026-11-05.json', 'utf8');
  const slots = parseSchedules(text, '2026-11-05');
  assert.strictEqual(slots.length, 5);
  assert.deepStrictEqual(slots[0], { court: null, start: '2026-11-05T16:30', duration: 90, price: 40 });
  assert.deepStrictEqual(slots[4], { court: null, start: '2026-11-05T22:30', duration: 90, price: 45 });
});

test('MyMobileApp (La Cancha) : vraie réponse du 01/11/2026, un créneau par terrain libre', () => {
  const { parseCalendar } = require('../adapters/mymobileapp');
  const html = require('fs').readFileSync(__dirname + '/fixtures/mymobileapp-la-cancha-2026-11-01.html', 'utf8');
  const slots = parseCalendar(html, 90);
  assert.strictEqual(slots.length, 5); // 1 + 2 + 0 (18h complet) + 2
  assert.deepStrictEqual(slots[0], { court: '2214', start: '2026-11-01T13:30', duration: 90, price: 42 });
  assert.ok(!slots.some((s) => s.start.endsWith('18:00')));
  assert.deepStrictEqual(slots.filter((s) => s.start.endsWith('18:30')).map((s) => s.court), ['2213', '2216']);
});
