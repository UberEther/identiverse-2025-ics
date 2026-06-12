# Identiverse 2026 Conference Calendar Generator v2.0.0

*Released: June 12, 2026*

Version 2.0.0 updates the generator for the Identiverse 2026 conference (June 15–18, 2026, Mandalay Bay, Las Vegas) and replaces the browser-automation scraper with a much simpler and faster HTTP-based one.

## What's New

- **Identiverse 2026 support**: Scrapes https://identiverse.com/idv26/agenda/ and produces `identiverse-2026-agenda.ics` covering all 263 published sessions across June 15–18
- **No more browser automation**: The 2026 site is fully server-rendered, so Playwright (and its visible browser windows, screenshots, and multi-minute runtimes) is replaced by plain `fetch` + cheerio. A full run takes about a minute
- **Real room locations**: Session detail pages publish actual rooms (e.g. "Mandalay Bay K", "Breakers L", "NHAI Pavilion Theater"); 262 of 263 events carry a specific room
- **Inline speakers**: The 2026 agenda includes speaker names, titles, and companies, which are formatted cleanly into event descriptions
- **Standards-compliant ICS**: Text values are now escaped per RFC 5545 (newlines, commas, semicolons) and lines are folded at 75 octets, fixing import issues strict parsers had with the 2025 file
- **Test suite**: `npm test` runs unit tests for the time parser, UID generator, ICS escaping/folding, and the HTML parsers (tested against fixtures captured from the live 2026 site)

## Unchanged

- The three-stage pipeline (scrape → process → generate) and ICS event structure
- Stable UID scheme (`identiverse-2026-event-<session-id>@identiverse.com`) so reimporting after schedule changes updates events instead of duplicating them
- Las Vegas timezone handling (PDT / America/Los_Angeles with VTIMEZONE definition)

## Removed

- Playwright, screenshot capture, and the screenshot cleanup utility
- Fallback "fake session" generation — if the site can't be parsed, the tool now fails loudly instead of emitting invented events
- Unused dependencies (`playwright`, `ical-generator`)

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the generator with `npm start`
4. Import the generated `output/identiverse2026.ics` (or the committed `identiverse-2026-agenda.ics`) into your calendar application

## Compatibility

The generated ICS file targets:
- Google Calendar
- Apple Calendar
- Microsoft Outlook
- Mozilla Thunderbird

## Known Limitations

- The tool depends on the current structure of the Identiverse website
- "The Exchange" has no published room, so it uses the venue-level location
- Sessions may have incomplete information if the website doesn't provide it

---

# Identiverse 2025 Conference Calendar Generator v1.0.0

*Released: March 15, 2025*

Initial release: Playwright-based scraper for the Identiverse 2025 agenda with ICS generation, Las Vegas timezone support, session categorization, and stable UIDs. The 2025 calendar artifact is preserved at `identiverse-2025-agenda.ics`.
