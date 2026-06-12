/**
 * Web scraping functionality for the Identiverse conference agenda.
 *
 * The 2026 site (https://identiverse.com/idv26/agenda/) is fully
 * server-rendered: a single GET returns every session for all conference
 * days inside #sessionsgrid, organized in #gridday-YYYY-MM-DD containers.
 * Session detail pages are also static HTML, so plain fetch + cheerio is
 * all that's needed — no browser automation.
 */

import * as cheerio from 'cheerio';
import { sleep } from './utils.js';

const SITE_ORIGIN = 'https://identiverse.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Matches time ranges like "8:30 am - 12 pm", "6 am - 7 am", "11:30 - 1 pm" */
const TIME_RANGE_RE = /\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)/i;

/** Collapse whitespace runs (incl. newlines) into single spaces */
const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();

/**
 * Extract readable text from a container, preserving paragraph/list-item
 * boundaries as newlines.
 * @param {object} $ - cheerio instance
 * @param {object} container - cheerio element
 * @returns {string}
 */
function blockText($, container) {
  const blocks = container.find('p, li');
  if (blocks.length > 0) {
    return blocks
      .map((_, el) => normalize($(el).text()))
      .get()
      .filter(Boolean)
      .join('\n');
  }
  return normalize(container.text());
}

/**
 * Parse all sessions out of the agenda page HTML.
 * @param {string} html - Full HTML of the agenda page
 * @returns {Array} Array of raw session objects
 */
export function parseAgendaSessions(html) {
  const $ = cheerio.load(html);
  const sessions = [];

  $('#sessionsgrid [id^="gridday-"]').each((_, dayEl) => {
    const day = $(dayEl);
    const date = day.attr('id').replace('gridday-', ''); // e.g. "2026-06-15"

    day.find('.sessionentry').each((_, entryEl) => {
      const entry = $(entryEl);
      const sessionId = entry.attr('data-sessionid') || null;

      // Title
      const nameEl = entry.find('.sessionname');
      const title =
        normalize(nameEl.find('.sessionlink').text()) ||
        normalize(nameEl.text()) ||
        'Untitled Session';

      // Time and type live together in .sessiontime: "<strong>TYPE</strong> / 8:30 am - 12 pm"
      const timeEl = entry.find('.sessiontime');
      const strongType = normalize(timeEl.find('strong').text());
      const timeText = normalize(timeEl.text());
      const timeMatch = timeText.match(TIME_RANGE_RE);
      const time = timeMatch ? timeMatch[0] : timeText.split('/').pop().trim();

      // Type: prefer the <strong> label, then type-*/topic-* classes
      const classes = (entry.attr('class') || '').split(/\s+/);
      const classType = (prefix) => {
        const cls = classes.find((c) => c.startsWith(prefix) && c !== prefix);
        return cls ? cls.slice(prefix.length).replace(/-/g, ' ') : null;
      };
      const type = (strongType || classType('type-') || classType('topic-') || 'SESSION').toUpperCase();

      // Details URL (absolute or site-relative)
      let detailsUrl = entry.find('a.morelink').attr('href') || entry.find('a.sessionlink').attr('href') || '';
      if (detailsUrl && !detailsUrl.startsWith('http')) {
        detailsUrl = `${SITE_ORIGIN}${detailsUrl}`;
      }

      // Inline speakers: name plus "Title • Company"
      const speakers = entry
        .find('.speakerpanel .speaker')
        .map((_, speakerEl) => {
          const speaker = $(speakerEl);
          const name = normalize(speaker.find('.speakername').text());
          const speakerTitle = normalize(speaker.find('.speakertitle').text());
          return name ? { name, title: speakerTitle } : null;
        })
        .get()
        .filter(Boolean);

      sessions.push({
        date,
        time,
        title,
        type,
        sessionId,
        detailsUrl,
        speakers,
        hasDetails: Boolean(detailsUrl),
      });
    });
  });

  return sessions;
}

/**
 * Parse a session detail page. Handles both page templates:
 *  - standard sessions: .idvdetail with .entrydate / .entrydetail / .blurb
 *  - named workshop pages: .workshops26-dates with .date / .time / .location
 * @param {string} html - Full HTML of the detail page
 * @returns {Object} { date, time, location, description } (nulls when absent)
 */
