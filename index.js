/**
 * Identiverse 2025 Conference Calendar Generator
 *
 * This script scrapes the Identiverse conference agenda website,
 * extracts all session details, and generates an ICS file that can
 * be imported into calendar applications.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { IdentiverseScraper } from './src/scraper.js';
import { DataProcessor } from './src/dataProcessor.js';
import { ICSGenerator } from './src/icsGenerator.js';

// Get the directory name for the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main function to run the entire process
 */
/**
 * Main function to run the entire process
 */
async function main() {
  console.log('Identiverse 2025 Conference Calendar Generator');
  console.log('=============================================');
  
  try {
    console.log('\n1. Scraping the Identiverse conference agenda...');
    const scraper = new IdentiverseScraper();
    const rawSessions = await scraper.scrapeAllSessions();
    console.log(`Successfully scraped ${rawSessions.length} sessions\n`);
    
    console.log('2. Processing and normalizing session data...');
    const processor = new DataProcessor();
    const { sessions } = processor.processAll(rawSessions);
    console.log(`Successfully processed ${sessions.length} sessions\n`);
    
    console.log('3. Generating ICS file...');
    const generator = new ICSGenerator();
    const outputPath = path.join(__dirname, 'output', 'identiverse2025.ics');
    await generator.generateICSFile(sessions, outputPath);
    
    console.log('\n4. Summary of generated calendar:');
    generator.printCalendarSummary(sessions);
    
    console.log('\nProcess completed successfully!');
    console.log(`The ICS file has been saved to: ${outputPath}`);
    console.log('You can now import this file into your calendar application.');
    
  } catch (error) {
    console.error('\nAn error occurred during execution:');
    console.error(error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Unhandled error in main process:', err);
    process.exit(1);
  });
}