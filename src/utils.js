/**
 * Utility functions for the Identiverse calendar generator
 */

import { DateTime } from 'luxon';

/** Conference year — used for date parsing defaults and UID generation */
export const CONFERENCE_YEAR = 2026;

/**
 * Delays execution for a specified number of milliseconds
 * @param {number} ms - The number of milliseconds to delay
 * @returns {Promise} A promise that resolves after the specified delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Converts a Las Vegas date + time-range string to DateTime objects with the
 * conference timezone (PDT / UTC-7, fixed offset — the conference is in June).
 *
 * @param {string} dateStr - ISO date ("2026-06-15") or month-name date ("JUNE 15")
 * @param {string} timeStr - The time range (e.g., "8:30 am - 12 pm")
 * @returns {Object} An object with start and end DateTime objects
 */
export const parseLasVegasTime = (dateStr, timeStr) => {
  try {
    let year = CONFERENCE_YEAR;
    let month = null;
    let day = null;

    // Preferred format: ISO date taken from the agenda grid container ids
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else {
      // Legacy format: "JUNE 15" style strings
      if (dateStr.match(/JUNE|JUN/i)) {
        month = 6;
      } else if (dateStr.match(/JULY|JUL/i)) {
        month = 7;
      } else if (dateStr.match(/MAY/i)) {
        month = 5;
      } else {
        console.warn(`Could not determine month from "${dateStr}", defaulting to June`);
        month = 6;
      }

      const dayMatch = dateStr.match(/\d+/);
      if (dayMatch) {
        day = parseInt(dayMatch[0], 10);
      } else {
        console.warn(`Could not determine day from "${dateStr}", defaulting to day 1`);
        day = 1;
      }
    }

    // Parse the time range
    const timeParts = timeStr.includes('-')
      ? timeStr.split('-').map(part => part.trim())
      : [timeStr.trim(), ''];

    const parseTime = (str) => {
      if (!str) {
        return DateTime.fromObject(
          { year, month, day, hour: 12, minute: 0 },
          { zone: 'UTC-7' } // PDT is UTC-7
        );
      }

      let hours = 0;
      let minutes = 0;
      let isPM = str.toUpperCase().includes('PM');

      const timeMatch = str.match(/(\d+)(?::(\d+))?\s*(AM|PM|am|pm)?/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10) || 0;
        minutes = parseInt(timeMatch[2], 10) || 0;
        if (timeMatch[3] && timeMatch[3].toUpperCase() === 'PM') {
          isPM = true;
        }
      } else {
        console.warn(`Could not parse time from "${str}", defaulting to noon`);
        hours = 12;
      }

      if (isPM && hours < 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0; // 12 AM is 0 in 24-hour format
      }

      return DateTime.fromObject(
        { year, month, day, hour: hours, minute: minutes },
        { zone: 'UTC-7' } // PDT is UTC-7
      );
    };

    const startTime = parseTime(timeParts[0]);
    let endTime;

    if (timeParts.length > 1 && timeParts[1]) {
      endTime = parseTime(timeParts[1]);
    } else {
      endTime = startTime.plus({ hours: 1 });
      console.warn(`No end time found in "${timeStr}", defaulting to 1 hour duration`);
    }

    // If end time is before start time, the range crossed noon without an
    // explicit PM marker (e.g. "11:00 - 1:30 pm") — shift the end by 12 hours
    if (endTime < startTime) {
      endTime = endTime.plus({ hours: 12 });
    }

    return { start: startTime, end: endTime };
  } catch (error) {
    console.error(`Error parsing time "${timeStr}" on date "${dateStr}":`, error);
    throw error;
  }
};

/**
 * Formats a session description including speakers and other details
 * @param {Object} session - The session object with details
 * @returns {string} Formatted description for the calendar event
 */
export const formatDescription = (session) => {
  const parts = [];

  if (session.description) {
    parts.push(session.description);
  }

  if (session.detailsUrl) {
    parts.push(`Details: ${session.detailsUrl}`);
  }

  if (session.speakers && session.speakers.length > 0) {
    const formatted = session.speakers.map(speaker => {
      if (typeof speaker === 'string') return speaker;
      return speaker.title ? `${speaker.name} (${speaker.title})` : speaker.name;
    });
    parts.push(`Speakers: ${formatted.join(' | ')}`);
  }

  if (session.type) {
    parts.push(`Session Type: ${session.type}`);
  }

  parts.push('All times are in Pacific Daylight Time (PDT / UTC-7)');

  return parts.join('\n\n');
};

/**
 * Generates a unique identifier for a calendar event
 * This is critical for preventing duplicate events when reimporting the calendar
 * after schedule changes. The UID must remain stable even if the event time changes.
 *
 * @param {string} title - The event title
 * @param {DateTime} startTime - The event start time (used only as a fallback)
 * @param {string} [sessionId] - Optional session ID from the website
 * @returns {string} A unique identifier
 */
export const generateUID = (title, startTime, sessionId) => {
  // If we have a session ID from the website, use that as the most stable identifier
  if (sessionId) {
    return `identiverse-${CONFERENCE_YEAR}-event-${sessionId}@identiverse.com`;
  }

  // Otherwise, create a hash based on the title and date (not time)
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  const dateStr = startTime ? startTime.toFormat('yyyyMMdd') : `${CONFERENCE_YEAR}0615`;

  // Create a simple hash of the title to help ensure uniqueness
  let titleHash = 0;
  for (let i = 0; i < title.length; i++) {
    titleHash = ((titleHash << 5) - titleHash) + title.charCodeAt(i);
    titleHash = titleHash & titleHash; // Convert to 32bit integer
  }
  titleHash = Math.abs(titleHash).toString(16).substring(0, 8);

  return `identiverse-${CONFERENCE_YEAR}-${cleanTitle}-${dateStr}-${titleHash}@identiverse.com`;
};
