const test = require('node:test');
const assert = require('node:assert');
const { findNewMatches, formatMessage, weekday } = require('../alerts');

const NOW = new Date('2026-11-01T10:00:00Z'); // dimanche 1er novembre, 11h à Paris
const slot = (start, duration = 90) => ({ court: null, start, duration, price: 40 });
const data = (clubs) => ({ availability: Object.entries(clubs).map(([id, v]) => (Array.isArray(v) ? { id, status: 'ok', slots: v } : v)) });
const mardiSoir = { name: 'Mardi soir', days: [2], from: '18:00', to: '20:00', duration: 90 };

test('jours de la semaine : lundi = 1, dimanche = 7', () => {
  assert.strictEqual(weekday('2026-11-02'), 1);
  assert.strictEqual(weekday('2026-11-01'), 7);
});

test('premier lancement : aucune alerte', () => {
  assert.deepStrictEqual(findNewMatches(null, data({ a: [slot('2026-11-03T18:00')] }), [mardiSoir], NOW), []);
});

test('un créneau qui se libère déclenche la veille', () => {
  const prev = data({ a: [] });
  const next = data({ a: [slot('2026-11-03T18:00')] });
  const r = findNewMatches(prev, next, [mardiSoir], NOW);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].hits[0].start, '2026-11-03T18:00');
});

test('un créneau déjà connu ne redéclenche pas', () => {
  const s = [slot('2026-11-03T18:00')];
  assert.deepStrictEqual(findNewMatches(data({ a: s }), data({ a: s }), [mardiSoir], NOW), []);
});

test('hors critères (jour, heure, durée, club) : pas d alerte', () => {
  const prev = data({ a: [] });
  const next = data({ a: [slot('2026-11-04T18:00'), slot('2026-11-03T21:00'), slot('2026-11-03T18:00', 60)] });
  assert.deepStrictEqual(findNewMatches(prev, next, [mardiSoir], NOW), []);
  const autreClub = { ...mardiSoir, clubs: ['b'] };
  assert.deepStrictEqual(findNewMatches(prev, data({ a: [slot('2026-11-03T18:00')] }), [autreClub], NOW), []);
});

test('club en erreur la fois précédente : ignoré ce tour-ci', () => {
  const prev = data({ a: { id: 'a', status: 'erreur', slots: [] } });
  const next = data({ a: [slot('2026-11-03T18:00')] });
  assert.deepStrictEqual(findNewMatches(prev, next, [mardiSoir], NOW), []);
});

test('créneau déjà passé : ignoré', () => {
  const tous = { name: 'Tout', from: '00:00', to: '23:59' };
  const r = findNewMatches(data({ a: [] }), data({ a: [slot('2026-11-01T09:00'), slot('2026-11-01T18:00')] }), [tous], NOW);
  assert.deepStrictEqual(r[0].hits.map((h) => h.start), ['2026-11-01T18:00']);
});

test('message lisible avec le nom du club', () => {
  const r = findNewMatches(data({ a: [] }), data({ a: [slot('2026-11-03T18:00')] }), [mardiSoir], NOW)[0];
  const m = formatMessage(r, [{ id: 'a', name: 'Le Set' }], 'https://x.github.io/padel/');
  assert.match(m.title, /Mardi soir : 1 créneau/);
  assert.match(m.message, /mar\. 3 nov\.? 18:00 · Le Set/);
  assert.strictEqual(m.click, 'https://x.github.io/padel/');
});

test('canal ntfy : secret propre à la veille, sinon canal commun', () => {
  const { resolveTopic } = require('../alerts');
  const env = { SECRETS: JSON.stringify({ NTFY_TOPIC: 'commun', NTFY_TOPIC_PAUL: 'paul-x7' }) };
  assert.strictEqual(resolveTopic({ notify: 'NTFY_TOPIC_PAUL' }, env), 'paul-x7');
  assert.strictEqual(resolveTopic({}, env), 'commun');
  assert.strictEqual(resolveTopic({ notify: 'NTFY_TOPIC_LEA' }, env), null);
  assert.strictEqual(resolveTopic({}, { NTFY_TOPIC: 'local' }), 'local');
});

test('la partie doit se terminer avant la fin de la plage', () => {
  const soir = { name: 'Soir', from: '18:00', to: '20:00' };
  const r = findNewMatches(data({ a: [] }), data({ a: [slot('2026-11-03T18:00', 120), slot('2026-11-03T18:30', 120), slot('2026-11-03T19:00', 60)] }), [soir], NOW);
  assert.deepStrictEqual(r[0].hits.map((h) => h.start), ['2026-11-03T18:00', '2026-11-03T19:00']);
});

test('withinDays ignore les créneaux trop loin', () => {
  const { matches } = require('../alerts');
  const now = new Date('2026-11-01T12:00:00Z');
  const w = { withinDays: 7 };
  assert.equal(matches(w, 'x', { start: '2026-11-05T18:00', duration: 90 }, now), true);
  assert.equal(matches(w, 'x', { start: '2026-11-20T18:00', duration: 90 }, now), false);
});

test('format compact : aller-retour sans perte', () => {
  const { pack, unpack } = require('../format');
  const data = { days: ['2026-11-05', '2026-11-06'], availability: [
    { id: 'a', status: 'ok', slots: [{ court: 'T1', start: '2026-11-06T19:30', duration: 90, price: 48 }, { court: null, start: '2026-11-05T09:00', duration: 60, price: null }] },
    { id: 'b', status: 'non-branche', slots: [] }] };
  const packed = pack(data);
  assert.equal(packed.fmt, 2);
  assert.deepEqual(unpack(JSON.parse(JSON.stringify(packed))).availability.map((a) => a.slots), data.availability.map((a) => a.slots));
});

test('surveillance : panne signalée au 2e échec, puis retour', () => {
  const { clubIncidents } = require('../alerts');
  const clubs = [{ id: 'x', name: 'Club X' }];
  const r1 = clubIncidents({ availability: [{ id: 'x', fails: 1 }] }, { availability: [{ id: 'x', status: 'erreur', fails: 2, error: 'HTTP 500' }] }, clubs);
  assert.equal(r1.length, 1); assert.match(r1[0].title, /ne répond plus/);
  assert.equal(clubIncidents({ availability: [{ id: 'x', fails: 0 }] }, { availability: [{ id: 'x', status: 'erreur', fails: 1 }] }, clubs).length, 0);
  const r2 = clubIncidents({ availability: [{ id: 'x', fails: 3 }] }, { availability: [{ id: 'x', status: 'ok', fails: 0 }] }, clubs);
  assert.match(r2[0].title, /refonctionne/);
});
