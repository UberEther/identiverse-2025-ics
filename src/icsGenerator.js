/**
 * ICS file generation for the Identiverse calendar
 */

import fs from 'fs-extra';
import path from 'path';
import { DateTime } from 'luxon';

export class ICSGenerator {
  /**
   * Create a new calendar and manually generate ICS content
   * @param {Array} sessions - Array of processed session objects
   * @returns {String} ICS file content
   */
  createCalendar(sessions) {
    console.log(`Creating calendar with ${sessions.length} events...`);
    
    // Build ICS file content manually for maximum control over time formatting
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Identiverse//Conference Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Identiverse 2025 Conference',
      'X-WR-TIMEZONE:America/Los_Angeles',
      'X-WR-CALDESC:Events for Identiverse 2025 Conference',
      'BEGIN:VTIMEZONE',
      'TZID:America/Los_Angeles',
      'TZURL:http://tzurl.org/zoneinfo-outlook/America/Los_Angeles',
      'X-LIC-LOCATION:America/Los_Angeles',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0800',
      'TZOFFSETTO:-0700',
      'TZNAME:PDT',
      'DTSTART:20250309T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0700',
      'TZOFFSETTO:-0800',
      'TZNAME:PST',
      'DTSTART:20251102T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
    ];
    
    // Add each session as an event
    for (const session of sessions) {
      // Format times directly as PDT, with no conversion
      // IMPORTANT: We control the exact format of the timestamp here
      const startTime = this.formatIcsTime(session.startTime);
      const endTime = this.formatIcsTime(session.endTime);
      
      // Format description with proper line folding
      const description = this.foldLine(session.description || 'No description available');
      
      // Format location with proper line folding
      const location = this.foldLine(session.location || 'Caesars Forum, Las Vegas, NV');
      
      // Format summary with timezone indicator
      const summary = this.foldLine(`${session.title} (PDT)`);
      
      // Create a unique ID if not present
      const uid = session.uid || `identiverse-2025-${Date.now()}@identiverse.com`;
      
      // Add event to calendar
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
      
      // Add categories if available
      if (session.type) {
        eventLines.push(`CATEGORIES:${session.type}`);
      }
      
      // Close the event
      eventLines.push('END:VEVENT');
      
      // Add the event to the calendar
      icsContent.push(...eventLines);
    }
    
    // Close the calendar
    icsContent.push('END:VCALENDAR');
    
    // Join the lines with CRLF as required by the ICS spec
    return icsContent.join('\r\n');
  }
  
  /**
   * Format a Luxon DateTime object to ICS format, directly as PDT
   * @param {DateTime} dateTime - Luxon DateTime object
   * @returns {string} ICS-formatted time string
   */
  formatIcsTime(dateTime) {
    // CRITICAL: We do NOT convert from PDT to UTC here - use the original hour/minute
    // Format the time as YYYYMMDDTHHMMSS - must match exact ICS format
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
   * Fold long lines according to ICS spec (max 75 chars)
   * @param {string} text - Text to fold
   * @returns {string} Folded text
   */
  foldLine(text) {
    if (!text) return '';
    
    const MAX_LENGTH = 75;
    let result = '';
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
      currentLine += text[i];
      
      if (currentLine.length >= MAX_LENGTH) {
        result += currentLine + '\r\n ';
        currentLine = '';
      }
    }
    
    return result + currentLine;
  }
  
  /**
   * Generate and save the ICS file
   * @param {Array} sessions - Array of processed session objects
   * @param {string} outputPath - Path where the ICS file should be saved
   * @returns {string} Path to the generated ICS file
   */
  async generateICSFile(sessions, outputPath = 'output/identiverse2025.ics') {
    // Create ICS content
    const icsString = this.createCalendar(sessions);
    
    // Ensure the output directory exists
    await fs.ensureDir(path.dirname(outputPath));
    
    // Write the ICS file
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
      if (!days[dayStr]) {
        days[dayStr] = 0;
      }
      days[dayStr]++;
    }
    
    for (const [day, count] of Object.entries(days)) {
      console.log(`  ${day}: ${count} events`);
    }
    
    console.log('\nEvent Types:');
    const types = {};
    for (const session of sessions) {
      const type = session.type || 'Unspecified';
      if (!types[type]) {
        types[type] = 0;
      }
      types[type]++;
    }
    
    for (const [type, count] of Object.entries(types)) {
      console.log(`  ${type}: ${count} events`);
    }
  }
}