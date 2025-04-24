import axios from 'axios';
// Removed local Fuse import, helpers are now imported
import {
    parseReference, 
    createVerseId, 
    bookNameToNumberMap, 
    fuse, 
    fuseOptions
} from './bibleUtils'; // Import shared utils

// --- START: Helpers for NWT Local JSON --- 
// Copied from server.js / nwt-proxy.mts

// --- REMOVED Book Data Structure (Now in bibleUtils.ts) --- 

// --- REMOVED Fuse.js Setup (Now in bibleUtils.ts) ---

// --- REMOVED parseReference (Now in bibleUtils.ts) ---

// --- REMOVED createVerseId (Now in bibleUtils.ts) ---

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