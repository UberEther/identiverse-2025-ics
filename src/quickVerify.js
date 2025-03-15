/**
 * Quick script to verify the ICS file content directly
 */
import fs from 'fs';

const icsFilePath = './output/identiverse2025.ics';
const icsContent = fs.readFileSync(icsFilePath, 'utf8');

// Find all event starts
const startTimePattern = /DTSTART;TZID=America\/Los_Angeles:(\d{8}T\d{6})/g;
const matches = [...icsContent.matchAll(startTimePattern)];

console.log(`Found ${matches.length} events in the ICS file\n`);

// Show the first 5 events
console.log('FIRST 5 EVENT START TIMES:');
console.log('-------------------------');
for (let i = 0; i < Math.min(5, matches.length); i++) {
  const dtstart = matches[i][1];
  const year = dtstart.substring(0, 4);
  const month = dtstart.substring(4, 6);
  const day = dtstart.substring(6, 8);
  const hour = dtstart.substring(9, 11);
  const minute = dtstart.substring(11, 13);
  
  console.log(`Event ${i+1}: ${year}-${month}-${day} @ ${hour}:${minute} (America/Los_Angeles)`);
  
  // Find the summary for this event
  const eventStart = icsContent.indexOf(`DTSTART;TZID=America/Los_Angeles:${dtstart}`);
  const summaryStart = icsContent.indexOf('SUMMARY:', eventStart);
  const summaryEnd = icsContent.indexOf('\n', summaryStart);
  const summary = icsContent.substring(summaryStart + 8, summaryEnd).trim();
  
  console.log(`  Title: ${summary}`);
}

// Find any AI workshop
const aiWorkshopPattern = /SUMMARY:.*AI and Identity Workshop.*\r?\n/;
const aiMatch = icsContent.match(aiWorkshopPattern);

if (aiMatch) {
  const aiSummaryIndex = icsContent.indexOf(aiMatch[0]);
  
  // Find the DTSTART before this summary
  const aiStartIndex = icsContent.lastIndexOf('DTSTART', aiSummaryIndex);
  const aiStartLine = icsContent.substring(aiStartIndex, icsContent.indexOf('\n', aiStartIndex));
  
  console.log('\nAI WORKSHOP:');
  console.log('-----------');
  console.log(`Start time in ICS: ${aiStartLine}`);
  
  // Extract the time
  const aiTimeMatch = aiStartLine.match(/(\d{8}T\d{6})/);
  if (aiTimeMatch) {
    const dtstart = aiTimeMatch[1];
    const year = dtstart.substring(0, 4);
    const month = dtstart.substring(4, 6);
    const day = dtstart.substring(6, 8);
    const hour = dtstart.substring(9, 11);
    const minute = dtstart.substring(11, 13);
    
    console.log(`Parsed as: ${year}-${month}-${day} @ ${hour}:${minute} (America/Los_Angeles)`);
  }
}