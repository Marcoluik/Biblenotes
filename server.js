import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BIBLE_API_BASE_URL = 'https://api.scripture.api.bible/v1';
const DEFAULT_BIBLE_ID = 'de4e12af7f28f599-02'; // King James Version (KJV)

if (!process.env.VITE_BIBLE_API_KEY) {
  console.error('ERROR: VITE_BIBLE_API_KEY is not set in environment variables');
  process.exit(1);
}

// --- START: JW.ORG Fetcher Helpers --- 

// Basic mapping from common English book names/abbreviations to JW.ORG numbers
const bookNameToNumberMap = {
  'genesis': 1, 'gen': 1, 'ge': 1,
  'exodus': 2, 'ex': 2,
  'leviticus': 3, 'lev': 3, 'le': 3,
  'numbers': 4, 'num': 4, 'nu': 4,
  'deuteronomy': 5, 'deut': 5, 'de': 5,
  'joshua': 6, 'josh': 6, 'jos': 6,
  'judges': 7, 'judg': 7, 'jg': 7,
  'ruth': 8, 'ru': 8,
  '1 samuel': 9, '1 sam': 9, '1sa': 9,
  '2 samuel': 10, '2 sam': 10, '2sa': 10,
  '1 kings': 11, '1 kgs': 11, '1ki': 11,
  '2 kings': 12, '2 kgs': 12, '2ki': 12,
  '1 chronicles': 13, '1 chron': 13, '1ch': 13,
  '2 chronicles': 14, '2 chron': 14, '2ch': 14,
  'ezra': 15, 'ezr': 15,
  'nehemiah': 16, 'neh': 16,
  'esther': 17, 'esth': 17, 'es': 17,
  'job': 18, 'jb': 18,
  'psalms': 19, 'psalm': 19, 'ps': 19,
  'proverbs': 20, 'prov': 20, 'pr': 20,
  'ecclesiastes': 21, 'eccl': 21, 'ec': 21,
  'song of solomon': 22, 'song of sol': 22, 'sos': 22, 'song': 22,
  'isaiah': 23, 'isa': 23,
  'jeremiah': 24, 'jer': 24,
  'lamentations': 25, 'lam': 25,
  'ezekiel': 26, 'ezek': 26, 'eze': 26,
  'daniel': 27, 'dan': 27, 'da': 27,
  'hosea': 28, 'hos': 28,
  'joel': 29, 'jl': 29,
  'amos': 30, 'am': 30,
  'obadiah': 31, 'obad': 31, 'ob': 31,
  'jonah': 32, 'jon': 32,
  'micah': 33, 'mic': 33,
  'nahum': 34, 'nah': 34, 'na': 34,
  'habakkuk': 35, 'hab': 35,
  'zephaniah': 36, 'zeph': 36, 'zep': 36,
  'haggai': 37, 'hag': 37,
  'zechariah': 38, 'zech': 38, 'zec': 38,
  'malachi': 39, 'mal': 39,
  'matthew': 40, 'matt': 40, 'mt': 40,
  'mark': 41, 'mrk': 41, 'mk': 41,
  'luke': 42, 'lk': 42,
  'john': 43, 'joh': 43, 'jhn': 43,
  'acts': 44, 'act': 44,
  'romans': 45, 'rom': 45, 'ro': 45,
  '1 corinthians': 46, '1 cor': 46, '1co': 46,
  '2 corinthians': 47, '2 cor': 47, '2co': 47,
  'galatians': 48, 'gal': 48,
  'ephesians': 49, 'eph': 49,
  'philippians': 50, 'phil': 50, 'php': 50,
  'colossians': 51, 'col': 51,
  '1 thessalonians': 52, '1 thess': 52, '1th': 52,
  '2 thessalonians': 53, '2 thess': 53, '2th': 53,
  '1 timothy': 54, '1 tim': 54, '1ti': 54,
  '2 timothy': 55, '2 tim': 55, '2ti': 55,
  'titus': 56, 'tit': 56,
  'philemon': 57, 'philem': 57, 'phm': 57,
  'hebrews': 58, 'heb': 58,
  'james': 59, 'jas': 59, 'jmp': 59, 
  '1 peter': 60, '1 pet': 60, '1pe': 60,
  '2 peter': 61, '2 pet': 61, '2pe': 61,
  '1 john': 62, '1 joh': 62, '1jn': 62,
  '2 john': 63, '2 joh': 63, '2jn': 63,
  '3 john': 64, '3 joh': 64, '3jn': 64,
  'jude': 65, 'jud': 65,
  'revelation': 66, 'rev': 66, 're': 66,
};

