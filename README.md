# Identiverse 2025 Conference Calendar Generator

A tool that scrapes the [Identiverse 2025 conference agenda](https://identiverse.com/idv25/agenda/) and generates an ICS calendar file that can be imported into calendar applications like Google Calendar, Apple Calendar, or Outlook.

## Features

- Extracts all sessions from the Identiverse conference website
- Creates a comprehensive ICS file with session details
- Handles Las Vegas timezone correctly
- Identifies different session types (Workshops, Keynotes, Panels, etc.)
- **Maintains stable UIDs to prevent duplicate events when reimporting** after schedule changes
- Automatically organizes screenshots in timestamped folders for better debugging

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone this repository:
```
git clone [repository URL]
cd identiverse-2025-ics
```

2. Install dependencies:
```
npm install
```

### Usage

Run the script to generate an ICS file:

```
npm start
```

This will:
1. Scrape the conference website for session information
2. Process and normalize the data
3. Generate an ICS file at `output/identiverse2025.ics`
4. Save debugging screenshots to timestamped folders in the `screenshots/` directory

### Cleaning Up Old Screenshots

If you want to remove old screenshots from the root directory:

```
npm run cleanup
```

This script will:
- Delete all screenshot files from the root directory (session-*.png, tue-page.png, etc.)
- Display information about available screenshot directories

## Handling Schedule Changes

As the conference approaches, the schedule will likely change. This tool is designed to handle these changes gracefully:

1. **Stable UIDs**: The application generates consistent UIDs for each session based on:
   - The session ID from the website when available (most reliable)
   - A hash of the title and date when no ID is available
   
2. **Update vs. Create**: When you reimport the calendar after running the script again:
   - Existing events will be **updated** with any changes to time, location, description, etc.
   - New events will be **added**
   - Events that no longer exist will remain unless manually deleted
   
3. **Recommended Workflow**:
   - Run the script periodically as the conference approaches
   - Re-import the ICS file into your calendar
   - Any schedule changes will update existing events rather than creating duplicates

## How It Works

The application has several components:

1. **Scraper** (`src/scraper.js`): Navigates to the conference website and extracts session data
2. **Session Details Extractor** (`src/sessionDetailsExtractor.js`): Visits individual session pages to get comprehensive details
3. **Data Processor** (`src/dataProcessor.js`): Normalizes and processes the scraped data
4. **ICS Generator** (`src/icsGenerator.js`): Creates the calendar file
5. **Utils** (`src/utils.js`): Contains utility functions for time parsing, UID generation, and screenshot management
6. **Cleanup Script** (`src/cleanupOldScreenshots.js`): Utility for removing old screenshot files

## Project Structure

```
identiverse-2025-ics/
├── index.js              # Main entry point
├── package.json          # Package configuration
├── .gitignore            # Git ignore configuration
├── output/               # Generated ICS file location
├── screenshots/          # Organized screenshots in timestamped folders
└── src/
    ├── scraper.js                  # Web scraping functionality
    ├── sessionDetailsExtractor.js  # Detail page extraction
    ├── dataProcessor.js            # Data normalization and processing
    ├── icsGenerator.js             # ICS file generation
    ├── utils.js                    # Utility functions
    ├── cleanupOldScreenshots.js    # Screenshot cleanup utility
    └── sampleData.js               # Sample data for testing
```

## Version Control

The project includes a `.gitignore` file that excludes:
- Node.js dependencies and logs
- All PNG screenshot files
- Generated output files
- Environment files and system-specific files

This ensures that only the source code is tracked in version control, while generated files and dependencies are excluded.

## Customization

You can customize the scraper behavior by modifying:

- Batch size and request delay in `src/scraper.js` constructor options
- Target URL patterns in `src/scraper.js`
- Time parsing and formatting in `src/utils.js`

## Troubleshooting

If you encounter issues:

1. Check the screenshots saved in the `screenshots/` directory (organized by timestamp)
2. Look for error messages in the console output
3. Try adjusting the batch size and delay parameters to be more conservative
4. Run `npm run cleanup` to clean up old screenshots from the root directory