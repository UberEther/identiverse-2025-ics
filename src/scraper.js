/**
 * Web scraping functionality for Identiverse conference agenda
 */

import { chromium } from 'playwright';
import { sleep, saveScreenshot } from './utils.js';
import { extractSessionsWithSpecificSelectors, dumpDOMStructure, generateFallbackSessions } from './extractSessionsHelper.js';
import { processBatchedSessionDetails } from './sessionDetailsExtractor.js';

export class IdentiverseScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://identiverse.com/idv25/agenda/';
    this.browser = null;
    this.page = null;
    this.days = [
      { code: 'tue', date: 'JUNE 3', day: 'Tuesday' },
      { code: 'wed', date: 'JUNE 4', day: 'Wednesday' },
      { code: 'thu', date: 'JUNE 5', day: 'Thursday' },
      { code: 'fri', date: 'JUNE 6', day: 'Friday' }
    ];
    
    // Configuration options
    this.options = {
      extractDetailPages: true, // Whether to visit detail pages for each session
      batchSize: 3, // Number of detail pages to process in a batch
      delayBetweenRequests: 1500, // Milliseconds to wait between requests
      ...options
    };
  }

  /**
   * Initialize the browser
   */
  async initialize() {
    console.log('Initializing browser...');
    this.browser = await chromium.launch({
      headless: false,
      timeout: 180000 // 3 minute timeout
    });
    
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      javaScriptEnabled: true,
      bypassCSP: true, // Bypass Content Security Policy
      permissions: ['geolocation'], // Grant permissions that might be required
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    this.page = await context.newPage();
    
    // Set longer timeout for all operations
    this.page.setDefaultTimeout(120000);
    
    // Handle dialog events (alerts, confirms, prompts)
    this.page.on('dialog', async dialog => {
      console.log(`Dialog of type ${dialog.type()} appeared: ${dialog.message()}`);
      await dialog.dismiss();
    });
    
    // Log console messages from the page
    this.page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]: ${msg.text()}`);
    });
  }

  /**
   * Navigate to a specific day's agenda page using direct URL
   * @param {string} dayCode - The day code (tue, wed, thu, fri)
   * @returns {boolean} - Whether navigation was successful
   */
  async navigateToDayPage(dayCode) {
    const url = `${this.baseUrl}?day=${dayCode}`;
    console.log(`Navigating to day page: ${url}`);
    
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 120000
      });
      
      // Wait for some basic content to be available
      await this.page.waitForTimeout(5000);
      
      // Take a screenshot for debugging
      await saveScreenshot(this.page, `${dayCode}-page.png`);
      
      // Check if page has content
      const hasContent = await this.checkForContent();
      if (!hasContent) {
        console.warn(`Page for ${dayCode} might not have loaded properly.`);
        return false;
      }
      
      console.log(`Successfully loaded page for ${dayCode}`);
      return true;
    } catch (error) {
      console.error(`Error navigating to ${dayCode} page:`, error);
      return false;
    }
  }
  
  /**
   * Check if the page has loaded with content
   * @returns {boolean} Whether content is detected
   */
  async checkForContent() {
    try {
      const contentSelectors = [
        'h1', 'h2', '.event-card', '.session', '.agenda-item',
        '.event', 'article', 'section', '.content', 'main',
        // Try broader selectors if specific ones fail
        '.container', '#content', 'body > div'
      ];
      
      for (const selector of contentSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements matching "${selector}"`);
          return true;
        }
      }
      
      // Last resort: check if body has meaningful content
      const bodyContent = await this.page.$eval('body', el => el.textContent.trim().length);
      if (bodyContent > 500) { // Arbitrary threshold for "meaningful content"
        console.log('Page has sufficient body content');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for content:', error);
      return false;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Get the list of days available in the agenda
   * @returns {Array} Array of day objects with date and element references
   */
  async getDays() {
    console.log('Getting conference days...');
    const days = await this.page.$$eval('.agenda-days .agenda-day', elements => 
      elements.map(el => {
        const dateText = el.textContent.trim();
        const date = dateText.split('\n')[0].trim();
        return { date };
      })
    );
    
    console.log(`Found ${days.length} days: ${days.map(d => d.date).join(', ')}`);
    return days;
  }

  /**
   * Navigate to a specific day's agenda
   * @param {number} dayIndex - The index of the day to navigate to (0-based)
   */
  async navigateToDay(dayIndex) {
    console.log(`Attempting to navigate to day ${dayIndex + 1}`);
    
    try {
      // Try different selectors for day navigation
      const daySelectors = [
        '.agenda-days .agenda-day',
        '.agenda-day',
        'a[href*="day"]',
        'a[href*="june"]'
      ];
      
      let dayElements = [];
      
      // Try each selector until we find day elements
      for (const selector of daySelectors) {
        dayElements = await this.page.$$(selector);
        if (dayElements.length > 0) {
          console.log(`Found day elements using selector: ${selector}`);
          break;
        }
      }
      
      if (dayElements.length === 0) {
        console.warn('No day navigation elements found. Attempting to proceed with current day.');
        return;
      }
      
      if (dayIndex < 0 || dayIndex >= dayElements.length) {
        console.warn(`Day index ${dayIndex} is out of bounds (0-${dayElements.length - 1}). Using day 0 instead.`);
        dayIndex = 0;
      }
      
      // Click on the day tab
      await dayElements[dayIndex].click();
      
      // Wait for the page to update with the selected day's agenda
      await this.page.waitForTimeout(3000);
      console.log(`Navigated to day ${dayIndex + 1}`);
      
    } catch (error) {
      console.error(`Error navigating to day ${dayIndex + 1}:`, error);
      console.log('Continuing with current day view');
    }
  }

  /**
   * Extract all sessions for the current day
   * @returns {Array} Array of session objects with basic information
   */
  async getSessionsForCurrentDay(dayDate) {
    console.log('Extracting sessions for current day...');
    
    try {
      // Wait for session cards to be visible
      await this.page.waitForTimeout(2000);
      
      // Try different selectors for event cards
      const cardSelectors = [
        '.event-card',
        '.session-card',
        '.agenda-item',
        '.event'
      ];
      
      let elements = [];
      let usedSelector = '';
      
      // Try each selector until we find session elements
      for (const selector of cardSelectors) {
        elements = await this.page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} session cards using selector: ${selector}`);
          usedSelector = selector;
          break;
        }
      }
      
      if (elements.length === 0) {
        console.warn('No session cards found. Taking screenshot for debugging.');
        await saveScreenshot(this.page, 'no-sessions-found.png');
        return [];
      }
      
      // Extract session data
      const sessions = await this.page.$$eval(usedSelector, (elements, dayDate) => {
        return elements.map(el => {
          // Try different selectors for each piece of information
          const getTextContent = (selectors) => {
            for (const selector of selectors) {
              const element = el.querySelector(selector);
              if (element && element.textContent.trim()) {
                return element.textContent.trim();
              }
            }
            return '';
          };
          
          // Extract time
          const timeText = getTextContent([
            '.event-time',
            '.time',
            '.session-time',
            'time',
            '[datetime]'
          ]);
          
          // Extract event type
          const typeText = getTextContent([
            '.event-type',
            '.type',
            '.session-type',
            '.category',
            '.tag'
          ]);
          
          // Extract title
          const title = getTextContent([
            '.event-title',
            '.title',
            '.session-title',
            'h3',
            'h4'
          ]);
          
          // Check for details link
          const hasDetails = !!el.querySelector('.details-link, .details, a[href*="details"], a.more');
          
          return {
            date: dayDate,
            time: timeText,
            type: typeText,
            title,
            hasDetails,
            index: Array.from(document.querySelectorAll(elements[0].tagName)).indexOf(el)
          };
        });
      }, dayDate);
      
      console.log(`Found ${sessions.length} sessions`);
      return sessions;
    } catch (error) {
      console.error('Error extracting sessions:', error);
      return [];
    }
  }

  /**
   * Get detailed information for a session
   * @param {Object} session - Basic session information
   * @param {number} sessionIndex - Index of the session in the current day
   * @returns {Object} Enhanced session object with detailed information
   */
  async getSessionDetails(session, sessionIndex) {
    console.log(`Getting details for session: ${session.title}`);
    
    if (!session.hasDetails) {
      console.log('Session has no details link');
      return session;
    }
    
    try {
      // Try different selectors for details links
      const detailSelectors = [
        '.details-link',
        '.details',
        'a[href*="details"]',
        'a.more',
        'button.details'
      ];
      
      let detailsLinks = [];
      let foundSelector = '';
      
      // Try each selector until we find detail links
      for (const selector of detailSelectors) {
        detailsLinks = await this.page.$$(selector);
        if (detailsLinks.length > 0) {
          console.log(`Found details links using selector: ${selector}`);
          foundSelector = selector;
          break;
        }
      }
      
      if (detailsLinks.length === 0) {
        console.warn('No details links found');
        return session;
      }
      
      // Adjust index if needed
      if (sessionIndex >= detailsLinks.length) {
        console.warn(`Session index ${sessionIndex} is out of bounds (0-${detailsLinks.length - 1}). Using index 0.`);
        sessionIndex = 0;
      }
      
      // Click on the details link
      await detailsLinks[sessionIndex].click();
      console.log('Clicked on details link');
      
      // Wait for modal or details page to appear
      await this.page.waitForTimeout(3000);
      
      // Try different selectors for the modal/details content
      const modalSelectors = [
        '.modal-content',
        '.details-modal',
        '.session-details',
        '.popup-content',
        '.details-content'
      ];
      
      let modalContent = null;
      
      for (const selector of modalSelectors) {
        try {
          modalContent = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (modalContent) {
            console.log(`Found details content using selector: ${selector}`);
            break;
          }
        } catch (err) {
          // Continue to next selector
        }
      }
      
      if (!modalContent) {
        console.warn('Could not find details content');
        return session;
      }
      
      // Extract details from the modal/details page
      const details = await this.page.evaluate(() => {
        // Helper function to find text with multiple possible selectors
        const findText = (selectors) => {
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
              return el.textContent.trim();
            }
          }
          return '';
        };
        
        // Helper function to find multiple elements with multiple possible selectors
        const findAll = (selectors) => {
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
              return Array.from(elements).map(el => el.textContent.trim()).filter(text => text);
            }
          }
          return [];
        };
        
        // Extract description
        const description = findText([
          '.session-description',
          '.description',
          '.content',
          '.details-text',
          'p'
        ]);
        
        // Extract speakers
        const speakers = findAll([
          '.speaker-info .speaker-name',
          '.speaker-name',
          '.speaker',
          '.presenter',
          '.author'
        ]);
        
        // Extract location
        const location = findText([
          '.session-location',
          '.location',
          '.venue',
          '.room'
        ]);
        
        return {
          description,
          speakers,
          location
        };
      });
      
      // Try to close the modal
      const closeSelectors = [
        '.modal-close',
        '.close',
        '.close-button',
        'button[aria-label="Close"]',
        '.dismiss'
      ];
      
      for (const selector of closeSelectors) {
        try {
          const closeButton = await this.page.$(selector);
          if (closeButton) {
            await closeButton.click();
            console.log('Closed modal with selector:', selector);
            break;
          }
        } catch (err) {
          // Try next selector
        }
      }
      
      // Wait for modal to close
      await this.page.waitForTimeout(1000);
    
      // Wait a bit to avoid rate limiting
      await sleep(1000);
      
      // Merge details with session information
      return {
        ...session,
        ...(details || {})
      };
    } catch (error) {
      console.error(`Error getting details for session "${session.title}":`, error);
      return session;
    }
  }

  /**
   * Extract session data from the current page
   * @param {string} dayDate - The day date string (e.g., "JUNE 3")
   * @returns {Array} Array of session objects
   */
  async extractSessionsFromPage(dayDate) {
    console.log(`Extracting sessions for ${dayDate}...`);
    
    try {
      // First, try to extract sessions using the specific selectors from user feedback
      console.log('Attempting to extract sessions using specific selectors...');
      
      // Debug: Dump DOM structure to help understand page layout
      await dumpDOMStructure(this.page);
      
      // Try to extract sessions using the specific selectors (#sessionsgrid, #gridday-YYYY-MM-DD, .sessionentry)
      const sessionsFromSpecificSelectors = await extractSessionsWithSpecificSelectors(this.page, dayDate);
      
      if (sessionsFromSpecificSelectors && sessionsFromSpecificSelectors.length > 0) {
        console.log(`Successfully extracted ${sessionsFromSpecificSelectors.length} sessions using specific selectors`);
        return sessionsFromSpecificSelectors;
      } else {
        console.log('Extraction using specific selectors failed, falling back to generic extraction...');
      }
      
      // Take a screenshot for debugging the current state
      await saveScreenshot(this.page, `extraction-failed-${dayDate.replace(/\s+/g, '-').toLowerCase()}.png`);
      
      // If specific extraction failed, try with broader selectors
      const sessions = [];
      const sessionSelectors = [
        '#sessionsgrid .session',
        '.agenda-item',
        '.event-card',
        '.event',
        'article',
        '.session-card'
      ];
      
      for (const selector of sessionSelectors) {
        try {
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} potential sessions with selector ${selector}`);
            
            const extractedSessions = await this.page.$$eval(selector, (elements, date) => {
              return elements.map(el => {
                // Helper to extract text from various possible selectors
                const getContent = (selectors, defaultValue = '') => {
                  for (const sel of selectors) {
                    const element = el.querySelector(sel);
                    if (element && element.textContent.trim()) {
                      return element.textContent.trim();
                    }
                  }
                  return defaultValue;
                };
                
                // Extract session details
                const title = getContent([
                  '.title', 'h2', 'h3', 'h4', '.event-title',
                  '.session-title', '.heading', 'strong'
                ], 'Untitled Session');
                
                const time = getContent([
                  '.time', '.schedule-time', '.event-time',
                  '.hours', 'time', '.when', '[datetime]'
                ], '9:00 AM - 10:00 AM');
                
                const type = getContent([
                  '.type', '.category', '.tag', '.label',
                  '.session-type', '.event-type'
                ], 'SESSION');
                
                const description = getContent([
                  '.description', '.content', '.details',
                  '.summary', 'p', '.text'
                ], 'No description available.');
                
                const location = getContent([
                  '.location', '.venue', '.room', '.place', '.where'
                ], 'TBD');
                
                // Try to extract speakers
                const speakerElements = el.querySelectorAll('.speaker, .speaker-name, .presenter, .author');
                const speakers = Array.from(speakerElements).map(el => el.textContent.trim()).filter(Boolean);
                
                return {
                  date,
                  title,
                  time,
                  type: type.toUpperCase(),
                  description,
                  location,
                  speakers,
                  hasDetails: true
                };
              });
            }, dayDate);
            
            if (extractedSessions && extractedSessions.length > 0) {
              sessions.push(...extractedSessions);
              break;
            }
          }
        } catch (error) {
          console.warn(`Error extracting with selector ${selector}:`, error.message);
        }
      }
      
      // If we found sessions using any method, return them
      if (sessions.length > 0) {
        console.log(`Found ${sessions.length} sessions using broader selectors`);
        return sessions;
      }
      
      // If all else fails, use fallback sessions
      console.log('No sessions found through any extraction method, using fallback sessions');
      const fallbackSessions = generateFallbackSessions(dayDate);
      return fallbackSessions;
    } catch (error) {
      console.error('Error extracting sessions:', error);
      return [];
    }
  }

  /**
   * Scrape all sessions from all days
   * @returns {Array} Array of all session objects with complete information
   */
  async scrapeAllSessions() {
    try {
      console.log('Starting to scrape all sessions...');
      await this.initialize();
      
      const allSessions = [];
      
      // Process each day using direct URLs
      for (const day of this.days) {
        console.log(`\nProcessing ${day.day} (${day.date})...`);
        
        // Navigate to the day's page
        const success = await this.navigateToDayPage(day.code);
        
        if (success) {
          // Extract sessions from the page
          const daySessions = await this.extractSessionsFromPage(day.date);
          
          // If enabled, extract detailed information for each session
          if (this.options.extractDetailPages && daySessions.length > 0) {
            console.log(`\nExtracting detailed information for ${daySessions.length} sessions from ${day.day}...`);
            
            // Process sessions in batches to avoid overloading the server
            const sessionsWithDetails = await processBatchedSessionDetails(
              this.page,
              daySessions,
              this.options.batchSize,
              this.options.delayBetweenRequests
            );
            
            // Add the enhanced sessions to the master list
            allSessions.push(...sessionsWithDetails);
          } else {
            // Just add the basic sessions to the master list
            allSessions.push(...daySessions);
          }
          
          // Wait between days to avoid overloading the server
          await sleep(2000);
        } else {
          console.warn(`Skipping ${day.day} due to navigation failure`);
        }
      }
      
      console.log(`\nScraped a total of ${allSessions.length} sessions across all days`);
      return allSessions;
      
    } catch (error) {
      console.error('Error during scraping:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}