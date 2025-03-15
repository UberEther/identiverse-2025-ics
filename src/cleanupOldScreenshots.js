/**
 * Script to remove old session PNG files from the root directory
 * after they've been moved to timestamped folders
 */

import fs from 'fs';
import path from 'path';

// Files to look for
const patterns = [
  /^session-\d+\.png$/,             // session-123456.png
  /^workshop-\d+\.png$/,            // workshop-123456.png
  /^[a-z]+-page\.png$/,             // tue-page.png, wed-page.png, etc.
  /^missing-[a-z]+\d+\.png$/,       // missing-sessionsgrid-03.png
  /^missing-[a-z]+-\d+\.png$/,      // missing-gridday-03.png
  /^extraction-failed-.*\.png$/,    // extraction-failed-june-3.png
  /^no-sessions-found\.png$/,       // no-sessions-found.png
  /^debug-screenshot\.png$/         // debug-screenshot.png
];

function shouldDelete(filename) {
  return patterns.some(pattern => pattern.test(filename));
}

async function cleanupScreenshots() {
  console.log('Cleaning up old screenshot files from root directory...');
  
  try {
    // Read all files in the current directory
    const files = fs.readdirSync('.');
    
    // Filter for PNG files matching our patterns
    const pngFiles = files.filter(file => 
      file.endsWith('.png') && shouldDelete(file)
    );
    
    console.log(`Found ${pngFiles.length} PNG files to clean up:`);
    
    // Delete each file
    let deletedCount = 0;
    for (const file of pngFiles) {
      try {
        fs.unlinkSync(file);
        console.log(`  ✓ Deleted: ${file}`);
        deletedCount++;
      } catch (err) {
        console.error(`  ✗ Failed to delete ${file}: ${err.message}`);
      }
    }
    
    console.log(`\nSuccessfully deleted ${deletedCount} of ${pngFiles.length} PNG files.`);
    
    // Check if screenshots directory exists
    if (fs.existsSync('screenshots')) {
      const screenshotDirs = fs.readdirSync('screenshots');
      console.log(`\nScreenshot directories available (${screenshotDirs.length}):`);
      
      // List the screenshot directories
      for (const dir of screenshotDirs.slice(0, 5)) {
        const fullPath = path.join('screenshots', dir);
        const stats = fs.statSync(fullPath);
        const fileCount = fs.readdirSync(fullPath).length;
        console.log(`  - ${dir} (${fileCount} files)`);
      }
      
      if (screenshotDirs.length > 5) {
        console.log(`  ... and ${screenshotDirs.length - 5} more directories`);
      }
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup function
cleanupScreenshots();