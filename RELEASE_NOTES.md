# Identiverse 2025 Conference Calendar Generator v1.0.0

*Released: March 15, 2025*

We're excited to announce the official 1.0.0 release of the Identiverse 2025 Conference Calendar Generator. This tool makes it easy to import the Identiverse conference schedule into your preferred calendar application, ensuring you never miss an important session.

## Key Features

- **Complete Session Extraction**: Automatically extracts all sessions from the Identiverse 2025 conference website
- **Timezone Support**: Correctly handles Las Vegas (PDT) timezone for all events
- **Session Categorization**: Identifies and categorizes different session types (Workshops, Keynotes, Panels, etc.)
- **Stable Event IDs**: Uses consistent unique identifiers to prevent duplicate events when reimporting after schedule updates
- **Comprehensive Event Details**: Includes locations, descriptions, and speaker information for all sessions
- **Debugging Tools**: Saves screenshots in timestamped folders for easier troubleshooting

## Technical Highlights

- Built with Node.js and modern JavaScript
- Uses Playwright for robust web scraping
- Implements the iCalendar (ICS) format standard for maximum compatibility
- Organizes debugging screenshots in timestamped directories
- Includes utilities for cleaning up temporary files
- Proper version control configuration with .gitignore

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the generator with `npm start`
4. Import the generated `output/identiverse2025.ics` file into your calendar application

For cleanup of debugging files:
```
npm run cleanup
```

## Compatibility

The generated ICS file has been tested with:
- Google Calendar
- Apple Calendar
- Microsoft Outlook
- Mozilla Thunderbird

## Known Limitations

- The tool depends on the current structure of the Identiverse website
- Some sessions may have incomplete information if the website doesn't provide it

## Roadmap for Future Versions

- Add filtering options for specific session types
- Support for exporting to other calendar formats
- Command-line arguments for customization
- Incremental updates that only process changes

## Acknowledgements

- Thanks to the Identiverse conference organizers for making their schedule available online
- Built using open-source libraries including Playwright, Luxon, and ical-generator

---

### Full Changelog

**Features:**
- Initial implementation of web scraper for Identiverse conference agenda
- Implementation of ICS file generation with proper timezone support
- Multi-day event support
- Session detail extraction from individual event pages
- Error handling and recovery mechanisms
- Screenshot organization in timestamped directories
- Cleanup utility for temporary files

**Technical Improvements:**
- Proper error handling for network issues and HTML parsing
- Batched processing to avoid rate limiting
- Stable UID generation for update-friendly calendar entries
- Comprehensive debugging capabilities
- Version control configuration

**Documentation:**
- Added comprehensive README
- Added Git history management guide
- Included cleanup instructions
- Added release notes