function parseReference(reference) {
  if (!reference) return null;
  reference = reference.trim().toLowerCase();
  const match = reference.match(/^([1-3]?\s?[a-z]+(?:\s+[a-z]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) {
    console.warn(`[JW.ORG] Could not parse reference: ${reference}`);
    return null;
  }
  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
  if (isNaN(chapter) || isNaN(startVerse) || (endVerse !== undefined && isNaN(endVerse))) {
    console.warn(`[JW.ORG] Invalid numbers in parsed reference: ${reference}`);
    return null;
  }
  return { bookName, chapter, startVerse, endVerse };
}

function createVerseId(bookNumber, chapter, verse) {
  const bookStr = bookNumber.toString();
  const chapterStr = chapter.toString().padStart(3, '0');
  const verseStr = verse.toString().padStart(3, '0');
  return `${bookStr}${chapterStr}${verseStr}`;
}

/**
 * Server-side HTML parser using cheerio.
 * VERY FRAGILE - Relies on current JW.ORG HTML structure.
 */
function parseVerseHtmlUsingCheerio(html) {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    // Remove known non-content elements
    $('.xrefLink, .footnoteLink, .parabreak, .heading, span.chapterNum').remove();
    // Get text from the main verse span, or body if structure changes
    let text = $('span.verse').text() || $.root().text();
    // Basic cleanup
    text = text.replace(/\+/g, ''); // Remove leftover '+'
    text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
    return text;
  } catch (e) {
    console.error("[JW.ORG] Error parsing verse HTML:", e);
    return ''; // Return empty string on parsing error
  }
}

// --- END: JW.ORG Fetcher Helpers ---

// Enable CORS
app.use(cors());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Query params:', req.query);
  // console.log('Headers:', req.headers); // Optional: less verbose logging
  next();
});

