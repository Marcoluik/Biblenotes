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
  console.log(`Requesting NWT verse from backend proxy: ${reference} for bibleId: ${bibleId}`);
  
  // Extract language code from bibleId (e.g., 'nwtsty-en' -> 'en')
  // Default to 'en' if format is unexpected
  const langMatch = bibleId.match(/nwtsty-(\w+)/);
  const lang = langMatch ? langMatch[1] : 'en';
  
  const proxyUrl = `http://localhost:3000/nwt-verse`; 

  try {
    const response = await axios.get(proxyUrl, {
      params: {
        ref: reference, // Pass reference
        lang: lang      // Pass extracted language code
      },
      timeout: 10000 
    });

    if (response.status === 200 && response.data?.text) {
      console.log(`Received text from proxy for ${reference} (${lang}):`, response.data.text);
      return response.data.text;
    } else {
      console.error(`Proxy returned an unexpected response for ${reference} (${lang}):`, response.data);
      return null;
    }

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(`Error calling backend proxy for ${reference} (${lang}): ${error.message}`);
      if (error.response) {
        console.error(`Proxy Response Status (${lang}):`, error.response.status);
        console.error(`Proxy Response Data (${lang}):`, error.response.data);
      } else {
        console.error(`No response received from proxy (is server.js running?) for ${lang}`);
      }
    } else {
      console.error(`Unexpected error calling backend proxy for ${reference} (${lang}):`, error);
    }
    return null;
  }
}

// Example usage (for testing):
// fetchVerseFromJwOrg("Genesis 1:1").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Matthew 20:28").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Exodus 1:1").then(text => console.log("Test Result:", text)); 