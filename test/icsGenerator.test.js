import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { ICSGenerator, escapeIcsText, foldIcsLine } from '../src/icsGenerator.js';

test('escapeIcsText escapes backslashes, commas, semicolons and newlines', () => {
  assert.equal(escapeIcsText('a\\b'), 'a\\\\b');
  assert.equal(escapeIcsText('a,b;c'), 'a\\,b\\;c');
  assert.equal(escapeIcsText('line1\nline2'), 'line1\\nline2');
  assert.equal(escapeIcsText('line1\r\nline2'), 'line1\\nline2');
});

test('foldIcsLine keeps every physical line at 75 octets or fewer', () => {
  const line = 'DESCRIPTION:' + 'x'.repeat(300);
  const folded = foldIcsLine(line);
  const physical = folded.split('\r\n');
  assert.ok(physical.length > 1, 'long line should be folded');
  for (const p of physical) {
    assert.ok(Buffer.byteLength(p, 'utf8') <= 75, `line too long: ${p.length}`);
  }
  for (const p of physical.slice(1)) {
    assert.ok(p.startsWith(' '), 'continuation lines must start with a space');
  }
  // Unfolding restores the original content
  assert.equal(physical[0] + physical.slice(1).map(p => p.slice(1)).join(''), line);
});

test('foldIcsLine respects octet length for multi-byte characters', () => {
  const line = 'SUMMARY:' + '•'.repeat(100); // bullet is 3 bytes in UTF-8
  const folded = foldIcsLine(line);
  for (const p of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(p, 'utf8') <= 75);
  }
});

function sampleSession() {
  const zone = 'UTC-7';
  return {
    title: 'Test Session',
    description: 'First line\nSecond line, with comma',
    location: 'Mandalay Bay K',
    startTime: DateTime.fromObject({ year: 2026, month: 6, day: 15, hour: 9 }, { zone }),
    endTime: DateTime.fromObject({ year: 2026, month: 6, day: 15, hour: 10 }, { zone }),
    uid: 'identiverse-2026-event-1@identiverse.com',
    type: 'SESSION',
  };
}

test('createCalendar produces a 2026 calendar with the same structure as 2025', () => {
  const ics = new ICSGenerator().createCalendar([sampleSession()]);
  assert.match(ics, /X-WR-CALNAME:Identiverse 2026 Conference/);
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /TZID:America\/Los_Angeles/);
  assert.match(ics, /UID:identiverse-2026-event-1@identiverse\.com/);
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20260615T090000/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20260615T100000/);
  assert.match(ics, /SUMMARY:Test Session \(PDT\)/);
  assert.match(ics, /X-MICROSOFT-CDO-BUSYSTATUS:BUSY/);
  assert.match(ics, /CATEGORIES:SESSION/);
  // RFC 5545: no raw newlines inside DESCRIPTION — must be escaped
  assert.match(ics, /DESCRIPTION:First line\\nSecond line\\, with comma/);
  // Every physical line within length budget
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line exceeds 75 octets: ${line}`);
  }
});

test('createCalendar uses CRLF line endings throughout', () => {
  const ics = new ICSGenerator().createCalendar([sampleSession()]);
  assert.ok(!/[^\r]\n/.test(ics), 'found LF without preceding CR');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR$/);
});
