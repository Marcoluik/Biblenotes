import axios from 'axios';
import Fuse from 'fuse.js'; // Import Fuse.js

// --- START: Helpers for NWT Local JSON --- 
// Copied from server.js / nwt-proxy.mts

// --- New Maintainable Book Data Structure ---
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

// Function to build the lookup map from the array
function buildBookNameToNumberMap(): { [key: string]: number } {
  const map: { [key: string]: number } = {};
  bibleBooks.forEach((book, index) => {
    const bookNumber = index + 1;
    // Add English name (lowercase)
    map[book.english.toLowerCase()] = bookNumber;
    // Add Danish name (lowercase)
    map[book.danish.toLowerCase()] = bookNumber;
    // Add all abbreviations (lowercase)
    book.abbreviations.forEach(abbr => {
      map[abbr.toLowerCase()] = bookNumber;
    });
  });
  return map;
}

// Generate the map for exact lookups
const bookNameToNumberMap = buildBookNameToNumberMap();

// --- Fuse.js Setup for Fuzzy Matching ---
const allBookNamesAndAbbrs = Object.keys(bookNameToNumberMap);
const fuseOptions = {
  includeScore: true,
  threshold: 0.4, // Adjust threshold (0=exact, 1=match anything)
  minMatchCharLength: 2, 
};
const fuse = new Fuse(allBookNamesAndAbbrs, fuseOptions);
// --- End Fuse.js Setup ---

function parseReference(reference: string | undefined): { bookName: string; chapter: number; startVerse: number; endVerse?: number } | null {
  if (!reference) return null;
  const lowerRef = reference.trim().toLowerCase(); // Convert to lowercase FIRST
  // Basic regex, might need refinement for edge cases
  // Now match against the lowercased string
  const match = lowerRef.match(/^([1-3]?\s?[a-zåæø]+(?:\s+[a-zåæø]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);
  // Also added åæø to the regex character set for robustness, although toLowerCase should handle most cases
  if (!match) return null;
  const bookName = match[1].trim(); // bookName will already be lowercase here
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

  // 1. Parse Reference to get potential bookName
  const parsedRef = parseReference(reference);
  if (!parsedRef) {
    console.error(`[JW.org API - Local] Could not parse reference: ${reference}`);
    throw new Error(`Could not parse reference: ${reference}`);
  }
  if (parsedRef.endVerse && parsedRef.endVerse !== parsedRef.startVerse) {
    console.warn(`[JW.org API - Local] Range detected (${reference}), fetching only start verse ${parsedRef.startVerse}.`);
  }
  
  // --- Book Lookup with Fuzzy Fallback ---
  let bookNumber = bookNameToNumberMap[parsedRef.bookName]; // Try exact match first (already lowercase)
  
  if (bookNumber === undefined) {
      console.log(`[JW.org API - Local] Exact book name "${parsedRef.bookName}" not found. Trying fuzzy match...`);
      const fuseResults = fuse.search(parsedRef.bookName);
      if (fuseResults.length > 0 && fuseResults[0].score !== undefined && fuseResults[0].score <= fuseOptions.threshold) {
          const bestMatch = fuseResults[0].item;
          bookNumber = bookNameToNumberMap[bestMatch]; // Get number from the matched name
          console.log(`[JW.org API - Local] Fuzzy match found: "${parsedRef.bookName}" -> "${bestMatch}" (Book ${bookNumber})`);
      } else {
          console.error(`[JW.org API - Local] Book not found in mapping (exact or fuzzy): ${parsedRef.bookName}`);
          throw new Error(`Book not found in mapping: ${parsedRef.bookName}`);
      }
  }
  // --- End Book Lookup ---

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