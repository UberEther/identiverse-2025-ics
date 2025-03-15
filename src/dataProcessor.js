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
      try {
        // Extract the date and time
        const date = session.date || '';
        const time = session.time || '';
        const title = session.title || 'Untitled Session';
        
        // Skip sessions without proper time information
        if (!date || !time) {
          console.warn(`Skipping session with incomplete time info: ${title}`);
          return null;
        }
        
        try {
          // Parse the Las Vegas time
          const { start, end } = parseLasVegasTime(date, time);
          
          // Fall back to a default 1-hour duration if something goes wrong with time parsing
          if (!start || !end) {
            console.warn(`Invalid time format for session "${title}". Using default 1-hour duration.`);
            // Create default times (today at noon for 1 hour)
            const defaultStart = new Date();
            defaultStart.setHours(12, 0, 0, 0);
            const defaultEnd = new Date(defaultStart);
            defaultEnd.setHours(13, 0, 0, 0);
            
            // Extract session ID if available (for stable UIDs)
            let sessionId = null;
            if (session.detailsUrl) {
              const idMatch = session.detailsUrl.match(/idvid=(\d+)/);
              if (idMatch && idMatch[1]) {
                sessionId = idMatch[1];
              }
            }
            
            // Create a processed session object with default times
            return {
              title,
              description: formatDescription(session),
              location: session.location || 'TBD',
              startTime: defaultStart,
              endTime: defaultEnd,
              uid: generateUID(title, defaultStart, sessionId),
              type: session.type || 'Session',
              sessionId: sessionId,
              isDefaultTime: true // Flag that this is using a default time
            };
          }
          
          // Extract session ID if available (for stable UIDs)
          let sessionId = null;
          if (session.detailsUrl) {
            const idMatch = session.detailsUrl.match(/idvid=(\d+)/);
            if (idMatch && idMatch[1]) {
              sessionId = idMatch[1];
            }
          }
          
          // Create a processed session object
          const processedSession = {
            title,
            description: formatDescription(session),
            location: session.location || 'TBD',
            startTime: start,
            endTime: end,
            uid: generateUID(title, start, sessionId),
            type: session.type || 'Session',
            sessionId: sessionId
          };
          
          return processedSession;
        } catch (timeError) {
          console.error(`Error parsing time for session "${title}":`, timeError);
          return null;
        }
      } catch (error) {
        console.error(`Error processing session:`, error);
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