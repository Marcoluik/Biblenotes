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
  requestedVerse: number; // The starting verse used for the lookup (might be defaulted)
  requestedEndVerse?: number; // The ending verse of the range, if applicable
}

/**
 * Fetches a SINGLE Bible verse or a RANGE of verses from the local JSON data.
 * Handles partial references (book name only) by defaulting to Chapter 1, Verse 1.
 * Handles ranges like "Book C:V-V".
 *
 * @param parsedRef The result from parseReference (can be partial, can contain endVerse).
 * @param lang The language identifier (e.g., 'en', 'da').
 * @returns The verse text(s) and details about the match.
 */
export async function fetchVerseLocally(parsedRef: ParsedReference, lang: SupportedLanguage): Promise<LocalVerseResult> {
  const startTime = Date.now();
  console.log(`[JW.org API - Local] Starting fetch for parsedRef:`, parsedRef, `, lang: "${lang}" at ${new Date().toISOString()}`);

  // 1. Validate Parsed Reference Input
  if (!parsedRef || parsedRef.bookNumber === null) {
    console.error(`[JW.org API - Local] Invalid parsedRef provided to fetchVerseLocally: bookNumber is null. Ref:`, parsedRef);
    throw new Error(`Cannot fetch locally without a valid book identified.`);
  }
  // We also need chapter and startVerse, even if defaulted later
  if (parsedRef.chapter === null || parsedRef.startVerse === null) {
      console.log(`[JW.org API - Local] Partial reference (book only) detected. Defaulting to chapter 1, verse 1.`);
  }
  
  // 2. Determine Chapter and Verse(s)
  const { bookNumber, bookName } = parsedRef; // bookNumber is guaranteed non-null here
  const chapterToFetch = parsedRef.chapter ?? 1; 
  const startVerseToFetch = parsedRef.startVerse ?? 1; 
  const endVerseToFetch = parsedRef.endVerse; // Might be undefined

  // Determine if it's a range query
  const isRange = endVerseToFetch !== undefined && endVerseToFetch > startVerseToFetch;
  
  console.log(`[JW.org API - Local] Using Book: "${bookName}" (#${bookNumber}), Chapter: ${chapterToFetch}, StartVerse: ${startVerseToFetch}${isRange ? ", EndVerse: " + endVerseToFetch : ""}`);

  // 3. Fetch from Cache/Network (Load data if needed)
  // Ensure data is loaded before proceeding
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
        verseDataCache[lang] = null; 
        throw fetchError; 
    } finally {
         isLoadingCache[lang] = false;
    }
  } else if (isLoadingCache[lang]) {
      console.log(`[JW.org API - Local] Waiting for ongoing fetch for ${lang}...`);
      await new Promise<void>(resolve => {
          const interval = setInterval(() => {
              if (!isLoadingCache[lang]) {
                  clearInterval(interval);
                  resolve();
              }
          }, 100); 
      });
       console.log(`[JW.org API - Local] Ongoing fetch for ${lang} completed.`);
  }

  const cachedVerseData = verseDataCache[lang];
  if (!cachedVerseData) {
       throw new Error(`Verse data for language '${lang}' is not available after fetch attempt.`);
  }

  // 4. Generate Verse ID(s) and Fetch Text(s)
  let combinedVerseText = '';
  const versesFound: string[] = [];
  let firstVerseId = '';

  try {
    if (isRange && endVerseToFetch) { // Handle range
      console.log(`[JW.org API - Local] Fetching range: ${startVerseToFetch} - ${endVerseToFetch}`);
      for (let v = startVerseToFetch; v <= endVerseToFetch; v++) {
        const verseId = createVerseId(bookNumber, chapterToFetch, v);
        if (!firstVerseId) firstVerseId = verseId; // Store first ID for logging
        const verseText = cachedVerseData[verseId];
        if (verseText !== undefined) {
          versesFound.push(verseText);
        } else {
          console.warn(`[JW.org API - Local] Verse ID "${verseId}" (part of range) not found in ${lang} data for reference: ${bookName} ${chapterToFetch}:${v}`);
          // Optionally, insert a placeholder or skip
          // versesFound.push(`[Verse ${v} not found]`); 
        }
      }
      combinedVerseText = versesFound.join(' '); // Join verses with a space
      if (versesFound.length === 0) {
          throw new Error(`None of the verses in the range ${startVerseToFetch}-${endVerseToFetch} were found for book '${bookName}' chapter ${chapterToFetch} in the ${lang} data.`);
      }

    } else { // Handle single verse
      const verseId = createVerseId(bookNumber, chapterToFetch, startVerseToFetch);
      firstVerseId = verseId;
      const verseText = cachedVerseData[verseId];
      if (verseText === undefined) {
        console.error(`[JW.org API - Local] Verse ID "${verseId}" not found in ${lang} data for reference: ${bookName} ${chapterToFetch}:${startVerseToFetch}`);
        throw new Error(`Verse ${chapterToFetch}:${startVerseToFetch} not found for book '${bookName}' in the ${lang} data.`);
      }
      combinedVerseText = verseText;
    }

    console.log(`[JW.org API - Local] Found text for ID(s) starting with ${firstVerseId} (${combinedVerseText.length} chars)`);
    const endTime = Date.now();
    console.log(`[JW.org API - Local] Fetch operation took ${(endTime - startTime) / 1000} seconds.`);

    // 5. Return Result
    return {
      text: combinedVerseText,
      matchedBookName: bookName,
      matchedBookNumber: bookNumber,
      requestedChapter: chapterToFetch,
      requestedVerse: startVerseToFetch,
      // Include end verse only if it was a valid range
      requestedEndVerse: isRange ? endVerseToFetch : undefined, 
    };

  } catch (error: any) {
    console.error(`[JW.org API - Local] Error during local fetch for ${bookName} ${chapterToFetch}:${startVerseToFetch}${isRange ? '-'+endVerseToFetch : ''}:`, error);
    throw new Error(`Failed to fetch verse locally: ${error.message || 'Unknown error'}`);
  }
}

// Keep existing bibleApi functions if they are still needed for other Bible versions
// ... (searchBibleVerses, searchVerse, searchBook, getBibleVerse, getAvailableBibles) ...