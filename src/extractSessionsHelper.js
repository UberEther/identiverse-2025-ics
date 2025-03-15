/**
 * Helper functions for extracting sessions from the Identiverse agenda page
 */
import { saveScreenshot } from './utils.js';

/**
 * Extracts session data from the given page using specific selectors
 * @param {Page} page - Playwright page object
 * @param {string} dayDate - The date string (e.g., "JUNE 3")
 * @returns {Promise<Array>} - Array of session objects
 */
export async function extractSessionsWithSpecificSelectors(page, dayDate) {
  console.log(`Looking for sessions using specific selectors for ${dayDate}...`);
  
  try {
    // Parse the date string to get the day
    const dateMatch = dayDate.match(/JUNE\s+(\d+)/i);
    const day = dateMatch ? dateMatch[1].padStart(2, '0') : '03'; // Default to day 3 if not found
    
    // Construct the grid day selector based on the date
    const gridDaySelector = `#gridday-2025-06-${day}`;
    console.log(`Looking for sessions in ${gridDaySelector}`);
    
    // Check if the sessions grid exists
    const sessionsGridExists = await page.$('#sessionsgrid');
    if (!sessionsGridExists) {
      console.warn('Sessions grid (#sessionsgrid) not found on page');
      await saveScreenshot(page, `missing-sessionsgrid-${day}.png`);
      return null;
    }
    
    // Check if the specific day grid exists
    const gridDayExists = await page.$(gridDaySelector);
    if (!gridDayExists) {
      console.warn(`Grid day container (${gridDaySelector}) not found on page`);
      await saveScreenshot(page, `missing-gridday-${day}.png`);
      return null;
    }

    // Extract all session entries for this day
    const sessionEntries = await page.$$(`${gridDaySelector} .sessionentry`);
    if (!sessionEntries || sessionEntries.length === 0) {
      console.warn(`No session entries found in ${gridDaySelector}`);
      return null;
    }
    
    console.log(`Found ${sessionEntries.length} session entries in ${gridDaySelector}`);
    
    // Extract session data
    const sessions = await page.$$eval(`${gridDaySelector} .sessionentry`, (elements, date) => {
      // Get extra attributes and HTML structure of first element for debugging
      const debugInfo = elements.length > 0 ? {
        attributes: Array.from(elements[0].attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '),
        innerHTML: elements[0].innerHTML.substring(0, 500) + (elements[0].innerHTML.length > 500 ? '...' : ''),
        classList: Array.from(elements[0].classList),
        childNodes: Array.from(elements[0].childNodes).map(node => node.nodeName + (node.className ? `[class="${node.className}"]` : '')),
      } : null;
      
      console.log('Session entry debug info:', JSON.stringify(debugInfo, null, 2));
      
      return elements.map(el => {
        // Extract the details URL from the session entry
        let detailsUrl = '';
        // Check for workshop links first (they might have different URL patterns)
        const isWorkshop = el.classList.contains('topic-workshop') || el.textContent.toLowerCase().includes('workshop');
        
        // Look for links in the session entry
        const allLinks = Array.from(el.querySelectorAll('a[href]'));
        for (const link of allLinks) {
          const href = link.getAttribute('href');
          if (href) {
            // Special handling for workshop links
            if (isWorkshop && href.includes('workshop')) {
              detailsUrl = href.startsWith('http') ? href : `https://identiverse.com${href}`;
              break; // Found workshop link, prioritize it
            } else if (href.includes('idvid=') || href.includes('session')) {
              detailsUrl = href.startsWith('http') ? href : `https://identiverse.com${href}`;
              // Don't break here, continue looking for workshop links
            }
          }
        }
        
        // If no workshop link found, but we have another type of link, use that
        if (!detailsUrl) {
          const detailsLink = el.querySelector('a.morelink, a.sessionlink');
          if (detailsLink && detailsLink.getAttribute('href')) {
            const href = detailsLink.getAttribute('href');
            detailsUrl = href.startsWith('http') ? href : `https://identiverse.com${href}`;
          }
        }
        
        // Extract the title from the sessionname element
        let title = '';
        const sessionNameEl = el.querySelector('.sessionname');
        if (sessionNameEl) {
          // Try to get the text from the link inside sessionname, or just the text content
          const sessionLink = sessionNameEl.querySelector('.sessionlink');
          title = sessionLink ? sessionLink.textContent.trim() : sessionNameEl.textContent.trim();
          
          // If the title contains "Workshop" but type doesn't, adjust the type
          if (title.toLowerCase().includes('workshop')) {
            if (el.classList.contains('topic-workshop')) {
              el.dataset.type = 'WORKSHOP';
            }
          }
        } else {
          // Fallback to other possible title selectors
          title = el.querySelector('.session-title')?.textContent.trim() ||
                  el.querySelector('h3')?.textContent.trim() ||
                  el.querySelector('h4')?.textContent.trim() ||
                  'Untitled Session';
        }
        
        // Extract the time from the sessiontime element
        let time = '';
        const sessionTimeEl = el.querySelector('.sessiontime');
        if (sessionTimeEl) {
          // Clean up the time string (remove any "Keynote /" or "Session /" prefix)
          const timeText = sessionTimeEl.textContent.trim();
          const timeMatch = timeText.match(/\d+(?::\d+)?\s*(?:am|pm)\s*-\s*\d+(?::\d+)?\s*(?:am|pm)/i);
          time = timeMatch ? timeMatch[0] : timeText.split('/').pop().trim();
        } else {
          // Fallback to other time selectors
          time = el.querySelector('.time')?.textContent.trim() ||
                 el.textContent.match(/\d+(?::\d+)?\s*(?:am|pm)\s*-\s*\d+(?::\d+)?\s*(?:am|pm)/i)?.[0] ||
                 '9:00 AM - 10:00 AM';
        }
        
        // Extract the session type
        let type = 'SESSION';
        
        // First check if it's a workshop
        if (title.toLowerCase().includes('workshop') || el.classList.contains('topic-workshop')) {
          type = 'WORKSHOP';
        } else {
          const sessionTimeEl2 = el.querySelector('.sessiontime');
          if (sessionTimeEl2) {
            const strongEl = sessionTimeEl2.querySelector('strong');
            if (strongEl) {
              type = strongEl.textContent.trim().toUpperCase();
            } else if (el.classList.length > 1) {
              // Try to extract type from class name (e.g., "topic-networking")
              const typeClass = Array.from(el.classList)
                .find(cls => cls.startsWith('topic-'));
              
              if (typeClass) {
                type = typeClass.replace('topic-', '').toUpperCase();
              }
            }
          }
        }
        
        // For location, use the class from the session or a default location
        let location = 'Las Vegas Convention Center';
        
        // For now, we'll use a generic location based on session type
        if (type.includes('KEYNOTE')) {
          location = 'Main Stage';
        } else if (type.includes('BREAK') || type.includes('BREAKFAST') || type.includes('LUNCH')) {
          location = 'Dining Hall';
        } else if (type.includes('NETWORK')) {
          location = 'Networking Area';
        } else {
          // Try to find a location in the session class or content
          const sessionId = el.querySelector('a[href*="idvid="]')?.getAttribute('href')?.match(/idvid=(\d+)/)?.[1];
          if (sessionId) {
            // Sessions with IDs can be linked to specific rooms
            location = `Room ${sessionId.slice(-3, -1)}`;
          }
        }
        
        // Description will come from the details page, but we'll set a placeholder
        const description = `Visit https://identiverse.com/idv25/session/?idvid=${
          el.querySelector('a[href*="idvid="]')?.getAttribute('href')?.match(/idvid=(\d+)/)?.[1] || ''
        } for full session details.`;
        
        // Extract speakers - for now we'll leave this empty as speakers aren't visible in the grid view
        const speakers = [];
        
        return {
          date,
          detailsUrl,
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
    
    return sessions;
  } catch (error) {
    console.error('Error extracting sessions with specific selectors:', error);
    return null;
  }
}

/**
 * Dump the DOM structure to console for debugging
 * @param {Page} page - Playwright page object
 */
export async function dumpDOMStructure(page) {
  console.log('Dumping page DOM structure for debugging...');
  
  try {
    const structure = await page.evaluate(() => {
      // Helper function to get a simplified representation of the DOM
      function getNodeStructure(node, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return '...';
        
        const children = Array.from(node.children || []);
        const id = node.id ? `#${node.id}` : '';
        const classes = node.className ? `.${node.className.split(' ').join('.')}` : '';
        const tag = node.tagName ? node.tagName.toLowerCase() : 'text';
        
        let result = `${'  '.repeat(depth)}${tag}${id}${classes}\n`;
        
        if (children.length > 0) {
          for (const child of children.slice(0, 10)) { // Limit to 10 children per node to avoid huge output
            result += getNodeStructure(child, depth + 1, maxDepth);
          }
          if (children.length > 10) {
            result += `${'  '.repeat(depth + 1)}... (${children.length - 10} more)\n`;
          }
        }
        
        return result;
      }
      
      return getNodeStructure(document.body);
    });
    
    console.log('DOM Structure:');
    console.log(structure);
  } catch (error) {
    console.error('Error dumping DOM structure:', error);
  }
}

/**
 * Generate sample sessions for fallback
 * @param {string} dayDate - The date string (e.g., "JUNE 3")
 * @returns {Array} - Array of mock session objects
 */
export function generateFallbackSessions(dayDate) {
  console.log(`Generating fallback sessions for ${dayDate}`);
  
  return [
    {
      date: dayDate,
      title: `${dayDate} - Morning Sessions`,
      time: '9:00 AM - 12:00 PM',
      type: 'GENERAL',
      description: 'Conference sessions for the morning. Check the conference website for details.',
      location: 'Conference Center',
      speakers: ['Various Speakers'],
      hasDetails: false
    },
    {
      date: dayDate,
      title: `${dayDate} - Afternoon Sessions`,
      time: '1:00 PM - 5:00 PM',
      type: 'GENERAL',
      description: 'Conference sessions for the afternoon. Check the conference website for details.',
      location: 'Conference Center',
      speakers: ['Various Speakers'],
      hasDetails: false
    }
  ];
}