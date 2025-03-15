/**
 * Test script to verify timezone handling
 */

import { DateTime } from 'luxon';

// Original hour in Las Vegas (PDT)
const lasVegasHour = 7; // example, 7 AM in Las Vegas
console.log(`\nTest: ${lasVegasHour}:00 AM in Las Vegas (PDT)`);

// Create the date in various ways to see what's happening
console.log('\n1. Using explicit timezone creation:');

// Method 1: Create directly in Pacific timezone
const dt1 = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'America/Los_Angeles' }
);
console.log('Las Vegas time (direct):', dt1.toLocaleString(DateTime.DATETIME_FULL));
console.log('UTC time:', dt1.toUTC().toLocaleString(DateTime.DATETIME_FULL));
console.log('New York time:', dt1.setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL));

// Method 2: Create in UTC then convert to Pacific
console.log('\n2. Using UTC creation then converting:');
const dt2 = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'UTC' }
);
const pacificTime = dt2.setZone('America/Los_Angeles');
console.log('Las Vegas time (from UTC):', pacificTime.toLocaleString(DateTime.DATETIME_FULL));
console.log('UTC time:', dt2.toLocaleString(DateTime.DATETIME_FULL));
console.log('New York time:', dt2.setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL));

// Method 3: Create in UTC, but keep the local time when converting (this is what we want!)
console.log('\n3. Using UTC creation with keepLocalTime:');
const dt3 = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'UTC' }
);
const pacificTimeKeepLocal = dt3.setZone('America/Los_Angeles', { keepLocalTime: true });
console.log('Las Vegas time (from UTC, keepLocalTime):', pacificTimeKeepLocal.toLocaleString(DateTime.DATETIME_FULL));
console.log('UTC time:', pacificTimeKeepLocal.toUTC().toLocaleString(DateTime.DATETIME_FULL));
console.log('New York time:', pacificTimeKeepLocal.setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL));

// Method 4: Naive date + time using JS Date
console.log('\n4. Using native JS Date:');
const jsDate = new Date(2025, 5, 3, lasVegasHour, 0); // Note: month is 0-based in JS Date
console.log('JS Date (local):', jsDate.toString());
console.log('JS Date (UTC):', jsDate.toUTCString());
console.log('JS Date (ISO):', jsDate.toISOString());

// Method 5: Directly fixed creation with hardcoded offset (reliable but more manual)
console.log('\n5. Using fixed offset:');
const dt5 = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'UTC-7' } // PDT is UTC-7 (Pacific Time during summer)
);
console.log('Las Vegas time (fixed offset):', dt5.toLocaleString(DateTime.DATETIME_FULL));
console.log('UTC time:', dt5.toUTC().toLocaleString(DateTime.DATETIME_FULL));
console.log('New York time:', dt5.setZone('America/New_York').toLocaleString(DateTime.DATETIME_FULL));

/**
 * ICS FORMAT TEST
 */
console.log('\n\nICS FORMAT TEST:');

// Key insight: Need to convert time to UTC for ICS format, while preserving original local time
// This is because ICS uses UTC time internally, but with TZID parameter for display
const localVegasTime = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'UTC-7' }
);

console.log('Local Vegas Time:', localVegasTime.toLocaleString(DateTime.DATETIME_FULL));

// Convert to UTC for ICS representation
const utcTime = localVegasTime.toUTC();
console.log('UTC time for ICS:', utcTime.toLocaleString(DateTime.DATETIME_FULL));

// The ICS format would use the UTC time with a TZID parameter
console.log('\nWhat an ICS file would use:');
console.log('DTSTART;TZID=America/Los_Angeles:20250603T' + 
    localVegasTime.toFormat('HHmmss') + 
    '\n(But the actual UTC time: ' + utcTime.toFormat('yyyyMMddTHHmmss') + 'Z)');

// Time zone conversion check
console.log('\nTime Zone Conversion Check:');
const vegasTime = DateTime.fromObject(
  { year: 2025, month: 6, day: 3, hour: lasVegasHour, minute: 0 },
  { zone: 'America/Los_Angeles' }
);
console.log('Las Vegas (PDT):', vegasTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
console.log('UTC:', vegasTime.toUTC().toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));
console.log('New York (EDT):', vegasTime.setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'));