/**
 * Data processing and normalization for the Identiverse calendar generator
 */

import { parseLasVegasTime, formatDescription, generateUID } from './utils.js';

export class DataProcessor {
  /**
   * Process raw session data and convert times
   * @param {Array} rawSessions - Array of raw session objects from scraper
   * @returns {Array} Array of processed session objects ready for ICS generation
   */
  processSessionData(rawSessions) {
    console.log(`Processing ${rawSessions.length} sessions...`);

    return rawSessions.map(session => {
      const title = session.title || 'Untitled Session';

      // Skip sessions without proper time information
      if (!session.date || !session.time) {
        console.warn(`Skipping session with incomplete time info: ${title}`);
        return null;
      }

      try {
        const { start, end } = parseLasVegasTime(session.date, session.time);

        // Session ID for stable UIDs: prefer the grid's data-sessionid,
        // fall back to an idvid= match in the details URL
        const sessionId =
          session.sessionId ||
          session.detailsUrl?.match(/idvid=(\d+)/)?.[1] ||
          null;

        return {
          title,
          description: formatDescription(session),
          location: session.location || 'Mandalay Bay, Las Vegas, NV',
          startTime: start,
          endTime: end,
          uid: generateUID(title, start, sessionId),
          type: session.type || 'Session',
          sessionId,
        };
      } catch (error) {
        console.error(`Error processing session "${title}":`, error);
        return null;
      }
    }).filter(Boolean); // Remove null entries
  }

  /**
   * Group sessions by date for easier display and handling
   * @param {Array} sessions - Array of processed session objects
   * @returns {Object} Object with dates as keys and arrays of sessions as values
   */
  groupSessionsByDate(sessions) {
    const grouped = {};

    for (const session of sessions) {
      const dateStr = session.startTime.toFormat('yyyy-MM-dd');

      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }

      grouped[dateStr].push(session);
    }

    // Sort sessions within each day by start time
    for (const date in grouped) {
      grouped[date].sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    }

    return grouped;
  }

  /**
   * Process and organize all session data
   * @param {Array} rawSessions - Raw session data from scraper
   * @returns {Object} Processed and organized session data
   */
  processAll(rawSessions) {
    const processedSessions = this.processSessionData(rawSessions);
    const groupedSessions = this.groupSessionsByDate(processedSessions);

    return {
      sessions: processedSessions,
      groupedSessions
    };
  }
}
