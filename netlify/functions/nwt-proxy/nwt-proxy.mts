// netlify/functions/nwt-proxy.ts
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import Fuse from 'fuse.js'; // Import Fuse.js
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// --- START: Copied/Adapted Helpers from bibleUtils.ts ---

interface BookInfo {
  english: string;
  danish: string;
  abbreviations: string[]; // Combined English/Danish abbreviations
}

const bibleBooks: BookInfo[] = [
  { english: "Genesis", danish: "1 Mosebog", abbreviations: ["gen", "ge", "1 mos"] }, // 1
  { english: "Exodus", danish: "2 Mosebog", abbreviations: ["ex", "2 mos"] }, // 2
  { english: "Leviticus", danish: "3 Mosebog", abbreviations: ["lev", "le", "3 mos"] }, // 3
  { english: "Numbers", danish: "4 Mosebog", abbreviations: ["num", "nu", "4 mos"] }, // 4
  { english: "Deuteronomy", danish: "5 Mosebog", abbreviations: ["deut", "de", "5 mos"] }, // 5
  { english: "Joshua", danish: "Josua", abbreviations: ["jos"] }, // 6
  { english: "Judges", danish: "Dommerbogen", abbreviations: ["judg", "jg", "dom"] }, // 7
  { english: "Ruth", danish: "Ruths Bog", abbreviations: ["ru", "rut"] }, // 8
  { english: "1 Samuel", danish: "1 Samuelsbog", abbreviations: ["1sa", "1 sam"] }, // 9
  { english: "2 Samuel", danish: "2 Samuelsbog", abbreviations: ["2sa", "2 sam"] }, // 10
  { english: "1 Kings", danish: "1 Kongebog", abbreviations: ["1 kgs", "1ki", "1 kong"] }, // 11
  { english: "2 Kings", danish: "2 Kongebog", abbreviations: ["2 kgs", "2ki", "2 kong"] }, // 12
  { english: "1 Chronicles", danish: "1 Krønikebog", abbreviations: ["1 chron", "1ch", "1 krøn"] }, // 13
  { english: "2 Chronicles", danish: "2 Krønikebog", abbreviations: ["2 chron", "2ch", "2 krøn"] }, // 14
  { english: "Ezra", danish: "Ezras Bog", abbreviations: ["ezra"] }, // 15
  { english: "Nehemiah", danish: "Nehemias' Bog", abbreviations: ["neh"] }, // 16
  { english: "Esther", danish: "Esters Bog", abbreviations: ["esth", "est"] }, // 17
  { english: "Job", danish: "Jobs Bog", abbreviations: ["job"] }, // 18
  { english: "Psalms", danish: "Salmernes Bog", abbreviations: ["psalm", "sl"] }, // 19
  { english: "Proverbs", danish: "Ordsprogenes Bog", abbreviations: ["prov", "ordsp"] }, // 20
  { english: "Ecclesiastes", danish: "Prædikerens Bog", abbreviations: ["eccl", "ec", "præd"] }, // 21
  { english: "Song of Solomon", danish: "Højsangen", abbreviations: ["song of sol", "sos", "højs"] }, // 22
  { english: "Isaiah", danish: "Esajas' Bog", abbreviations: ["es"] }, // 23
  { english: "Jeremiah", danish: "Jeremias' Bog", abbreviations: ["jer"] }, // 24
  { english: "Lamentations", danish: "Klagesangene", abbreviations: ["lam", "klages"] }, // 25
  { english: "Ezekiel", danish: "Ezekiels Bog", abbreviations: ["ezek", "ez"] }, // 26
  { english: "Daniel", danish: "Daniels Bog", abbreviations: ["dan"] }, // 27
  { english: "Hosea", danish: "Hoseas' Bog", abbreviations: ["hos"] }, // 28
  { english: "Joel", danish: "Joels Bog", abbreviations: ["joel", "jl"] }, // 29 - Added jl
  { english: "Amos", danish: "Amos' Bog", abbreviations: ["am"] }, // 30
  { english: "Obadiah", danish: "Obadias' Bog", abbreviations: ["obad", "ob"] }, // 31 - Added ob
  { english: "Jonah", danish: "Jonas' Bog", abbreviations: ["jon"] }, // 32
  { english: "Micah", danish: "Mikas Bog", abbreviations: ["mik"] }, // 33
  { english: "Nahum", danish: "Nahums Bog", abbreviations: ["nah"] }, // 34
  { english: "Habakkuk", danish: "Habakkuks Bog", abbreviations: ["hab"] }, // 35
  { english: "Zephaniah", danish: "Sefanias' Bog", abbreviations: ["zeph", "zep", "sef"] }, // 36 - Added zep
  { english: "Haggai", danish: "Haggajs Bog", abbreviations: ["hag", "hagg"] }, // 37 - Added hagg
  { english: "Zechariah", danish: "Zakarias' Bog", abbreviations: ["zech", "zec", "zak"] }, // 38 - Added zec
  { english: "Malachi", danish: "Malakias' Bog", abbreviations: ["mal"] }, // 39
  { english: "Matthew", danish: "Matthæusevangeliet", abbreviations: ["mt", "matt", "mattæus"] }, // 40 - Added mattæus
  { english: "Mark", danish: "Markusevangeliet", abbreviations: ["mrk", "mk", "mark"] }, // 41 - Added mk
  { english: "Luke", danish: "Lukasevangeliet", abbreviations: ["lk", "luk"] }, // 42 - Added luk
  { english: "John", danish: "Johannesevangeliet", abbreviations: ["jhn", "joh"] }, // 43
  { english: "Acts", danish: "Apostlenes Gerninger", abbreviations: ["act", "apg"] }, // 44
  { english: "Romans", danish: "Romerbrevet", abbreviations: ["ro", "rom"] }, // 45
  { english: "1 Corinthians", danish: "1 Korintherbrev", abbreviations: ["1co", "1 kor"] }, // 46
  { english: "2 Corinthians", danish: "2 Korintherbrev", abbreviations: ["2co", "2 kor"] }, // 47
  { english: "Galatians", danish: "Galaterbrevet", abbreviations: ["gal"] }, // 48
  { english: "Ephesians", danish: "Efeserbrevet", abbreviations: ["eph", "ef", "efeserne"] }, // 49 - Added efeserne
  { english: "Philippians", danish: "Filipperbrevet", abbreviations: ["php", "phil", "flp"] }, // 50 - Added phil
  { english: "Colossians", danish: "Kolossenserbrevet", abbreviations: ["col", "kol"] }, // 51
  { english: "1 Thessalonians", danish: "1 Thessalonikerbrev", abbreviations: ["1th", "1 thess"] }, // 52
  { english: "2 Thessalonians", danish: "2 Thessalonikerbrev", abbreviations: ["2th", "2 thess"] }, // 53
  { english: "1 Timothy", danish: "1 Timotheusbrev", abbreviations: ["1ti", "1 tim"] }, // 54
  { english: "2 Timothy", danish: "2 Timotheusbrev", abbreviations: ["2ti", "2 tim"] }, // 55
  { english: "Titus", danish: "Titusbrevet", abbreviations: ["tit"] }, // 56
  { english: "Philemon", danish: "Filemonbrevet", abbreviations: ["phm", "filem"] }, // 57
  { english: "Hebrews", danish: "Hebræerbrevet", abbreviations: ["heb", "hebr"] }, // 58
  { english: "James", danish: "Jakobs Brev", abbreviations: ["jmp", "jas", "jak"] }, // 59 - Added jas
  { english: "1 Peter", danish: "1 Peters Brev", abbreviations: ["1pe", "1 pet"] }, // 60
  { english: "2 Peter", danish: "2 Peters Brev", abbreviations: ["2pe", "2 pet"] }, // 61
  { english: "1 John", danish: "1 Johannes' Brev", abbreviations: ["1jn", "1 joh"] }, // 62
  { english: "2 John", danish: "2 Johannes' Brev", abbreviations: ["2jn", "2 joh"] }, // 63
  { english: "3 John", danish: "3 Johannes' Brev", abbreviations: ["3jn", "3 joh"] }, // 64
  { english: "Jude", danish: "Judas' Brev", abbreviations: ["jud"] }, // 65
  { english: "Revelation", danish: "Åbenbaringen", abbreviations: ["rev", "re", "åb"] }, // 66 - Added re
];