export function parseDetailPage(html) {
  const $ = cheerio.load(html);
  const detail = { date: null, time: null, location: null, description: null };

  const idvDetail = $('.idvdetail');
  if (idvDetail.length > 0) {
    detail.date = normalize(idvDetail.find('.entrydate').first().text()) || null;

    idvDetail.find('.entrydetail').each((_, el) => {
      const text = normalize($(el).text());
      if (!text) return;
      if (TIME_RANGE_RE.test(text)) {
        detail.time = detail.time || text;
      } else {
        detail.location = detail.location || text;
      }
    });

    const blurb = idvDetail.find('.blurb');
    if (blurb.length > 0) {
      detail.description = blockText($, blurb) || null;
    }
    return detail;
  }

  const workshopDates = $('.workshops26-dates');
  if (workshopDates.length > 0) {
    detail.date = normalize(workshopDates.find('.date').first().text()) || null;
    detail.time = normalize(workshopDates.find('.time').first().text()) || null;
    detail.location = normalize(workshopDates.find('.location').first().text()) || null;

    const about = $('.workshops26-about .regtext');
    if (about.length > 0) {
      detail.description = blockText($, about) || null;
    }
    return detail;
  }

  // Hero-banner template (e.g. the Women in Identiverse summit page):
  // a .panelinfo block holding "Month DD, YYYY | h:mm am - h:mm pm<br>Room"
  const panelInfo = $('.panelinfo').first();
  if (panelInfo.length > 0) {
    panelInfo.find('br').replaceWith('\n');
    const lines = panelInfo.text().split('\n').map(normalize).filter(Boolean);
    for (const line of lines) {
      const timeMatch = line.match(TIME_RANGE_RE);
      if (timeMatch) {
        detail.time = detail.time || timeMatch[0];
        const dateMatch = line.match(/[A-Za-z]+\s+\d{1,2},\s*\d{4}/);
        if (dateMatch) detail.date = detail.date || dateMatch[0];
      } else if (!/\d/.test(line)) {
        detail.location = detail.location || line;
      }
    }
    const blurb = $('.blurb').first();
    if (blurb.length > 0) {
      detail.description = blockText($, blurb) || null;
    }
  }

  return detail;
}

export class IdentiverseScraper {
  constructor(options = {}) {
    this.baseUrl = `${SITE_ORIGIN}/idv26/agenda/`;
    this.options = {
      extractDetailPages: true, // Whether to fetch detail pages for location/description
      concurrency: 4, // Parallel detail-page fetches
      delayBetweenRequests: 200, // Milliseconds between requests per worker
      ...options,
    };
  }

  /**
   * Fetch a page with a browser-like User-Agent, retrying once on failure.
   * @param {string} url
   * @returns {Promise<string>} HTML body
   */
  async fetchPage(url, attempt = 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (error) {
      if (attempt < 2) {
        console.warn(`Fetch failed for ${url} (${error.message}), retrying...`);
        await sleep(1000);
        return this.fetchPage(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Fetch and merge detail-page data (location, description) into sessions.
   * Sessions sharing a detail URL are enriched from a single fetch.
   * @param {Array} sessions - Raw sessions from the agenda grid
   */
  async enrichWithDetails(sessions) {
    const urls = [...new Set(sessions.filter((s) => s.detailsUrl).map((s) => s.detailsUrl))];
    console.log(`Fetching ${urls.length} session detail pages (concurrency ${this.options.concurrency})...`);

    const detailsByUrl = new Map();
    let completed = 0;
    let failed = 0;

    const worker = async (queue) => {
      for (;;) {
        const url = queue.shift();
        if (!url) return;
        try {
          const html = await this.fetchPage(url);
          detailsByUrl.set(url, parseDetailPage(html));
        } catch (error) {
          failed++;
          console.warn(`Could not fetch details for ${url}: ${error.message}`);
        }
        completed++;
        if (completed % 25 === 0 || completed === urls.length) {
          console.log(`  ${completed}/${urls.length} detail pages fetched`);
        }
        await sleep(this.options.delayBetweenRequests);
      }
    };

    const queue = [...urls];
    await Promise.all(
      Array.from({ length: Math.min(this.options.concurrency, urls.length) }, () => worker(queue))
    );

    if (failed > 0) {
      console.warn(`${failed} detail pages could not be fetched; those sessions keep grid-level data only.`);
    }

    for (const session of sessions) {
      const detail = detailsByUrl.get(session.detailsUrl);
      if (!detail) continue;
      if (detail.location) session.location = detail.location;
      if (detail.description) session.description = detail.description;
      // The grid is authoritative for date/time; fill from the detail page only if missing
      if (!session.time && detail.time) session.time = detail.time;
    }
  }

  /**
   * Scrape all sessions from all conference days.
   * @returns {Array} Array of session objects with complete information
   */
  async scrapeAllSessions() {
    console.log(`Fetching agenda page: ${this.baseUrl}`);
    const html = await this.fetchPage(this.baseUrl);

    const sessions = parseAgendaSessions(html);
    if (sessions.length === 0) {
      throw new Error(
        'No sessions found on the agenda page — the site structure may have changed. ' +
        'Inspect https://identiverse.com/idv26/agenda/ and update the selectors in src/scraper.js.'
      );
    }

    const perDay = {};
    for (const s of sessions) perDay[s.date] = (perDay[s.date] || 0) + 1;
    console.log(
      `Found ${sessions.length} sessions: ` +
      Object.entries(perDay).sort().map(([d, n]) => `${d}: ${n}`).join(', ')
    );

    if (this.options.extractDetailPages) {
      await this.enrichWithDetails(sessions);
    }

    return sessions;
  }
}
