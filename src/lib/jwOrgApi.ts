import axios from 'axios';

/**
 * Fetches a SINGLE Bible verse by calling the backend proxy which
 * in turn calls the undocumented JW.ORG JSON source.
 *
 * @param reference Standard Bible reference (e.g., "John 3:16")
 * @param bibleId The bible ID string (e.g., 'nwtsty-en', 'nwtsty-da') used to determine the language.
 * @returns The cleaned verse text from the backend or null if not found/error.
 */
export async function fetchVerseFromJwOrg(reference: string, bibleId: string = 'nwt'): Promise<string> {
  const startTime = Date.now();
  console.log(`[JW.org API] Starting fetch for reference: "${reference}", bibleId: "${bibleId}" at ${new Date().toISOString()}`);
  
  // Determine if this is a Danish request
  const isDanish = bibleId.includes('da');
  console.log(`[JW.org API] Request is for ${isDanish ? 'Danish' : 'English'} language`);
  
  try {
    // Determine language from bibleId
    const lang = isDanish ? 'da' : 'en';
    console.log(`[JW.org API] Using language: "${lang}" for bibleId: "${bibleId}"`);
    
    // Construct the proxy URL
    const proxyUrl = `/.netlify/functions/nwt-proxy?ref=${encodeURIComponent(reference)}&lang=${lang}`;
    console.log(`[JW.org API] Constructed proxy URL: ${proxyUrl}`);
    
    // Log request details
    console.log(`[JW.org API] Sending request to Netlify Function at ${new Date().toISOString()}`);
    const requestStartTime = Date.now();
    
    // Make the request with appropriate timeout based on language
    const response = await axios.get(proxyUrl, {
      timeout: isDanish ? 20000 : 15000, // 20 seconds for Danish, 15 for English
      // Add retry logic on the frontend as well
      validateStatus: (status) => status < 500, // Don't reject for 4xx errors
    });
    
    const requestDuration = (Date.now() - requestStartTime) / 1000;
    console.log(`[JW.org API] Request completed in ${requestDuration} seconds`);
    console.log(`[JW.org API] Response status: ${response.status}`);
    console.log(`[JW.org API] Response headers:`, response.headers);
    
    // Check if we have text in the response
    if (response.data?.text) {
      console.log(`[JW.org API] Successfully received verse text (${response.data.text.length} characters)`);
      if (response.data.cached) {
        console.log(`[JW.org API] Response was served from cache`);
      }
      if (response.data.retried) {
        console.log(`[JW.org API] Response was retrieved after a retry`);
      }
      console.log(`[JW.org API] Total operation completed in ${(Date.now() - startTime) / 1000} seconds`);
      return response.data.text;
    } else {
      console.error(`[JW.org API] No verse text found in response:`, response.data);
      throw new Error('No verse text found in response');
    }
  } catch (error: any) {
    console.error(`[JW.org API] Error fetching verse:`, error);
    
    // Log detailed error information
    if (axios.isAxiosError(error)) {
      console.error(`[JW.org API] Axios error details:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          headers: error.config?.headers
        }
      });
      
      // Check if we have a response with an error message
      if (error.response?.data?.error) {
        throw new Error(`Failed to fetch verse: ${error.response.data.error}`);
      }
    } else {
      console.error(`[JW.org API] Non-Axios error:`, error);
    }
    
    // Handle timeout specifically
    if (error.response?.status === 504 || error.response?.data?.timeout || error.code === 'ECONNABORTED') {
      console.error(`[JW.org API] Timeout error detected`);
      
      // For Danish verses, provide a more specific message
      if (isDanish) {
        throw new Error('The Danish Bible verse request is taking longer than expected. Please try again in a moment.');
      } else {
        throw new Error('Request timed out while fetching verse. Please try again.');
      }
    }
    
    // Handle other errors
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
    console.error(`[JW.org API] Throwing error: ${errorMessage}`);
    throw new Error(`Failed to fetch verse: ${errorMessage}`);
  } finally {
    console.log(`[JW.org API] Operation completed in ${(Date.now() - startTime) / 1000} seconds`);
  }
}

// Example usage (for testing):
// fetchVerseFromJwOrg("Genesis 1:1").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Matthew 20:28").then(text => console.log("Test Result:", text));
// fetchVerseFromJwOrg("Exodus 1:1").then(text => console.log("Test Result:", text)); 