// --- START: NEW JW.ORG Proxy Route ---
app.get('/nwt-verse', async (req, res) => {
  const reference = req.query.ref;
  if (!reference) {
    return res.status(400).json({ error: 'Missing ref query parameter' });
  }

  console.log(`[JW.ORG] Received request for: ${reference}`);
  const parsedRef = parseReference(reference);
  if (!parsedRef) {
    return res.status(400).json({ error: `Could not parse reference: ${reference}` });
  }

  // Currently only handles single verse fetch
  if (parsedRef.endVerse && parsedRef.endVerse !== parsedRef.startVerse) {
      console.warn(`[JW.ORG] Fetcher currently only supports single verses, not ranges like ${reference}. Fetching only ${parsedRef.startVerse}.`);
      // Potentially loop here in future to fetch multiple verses if needed
  }
  const verseNum = parsedRef.startVerse;

  const bookNumber = bookNameToNumberMap[parsedRef.bookName];
  if (bookNumber === undefined) {
    console.error(`[JW.ORG] Book not found in mapping: ${parsedRef.bookName}`);
    return res.status(404).json({ error: `Book not found in mapping: ${parsedRef.bookName}` });
  }

  const verseId = createVerseId(bookNumber, parsedRef.chapter, verseNum);
  const url = `https://www.jw.org/en/library/bible/study-bible/books/json/html/${verseId}`;

  try {
    console.log(`[JW.ORG] Fetching URL: ${url}`);
    const response = await axios.get(url, {
        timeout: 10000, // 10 seconds
        headers: { 
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    console.log(`[JW.ORG] Response status for ${verseId}: ${response.status}`);

    if (response.status === 200 && response.data?.ranges?.[verseId]) {
      const verseData = response.data.ranges[verseId];
      const htmlContent = verseData.verses?.[0]?.content ?? verseData.html;
      const cleanedText = parseVerseHtmlUsingCheerio(htmlContent);
      
      if (cleanedText) {
        console.log(`[JW.ORG] Sending cleaned text for ${verseId}:`, cleanedText);
        return res.json({ text: cleanedText });
      } else {
          console.error(`[JW.ORG] Failed to parse HTML for ${verseId}`);
          return res.status(500).json({ error: 'Failed to parse verse content' });
      }
    } else {
      console.error(`[JW.ORG] Verse ${verseId} not found or invalid response:`, response.data);
      return res.status(404).json({ error: `Verse not found or invalid response from source for ${reference}` });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[JW.ORG] Axios error fetching verse ${verseId}: ${error.message}`);
      if (error.response) {
        console.error(`[JW.ORG] Response Status: ${error.response.status}`);
        console.error(`[JW.ORG] Response Data:`, error.response.data);
        // Send specific status if available, otherwise 502 (Bad Gateway)
        return res.status(error.response.status || 502).json({ error: `Error fetching from source: ${error.message}` });
      } else if (error.request) {
           console.error('[JW.ORG] Request made but no response received (or Network Error)');
           return res.status(504).json({ error: 'Gateway Timeout - No response from source' });
      } else {
           console.error('[JW.ORG] Error setting up Axios request:', error.message);
           return res.status(500).json({ error: 'Internal server error setting up request' });
      }
    } else {
      console.error(`[JW.ORG] Unexpected error fetching verse ${verseId}:`, error);
      return res.status(500).json({ error: 'Unexpected internal server error' });
    }
  }
  // Safety net: Ensure a response is always sent if code reaches here unexpectedly
  console.error("[JW.ORG] Reached end of /nwt-verse handler unexpectedly!"); 
  return res.status(500).json({ error: "Internal server error: Unhandled path in /nwt-verse" });
});
// --- END: NEW JW.ORG Proxy Route ---

// Bible API proxy
app.get('/api/bible/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    // Check if the query is a book name
    const isBookSearch = /^[1-3]?\s*[A-Za-z]+$/.test(query); // Matches book names like "Genesis", "1 Kings", etc.
    
    if (isBookSearch) {
      console.log('[Search] Book search detected, fetching chapters');
      // First get the book ID
      const booksResponse = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/books`,
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      const books = booksResponse.data.data;
      const book = books.find(b => 
        b.name.toLowerCase() === query.toLowerCase() ||
        b.name.toLowerCase().includes(query.toLowerCase())
      );

      if (!book) {
        console.log('[Search] Book not found, falling back to search');
        // Fall back to regular search if book not found
        const searchResponse = await axios({
          method: 'get',
          url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/search`,
          params: { query, limit },
          headers: {
            'api-key': process.env.VITE_BIBLE_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        res.json(searchResponse.data);
        return;
      }

      // Get the first chapter of the book
      const chapterResponse = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/chapters/${book.id}.1`,
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      // Format the response to match our expected structure
      const formattedResponse = {
        data: {
          passages: [{
            id: chapterResponse.data.data.id,
            reference: `${book.name} 1`,
            content: chapterResponse.data.data.content
          }]
        }
      };

      res.json(formattedResponse);
    } else {
      console.log('[Search] Regular search, using search endpoint');
      // For regular searches, use the search endpoint
      const response = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/search`,
        params: { query, limit },
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Search] Bible API response status:', response.status);
      res.json(response.data);
    }
  } catch (error) {
    console.error('[Search] Error proxying Bible API request:', error.message);
    if (error.response) {
      console.error('[Search] API Response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to fetch Bible verses' });
    }
  }
});

app.get('/api/bible/verses/:reference', async (req, res) => {
  try {
    console.log('[Verses] Proxying request to Bible API:', {
      url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/verses/${req.params.reference}`,
      params: req.query,
    });

    const response = await axios({
      method: 'get',
      url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/verses/${req.params.reference}`,
      headers: {
        'api-key': process.env.VITE_BIBLE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Verses] Bible API response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('[Verses] Error proxying Bible API request:', error.message);
    if (error.response) {
      console.error('[Verses] API Response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to fetch Bible verse' });
    }
  }
});

// Handle all API routes that don't match
app.use('/api', (req, res) => {
  console.log(`[404] No API route found for ${req.method} ${req.url}`);
  res.status(404).json({ error: `No API route found for ${req.method} ${req.url}` });
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all other routes by serving index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log(`Server running on port ${PORT}`);
  console.log('JW.ORG NWT Proxy route available at /nwt-verse');
  console.log('='.repeat(80));
}); 