function buildBookNameToNumberMap(): { [key: string]: number } {
  const map: { [key: string]: number } = {};
  bibleBooks.forEach((book, index) => {
    const bookNumber = index + 1;
    map[book.english.toLowerCase()] = bookNumber;
    map[book.danish.toLowerCase()] = bookNumber;
    book.abbreviations.forEach(abbr => {
      map[abbr.toLowerCase()] = bookNumber;
    });
  });
  return map;
}

const bookNameToNumberMap = buildBookNameToNumberMap();

const allBookNamesAndAbbrs = Object.keys(bookNameToNumberMap);
const fuseOptions = {
  includeScore: true,
  threshold: 0.4, 
  minMatchCharLength: 2, 
};
const fuse = new Fuse(allBookNamesAndAbbrs, fuseOptions);

function parseReference(reference: string | undefined): { bookName: string; chapter: number; startVerse: number; endVerse?: number } | null {
  if (!reference) return null;
  const lowerRef = reference.trim().toLowerCase();
  const match = lowerRef.match(/^([1-3]?\s?[a-zåæø]+(?:\s+[a-zåæø]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);
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

// --- END Copied Helpers ---

// --- REMOVED Original Duplicated Helpers --- 

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

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const startTime = Date.now();
  console.log(`[NWT Proxy Fn] Function started at ${new Date().toISOString()}`);
  console.log(`[NWT Proxy Fn] Request path: ${event.path}`);
  console.log(`[NWT Proxy Fn] Query parameters:`, event.queryStringParameters);
  
  // Set CORS headers for all responses
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
  
  const reference = event.queryStringParameters?.ref;
  const lang = event.queryStringParameters?.lang || 'en';
  console.log(`[NWT Proxy Fn] Processing request for reference: "${reference}" in language: "${lang}"`);

  // --- Input Validation ---
  if (!reference) {
    console.log(`[NWT Proxy Fn] Error: Missing ref query parameter`);
    return { 
      statusCode: 400, 
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing ref query parameter' }) 
    };
  }
  // Add more supported languages here if needed
  if (!['en', 'da'].includes(lang)) { 
    console.log(`[NWT Proxy Fn] Error: Unsupported language code: ${lang}`);
    return { 
      statusCode: 400, 
      headers: corsHeaders,
      body: JSON.stringify({ error: `Unsupported language code: ${lang}` }) 
    };
  }
  
  const parsedRef = parseReference(reference);
  if (!parsedRef) {
    console.log(`[NWT Proxy Fn] Error: Could not parse reference: ${reference}`);
    return { 
      statusCode: 400, 
      headers: corsHeaders,
      body: JSON.stringify({ error: `Could not parse reference: ${reference}` }) 
    };
  }
  console.log(`[NWT Proxy Fn] Parsed reference:`, parsedRef);
  
  // --- Single Verse Logic --- (Combine book lookup here)
  if (parsedRef.endVerse && parsedRef.endVerse !== parsedRef.startVerse) {
    // Log a warning but proceed with the start verse
    console.warn(`[NWT Proxy Fn] Range detected (${reference}), fetching only start verse ${parsedRef.startVerse}.`);
  }
  const verseNum = parsedRef.startVerse; // Only use start verse for now
  
  // --- Book Lookup with Fuzzy Fallback ---
  let bookNumber = bookNameToNumberMap[parsedRef.bookName]; // Try exact match first (already lowercase)
  
  if (bookNumber === undefined) {
      console.log(`[NWT Proxy Fn] Exact book name "${parsedRef.bookName}" not found. Trying fuzzy match...`);
      const fuseResults = fuse.search(parsedRef.bookName);
      if (fuseResults.length > 0 && fuseResults[0].score !== undefined && fuseResults[0].score <= fuseOptions.threshold) {
          const bestMatch = fuseResults[0].item;
          bookNumber = bookNameToNumberMap[bestMatch]; // Get number from the matched name
          console.log(`[NWT Proxy Fn] Fuzzy match found: "${parsedRef.bookName}" -> "${bestMatch}" (Book ${bookNumber})`);
      } else {
          console.log(`[NWT Proxy Fn] Book not found in mapping (exact or fuzzy): ${parsedRef.bookName}`);
          return { 
            statusCode: 404, 
            headers: corsHeaders,
            body: JSON.stringify({ error: `Book not found in mapping: ${parsedRef.bookName}` }) 
          };
      }
  }
  // --- End Book Lookup ---
  
  console.log(`[NWT Proxy Fn] Using Book number: ${bookNumber}`);
  
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
      headers: corsHeaders,
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
  let responseData: any; // To store the JSON data from the fetch response
  try {
    console.log(`[NWT Proxy Fn] Starting fetch request using native fetch at ${new Date().toISOString()}`);
    const fetchStartTime = Date.now();
    
    // Use native fetch with AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log(`[NWT Proxy Fn] Aborting fetch due to 15s timeout`);
        controller.abort();
    }, 15000); // 15 seconds timeout

    // Determine Accept-Language based on lang
    const acceptLanguage = lang === 'da' 
        ? 'da-DK,da;q=0.9,en;q=0.8' 
        : 'en-US,en;q=0.9';

    console.log(`[NWT Proxy Fn] Using headers: Accept-Language: ${acceptLanguage}, Referer: https://www.jw.org/`);

    const response = await fetch(url, {
      signal: controller.signal, // Link the controller
      headers: { 
        'Accept': 'application/json, text/plain, */*', // Keep Accept header
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Keep User-Agent
        'Accept-Language': acceptLanguage, // Add Accept-Language
        'Referer': 'https://www.jw.org/' // Add Referer
        // Note: fetch might add slightly different default headers than axios (e.g., Accept-Encoding)
      }
    });

    // Clear the timeout timer if the fetch completes or fails before 15s
    clearTimeout(timeoutId);

    const fetchDuration = (Date.now() - fetchStartTime) / 1000;
    console.log(`[NWT Proxy Fn] Fetch completed in ${fetchDuration} seconds`);
    console.log(`[NWT Proxy Fn] Response status for ${verseId} (${lang}): ${response.status} (${response.statusText})`);

    if (!response.ok) { // Check if status code is 2xx
        // Try to get error details from the response body if possible
        let errorBody = await response.text().catch(() => 'Could not read error body');
        console.error(`[NWT Proxy Fn] Fetch failed with status ${response.status}. Body: ${errorBody.substring(0, 500)}`); // Log first 500 chars
        throw new Error(`Fetch failed with status ${response.status}`); // Throw a generic error
    }

    // Parse the JSON response body
    responseData = await response.json();
    
    // Check response structure and parse (similar logic as before)
    if (responseData?.ranges?.[verseId]) {
        console.log(`[NWT Proxy Fn] Successfully received data for verse ${verseId}`);
        const verseData = responseData.ranges[verseId];
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
                 headers: corsHeaders,
                 body: JSON.stringify({ text: cleanedText }),
             };
        } else {
             console.error(`[NWT Proxy Fn] Failed to parse HTML for ${verseId} (${lang})`);
             console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
             return { 
               statusCode: 500, 
               headers: corsHeaders,
               body: JSON.stringify({ error: 'Failed to parse verse content' }) 
             };
        }
    } else {
        console.error(`[NWT Proxy Fn] Verse ${verseId} (${lang}) not found or invalid response structure:`, responseData);
        console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
        return { 
          statusCode: 404, 
          headers: corsHeaders,
          body: JSON.stringify({ error: `Verse not found or invalid response from source for ${reference} (${lang})` }) 
        };
    }
  } catch (error: any) {
      console.error(`[NWT Proxy Fn] Error during fetch/parse for ${verseId} (${lang}):`, error);
      
      // Handle timeout specifically (AbortError from AbortController)
      if (error.name === 'AbortError') {
        console.log(`[NWT Proxy Fn] Fetch timed out (15s), returning 504 status`);
        console.log(`[NWT Proxy Fn] Function completed with timeout in ${(Date.now() - startTime) / 1000} seconds`);
        return {
          statusCode: 504, // Gateway Timeout
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `Request timed out while fetching from source (${lang}). Please try again later.`,
            timeout: true
          }),
        };
      }
      
      // Handle other potential fetch errors (network errors, JSON parsing errors, etc.)
      const statusCode = 502; // Treat most other fetch errors as Bad Gateway
      const message = error.message || 'Unknown fetch/processing error';
      console.error(`[NWT Proxy Fn] Other error details:`, { // Log more generic details
        message: error.message,
        name: error.name, 
        cause: error.cause 
      });
      // Return Netlify Function error response
      console.log(`[NWT Proxy Fn] Function completed with error in ${(Date.now() - startTime) / 1000} seconds`);
      return {
          statusCode: statusCode,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Proxy error fetching/processing from source (${lang}): ${message}` }),
      };
  }
};

export { handler };