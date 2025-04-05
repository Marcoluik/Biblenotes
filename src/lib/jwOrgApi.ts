import axios from 'axios';

/**
 * Fetches a SINGLE Bible verse by calling the backend proxy which
 * in turn calls the undocumented JW.ORG JSON source.
 *
 * @param reference Standard Bible reference (e.g., "John 3:16")
 * @param bibleId The bible ID string (e.g., 'nwtsty-en', 'nwtsty-da') used to determine the language.
 * @returns The cleaned verse text from the backend or null if not found/error.
 */
export async function fetchVerseFromJwOrg(reference: string, bibleId: string = 'nwtsty-en'): Promise<string | null> {
  console.log(`Requesting NWT verse via Netlify Function: ${reference} for bibleId: ${bibleId}`);
  
  // Extract language code from bibleId (e.g., 'nwtsty-en' -> 'en')
  // Default to 'en' if format is unexpected
  const langMatch = bibleId.match(/nwtsty-(\w+)/);
  const lang = langMatch ? langMatch[1] : 'en';
  
  const proxyUrl = `/.netlify/functions/nwt-proxy`; 

  try {
    const response = await axios.get(proxyUrl, {
      params: {
        ref: reference, // Pass reference
        lang: lang      // Pass extracted language code
      },
      timeout: 15000 
    });

    if (response.status === 200 && response.data?.text) {
      console.log(`Received text from Netlify Function for ${reference} (${lang}):`, response.data.text);
      return response.data.text;
    } else {
      console.error(`Netlify Function returned an unexpected response for ${reference} (${lang}):`, response.data);
      return null;
    }

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(`Error calling Netlify Function for ${reference} (${lang}): ${error.message}`);
      if (error.response) {
        console.error(`Netlify Function Response Status (${lang}):`, error.response.status);
        console.error(`Netlify Function Response Data (${lang}):`, error.response.data);
      } else {
        console.error(`No response received from Netlify Function for ${lang}`);
      }
    } else {
      console.error(`Unexpected error calling Netlify Function for ${reference} (${lang}):`, error);
    }
    return null;
  }
}

// Example usage (for testing):
// fetchVerseFromJwOrg("Genesis 1:1").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Matthew 20:28").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Exodus 1:1").then(text => console.log("Test Result:", text)); 