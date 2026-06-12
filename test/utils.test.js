import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLasVegasTime, generateUID, formatDescription } from '../src/utils.js';

test('parseLasVegasTime parses ISO dates from gridday ids', () => {
  const { start, end } = parseLasVegasTime('2026-06-15', '8:30 am - 12:30 pm');
  assert.equal(start.year, 2026);
  assert.equal(start.month, 6);
  assert.equal(start.day, 15);
  assert.equal(start.hour, 8);
  assert.equal(start.minute, 30);
  assert.equal(end.hour, 12);
  assert.equal(end.minute, 30);
});

test('parseLasVegasTime still parses legacy month-name dates', () => {
  const { start } = parseLasVegasTime('JUNE 16', '9 am - 10 am');
  assert.equal(start.year, 2026);
  assert.equal(start.month, 6);
  assert.equal(start.day, 16);
  assert.equal(start.hour, 9);
});

test('parseLasVegasTime handles "12 pm" without minutes', () => {
  const { start, end } = parseLasVegasTime('2026-06-15', '8:30 am - 12 pm');
  assert.equal(start.hour, 8);
  assert.equal(end.hour, 12);
  assert.equal(end.minute, 0);
});

test('parseLasVegasTime handles hour-only times', () => {
  const { start, end } = parseLasVegasTime('2026-06-17', '6 am - 7 am');
  assert.equal(start.hour, 6);
  assert.equal(end.hour, 7);
});

test('parseLasVegasTime handles ranges crossing noon without explicit pm on end', () => {
  const { start, end } = parseLasVegasTime('2026-06-16', '11:30 am - 1 pm');
  assert.equal(start.hour, 11);
  assert.equal(end.hour, 13);
});

test('parseLasVegasTime uses a fixed PDT (UTC-7) offset', () => {
  const { start } = parseLasVegasTime('2026-06-15', '9 am - 10 am');
  assert.equal(start.offset, -7 * 60);
});

test('generateUID uses the 2026 session id scheme when an id is available', () => {
  const uid = generateUID('Some Session', null, '3822721');
  assert.equal(uid, 'identiverse-2026-event-3822721@identiverse.com');
});

test('generateUID falls back to a stable title/date hash', () => {
  const { start } = parseLasVegasTime('2026-06-15', '9 am - 10 am');
  const uid1 = generateUID('Opening Reception!', start, null);
  const uid2 = generateUID('Opening Reception!', start, null);
  assert.equal(uid1, uid2);
  assert.match(uid1, /^identiverse-2026-OpeningReception-20260615-[0-9a-f]+@identiverse\.com$/);
});

test('formatDescription includes structured speakers, details URL, type and timezone note', () => {
  const text = formatDescription({
    description: 'A session about identity.',
    detailsUrl: 'https://identiverse.com/idv26/session/?idvid=123',
    speakers: [
      { name: 'Andrew Cameron', title: 'Distinguished Engineer, IAM • GM' },
      { name: "Sean O'Dell", title: 'Distinguished Engineer, Identity & Security • CVS Health' },
    ],
    type: 'WORKSHOP',
  });
  assert.match(text, /A session about identity\./);
  assert.match(text, /Details: https:\/\/identiverse\.com\/idv26\/session\/\?idvid=123/);
  assert.match(text, /Speakers: Andrew Cameron \(Distinguished Engineer, IAM • GM\) \| Sean O'Dell \(Distinguished Engineer, Identity & Security • CVS Health\)/);
  assert.match(text, /Session Type: WORKSHOP/);
  assert.match(text, /Pacific Daylight Time \(PDT \/ UTC-7\)/);
});

test('formatDescription tolerates plain-string speakers', () => {
  const text = formatDescription({ description: 'X', speakers: ['Jane Doe'], type: 'SESSION' });
  assert.match(text, /Speakers: Jane Doe/);
});
