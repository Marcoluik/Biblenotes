import axios from 'axios';
import { bookNameToNumberMap, SupportedLanguage } from './constants'; // Import the structured map
import { ParsedReference } from '../types/bible'; // Import the type

// --- START: Helpers for NWT Local JSON --- 
// Removed bookNameToNumberMap from here

// --- Levenshtein Distance Calculation --- 
// (Standard dynamic programming implementation)
function calculateLevenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const dp: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Deletion
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  return dp[len1][len2];
}

// --- Helper to find closest book name match --- 
const FUZZY_MATCH_THRESHOLD = 2; // Max distance allowed for a match (e.g., 2 allows two typos)

/**
 * Internal helper to find the closest book match based on Levenshtein distance.
 */
function findClosestBookMatchHelper(inputName: string, langMap: { [key: string]: number }): { bookName: string; bookNumber: number } | null {
    let bestMatch: { bookName: string; bookNumber: number } | null = null;
    let minDistance = Infinity;
    const lowerInputName = inputName.toLowerCase().trim(); // Compare case-insensitively and trimmed

    if (!lowerInputName) return null; // Don't match empty strings

    for (const knownName in langMap) {
        const lowerKnownName = knownName.toLowerCase();
        const distance = calculateLevenshteinDistance(lowerInputName, lowerKnownName);

        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = { bookName: knownName, bookNumber: langMap[knownName] };
        }

        // Optimization: Exact match found, no need to search further
        if (distance === 0) {
            break;
        }
    }

    // Only return if the best match is within the threshold
    if (bestMatch && minDistance <= FUZZY_MATCH_THRESHOLD) {
        console.log(`[FuzzyMatchHelper] Found close match for "${inputName}" (normalized: "${lowerInputName}"): "${bestMatch.bookName}" (Distance: ${minDistance})`);
        return bestMatch;
    }

    console.log(`[FuzzyMatchHelper] No close match found for "${inputName}" (normalized: "${lowerInputName}") within threshold ${FUZZY_MATCH_THRESHOLD}. Min distance was ${minDistance}.`);
    return null;
}

/**
 * Finds the canonical book name and number for a given potential book name using fuzzy matching.
 * @param potentialBookName The user-input string that might be a book name.
 * @param lang The language to check against.
 * @returns The matched book name and number, or null if no close match is found.
 */
export function findCanonicalBookName(potentialBookName: string, lang: SupportedLanguage): { bookName: string; bookNumber: number } | null {
    const langMap = bookNameToNumberMap[lang];
    if (!langMap) {
        console.error(`[findCanonicalBookName] No book name map found for language: ${lang}`);
        return null;
    }
    return findClosestBookMatchHelper(potentialBookName, langMap);
}

/**
 * Parses a Bible reference string.
 * Attempts to match "Book Chapter:Verse" format first.
 * If that fails, attempts to find a book name using fuzzy matching.
 * @param reference The input string.
 * @param lang The language required for fuzzy book name matching if needed.
 * @returns A ParsedReference object (potentially partial if only book name is matched), or null if parsing fails.
 */
