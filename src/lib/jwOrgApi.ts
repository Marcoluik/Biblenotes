import axios from 'axios';

// --- START: Helpers for NWT Local JSON --- 
// Copied from server.js / nwt-proxy.mts

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
  const match = reference.match(/^([1-3]?\s?[a-z]+(?:\s+[a-z]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);
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

// Simple cache for the fetched JSON data (improves performance)
const verseDataCache: { [lang: string]: Record<string, string> | null } = {
    en: null,
    da: null
};
const isLoadingCache: { [lang: string]: boolean } = {
    en: false,
    da: false
};

// --- END Helpers --- 

/**
 * Fetches a SINGLE Bible verse by calling the backend proxy (Netlify Function)
 * which in turn calls the undocumented JW.ORG JSON source.
 *
 * @param reference Standard Bible reference (e.g., "John 3:16")
 * @param bibleId The bible ID string (e.g., 'nwtsty-en', 'nwtsty-da') used to determine the language.
 * @returns The cleaned verse text from the backend or throws an error.
 */
export async function fetchVerseFromJwOrg(reference: string, bibleId: string = 'nwt'): Promise<string> {
  const startTime = Date.now();
  console.log(`[JW.org API - Proxy] Starting fetch for reference: "${reference}", bibleId: "${bibleId}" at ${new Date().toISOString()}`);
  
  // Determine if this is a Danish request
  const isDanish = bibleId.includes('da');
  const lang = isDanish ? 'da' : 'en';
  console.log(`[JW.org API - Proxy] Using language: "${lang}"`);
  
  try {
    // Construct the proxy URL
    const proxyUrl = `/.netlify/functions/nwt-proxy?ref=${encodeURIComponent(reference)}&lang=${lang}`;
    console.log(`[JW.org API - Proxy] Constructed proxy URL: ${proxyUrl}`);
    
    console.log(`[JW.org API - Proxy] Sending request to Netlify Function at ${new Date().toISOString()}`);
    const requestStartTime = Date.now();
    
    const response = await axios.get(proxyUrl, {
      timeout: isDanish ? 20000 : 15000, // Longer timeouts as proxy might be slow
      validateStatus: (status) => status < 500, 
    });
    
    const requestDuration = (Date.now() - requestStartTime) / 1000;
    console.log(`[JW.org API - Proxy] Request completed in ${requestDuration} seconds`);
    console.log(`[JW.org API - Proxy] Response status: ${response.status}`);
    
    if (response.data?.text) {
      console.log(`[JW.org API - Proxy] Successfully received verse text (${response.data.text.length} characters)`);
      return response.data.text;
    } else if (response.status >= 400) { // Handle errors reported by the proxy
        const errorMsg = response.data?.error || `Proxy returned status ${response.status}`;
        console.error(`[JW.org API - Proxy] Error from proxy: ${errorMsg}`);
        throw new Error(`Failed to fetch verse: ${errorMsg}`);
    } else { // Should not happen if proxy works correctly
      console.error(`[JW.org API - Proxy] No verse text found in successful proxy response:`, response.data);
      throw new Error('Proxy returned success but no verse text found');
    }
  } catch (error: any) {
    console.error(`[JW.org API - Proxy] Error fetching verse via proxy:`, error);
    // Log detailed error information
    if (axios.isAxiosError(error)) {
      // ... (existing detailed Axios error logging) ...
       const errorMsg = error.response?.data?.error || error.message || `Request failed with status ${error.response?.status || 'unknown'}`;
       throw new Error(`Failed to fetch verse: ${errorMsg}`);
    } else {
      console.error(`[JW.org API - Proxy] Non-Axios error:`, error);
       throw new Error(`Failed to fetch verse: ${error.message || 'Unknown error occurred'}`);
    }
    // Removed timeout specific handling here, rely on proxy error or Axios timeout error message
  } finally {
    console.log(`[JW.org API - Proxy] Operation completed in ${(Date.now() - startTime) / 1000} seconds`);
  }
}


/**
 * Fetches a SINGLE Bible verse from the statically generated JSON file.
 *
 * @param reference Standard Bible reference (e.g., "John 3:16")
 * @param lang Language code ('en' or 'da') to determine which JSON file to use.
 * @returns The verse text from the JSON file or throws an error.
 */
export async function fetchVerseLocally(reference: string, lang: 'en' | 'da'): Promise<string> {
  const startTime = Date.now();
  console.log(`[JW.org API - Local] Starting fetch for reference: "${reference}", lang: "${lang}" at ${new Date().toISOString()}`);

  // 1. Parse Reference to get verseId
  const parsedRef = parseReference(reference);
  if (!parsedRef) {
    console.error(`[JW.org API - Local] Could not parse reference: ${reference}`);
    throw new Error(`Could not parse reference: ${reference}`);
  }
  if (parsedRef.endVerse && parsedRef.endVerse !== parsedRef.startVerse) {
    console.warn(`[JW.org API - Local] Range detected (${reference}), fetching only start verse ${parsedRef.startVerse}.`);
  }
  const bookNumber = bookNameToNumberMap[parsedRef.bookName];
  if (bookNumber === undefined) {
      console.error(`[JW.org API - Local] Book not found in mapping: ${parsedRef.bookName}`);
      throw new Error(`Book not found in mapping: ${parsedRef.bookName}`);
  }
  const verseId = createVerseId(bookNumber, parsedRef.chapter, parsedRef.startVerse);
  console.log(`[JW.org API - Local] Calculated Verse ID: ${verseId}`);

  try {
    // 2. Check Cache / Fetch JSON Data if needed
    if (!verseDataCache[lang] && !isLoadingCache[lang]) {
        isLoadingCache[lang] = true;
        const filePath = `/verse-data/${lang}.json`;
        console.log(`[JW.org API - Local] Cache miss for ${lang}. Fetching ${filePath}...`);
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load verse data file (${filePath}): ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`[JW.org API - Local] Successfully fetched and parsed ${filePath}. Caching ${Object.keys(data).length} verses.`);
            verseDataCache[lang] = data;
        } catch (fetchError) {
            console.error(`[JW.org API - Local] Error fetching or parsing ${filePath}:`, fetchError);
            // Set cache back to null on error so the next attempt retries the fetch
            verseDataCache[lang] = null; 
            throw fetchError; // Re-throw to indicate failure
        } finally {
             isLoadingCache[lang] = false;
        }
    } else if (isLoadingCache[lang]) {
        // Wait for ongoing fetch to complete (simple polling)
        console.log(`[JW.org API - Local] Waiting for ongoing fetch for ${lang}...`);
        await new Promise<void>(resolve => {
            const interval = setInterval(() => {
                if (!isLoadingCache[lang]) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100); // Check every 100ms
        });
         console.log(`[JW.org API - Local] Ongoing fetch for ${lang} completed.`);
    }

    // 3. Look up verse in (now populated) cache
    const cachedVerseData = verseDataCache[lang];
    if (!cachedVerseData) { // Should ideally not happen if fetch logic is correct
         throw new Error(`Verse data for language '${lang}' is not available after fetch attempt.`);
    }

    const verseText = cachedVerseData[verseId];

    if (verseText !== undefined && verseText !== null) {
        console.log(`[JW.org API - Local] Found verse ${verseId} in ${lang} cache.`);
        return verseText;
    } else {
        console.error(`[JW.org API - Local] Verse ID ${verseId} not found in loaded ${lang}.json data.`);
        throw new Error(`Verse ${reference} (ID: ${verseId}) not found in local data.`);
    }

  } catch (error: any) {
    // Catch errors from parsing, file fetching, or lookup
    console.error(`[JW.org API - Local] Error processing local verse ${reference} (${lang}):`, error);
    throw new Error(`Failed to load local verse: ${error.message || 'Unknown error'}`);
  } finally {
    console.log(`[JW.org API - Local] Operation completed in ${(Date.now() - startTime) / 1000} seconds`);
  }
}

// Keep existing bibleApi functions if they are still needed for other Bible versions
// ... (searchBibleVerses, searchVerse, searchBook, getBibleVerse, getAvailableBibles) ...