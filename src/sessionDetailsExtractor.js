/**
 * Helper function to extract detailed information from individual session pages
 */
import { saveScreenshot } from './utils.js';

/**
 * Extracts detailed information for a session by visiting its detail page
 * @param {Page} page - Playwright page object
 * @param {string} sessionUrl - URL to the session detail page
 * @param {Object} baseSessionData - Basic session data extracted from the grid
 * @returns {Promise<Object>} - Enhanced session object with details
 */
export async function extractSessionDetails(page, sessionUrl, baseSessionData) {
  console.log(`Extracting details from: ${sessionUrl}`);
  
  try {
    // Navigate to the session detail page
    await page.goto(sessionUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Wait for the page content to load
    await page.waitForTimeout(2000);
    
    // Take a screenshot for debugging
    const sessionId = sessionUrl.match(/idvid=(\d+)/)?.[1] || 'unknown';
    const isWorkshop = sessionUrl.includes('workshop') || (baseSessionData.type && baseSessionData.type.toLowerCase().includes('workshop'));
    const fileName = isWorkshop ? `workshop-${sessionId}.png` : `session-${sessionId}.png`;
    await saveScreenshot(page, fileName);
    
    console.log(`Extracting details for ${isWorkshop ? 'workshop' : 'session'}: ${sessionUrl}`);
    
    // Extract detailed information using the provided selectors
    const details = await page.evaluate((isWorkshop) => {
      // Helper function to safely extract text
      const getText = (selector, defaultValue = '') => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : defaultValue;
      };
      
      // Different selectors based on whether it's a workshop or regular session
      if (isWorkshop) {
        // Extract workshop details
        const sessionName = getText('.workshops25-title, .workshop-title, h1, h2.gilroy');
        const date = getText('.workshops25-date, .workshop-date, .date');
        const location = getText('.workshops25-location, .workshop-location, .location, .venue');
        const time = getText('.workshops25-time, .workshop-time, .time');
        const description = getText('.workshops25-description, .workshop-description, .description, .blurb p');
        
        // Extract speakers
        const speakersContainer = document.querySelector('.workshops25-speakers, .workshop-speakers, .speakers, .presenters');
        let speakers = [];
        
        if (speakersContainer) {
          const speakerElements = speakersContainer.querySelectorAll('.speaker, .presenter, .name');
          if (speakerElements && speakerElements.length > 0) {
            speakers = Array.from(speakerElements).map(el => el.textContent.trim()).filter(Boolean);
          } else if (speakersContainer.textContent.trim()) {
            // If no speaker elements were found, try to get content from the whole container
            speakers = [speakersContainer.textContent.trim().replace(/speakers?:/i, '').trim()];
          }
        }
        
        return {
          sessionName,
          date,
          location,
          time,
          description,
          speakers
        };
      } else {
        // Extract regular session details
        const sessionName = getText('#pagewrap > section.idvhero25.venue.detailhero.textcenter.flex.bgcover > div > div.session.gilroy');
        const date = getText('#pagewrap > section.idv23detail > div > div > div.entry.textcenter > div.entrydate.session > span');
        const location = getText('#pagewrap > section.idv23detail > div > div > div.entry.textcenter > div:nth-child(2) > strong');
        const time = getText('#pagewrap > section.idv23detail > div > div > div.entry.textcenter > div:nth-child(3)');
        const description = getText('#pagewrap > section.idv23detail > div > div > div.blurb > p');
        
          // Extract speakers
          const speakersContainer = document.querySelector('#pagewrap > section.idv23detail > div > div > div.speakerwrap.flex.flexrow.flexwrap.textcenter');
          let speakers = [];
          
          if (speakersContainer) {
            // Try to find speaker names in speaker elements
            const speakerElements = speakersContainer.querySelectorAll('.speakercard');
            if (speakerElements && speakerElements.length > 0) {
              speakers = Array.from(speakerElements).map(el => {
                const nameEl = el.querySelector('.speakername') || el.querySelector('strong');
                return nameEl ? nameEl.textContent.trim() : '';
              }).filter(Boolean);
            }
            // If no speaker elements were found, try to get text content from the whole container
            if (speakers.length === 0 && speakersContainer.textContent.trim()) {
              const speakerText = speakersContainer.textContent.trim();
              // Try to extract names from the text
              speakers = [speakerText.replace(/speakers?:/i, '').trim()];
            }
          }
          
          return {
            sessionName,
            date,
            location,
            time,
            description,
            speakers
          };
        }
      
    }, isWorkshop);
    
    // Merge the detailed information with the base session data
    const enhancedSession = {
      ...baseSessionData,
      title: details.sessionName || baseSessionData.title,
      location: details.location || baseSessionData.location,
      description: details.description || baseSessionData.description,
      speakers: details.speakers.length > 0 ? details.speakers : baseSessionData.speakers
    };
    
    // If we got a different time format from the details page, use it to override
    if (details.time && details.time !== baseSessionData.time) {
      // Only override if it looks like a valid time
      if (details.time.match(/\d+(?::\d+)?\s*(?:am|pm)/i)) {
        enhancedSession.time = details.time;
      }
    }
    
    // Include type from details page if available
    if (isWorkshop && !enhancedSession.type.toLowerCase().includes('workshop')) {
      enhancedSession.type = 'WORKSHOP';
    }
    
    return enhancedSession;
  } catch (error) {
    console.error(`Error extracting details from ${sessionUrl}:`, error.message);
    // Return the original session data if we couldn't enhance it
    return baseSessionData;
  }
}

/**
 * Process a batch of sessions to extract their details
 * @param {Page} page - Playwright page object
 * @param {Array} sessions - Array of session objects with URLs
 * @param {number} batchSize - Number of sessions to process in a batch (default: 5)
 * @param {number} delayBetweenRequests - Milliseconds to wait between requests (default: 1000)
 * @returns {Promise<Array>} - Array of enhanced session objects
 */
export async function processBatchedSessionDetails(page, sessions, batchSize = 5, delayBetweenRequests = 1000) {
  console.log(`Processing ${sessions.length} sessions in batches of ${batchSize}`);
  
  const enhancedSessions = [];
  const batches = [];
  
  // Split sessions into batches
  for (let i = 0; i < sessions.length; i += batchSize) {
    batches.push(sessions.slice(i, i + batchSize));
  }
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    console.log(`Processing batch ${i + 1} of ${batches.length}`);
    const batch = batches[i];
    
    // Process each session in the batch
    for (const session of batch) {
      // Skip if there's no details URL
      if (!session.detailsUrl) {
        console.log(`No details URL for session: ${session.title}`);
        enhancedSessions.push(session);
        continue;
      }
      
      // Extract details for this session
      const enhancedSession = await extractSessionDetails(page, session.detailsUrl, session);
      enhancedSessions.push(enhancedSession);
      
      // Wait before processing the next session to avoid overloading the server
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
    
    // If we have more batches to process, wait a bit longer between batches
    if (i < batches.length - 1) {
      console.log(`Waiting between batches...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * 3));
    }
  }
  
  return enhancedSessions;
}