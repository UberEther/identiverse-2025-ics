import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAgendaSessions, parseDetailPage } from '../src/scraper.js';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const read = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf8');

test('parseAgendaSessions extracts sessions from all gridday containers', () => {
  const sessions = parseAgendaSessions(read('agenda-sample.html'));
  assert.equal(sessions.length, 5);

  const byDate = {};
  for (const s of sessions) byDate[s.date] = (byDate[s.date] || 0) + 1;
  assert.deepEqual(byDate, { '2026-06-15': 3, '2026-06-17': 2 });
});

test('parseAgendaSessions extracts core fields from a session entry', () => {
  const sessions = parseAgendaSessions(read('agenda-sample.html'));
  const exchange = sessions.find(s => s.sessionId === '3976042');
  assert.ok(exchange);
  assert.equal(exchange.title, 'The Exchange: Accepted Applicants Only');
  assert.equal(exchange.date, '2026-06-15');
  assert.equal(exchange.time, '8:30 am - 12:30 pm');
  assert.equal(exchange.type, 'NETWORKING');
  assert.equal(exchange.detailsUrl, 'https://identiverse.com/idv26/exchange/');
});

test('parseAgendaSessions extracts inline speakers with titles', () => {
  const sessions = parseAgendaSessions(read('agenda-sample.html'));
  const workshop = sessions.find(s => s.sessionId === '3822721');
  assert.ok(workshop);
  assert.equal(workshop.type, 'WORKSHOP');
  assert.equal(workshop.time, '8:30 am - 12 pm');
  assert.equal(workshop.speakers.length, 2);
  assert.equal(workshop.speakers[0].name, 'Andrew Cameron');
  assert.match(workshop.speakers[0].title, /Distinguished Engineer, IAM/);
});

test('parseAgendaSessions resolves relative detail URLs', () => {
  const sessions = parseAgendaSessions(read('agenda-sample.html'));
  const relative = sessions.find(s => s.sessionId === '4081865');
  assert.ok(relative);
  assert.equal(relative.detailsUrl, 'https://identiverse.com/idv26/session/?idvid=4081865');
});

test('parseDetailPage reads the standard session template', () => {
  const detail = parseDetailPage(read('session-detail.html'));
  assert.equal(detail.location, 'NHAI Pavilion Theater');
  assert.match(detail.description, /^Agentic systems don’t scale linearly/);
  assert.equal(detail.time, '10:15 am - 10:45 am');
});

test('parseDetailPage reads the hero-banner summit template', () => {
  const detail = parseDetailPage(read('summit-detail.html'));
  assert.equal(detail.location, 'Oceanside E');
  assert.equal(detail.time, '2:00 pm - 5:00 pm');
  assert.match(detail.date, /June 16, 2026/);
});

test('parseDetailPage reads the workshop template', () => {
  const detail = parseDetailPage(read('workshop-detail.html'));
  assert.equal(detail.location, 'Mandalay Bay K');
  assert.equal(detail.time, '8:30 AM - 12:30 PM');
  assert.match(detail.description, /What does it actually take to build a modern IAM ecosystem\?/);
});
