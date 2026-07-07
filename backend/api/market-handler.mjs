import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const FF_CALENDAR_JSON_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_CALENDAR_XML_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const FF_CALENDAR_CSV_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.csv';

const FETCH_HEADERS = { 'User-Agent': 'FinhubKH-Journal/1.0' };

const NEWS_FEEDS = [
  { source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', category: 'market' },
  { source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', category: 'market' },
  { source: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { source: 'The Guardian', url: 'https://www.theguardian.com/world/rss', category: 'world' },
  { source: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'world' },
  { source: 'CNBC Politics', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390', category: 'world' },
];

const CACHE_TTL_MS = 15 * 60 * 1000;
const NEWS_CACHE_TTL_MS = 2 * 60 * 1000;
const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;
const DISK_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map();

const DISK_CACHE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.cache',
  'economic-calendar.json',
);

function getCached(key, ttl = CACHE_TTL_MS) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > ttl) return null;
  return entry.data;
}

function getStaleCached(key) {
  return cache.get(key)?.data ?? null;
}

function setCache(key, data) {
  cache.set(key, { at: Date.now(), data });
}

function decodeEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x2019;/g, "'")
    .replace(/&#x2014;/g, '—')
    .replace(/&#x2013;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(re);
  if (!match) return '';
  return decodeEntities(match[1]).replace(/<[^>]+>/g, '').trim();
}

function extractTagRaw(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(re);
  if (!match) return '';
  return decodeEntities(match[1]).trim();
}

function extractImageUrl(block, rawDescription = '') {
  const patterns = [
    /<media:content[^>]+url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i,
    /<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i,
    /<image[^>]*>[\s\S]*?<url>([^<]+)<\/url>/i,
  ];

  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }

  const imgMatch = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return decodeEntities(imgMatch[1]);

  return null;
}

function parseRssItems(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    if (!title || !link) continue;

    const rawDescription = extractTagRaw(block, 'description');
    const description = rawDescription.replace(/<[^>]+>/g, '').trim().slice(0, 280);
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'pubdate');
    const imageUrl = extractImageUrl(block, rawDescription);

    items.push({
      id: `${feed.source}-${link}`,
      title,
      link,
      description,
      imageUrl,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      source: feed.source,
      category: feed.category || 'market',
    });
  }

  return items;
}

function normalizeImpact(impact) {
  const value = String(impact || '').toLowerCase();
  if (value.includes('high') || value === 'red') return 'High';
  if (value.includes('medium') || value === 'orange') return 'Medium';
  if (value.includes('holiday') || value.includes('non-economic')) return 'Holiday';
  return 'Low';
}

function buildFfDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const [month, day, year] = dateStr.split('-').map((part) => part.trim());
  if (!month || !day || !year) return null;

  const base = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const cleanTime = String(timeStr || '').trim();
  if (!cleanTime || /all day|tentative|day \d/i.test(cleanTime)) {
    return `${base}T12:00:00-04:00`;
  }

  const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return `${base}T12:00:00-04:00`;

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3].toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return `${base}T${String(hours).padStart(2, '0')}:${minutes}:00-04:00`;
}

function parseCsvLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  parts.push(current);
  return parts.map((part) => part.trim());
}

function parseFfCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const events = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 5) continue;

    const title = cols[0];
    const country = cols[1];
    const date = buildFfDateTime(cols[2], cols[3]);
    events.push({
      title,
      country,
      date,
      impact: cols[4] || '',
      forecast: cols[5] || '',
      previous: cols[6] || '',
      actual: '',
    });
  }

  return events;
}

function parseFfXml(xml) {
  const events = [];
  const blocks = xml.match(/<event>[\s\S]*?<\/event>/gi) || [];

  for (const block of blocks) {
    const title = extractTag(block, 'title');
    if (!title) continue;

    events.push({
      title,
      country: extractTag(block, 'country'),
      date: buildFfDateTime(extractTag(block, 'date'), extractTag(block, 'time')),
      impact: extractTag(block, 'impact'),
      forecast: extractTag(block, 'forecast'),
      previous: extractTag(block, 'previous'),
      actual: extractTag(block, 'actual'),
    });
  }

  return events;
}

