/**
 * A utility script to verify the contents of the ICS file
 */

import fs from 'fs';
import ical from 'ical';

const icsFilePath = './output/identiverse2025.ics';

// Read and parse the ICS file
try {
  console.log(`Reading ICS file from ${icsFilePath}...`);
  const icsContent = fs.readFileSync(icsFilePath, 'utf8');
  
  // Parse the ICS file using the ical library
  const parsedCal = ical.parseICS(icsContent);
  
  // Count the events
  const events = Object.values(parsedCal).filter(item => item.type === 'VEVENT');
  console.log(`Found ${events.length} events in the calendar\n`);
  
  // Display a sample of events with their times
  console.log('SAMPLE EVENTS (First 5):');
  console.log('--------------------');
  
  events.slice(0, 5).forEach((event, index) => {
    const startLocal = event.start.toLocaleString();
    const startPDT = new Date(event.start).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    });
    const startEDT = new Date(event.start).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    });
    const startUTC = new Date(event.start).toISOString();
    
    console.log(`Event ${index + 1}: ${event.summary}`);
    console.log(`  Description: ${event.description ? event.description.substring(0, 100) + '...' : 'No description'}`);
    console.log(`  Start (Local): ${startLocal}`);
    console.log(`  Start (Las Vegas PDT): ${startPDT}`);
    console.log(`  Start (NYC EDT): ${startEDT}`);
    console.log(`  Start (UTC): ${startUTC}`);
    console.log(`  Location: ${event.location || 'No location'}`);
    console.log(`  UID: ${event.uid || 'No UID'}`);
    console.log(`  TZID: ${event.rrule ? event.rrule.origOptions.tzid : 'No TZID'}`);
    console.log(`  All Properties: ${Object.keys(event).join(', ')}`);
    console.log();
  });
  
  // Find workshop events to verify they're handled correctly
  console.log('\nWORKSHOP EVENTS:');
  console.log('--------------------');
  const workshopEvents = events.filter(event => 
    event.summary?.toLowerCase().includes('workshop') ||
    event.description?.toLowerCase().includes('workshop') ||
    (event.categories && event.categories.some(cat => cat.toLowerCase() === 'workshop'))
  );
  
  workshopEvents.slice(0, 3).forEach((event, index) => {
    const startLocal = event.start.toLocaleString();
    const startPDT = new Date(event.start).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    });
    const startEDT = new Date(event.start).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: true,
      hour: 'numeric',
      minute: 'numeric'
    });
    
    console.log(`Workshop ${index + 1}: ${event.summary}`);
    console.log(`  Start (Local): ${startLocal}`);
    console.log(`  Start (Las Vegas PDT): ${startPDT}`);
    console.log(`  Start (NYC EDT): ${startEDT}`);
    console.log();
  });
  
  // Find specific problematic events if any
  console.log('\nCHECKING FOR PROBLEMATIC EVENTS:');
  console.log('------------------------------');
  
  // Look for events at 7am PDT (10am EDT)
  const sevenAmEvents = events.filter(event => {
    const hour = new Date(event.start).getUTCHours();
    return hour === 14; // 7am PDT = 14:00 UTC
  });
  
  if (sevenAmEvents.length > 0) {
    console.log(`Found ${sevenAmEvents.length} events at 7:00 AM PDT (should be 14:00 UTC)`);
    sevenAmEvents.slice(0, 3).forEach((event, index) => {
      console.log(`  7am Event ${index + 1}: ${event.summary}`);
      const utcHour = new Date(event.start).getUTCHours();
      console.log(`  UTC Hour: ${utcHour} (should be 14)`);
      console.log(`  Start: ${event.start.toLocaleString()}`);
      console.log();
    });
  } else {
    console.log('No 7:00 AM PDT events found.');
  }
  
  // Look for the AI and Identity Workshop specifically
  const aiWorkshopEvents = events.filter(event => 
    event.summary?.toLowerCase().includes('ai') && 
    event.summary?.toLowerCase().includes('identity workshop')
  );
  
  if (aiWorkshopEvents.length > 0) {
    console.log('\nAI AND IDENTITY WORKSHOP:');
    console.log('------------------------');
    aiWorkshopEvents.forEach((event, index) => {
      const startLocal = event.start.toLocaleString();
      const startPDT = new Date(event.start).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour12: true,
        hour: 'numeric',
        minute: 'numeric'
      });
      const startEDT = new Date(event.start).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: 'numeric',
        minute: 'numeric'
      });
      const startUTC = new Date(event.start).toISOString();
      
      console.log(`${event.summary}`);
      console.log(`  Start (Local): ${startLocal}`);
      console.log(`  Start (Las Vegas PDT): ${startPDT}`);
      console.log(`  Start (NYC EDT): ${startEDT}`);
      console.log(`  Start (UTC): ${startUTC}`);
      console.log(`  UID: ${event.uid}`);
    });
  } else {
    console.log('No AI and Identity Workshop found.');
  }
  
  console.log('\nVerification complete.');
  
} catch (error) {
  console.error('Error verifying ICS file:', error);
}