// netlify/functions/nwt-proxy.ts
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// --- Copy necessary helpers from server.js ---
const bookNameToNumberMap: { [key: string]: number } = {
  'genesis': 1, 'gen': 1, 'ge': 1, 'exodus': 2, 'ex': 2, 'leviticus': 3, 'lev': 3, 'le': 3, 'numbers': 4, 'num': 4, 'nu': 4,
  'deuteronomy': 5, 'deut': 5, 'de': 5, 'joshua': 6, 'josh': 6, 'jos': 6, 'judges': 7, 'judg': 7, 'jg': 7, 'ruth': 8, 'ru': 8,
  '1 samuel': 9, '1 sam': 9, '1sa': 9, '2 samuel': 10, '2 sam': 10, '2sa': 10, '1 kings': 11, '1 kgs': 11, '1ki': 11,
  '2 kings': 12, '2 kgs': 12, '2ki': 12, '1 chronicles': 13, '1 chron': 13, '1ch': 13, '2 chronicles': 14, '2 chron': 14, '2ch': 14,
  'ezra': 15, 'ezr': 15, 'nehemiah': 16, 'neh': 16, 'esther': 17, 'esth': 17, 'es': 17, 'job': 18, 'jb': 18,
  'psalms': 19, 'psalm': 19, 'ps': 19, 'proverbs': 20, 'prov': 20, 'pr': 20, 'ecclesiastes': 21, 'eccl': 21, 'ec': 21,
  'song of solomon': 22, 'song of sol': 22, 'sos': 22, 'song': 22, 'isaiah': 23, 'isa': 23, 'jeremiah': 24, 'jer': 24,
  'lamentations': 25, 'lam': 25, 'ezekiel': 26, 'ezek': 26, 'eze': 26, 'daniel': 27, 'dan': 27, 'da': 27, 'hosea': 28, 'hos': 28,
  'joel': 29, 'jl': 29, 'amos': 30, 'am': 30, 'obadiah': 31, 'obad': 31, 'ob': 31, 'jonah': 32, 'jon': 32, 'micah': 33, 'mic': 33,
  'nahum': 34, 'nah': 34, 'na': 34, 'habakkuk': 35, 'hab': 35, 'zephaniah': 36, 'zeph': 36, 'zep': 36, 'haggai': 37, 'hag': 37,
  'zechariah': 38, 'zech': 38, 'zec': 38, 'malachi': 39, 'mal': 39, 'matthew': 40, 'matt': 40, 'mt': 40, 'mark': 41, 'mrk': 41, 'mk': 41,
  'luke': 42, 'lk': 42, 'john': 43, 'joh': 43, 'jhn': 43, 'acts': 44, 'act': 44, 'romans': 45, 'rom': 45, 'ro': 45,
  '1 corinthians': 46, '1 cor': 46, '1co': 46, '2 corinthians': 47, '2 cor': 47, '2co': 47, 'galatians': 48, 'gal': 48,
  'ephesians': 49, 'eph': 49, 'philippians': 50, 'phil': 50, 'php': 50, 'colossians': 51, 'col': 51,
  '1 thessalonians': 52, '1 thess': 52, '1th': 52, '2 thessalonians': 53, '2 thess': 53, '2th': 53,
  '1 timothy': 54, '1 tim': 54, '1ti': 54, '2 timothy': 55, '2 tim': 55, '2ti': 55, 'titus': 56, 'tit': 56,
  'philemon': 57, 'philem': 57, 'phm': 57, 'hebrews': 58, 'heb': 58, 'james': 59, 'jas': 59, 'jmp': 59,
  '1 peter': 60, '1 pet': 60, '1pe': 60, '2 peter': 61, '2 pet': 61, '2pe': 61, '1 john': 62, '1 joh': 62, '1jn': 62,
  '2 john': 63, '2 joh': 63, '2jn': 63, '3 john': 64, '3 joh': 64, '3jn': 64, 'jude': 65, 'jud': 65,
  'revelation': 66, 'rev': 66, 're': 66,
};
    