export function parseReference(reference: string | undefined, lang: SupportedLanguage): ParsedReference | null {
  if (!reference) return null;
  const trimmedRef = reference.trim(); // Trim upfront

  // 1. Try parsing "Book Chapter:Verse" (or similar patterns)
  // Regex adjusted slightly: allows more flexible spacing, optional period/colon, case-insensitive book name start
  const fullRefMatch = trimmedRef.match(/^([1-3]?\s?[a-zæøå]+(?:[\s.-]?[a-zæøå]+)*)\s?[. ]?(\d+)[:.](\d+)(?:-(\d+))?$/i);

  if (fullRefMatch) {
    const bookNameInput = fullRefMatch[1].trim();
    const chapter = parseInt(fullRefMatch[2], 10);
    const startVerse = parseInt(fullRefMatch[3], 10);
    const endVerse = fullRefMatch[4] ? parseInt(fullRefMatch[4], 10) : undefined;

    if (isNaN(chapter) || isNaN(startVerse) || (endVerse !== undefined && isNaN(endVerse))) {
        console.warn(`[parseReference] Invalid numbers in full reference match: "${trimmedRef}"`);
        return null;
    }

    // Now, perform fuzzy matching *on the extracted book name part*
    const matchedBook = findCanonicalBookName(bookNameInput, lang);
    if (!matchedBook) {
        console.warn(`[parseReference] Could not fuzzy match book name "${bookNameInput}" from full reference "${trimmedRef}"`);
        return null; // Book name part couldn't be matched even though format was okay
    }

    console.log(`[parseReference] Parsed full reference: Book="${matchedBook.bookName}" (#${matchedBook.bookNumber}), C=${chapter}, V=${startVerse}${endVerse ? '-' + endVerse : ''}`);
    return {
        bookName: matchedBook.bookName, // Use the canonical matched name
        bookNumber: matchedBook.bookNumber,
        chapter: chapter,
        startVerse: startVerse,
        endVerse: endVerse
    };
  }

  // 2. If full parsing failed, check if the input might be *just* a book name
  // Basic check: contains no digits or typical separators like : . -
  const potentialBookOnly = !/[\d:.-]/.test(trimmedRef);

  if (potentialBookOnly) {
      console.log(`[parseReference] Input "${trimmedRef}" doesn't match full format, attempting book-only fuzzy match.`);
      const matchedBook = findCanonicalBookName(trimmedRef, lang);

      if (matchedBook) {
          console.log(`[parseReference] Found book-only fuzzy match: "${matchedBook.bookName}" (#${matchedBook.bookNumber})`);
          // Return a partial reference
          return {
              bookName: matchedBook.bookName,
              bookNumber: matchedBook.bookNumber,
              chapter: null,      // Indicate chapter is missing
              startVerse: null,   // Indicate verse is missing
              endVerse: undefined // No end verse either
          };
      } else {
           console.log(`[parseReference] Book-only fuzzy match failed for "${trimmedRef}"`);
      }
  }

  // 3. If neither worked, parsing fails
  console.warn(`[parseReference] Could not parse input as full reference or book name: "${reference}"`);
  return null;
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

// --- Updated fetchVerseLocally using Fuzzy Matching --- 
// Define the return type for fetchVerseLocally
export interface LocalVerseResult {
  text: string;
  matchedBookName: string; // The canonical book name found
  matchedBookNumber: number; // The book number found
  requestedChapter: number; // The chapter used for the lookup (might be defaulted)
  requestedVerse: number; // The verse used for the lookup (might be defaulted)
}

/**
 * Fetches a SINGLE Bible verse from the local JSON data.
 * Handles partial references (book name only) by defaulting to Chapter 1, Verse 1.
 *
 * @param parsedRef The result from parseReference (can be partial).
 * @param lang The language identifier (e.g., 'en', 'da').
 * @returns The verse text and details about the match.
 */
export async function fetchVerseLocally(parsedRef: ParsedReference, lang: SupportedLanguage): Promise<LocalVerseResult> {
  const startTime = Date.now();
  console.log(`[JW.org API - Local] Starting fetch for parsedRef:`, parsedRef, `, lang: "${lang}" at ${new Date().toISOString()}`);

  // 1. Validate Parsed Reference Input
  if (!parsedRef || parsedRef.bookNumber === null) { // We absolutely need a book number now
    console.error(`[JW.org API - Local] Invalid parsedRef provided to fetchVerseLocally: bookNumber is null. Ref:`, parsedRef);
    throw new Error(`Cannot fetch locally without a valid book identified.`);
  }

  // Check for verse range - currently only fetches the start verse
  if (parsedRef.endVerse && parsedRef.startVerse && parsedRef.endVerse !== parsedRef.startVerse) {
    console.warn(`[JW.org API - Local] Range detected (${parsedRef.bookName} ${parsedRef.chapter}:${parsedRef.startVerse}-${parsedRef.endVerse}), fetching only start verse ${parsedRef.startVerse}.`);
    // TODO: Add logic here to fetch multiple verses if range handling is desired
  }

  // 2. Determine Chapter and Verse (Default if necessary)
  const chapterToFetch = parsedRef.chapter ?? 1; // Default to chapter 1 if null
  const verseToFetch = parsedRef.startVerse ?? 1; // Default to verse 1 if null

  console.log(`[JW.org API - Local] Using Book: "${parsedRef.bookName}" (#${parsedRef.bookNumber}), Chapter: ${chapterToFetch} (original: ${parsedRef.chapter}), Verse: ${verseToFetch} (original: ${parsedRef.startVerse})`);

  // 3. Create Verse ID
  // We already have the bookNumber from the parsedRef passed in
  const { bookNumber } = parsedRef; // Type assertion is safe due to check above
  const verseId = createVerseId(bookNumber, chapterToFetch, verseToFetch);
  console.log(`[JW.org API - Local] Calculated Verse ID: ${verseId}`);

  // 4. Fetch from Cache/Network
  try {
    // --- Cache handling logic (remains the same) ---
    if (!verseDataCache[lang] && !isLoadingCache[lang]) {
        isLoadingCache[lang] = true;
        const filePath = `/verse-data/${lang}.json`;
        console.log(`[JW.org API - Local] Cache miss for ${lang}. Fetching ${filePath}...`);
        try {
            const response = await fetch(filePath); // Use standard fetch for public assets
            if (!response.ok) {
                throw new Error(`Failed to load verse data file (${filePath}): ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`[JW.org API - Local] Successfully fetched and parsed ${filePath}. Caching ${Object.keys(data).length} verses.`);
            verseDataCache[lang] = data;
        } catch (fetchError) {
            console.error(`[JW.org API - Local] Error fetching or parsing ${filePath}:`, fetchError);
            verseDataCache[lang] = null; // Ensure cache is null on error
            throw fetchError; // Rethrow to signal failure
        } finally {
             isLoadingCache[lang] = false;
        }
    } else if (isLoadingCache[lang]) {
        console.log(`[JW.org API - Local] Waiting for ongoing fetch for ${lang}...`);
        // Simple wait loop (consider a more robust promise-based approach for production)
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
    // --- End Cache handling ---

    const cachedVerseData = verseDataCache[lang];
    if (!cachedVerseData) {
        // This should ideally not happen if the cache loading logic is correct
         throw new Error(`Verse data for language '${lang}' is not available after fetch attempt.`);
    }

    const verseText = cachedVerseData[verseId];

    if (verseText === undefined) { // Check for undefined, as empty string might be valid?
        console.error(`[JW.org API - Local] Verse ID "${verseId}" not found in ${lang} data for reference: ${parsedRef.bookName} ${chapterToFetch}:${verseToFetch}`);
        throw new Error(`Verse ${chapterToFetch}:${verseToFetch} not found for book '${parsedRef.bookName}' in the ${lang} data.`);
    }

    console.log(`[JW.org API - Local] Found verse text for ID ${verseId} (${verseText.length} chars)`);
    const endTime = Date.now();
    console.log(`[JW.org API - Local] Fetch operation took ${(endTime - startTime) / 1000} seconds.`);

    return {
      text: verseText,
      matchedBookName: parsedRef.bookName, // Use the canonical name from parsing
      matchedBookNumber: bookNumber,
      requestedChapter: chapterToFetch,
      requestedVerse: verseToFetch,
    };

  } catch (error: any) {
    console.error(`[JW.org API - Local] Error during local fetch for ${verseId}:`, error);
    // Rethrow or handle specific errors as needed
    throw new Error(`Failed to fetch verse locally: ${error.message || 'Unknown error'}`);
  }
}

// Keep existing bibleApi functions if they are still needed for other Bible versions
// ... (searchBibleVerses, searchVerse, searchBook, getBibleVerse, getAvailableBibles) ...