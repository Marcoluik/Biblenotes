import axios from 'axios';
import { BibleVerse } from '../types';
import { 
    parseReference, 
    createVerseId, 
    bookNameToNumberMap, 
    fuse, 
    fuseOptions 
} from './bibleUtils'; 
import { fetchVerseLocally, fetchVerseFromJwOrg } from './jwOrgApi'; // Import NWT fetchers

// Export the BibleVerse type for use in other files
export type { BibleVerse };

// Get environment variables with fallbacks
const API_KEY = import.meta.env.VITE_BIBLE_API_KEY || '541f6e15fa999cbd8f8c593ca4186332';
const BIBLE_ID = import.meta.env.VITE_BIBLE_ID || 'de4e12af7f28f599-02'; // KJV Bible ID
const BASE_URL = 'https://api.scripture.api.bible/v1';

// Log the configuration for debugging
console.log('Bible API Configuration:', {
  apiKey: API_KEY ? 'Present' : 'Missing',
  bibleId: BIBLE_ID || 'Missing',
  baseUrl: BASE_URL
});

// Helper function to clean HTML content from Bible verses
const cleanHtmlContent = (htmlContent: string): string => {
  if (!htmlContent) return '';
  
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // Get the text content
  let textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  // Clean up extra whitespace
  textContent = textContent.replace(/\s+/g, ' ').trim();
  
  return textContent;
};

// Function to search for Bible verses
export async function searchBibleVerses(query: string, bibleId?: string): Promise<BibleVerse[]> {
  // Explicitly log the received bibleId
  console.log(`🔍 searchBibleVerses | Query: "${query}", Received Bible ID: "${bibleId}", Default Bible ID: "${BIBLE_ID}"`);

  // --- NWT Handling (Local or Proxy) ---
  if (bibleId && (bibleId.startsWith('nwt-local-') || bibleId.startsWith('nwtsty-'))) {
    console.log(`[NWT Search] Detected NWT Bible ID: ${bibleId}. Attempting reference parse.`);
    const parsedRef = parseReference(query); // Use imported helper

    if (parsedRef) {
      console.log(`[NWT Search] Parsed as reference:`, parsedRef);
      const targetReference = `${parsedRef.bookName} ${parsedRef.chapter}:${parsedRef.startVerse}`;
      // TODO: Handle verse ranges if parseReference supports endVerse and fetchers support it
      
      try {
        let verseText: string | null = null;
        let source: string = '';

        if (bibleId.startsWith('nwt-local-')) {
          const lang = bibleId.endsWith('-da') ? 'da' : 'en';
          source = `local (${lang})`;
          verseText = await fetchVerseLocally(targetReference, lang);
        } else { // nwtsty-
           source = 'proxy';
           // Pass the full bibleId (e.g., nwtsty-da) to the proxy fetcher
           verseText = await fetchVerseFromJwOrg(targetReference, bibleId); 
        }

        if (verseText) {
          // --- Look up book number for ID creation ---
          let bookNumberForId: number | undefined = bookNameToNumberMap[parsedRef.bookName];
          if (bookNumberForId === undefined) {
              // Attempt fuzzy match again just for ID creation if needed
              const fuseResults = fuse.search(parsedRef.bookName);
              if (fuseResults.length > 0 && fuseResults[0].score !== undefined && fuseResults[0].score <= fuseOptions.threshold) {
                 const bestMatch = fuseResults[0].item;
                 bookNumberForId = bookNameToNumberMap[bestMatch];
              }
          }
          if (bookNumberForId === undefined) {
             console.error(`[NWT Search] Could not determine book number for "${parsedRef.bookName}" to create verse ID.`);
             // Fallback or skip ID creation? Let's use a placeholder
             bookNumberForId = 0; 
          }
          // --- End book number lookup ---
          
          // Construct a BibleVerse object similar to the external API format
          const verseResult: BibleVerse = {
            id: createVerseId(bookNumberForId, parsedRef.chapter, parsedRef.startVerse), // Use looked-up number
            reference: targetReference, // Use the parsed reference
            content: verseText,
            text: verseText, // Use same text for both
            // bookId, chapterId, verseCount etc. might be missing or need defaults
          };
          console.log(`[NWT Search] Success using ${source} fetch. Result:`, verseResult);
          return [verseResult]; // Return as an array
        } else {
          console.log(`[NWT Search] Fetch via ${source} returned no text for ${targetReference}.`);
          return [];
        }
      } catch (error) {
        console.error(`[NWT Search] Error fetching NWT verse for "${targetReference}" using ID ${bibleId}:`, error);
        return []; // Return empty on error
      }

    } else {
      // Query is not a specific reference, try fuzzy matching book names/abbrs
      console.log(`[NWT Search] Query "${query}" did not parse as a specific reference. Trying fuzzy book match...`);
      const fuseResults = fuse.search(query);
      console.log(`[NWT Search] Fuse results for book match:`, fuseResults);
      
      // Map top results (e.g., score < 0.5) to BibleVerse-like objects
      const bookMatches: BibleVerse[] = fuseResults
        .filter(result => result.score !== undefined && result.score <= (fuseOptions.threshold + 0.1)) // Be slightly more lenient than threshold? Or use fuseOptions.threshold
        .slice(0, 5) // Limit to top 5 matches
        .map((result, index) => ({
          id: `bookmatch-${index}-${result.item}`, // Simple unique ID
          reference: result.item, // Show the matched book/abbr name
          content: 'Book/Abbreviation match', // Indicate it's not a verse
          text: '' // No verse text
        }));

      console.log(`[NWT Search] Formatted book matches:`, bookMatches);
      return bookMatches; 
    }
  }
  // --- END NWT Handling ---

  // --- Original External API Logic ---
  console.log(`[External Search] Proceeding with external API call. Bible ID received: "${bibleId}", Default used: "${BIBLE_ID}"`);
  console.log(`[External Search] Using scripture.api.bible for bibleId: "${bibleId || BIBLE_ID}"`);
  try {
    // Check if the query contains numbers (for verse/chapter searches)
    const hasNumbers = /\d/.test(query);
    
    // Use the provided bibleId or fall back to the default
    const id = bibleId || BIBLE_ID;
    
    // Always use the search endpoint for all queries
    const response = await axios.get(`${BASE_URL}/bibles/${id}/search`, {
      headers: {
        'api-key': API_KEY
      },
      params: {
        query,
        limit: 10
      }
    });

    console.log('📥 Raw API response:', response.data);

    // Handle different response structures based on query type
    if (hasNumbers) {
      // For verse/chapter searches (with numbers)
      if (!response.data?.data?.passages || response.data.data.passages.length === 0) {
        console.log('❌ No passages found in response');
        return [];
      }

      // Extract verses from the passages
      const verses: BibleVerse[] = [];
      
      response.data.data.passages.forEach((passage: any) => {
        // Create a verse from the passage
        verses.push({
          id: passage.id,
          reference: passage.reference,
          content: cleanHtmlContent(passage.content || ''),
          text: cleanHtmlContent(passage.content || '')
        });
      });

      console.log('✅ Processed verses from passages:', verses);
      return verses;
    } else {
      // For book searches (no numbers)
      if (!response.data?.data?.verses || response.data.data.verses.length === 0) {
        console.log('❌ No verses found in response');
        return [];
      }

      // Extract verses from the response
      const verses = response.data.data.verses.map((verse: any) => ({
        id: verse.id,
        reference: verse.reference,
        content: cleanHtmlContent(verse.content || verse.text || ''),
        text: cleanHtmlContent(verse.text || verse.content || '')
      }));

      console.log('✅ Processed verses from verses array:', verses);
      return verses;
    }
  } catch (error: any) {
    console.error('💥 Error searching verses:', {
      error,
      query,
      response: error.response?.data
    });
    return [];
  }
}

