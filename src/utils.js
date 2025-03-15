/**
 * Utility functions for the Identiverse calendar generator
 */

import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';

/**
 * Delays execution for a specified number of milliseconds
 * @param {number} ms - The number of milliseconds to delay
 * @returns {Promise} A promise that resolves after the specified delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Creates a timestamped screenshots directory if it doesn't exist
 * @returns {string} Path to the screenshots directory
 */
export const getScreenshotsDir = () => {
  // Generate a timestamp in the format YYYY-MM-DD_HH-MM-SS
  const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss');
  const dirPath = path.join('screenshots', timestamp);
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created screenshots directory: ${dirPath}`);
  }
  
  return dirPath;
};

/**
 * Save a screenshot to the timestamped directory
 * @param {Page} page - Playwright page object
 * @param {string} fileName - Name of the screenshot file
 * @param {Object} options - Additional screenshot options
 * @returns {Promise<string>} Path to the saved screenshot
 */
export const saveScreenshot = async (page, fileName, options = {}) => {
  const screenshotsDir = getScreenshotsDir();
  const filePath = path.join(screenshotsDir, fileName);
  
  await page.screenshot({ 
    path: filePath,
    ...options
  });
  
  console.log(`Saved screenshot to ${filePath}`);
  return filePath;
};

/**
 * Converts a Las Vegas time string to a DateTime object with proper timezone
 * @param {string} dateStr - The date string (e.g., "JUNE 3")
 * @param {string} timeStr - The time string (e.g., "9:30 AM - 11:20 AM")
 * @returns {Object} An object with start and end DateTime objects
 */
export const parseLasVegasTime = (dateStr, timeStr) => {
  try {
    // Parse the date
    let month = null;
    let day = null;
    let year = 2025; // Default year for the conference
    
    // Try to extract month
    if (dateStr.match(/JUNE/i) || dateStr.match(/JUN/i)) {
      month = 6;
    } else if (dateStr.match(/JULY/i) || dateStr.match(/JUL/i)) {
      month = 7;
    } else if (dateStr.match(/MAY/i)) {
      month = 5;
    } else {
      // Default to June if we can't determine the month
      console.warn(`Could not determine month from "${dateStr}", defaulting to June`);
      month = 6;
    }
    
    // Try to extract day
    const dayMatch = dateStr.match(/\d+/);
    if (dayMatch) {
      day = parseInt(dayMatch[0], 10);
    } else {
      // Default to day 1 if we can't determine the day
      console.warn(`Could not determine day from "${dateStr}", defaulting to day 1`);
      day = 1;
    }
    
    // Parse the time range
    let startTime, endTime;
    
    // Handle different time formats
    const timeParts = timeStr.includes('-')
      ? timeStr.split('-').map(part => part.trim())
      : [timeStr.trim(), '']; // If no end time, just use start time
    
    const parseTime = (timeStr) => {
      if (!timeStr) {
        // If no time string provided, default to noon
        return DateTime.fromObject(
          { year, month, day, hour: 12, minute: 0 },
          { zone: 'UTC-7' } // PDT is UTC-7
        );
      }
      
      // Handle various time formats
      let hours = 0;
      let minutes = 0;
      let isPM = false;
      
      // Check if time has AM/PM indicator
      if (timeStr.toUpperCase().includes('PM')) {
        isPM = true;
      }
      
      // Extract hours and minutes
      const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM|am|pm)?/);
      
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10) || 0;
        minutes = parseInt(timeMatch[2], 10) || 0;
        
        // Determine AM/PM if specified in the regex match
        if (timeMatch[3] && timeMatch[3].toUpperCase() === 'PM') {
          isPM = true;
        }
      } else {
        console.warn(`Could not parse time from "${timeStr}", defaulting to noon`);
        hours = 12;
      }
      
      // Adjust hours for PM
      if (isPM && hours < 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0; // 12 AM is actually 0 in 24-hour format
      }
      
      // Create with a fixed offset for Pacific Daylight Time (PDT)
      return DateTime.fromObject(
        { year, month, day, hour: hours, minute: minutes },
        { zone: 'UTC-7' } // PDT is UTC-7
      );
    };
    
    startTime = parseTime(timeParts[0]);
    
    if (timeParts.length > 1 && timeParts[1]) {
      endTime = parseTime(timeParts[1]);
    } else {
      // If no end time provided, default to 1 hour after start time
      endTime = startTime.plus({ hours: 1 });
      console.warn(`No end time found in "${timeStr}", defaulting to 1 hour duration`);
    }
    
    // Sanity check: If end time is before start time, add 12 hours to end time
    // This handles cases like "11:00 AM - 1:30 PM" where PM is not explicitly included in end time
    if (endTime < startTime) {
      endTime = endTime.plus({ hours: 12 });
    }
  
    return {
      start: startTime,
      end: endTime
    };
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
  
  // Process speaker information with better formatting
  if (session.speakers && session.speakers.length > 0) {
    // Clean and combine speaker information into logical groups
    const cleanedSpeakers = [];
    const speakerInfo = session.speakers.join(' ').replace(/\s+/g, ' ');
    
    // Extract individual speakers - typically name followed by title/company
    const speakerPattern = /([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})(?:,?\s+([^,]+))?(?:,?\s+([^,]+))?/g;
    let match;
    
    // Find all matches in the speaker information
    while ((match = speakerPattern.exec(speakerInfo)) !== null) {
      const name = match[1].trim();
      let details = [];
      
      // Add title and company if available
      if (match[2]) details.push(match[2].trim());
      if (match[3]) details.push(match[3].trim());
      
      if (details.length > 0) {
        cleanedSpeakers.push(`${name}, ${details.join(', ')}`);
      } else {
        cleanedSpeakers.push(name);
      }
    }
    
    // If no speakers were found using the regex, fall back to the original list
    if (cleanedSpeakers.length === 0) {
      cleanedSpeakers.push(...session.speakers);
    }
    
    parts.push(`\nSpeakers: ${cleanedSpeakers.join(' | ')}`);
  }
  
  if (session.type) {
    parts.push(`\nSession Type: ${session.type}`);
  }
  
  // Add a note about the time zone for clarity
  parts.push('\nAll times are in Pacific Daylight Time (PDT / UTC-7)');
  
  return parts.join('\n');
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
    return `identiverse-2025-event-${sessionId}@identiverse.com`;
  }
  
  // Otherwise, create a hash based on the title and date (not time)
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  const dateStr = startTime ? startTime.toFormat('yyyyMMdd') : '20250603'; // Just date, not time
  
  // Create a simple hash of the title to help ensure uniqueness
  let titleHash = 0;
  for (let i = 0; i < title.length; i++) {
    titleHash = ((titleHash << 5) - titleHash) + title.charCodeAt(i);
    titleHash = titleHash & titleHash; // Convert to 32bit integer
  }
  titleHash = Math.abs(titleHash).toString(16).substring(0, 8);
  
  return `identiverse-2025-${cleanTitle}-${dateStr}-${titleHash}@identiverse.com`;
};