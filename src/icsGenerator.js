/**
 * ICS file generation for the Identiverse calendar
 */

import fs from 'fs-extra';
import path from 'path';
import { DateTime } from 'luxon';

/**
 * Escape a text value per RFC 5545 (TEXT): backslash, semicolon, comma,
 * and newlines (as the two-character sequence "\n").
 * @param {string} text - Raw text
 * @returns {string} Escaped text safe for an ICS property value
 */
export function escapeIcsText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold a complete content line per RFC 5545: physical lines are limited to
 * 75 octets; continuations begin with a single space. Folding is octet-aware
 * so multi-byte UTF-8 characters never push a line over the limit or get
 * split mid-character.
 * @param {string} line - Complete unfolded content line (e.g. "SUMMARY:...")
 * @returns {string} Folded line (may contain CRLF + space continuations)
 */
export function foldIcsLine(line) {
  const MAX_OCTETS = 75;
  if (Buffer.byteLength(line, 'utf8') <= MAX_OCTETS) return line;

  const out = [];
  let current = '';
  let budget = MAX_OCTETS; // first line: 75 octets; continuations: 74 + leading space

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (Buffer.byteLength(current, 'utf8') + charBytes > budget) {
      out.push(current);
      current = '';
      budget = MAX_OCTETS - 1; // continuation lines carry a leading space
    }
    current += char;
  }
  if (current) out.push(current);

  return out.map((part, i) => (i === 0 ? part : ' ' + part)).join('\r\n');
}

export class ICSGenerator {
  /**
   * Create a new calendar and manually generate ICS content
   * @param {Array} sessions - Array of processed session objects
   * @returns {String} ICS file content
   */
  createCalendar(sessions) {
    console.log(`Creating calendar with ${sessions.length} events...`);

    // Build ICS file content manually for maximum control over time formatting
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Identiverse//Conference Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Identiverse 2026 Conference',
      'X-WR-TIMEZONE:America/Los_Angeles',
      'X-WR-CALDESC:Events for Identiverse 2026 Conference',
      'BEGIN:VTIMEZONE',
      'TZID:America/Los_Angeles',
      'TZURL:http://tzurl.org/zoneinfo-outlook/America/Los_Angeles',
      'X-LIC-LOCATION:America/Los_Angeles',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0700',
      'TZNAME:PDT',
      'DTSTART:20260308T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:20261101T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
    ];

    // Add each session as an event
    for (const session of sessions) {
      // Format times directly as PDT wall-clock time, with no conversion
      const startTime = this.formatIcsTime(session.startTime);
      const endTime = this.formatIcsTime(session.endTime);

      const summary = escapeIcsText(`${session.title} (PDT)`);
      const description = escapeIcsText(session.description || 'No description available');
      const location = escapeIcsText(session.location || 'Mandalay Bay, Las Vegas, NV');

      // Create a unique ID if not present
      const uid = session.uid || `identiverse-2026-${Date.now()}@identiverse.com`;

      const eventLines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        'SEQUENCE:0',
        `DTSTAMP:${this.formatUtcTime(new Date())}`,
        `DTSTART;TZID=America/Los_Angeles:${startTime}`,
        `DTEND;TZID=America/Los_Angeles:${endTime}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        'CLASS:PUBLIC',
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE:1',
        'X-MICROSOFT-CDO-ALLDAYEVENT:FALSE',
        'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
        'X-MICROSOFT-CDO-INSTTYPE:0',
        'X-MICROSOFT-DISALLOW-COUNTER:FALSE',
        'X-MICROSOFT-CDO-TZID:Pacific Standard Time',
        'X-TIMEZONE-CONF:America/Los_Angeles',
      ];

      if (session.type) {
        eventLines.push(`CATEGORIES:${escapeIcsText(session.type)}`);
      }

      eventLines.push('END:VEVENT');
      icsContent.push(...eventLines);
    }

    icsContent.push('END:VCALENDAR');

    // Fold long lines and join with CRLF as required by the ICS spec
    return icsContent.map(foldIcsLine).join('\r\n');
  }

  /**
   * Format a Luxon DateTime object to ICS format as local (PDT) wall-clock time
   * @param {DateTime} dateTime - Luxon DateTime object
   * @returns {string} ICS-formatted time string
   */
  formatIcsTime(dateTime) {
    // No conversion: DTSTART/DTEND carry TZID, so emit local wall-clock time
    return dateTime.toFormat('yyyyMMdd') + 'T' + dateTime.toFormat('HHmmss');
  }

  /**
   * Format a date to UTC time for DTSTAMP
   * @param {Date} date - JavaScript Date object
   * @returns {string} ICS-formatted UTC time string
   */
  formatUtcTime(date) {
    const dt = DateTime.fromJSDate(date).toUTC();
    return dt.toFormat('yyyyMMdd') + 'T' + dt.toFormat('HHmmss') + 'Z';
  }

  /**
   * Generate and save the ICS file
   * @param {Array} sessions - Array of processed session objects
   * @param {string} outputPath - Path where the ICS file should be saved
   * @returns {string} Path to the generated ICS file
   */
  async generateICSFile(sessions, outputPath = 'output/identiverse2026.ics') {
    const icsString = this.createCalendar(sessions);

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, icsString, 'utf8');

    console.log(`ICS file generated successfully at: ${outputPath}`);
    return outputPath;
  }

  /**
   * Print a summary of the calendar events
   * @param {Array} sessions - Array of processed session objects
   */
  printCalendarSummary(sessions) {
    console.log('\nCalendar Summary:');
    console.log(`Total Events: ${sessions.length}`);

    // Group by day and print summary
    const days = {};
    for (const session of sessions) {
      const dayStr = session.startTime.toFormat('yyyy-MM-dd');
      days[dayStr] = (days[dayStr] || 0) + 1;
    }

    for (const [day, count] of Object.entries(days).sort()) {
      console.log(`  ${day}: ${count} events`);
    }

    console.log('\nEvent Types:');
    const types = {};
    for (const session of sessions) {
      const type = session.type || 'Unspecified';
      types[type] = (types[type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count} events`);
    }
  }
}