// Function to search for verses by reference
export const searchVerse = async (reference: string, bibleId?: string): Promise<BibleVerse[]> => {
  try {
    // Use the provided bibleId or fall back to the default
    const id = bibleId || BIBLE_ID;
    
    const response = await axios.get(`${BASE_URL}/bibles/${id}/search`, {
      headers: {
        'api-key': API_KEY,
      },
      params: {
        query: reference,
        limit: 1,
      },
    });

    if (response.data && response.data.data && response.data.data.verses) {
      // Clean the HTML content from each verse
      return response.data.data.verses.map((verse: BibleVerse) => ({
        ...verse,
        content: cleanHtmlContent(verse.content || ''),
        text: cleanHtmlContent(verse.text || ''),
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching for verse:', error);
    throw error;
  }
};

// Function to search for verses by book
export const searchBook = async (book: string, bibleId?: string): Promise<BibleVerse[]> => {
  try {
    // Use the provided bibleId or fall back to the default
    const id = bibleId || BIBLE_ID;
    
    const response = await axios.get(`${BASE_URL}/bibles/${id}/search`, {
      headers: {
        'api-key': API_KEY,
      },
      params: {
        query: book,
        limit: 10,
      },
    });

    if (response.data && response.data.data && response.data.data.verses) {
      // Clean the HTML content from each verse
      return response.data.data.verses.map((verse: BibleVerse) => ({
        ...verse,
        content: cleanHtmlContent(verse.content || ''),
        text: cleanHtmlContent(verse.text || ''),
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching for book:', error);
    throw error;
  }
};

// Function to get a specific verse by reference
export const getBibleVerse = async (reference: string, bibleId?: string): Promise<BibleVerse | null> => {
  try {
    // Use the provided bibleId or fall back to the default
    const id = bibleId || BIBLE_ID;
    
    const response = await axios.get(`${BASE_URL}/bibles/${id}/verses/${reference}`, {
      headers: {
        'api-key': API_KEY,
      },
    });
    
    if (!response.data?.data) {
      return null;
    }
    
    const verse = response.data.data;
    return {
      ...verse,
      content: cleanHtmlContent(verse.content || ''),
      text: cleanHtmlContent(verse.text || ''),
    };
  } catch (error) {
    console.error('Error getting Bible verse:', error);
    throw error;
  }
};

// Function to get available Bibles
export const getAvailableBibles = async (): Promise<{ id: string; name: string; language: { id: string; name: string } }[]> => {
  try {
    console.log('Fetching available Bibles...');
    const response = await axios.get(`${BASE_URL}/bibles`, {
      headers: {
        'api-key': API_KEY,
      }
    });
    
    console.log('Bible API Response:', response.data);
    
    if (!response.data?.data) {
      console.log('No data in response');
      return [];
    }
    
    const bibles = response.data.data.map((bible: any) => ({
      id: bible.id,
      name: bible.name,
      language: {
        id: bible.language.id,
        name: bible.language.name
      }
    }));
    
    console.log('Processed Bibles:', bibles);
    return bibles;
  } catch (error) {
    console.error('Error getting available Bibles:', error);
    return [];
  }
}; 