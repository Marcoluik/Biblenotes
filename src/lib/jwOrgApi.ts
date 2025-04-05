import axios from 'axios';

// Basic mapping from common English book names/abbreviations to JW.ORG numbers
// NOTE: This is incomplete and might need significant expansion/refinement
const bookNameToNumberMap: { [key: string]: number } = {
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
  // NT
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
  'james': 59, 'jas': 59, 'jmp': 59, // jmp might be needed based on query format
  '1 peter': 60, '1 pet': 60, '1pe': 60,
  '2 peter': 61, '2 pet': 61, '2pe': 61,
  '1 john': 62, '1 joh': 62, '1jn': 62,
  '2 john': 63, '2 joh': 63, '2jn': 63,
  '3 john': 64, '3 joh': 64, '3jn': 64,
  'jude': 65, 'jud': 65,
  'revelation': 66, 'rev': 66, 're': 66,
  // Add more books and potential abbreviations as needed
};

/**
 * Parses a Bible reference string (e.g., "Genesis 1:1", "1 Cor 13:4-7")
 * Returns an object with bookName, chapter, startVerse, and endVerse.
 * NOTE: Very basic parsing, assumes standard formats.
 */
function parseReference(reference: string): { bookName: string; chapter: number; startVerse: number; endVerse?: number } | null {
  reference = reference.trim().toLowerCase();
  // Regex to capture book name (potentially multi-word), chapter, start verse, and optional end verse
  // Allows for space or no space before chapter, colon separating chapter/verse, hyphen for range
  const match = reference.match(/^([1-3]?\s?[a-z]+(?:\s+[a-z]+)*)\s?(\d+):(\d+)(?:-(\d+))?$/);

  if (!match) {
    console.warn(`Could not parse reference: ${reference}`);
    return null;
  }

  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : undefined;

  if (isNaN(chapter) || isNaN(startVerse) || (endVerse !== undefined && isNaN(endVerse))) {
    console.warn(`Invalid numbers in parsed reference: ${reference}`);
    return null;
  }

  return { bookName, chapter, startVerse, endVerse };
}

/**
 * Creates the numerical ID used by the JW.ORG JSON URL.
 * Example: Genesis 1:1 -> 1001001
 */
function createVerseId(bookNumber: number, chapter: number, verse: number): string {
  const bookStr = bookNumber.toString();
  const chapterStr = chapter.toString().padStart(3, '0');
  const verseStr = verse.toString().padStart(3, '0');
  return `${bookStr}${chapterStr}${verseStr}`;
}

/**
 * Fetches a SINGLE Bible verse by calling the backend proxy which
 * in turn calls the undocumented JW.ORG JSON source.
 *
 * @param reference Standard Bible reference (e.g., "John 3:16")
 * @returns The cleaned verse text from the backend or null if not found/error.
 */
export async function fetchVerseFromJwOrg(reference: string): Promise<string | null> {
  console.log(`Requesting NWT verse from backend proxy: ${reference}`);
  
  // URL of your backend proxy endpoint
  // Make sure the port matches your running server.js (default is 3000)
  const proxyUrl = `http://localhost:3000/nwt-verse`; 

  try {
    const response = await axios.get(proxyUrl, {
      params: {
        ref: reference // Pass reference as a query parameter
      },
      timeout: 10000 // Longer timeout for potentially slow proxy + external fetch
    });

    if (response.status === 200 && response.data?.text) {
      console.log(`Received text from proxy for ${reference}:`, response.data.text);
      return response.data.text; // Return the text sent by the backend
    } else {
      console.error(`Proxy returned an unexpected response for ${reference}:`, response.data);
      return null;
    }

  } catch (error: any) {
    // Handle errors calling the backend proxy
    if (axios.isAxiosError(error)) {
      console.error(`Error calling backend proxy for ${reference}: ${error.message}`);
      if (error.response) {
        console.error('Proxy Response Status:', error.response.status);
        console.error('Proxy Response Data:', error.response.data);
      } else {
        console.error('No response received from proxy (is server.js running?)');
      }
    } else {
      console.error(`Unexpected error calling backend proxy for ${reference}:`, error);
    }
    return null;
  }
}

// Example usage (for testing):
// fetchVerseFromJwOrg("Genesis 1:1").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Matthew 20:28").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Exodus 1:1").then(text => console.log("Test Result:", text)); 