function parseReference(reference: string | undefined): { bookName: string; chapter: number; startVerse: number; endVerse?: number } | null {
  if (!reference) return null;
  reference = reference.trim().toLowerCase();
  // Basic regex, might need refinement for edge cases
  const match = reference.match(/^([1-3]?\s?[a-z]+(?:\\s+[a-z]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
  if (isNaN(chapter) || isNaN(startVerse) || (endVerse !== undefined && isNaN(endVerse))) return null;
  return { bookName, chapter, startVerse, endVerse };
}

function createVerseId(bookNumber: number, chapter: number, verse: number): string {
  const bookStr = bookNumber.toString();
  const chapterStr = chapter.toString().padStart(3, '0');
  const verseStr = verse.toString().padStart(3, '0');
  return `${bookStr}${chapterStr}${verseStr}`;
}

function parseVerseHtmlUsingCheerio(html: string | undefined): string {
   if (!html) return '';
   try {
     const $ = cheerio.load(html);
     // Remove known non-content elements - might need adjustment per language/update
     $('.xrefLink, .footnoteLink, .parabreak, .heading, span.chapterNum').remove();
     // Attempt to get text from specific verse span, fallback to root
     let text = $('span.verse').text() || $.root().text();
     // Basic cleanup
     text = text.replace(/\+/g, ''); // Remove leftover '+'
     text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
     return text;
   } catch (e) {
     console.error("[NWT Proxy Fn] Error parsing verse HTML:", e);
     return ''; // Return empty string on parsing error
   }
}

// Simple in-memory cache with TTL
interface CacheEntry {
  text: string;
  timestamp: number;
}

const verseCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCachedVerse(cacheKey: string): string | null {
  const entry = verseCache[cacheKey];
  if (!entry) return null;
  
  // Check if cache entry is expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete verseCache[cacheKey];
    return null;
  }
  
  return entry.text;
}

function cacheVerse(cacheKey: string, text: string): void {
  verseCache[cacheKey] = {
    text,
    timestamp: Date.now()
  };
}

// --- End Helpers ---


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  console.log(`[NWT Proxy Fn] Function started at ${new Date().toISOString()}`);
  console.log(`[NWT Proxy Fn] Request path: ${event.path}`);
  console.log(`[NWT Proxy Fn] Query parameters:`, event.queryStringParameters);
  
  // Set a timeout promise that will reject after 9 seconds
  // This ensures we return before Netlify's 10-second timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      console.log(`[NWT Proxy Fn] Timeout triggered after ${(Date.now() - startTime) / 1000} seconds`);
      reject(new Error('Function timeout approaching, returning early'));
    }, 9000); // 9 seconds
  });

  const reference = event.queryStringParameters?.ref;
  const lang = event.queryStringParameters?.lang || 'en';
  console.log(`[NWT Proxy Fn] Processing request for reference: "${reference}" in language: "${lang}"`);

  // --- Input Validation ---
  if (!reference) {
    console.log(`[NWT Proxy Fn] Error: Missing ref query parameter`);
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing ref query parameter' }) };
  }
  // Add more supported languages here if needed
  if (!['en', 'da'].includes(lang)) { 
    console.log(`[NWT Proxy Fn] Error: Unsupported language code: ${lang}`);
    return { statusCode: 400, body: JSON.stringify({ error: `Unsupported language code: ${lang}` }) };
  }
  
  const parsedRef = parseReference(reference);
  if (!parsedRef) {
    console.log(`[NWT Proxy Fn] Error: Could not parse reference: ${reference}`);
    return { statusCode: 400, body: JSON.stringify({ error: `Could not parse reference: ${reference}` }) };
  }
  console.log(`[NWT Proxy Fn] Parsed reference:`, parsedRef);
  
  // --- Single Verse Logic ---
  if (parsedRef.endVerse && parsedRef.endVerse !== parsedRef.startVerse) {
    // Log a warning but proceed with the start verse
    console.warn(`[NWT Proxy Fn] Range detected (${reference}), fetching only start verse ${parsedRef.startVerse}.`);
  }
  const verseNum = parsedRef.startVerse; // Only use start verse for now
  const bookNumber = bookNameToNumberMap[parsedRef.bookName];
  if (bookNumber === undefined) {
    console.log(`[NWT Proxy Fn] Error: Book not found in mapping: ${parsedRef.bookName}`);
    return { statusCode: 404, body: JSON.stringify({ error: `Book not found in mapping: ${parsedRef.bookName}` }) };
  }
  console.log(`[NWT Proxy Fn] Book number for "${parsedRef.bookName}": ${bookNumber}`);
  
  const verseId = createVerseId(bookNumber, parsedRef.chapter, verseNum);
  const cacheKey = `${verseId}-${lang}`;
  console.log(`[NWT Proxy Fn] Generated verse ID: ${verseId}, cache key: ${cacheKey}`);
  
  // Check cache first
  const cachedText = getCachedVerse(cacheKey);
  if (cachedText) {
    console.log(`[NWT Proxy Fn] Cache hit for ${verseId} (${lang})`);
    console.log(`[NWT Proxy Fn] Function completed in ${(Date.now() - startTime) / 1000} seconds`);
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ text: cachedText, cached: true }),
    };
  }
  console.log(`[NWT Proxy Fn] Cache miss for ${verseId} (${lang}), proceeding to fetch from source`);
  
  // --- Construct URL ---
  let urlBasePath = '';
  if (lang === 'da') {
    urlBasePath = `/da/bibliotek/bibelen/studiebibel/b%C3%B8ger/json/html/`; // Danish path
  } else { // Default to English
    urlBasePath = `/en/library/bible/study-bible/books/json/html/`; // English path
  }
  const url = `https://www.jw.org${urlBasePath}${verseId}`;
  console.log(`[NWT Proxy Fn] Constructed URL: ${url}`);

  // --- Fetch and Parse ---
  try {
    console.log(`[NWT Proxy Fn] Starting fetch request at ${new Date().toISOString()}`);
    const fetchStartTime = Date.now();
    
    // Use Promise.race to compete with our timeout
    const response = await Promise.race<AxiosResponse>([
      axios.get(url, {
        timeout: 8000, // 8 seconds (reduced to ensure we complete before Netlify timeout)
        headers: { 
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        }
      }),
      timeoutPromise
    ]);

    const fetchDuration = (Date.now() - fetchStartTime) / 1000;
    console.log(`[NWT Proxy Fn] Fetch completed in ${fetchDuration} seconds`);
    console.log(`[NWT Proxy Fn] Response status for ${verseId} (${lang}): ${response.status}`);
    console.log(`[NWT Proxy Fn] Response headers:`, response.headers);
    
    // Check response and parse
    if (response.status === 200 && response.data?.ranges?.[verseId]) {
        console.log(`[NWT Proxy Fn] Successfully received data for verse ${verseId}`);
        const verseData = response.data.ranges[verseId];
        // Prefer verses[0].content if available, fallback to html
        const htmlContent = verseData.verses?.[0]?.content ?? verseData.html; 
        console.log(`[NWT Proxy Fn] HTML content length: ${htmlContent?.length || 0} characters`);
        
        const parseStartTime = Date.now();
        const cleanedText = parseVerseHtmlUsingCheerio(htmlContent);
        const parseDuration = (Date.now() - parseStartTime) / 1000;
        console.log(`[NWT Proxy Fn] Parsing completed in ${parseDuration} seconds`);
        console.log(`[NWT Proxy Fn] Cleaned text length: ${cleanedText.length} characters`);
        
        if (cleanedText) {
             // Cache the result
             cacheVerse(cacheKey, cleanedText);
             console.log(`[NWT Proxy Fn] Cached verse text for ${verseId} (${lang})`);
             
             // Return Netlify Function success response
             console.log(`[NWT Proxy Fn] Function completed successfully in ${(Date.now() - startTime) / 1000} seconds`);
             return {
                 statusCode: 200,
                 // Allow requests from any origin (adjust if needed for security)
                 headers: { 'Access-Control-Allow-Origin': '*' }, 
                 body: JSON.stringify({ text: cleanedText }),
             };
        } else {
             console.error(`[NWT Proxy Fn] Failed to parse HTML for ${verseId} (${lang})`);
             console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
             return { statusCode: 500, body: JSON.stringify({ error: 'Failed to parse verse content' }) };
        }
    } else {
        console.error(`[NWT Proxy Fn] Verse ${verseId} (${lang}) not found or invalid response structure:`, response.data);
        console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
        return { statusCode: 404, body: JSON.stringify({ error: `Verse not found or invalid response from source for ${reference} (${lang})` }) };
    }

  } catch (error: any) {
      console.error(`[NWT Proxy Fn] Error fetching verse ${verseId} (${lang}):`, error);
      console.error(`[NWT Proxy Fn] Error details:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // Handle timeout specifically
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('Function timeout approaching')) {
        console.log(`[NWT Proxy Fn] Timeout error detected, returning 504 status`);
        console.log(`[NWT Proxy Fn] Function completed with timeout in ${(Date.now() - startTime) / 1000} seconds`);
        return {
          statusCode: 504, // Gateway Timeout
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            error: `Request timed out while fetching from source (${lang}). Please try again later.`,
            timeout: true
          }),
        };
      }
      
      const statusCode = error.response?.status || 502; // 502 Bad Gateway is a common proxy error status
      const message = error.message || 'Unknown server error';
      // Return Netlify Function error response
      console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
      return {
          statusCode: statusCode,
          headers: { 'Access-Control-Allow-Origin': '*' }, // Allow CORS for errors too
          body: JSON.stringify({ error: `Proxy error fetching from source (${lang}): ${message}` }),
      };
  }
};

export { handler };