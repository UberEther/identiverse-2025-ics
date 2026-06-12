# Identiverse 2026 Conference Calendar Generator

A tool that scrapes the [Identiverse 2026 conference agenda](https://identiverse.com/idv26/agenda/) and generates an ICS calendar file that can be imported into calendar applications like Google Calendar, Apple Calendar, or Outlook.

Identiverse 2026 takes place June 15–18, 2026 at Mandalay Bay, Las Vegas, Nevada.

## Features

- Extracts all sessions from the Identiverse conference website with a single page fetch — no browser automation required
- Creates a comprehensive ICS file with session details, room locations, and speakers
- Handles Las Vegas timezone (PDT) correctly
- Identifies different session types (Workshops, Keynotes, Masterclasses, Tech Theater, etc.)
- **Maintains stable UIDs to prevent duplicate events when reimporting** after schedule changes
- RFC 5545-compliant output (proper text escaping and 75-octet line folding)

## Release Notes

See our [Release Notes](RELEASE_NOTES.md) for details about the current version and changes.

## Getting Started

### Prerequisites

- Node.js (v18 or higher — uses the built-in `fetch`)
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
1. Fetch the conference agenda page and parse all sessions
2. Fetch each session's detail page for room locations and descriptions
3. Process and normalize the data
4. Generate an ICS file at `output/identiverse2026.ics` and refresh the committed copy at `identiverse-2026-agenda.ics`

Run the test suite with:

```
npm test
```

Inspect a generated calendar with:

```
npm run verify
```

## Handling Schedule Changes

As the conference approaches, the schedule will likely change. This tool is designed to handle these changes gracefully:

1. **Stable UIDs**: The application generates consistent UIDs for each session based on:
   - The session ID published by the website (`data-sessionid`, most reliable)
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

1. **Scraper** (`src/scraper.js`): Fetches the agenda page, parses every session out of the day grids, then fetches each session's detail page (with limited concurrency) for room locations and full descriptions
2. **Data Processor** (`src/dataProcessor.js`): Normalizes the scraped data and computes event times and UIDs
3. **ICS Generator** (`src/icsGenerator.js`): Creates the calendar file
4. **Utils** (`src/utils.js`): Time parsing, UID generation, and description formatting

The 2026 Identiverse site is fully server-rendered, so the scraper uses plain HTTP requests and [cheerio](https://cheerio.js.org/) for HTML parsing — the Playwright browser automation used for 2025 is no longer needed.

## Project Structure

```
identiverse-2025-ics/
├── index.js                    # Main entry point
├── package.json                # Package configuration
├── .gitignore                  # Git ignore configuration
├── identiverse-2026-agenda.ics # Committed calendar artifact
├── output/                     # Generated ICS file location (gitignored)
├── test/                       # node:test suite + HTML fixtures
└── src/
    ├── scraper.js              # Agenda fetching and HTML parsing
    ├── dataProcessor.js        # Data normalization and processing
    ├── icsGenerator.js         # ICS file generation
    ├── utils.js                # Utility functions
    ├── verifyIcs.js            # Calendar inspection utility
    └── quickVerify.js          # Lightweight ICS spot-check
```

## Customization

You can customize the scraper behavior by modifying:

- Detail-page concurrency and request delay in the `IdentiverseScraper` constructor options (`src/scraper.js`)
- Target URL in `src/scraper.js`
- Time parsing and formatting in `src/utils.js`

## Troubleshooting

If you encounter issues:

1. Look for error messages in the console output — failed detail pages are reported and those sessions fall back to grid-level data
2. If no sessions are found at all, the site structure has likely changed: inspect https://identiverse.com/idv26/agenda/ and update the selectors in `src/scraper.js` (the parsers are unit-tested against fixtures in `test/fixtures/`)
3. Run `npm test` to confirm the parsers still match the recorded fixtures
