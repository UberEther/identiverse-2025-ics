# Identiverse 2026 Calendar Generator — Design

**Date:** 2026-06-12
**Goal:** Update the repository to scrape the Identiverse 2026 agenda (https://identiverse.com/idv26/agenda/) and produce `identiverse-2026-agenda.ics` in the same format as the 2025 artifact.

## Findings from site investigation

- The 2026 agenda is served at `https://identiverse.com/idv26/agenda/` (same WordPress platform as 2025, new `idv26` namespace).
- The page is **fully server-rendered**: a single GET returns all 263 sessions across four day containers `#gridday-2026-06-15` (36), `-16` (111), `-17` (88), `-18` (28) inside `#sessionsgrid`. No JavaScript execution is required.
- Each `.sessionentry` provides:
  - `data-sessionid` — stable numeric ID (basis for stable UIDs)
  - `.sessionname a.sessionlink` — title
  - `.sessiontime` — `<strong>TYPE</strong> / 8:30 am - 12:30 pm`
  - `a.morelink` — detail URL: 254× `/idv26/session/?idvid=N`, 9× named pages (e.g. `/idv26/continuous-identity-workshop/`)
  - `.speakerpanel` — inline speakers (`.speakername`, `.speakertitle` as "Title • Company") — new in 2026
  - `topic-*` and `type-*` classes
- Detail pages are also static HTML, two templates:
  - Session template: `.idvdetail` with `.entrydate` (e.g. "Wednesday, June 17"), two `.entrydetail` blocks (room, time), `.blurb` (description)
  - Workshop template: `.workshops26-dates` with `.date`, `.time`, `.location` (e.g. "Mandalay Bay K"), `.workshops26-about .regtext` (description)
- Venue: **Mandalay Bay, Las Vegas, Nevada**, June 15–18 2026 (PDT, UTC-7 — same timezone handling as 2025).

## Decision: drop Playwright, fetch + cheerio

The 2025 implementation drove a visible Chromium via Playwright with screenshot debugging and layered selector fallbacks. The 2026 site needs none of that. Replace the acquisition layer with native `fetch` (Node 22) + `cheerio` for parsing. Keep the three-stage pipeline and module layout: scraper → dataProcessor → icsGenerator.

Trade-offs considered:
1. **Minimal edit (keep Playwright)** — smallest diff, but slow (~10+ min), brittle, requires browser install, and most of the old code is dead fallback paths.
2. **fetch + cheerio rewrite of the scraper only** *(chosen)* — fast (~1 min), no browser, deterministic; processor/generator interfaces unchanged.
3. **Hybrid fetch-first with Playwright fallback** — double maintenance for a fallback that may never run (YAGNI).

## Components

- `index.js` — orchestrator; writes `output/identiverse2026.ics` and the committed root artifact `identiverse-2026-agenda.ics`.
- `src/scraper.js` — `IdentiverseScraper.scrapeAllSessions()`:
  1. GET agenda page (browser-like User-Agent).
  2. For each `#gridday-2026-06-DD .sessionentry`: extract ISO date (from container id), title, time, type (strong text → `type-*` class → `topic-*` class), sessionId (`data-sessionid`), detailsUrl, inline speakers `[{name, title}]`.
  3. Fetch each unique detail URL (concurrency 4, ~200 ms spacing, 1 retry) and parse both templates for location + description; merge into sessions. Failures degrade gracefully to grid-only data.
- `src/dataProcessor.js` — unchanged shape; prefers `session.sessionId`, falls back to `idvid=` match in detailsUrl.
- `src/utils.js` — `parseLasVegasTime` accepts ISO dates (`2026-06-15`) plus legacy "JUNE 15" strings; default year 2026; UID scheme `identiverse-2026-event-{sessionId}@identiverse.com` (hash fallback unchanged in form); `formatDescription` handles structured speakers; screenshot helpers removed.
- `src/icsGenerator.js` — same VCALENDAR/VEVENT structure and X-properties as 2025 with: 2026 calendar name, default location "Mandalay Bay, Las Vegas, NV", VTIMEZONE RRULE anchors moved to 2026 transition dates, and **RFC 5545-compliant TEXT escaping** (`\n`, `\,`, `\;`, `\\`) + 75-octet line folding. (The 2025 file emitted raw newlines inside DESCRIPTION, which strict parsers reject; the 2026 file keeps the same fields but is standards-valid.)
- `src/verifyIcs.js`, `src/quickVerify.js` — repointed at the 2026 output.
- **Deleted** (Playwright/2025-specific dead code): `src/extractSessionsHelper.js`, `src/sessionDetailsExtractor.js`, `src/cleanupOldScreenshots.js`, `src/sampleData.js`, `src/testTimezone.js`.
- `package.json` — drop `playwright`, `ical-generator`; add `cheerio`; keep `luxon`, `fs-extra`, `ical` (verifier); `test: node --test`; version 2.0.0.

## Data flow

agenda HTML → grid sessions `{date(ISO), time, title, type, sessionId, detailsUrl, speakers[]}` → detail merge `{+location, +description}` → processor `{title, description, location, startTime, endTime, uid, type}` → ICS.

UID stability: every 2026 grid entry carries `data-sessionid`, so re-runs after schedule changes update rather than duplicate events (same guarantee as 2025).

## Error handling

- Agenda fetch failure or zero sessions parsed → abort with non-zero exit (no fallback fake sessions — the 2025 "fallback sessions" path is removed; emitting invented events is worse than failing).
- Detail fetch failure → keep grid data, description points at the session URL.
- Unparseable time → skip event with warning (existing behavior).

## Testing

- `node --test` unit tests for the pure functions: time parsing (ISO + month-name dates, "12 pm" no-minutes, ranges crossing noon), UID generation, ICS text escaping/folding, grid + detail HTML parsing against fixture snippets captured from the live site.
- Integration verification: full run against the live site; assert 263 events, validate with the `ical` parser, spot-check sample sessions (times/rooms) against the website.