function normalizeCalendarEvents(rawEvents) {
  return rawEvents.map((event, index) => {
    const impact = normalizeImpact(event.impact);
    const parsedDate = event.date ? new Date(event.date) : null;

    return {
      id: `${event.title}-${event.date}-${index}`,
      title: event.title,
      country: event.country || '',
      currency: event.country || '',
      date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : event.date,
      impact,
      forecast: event.forecast || '',
      previous: event.previous || '',
      actual: event.actual || '',
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function readDiskCalendarCache() {
  try {
    const raw = await readFile(DISK_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.events?.length || !parsed?.updatedAt) return null;
    const age = Date.now() - new Date(parsed.updatedAt).getTime();
    if (Number.isNaN(age) || age > DISK_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDiskCalendarCache(payload) {
  try {
    await mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
    await writeFile(DISK_CACHE_PATH, JSON.stringify(payload), 'utf8');
  } catch {
    // ignore disk write failures
  }
}

function isValidCalendarPayload(payload) {
  if (!payload?.events?.length) return false;
  const dated = payload.events.filter((event) => event.date).length;
  return dated >= Math.min(3, payload.events.length * 0.5);
}

function eventMergeKey(event) {
  const day = event.date ? new Date(event.date).toISOString().slice(0, 10) : '';
  return `${event.title}|${event.country || ''}|${day}`;
}

function mergeSupplementalData(baseEvents, supplementalEvents) {
  if (!supplementalEvents.length) return baseEvents;

  const supplementalMap = new Map(
    supplementalEvents.map((event) => [eventMergeKey(event), event]),
  );

  return baseEvents.map((event) => {
    const extra = supplementalMap.get(eventMergeKey(event));
    if (!extra) return event;
    return {
      ...event,
      actual: extra.actual || event.actual || '',
      forecast: event.forecast || extra.forecast || '',
      previous: event.previous || extra.previous || '',
    };
  });
}

function normalizeJsonEvents(json) {
  return json.map((event) => ({
    title: event.title,
    country: event.country || '',
    date: event.date || null,
    impact: event.impact || '',
    forecast: event.forecast || '',
    previous: event.previous || '',
    actual: event.actual || '',
  }));
}

async function fetchSupplementalRawEvents() {
  try {
    const jsonRes = await fetch(FF_CALENDAR_JSON_URL, {
      headers: { ...FETCH_HEADERS, Accept: 'application/json' },
    });
    if (jsonRes.ok) {
      return normalizeJsonEvents(await jsonRes.json());
    }
  } catch {
    // try XML next
  }

  try {
    const xmlRes = await fetch(FF_CALENDAR_XML_URL, {
      headers: { ...FETCH_HEADERS, Accept: 'application/xml, text/xml' },
    });
    const xmlText = await xmlRes.text();
    if (xmlRes.ok && xmlText.trimStart().startsWith('<?xml')) {
      return parseFfXml(xmlText);
    }
  } catch {
    // supplemental feed unavailable
  }

  return [];
}

async function fetchCalendarRaw() {
  const csvRes = await fetch(FF_CALENDAR_CSV_URL, {
    headers: { ...FETCH_HEADERS, Accept: 'text/csv, text/plain' },
  });
  const csvText = await csvRes.text();
  if (csvRes.ok && csvText.trimStart().startsWith('Title,')) {
    const baseRaw = parseFfCsv(csvText);
    const supplemental = await fetchSupplementalRawEvents();
    const events = normalizeCalendarEvents(mergeSupplementalData(baseRaw, supplemental));
    if (events.some((event) => event.date)) return events;
  }

  const xmlRes = await fetch(FF_CALENDAR_XML_URL, {
    headers: { ...FETCH_HEADERS, Accept: 'application/xml, text/xml' },
  });
  const xmlText = await xmlRes.text();
  if (xmlRes.ok && xmlText.trimStart().startsWith('<?xml')) {
    const events = normalizeCalendarEvents(parseFfXml(xmlText));
    if (events.some((event) => event.date)) return events;
  }

  const jsonRes = await fetch(FF_CALENDAR_JSON_URL, {
    headers: { ...FETCH_HEADERS, Accept: 'application/json' },
  });
  if (jsonRes.ok) {
    const events = normalizeCalendarEvents(normalizeJsonEvents(await jsonRes.json()));
    if (events.some((event) => event.date)) return events;
  }

  throw new Error(`Calendar feed unavailable (CSV ${csvRes.status}, XML ${xmlRes.status}, JSON ${jsonRes.status})`);
}

export async function fetchEconomicCalendar() {
  const cached = getCached('calendar', CALENDAR_CACHE_TTL_MS);
  if (cached && isValidCalendarPayload(cached)) return cached;

  try {
    const events = await fetchCalendarRaw();
    const payload = {
      source: 'Forex Factory (Fair Economy)',
      updatedAt: new Date().toISOString(),
      events,
    };

    if (!isValidCalendarPayload(payload)) {
      throw new Error('Calendar feed returned incomplete data');
    }

    setCache('calendar', payload);
    await writeDiskCalendarCache(payload);
    return payload;
  } catch (err) {
    const stale = getStaleCached('calendar');
    if (stale && isValidCalendarPayload(stale)) return stale;
    const disk = await readDiskCalendarCache();
    if (disk && isValidCalendarPayload(disk)) return disk;
    throw err;
  }
}

export async function fetchMarketNews(limit = 40) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 80);
  const cacheKey = `news-${safeLimit}`;
  const cached = getCached(cacheKey, NEWS_CACHE_TTL_MS);
  if (cached) return cached;

  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'FinhubKH-Journal/1.0' },
      });
      if (!res.ok) throw new Error(`${feed.source} feed unavailable (${res.status})`);
      const xml = await res.text();
      return parseRssItems(xml, feed);
    }),
  );

  const articles = results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, safeLimit);

  const payload = {
    sources: NEWS_FEEDS.map((f) => f.source),
    updatedAt: new Date().toISOString(),
    articles,
  };

  setCache(cacheKey, payload);
  return payload;
}
