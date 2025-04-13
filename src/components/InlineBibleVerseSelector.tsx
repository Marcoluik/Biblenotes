import React, { useState, useEffect, useRef } from 'react';
import { fetchVerseLocally, parseReference, findCanonicalBookName, LocalVerseResult } from '../lib/jwOrgApi';
import { searchBibleVerses } from '../lib/bibleApi';
import { BibleVerse, ParsedReference } from '../types';
import { SupportedLanguage } from '../lib/constants';

interface InlineBibleVerseSelectorProps {
  onInsertVerse: (reference: string, verseContent: string) => void;
  onClose: () => void;
  bibleId?: string;
}

const shouldUseLocalSource = (bibleId?: string): boolean => {
  if (!bibleId) return true;
  return bibleId.toLowerCase().startsWith('nwt') || bibleId === 'en' || bibleId === 'da';
};

const getLanguageFromBibleId = (bibleId?: string): SupportedLanguage => {
  if (bibleId?.toLowerCase().includes('da')) return 'da';
  return 'en';
};

export const InlineBibleVerseSelector: React.FC<InlineBibleVerseSelectorProps> = ({ 
  onInsertVerse, 
  onClose,
  bibleId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localMatchedBookName, setLocalMatchedBookName] = useState<string | null>(null);
  const [localInputBookName, setLocalInputBookName] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if (searchTerm.length < 3) {
      setVerses([]);
      setSelectedVerse(null);
      setErrorMsg(null);
      setLocalMatchedBookName(null);
      setLocalInputBookName(null);
    }
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      if (searchTerm.length < 3) {
        return;
      }

      const useLocal = shouldUseLocalSource(bibleId);
      const language = getLanguageFromBibleId(bibleId);
      let parsedRef: ParsedReference | null = null;
      let partialMatchBookName: string | null = null;

      if (useLocal) {
        parsedRef = parseReference(searchTerm, language);
        console.log(`[Selector] Local parse attempt for "${searchTerm}" (lang: ${language}):`, parsedRef);
        
        if (parsedRef && parsedRef.chapter === null) {
            partialMatchBookName = parsedRef.bookName;
            console.log(`[Selector] Partial match found for book: "${partialMatchBookName}"`);
        }
      }
      
      let shouldFetch = false;
      if (useLocal && parsedRef) {
        shouldFetch = true;
        console.log('[Selector] Proceeding with local fetch (full or partial ref).');
      } else if (!useLocal) {
        shouldFetch = true;
        console.log('[Selector] Proceeding with API search.');
      } else {
        console.log('[Selector] Local source, parsing failed completely, not fetching.');
        setVerses([]);
        setSelectedVerse(null);
        setLocalMatchedBookName(null);
        setLocalInputBookName(null);
        setErrorMsg(null);
      }

      if (!shouldFetch) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      setVerses([]);
      setSelectedVerse(null);
      setLocalMatchedBookName(null);
      setLocalInputBookName(null);

      try {
        if (useLocal && parsedRef) {
          console.log(`[Selector] Using LOCAL source for bibleId: ${bibleId}, fetching based on parsedRef:`, parsedRef);
          
          const localResult: LocalVerseResult = await fetchVerseLocally(parsedRef, language);
          
          const { text, matchedBookName, requestedChapter, requestedVerse, requestedEndVerse } = localResult;
          
          let displayReference = `${matchedBookName} ${requestedChapter}:${requestedVerse}`;
          if (requestedEndVerse) {
              displayReference += `-${requestedEndVerse}`;
              console.log(`[Selector] Local fetch returned a range: ${displayReference}`);
          } else if (partialMatchBookName) {
              console.log(`[Selector] Original input "${searchTerm}" resulted in partial match default: ${displayReference}`);
          } else {
              console.log(`[Selector] Local fetch returned single verse: ${displayReference}`);
          }
                    
          const resultVerse: BibleVerse = {
              id: `${language}-${matchedBookName}-${requestedChapter}-${requestedVerse}${requestedEndVerse ? '-' + requestedEndVerse : ''}`,
              reference: displayReference,
              content: text,
              text: text,
            };
            
          console.log('[Selector] Local verse found, attempting to set state:', resultVerse);
          setVerses([resultVerse]);
          setSelectedVerse(resultVerse);
          setLocalMatchedBookName(matchedBookName);
          if (searchTerm.trim().toLowerCase() !== matchedBookName.toLowerCase()) {
              setLocalInputBookName(searchTerm.trim()); 
          } else {
              setLocalInputBookName(null);
          }
          console.log('[Selector] State update calls completed for local result.');
        } else if (!useLocal) {
          console.log(`[Selector] Using API source for bibleId: ${bibleId}, term: ${searchTerm}`);
          const results = await searchBibleVerses(searchTerm, bibleId);
          console.log('[Selector] API search results received, attempting to set state:', results);
          setVerses(results);
          if (results.length > 0) {
             console.log('[Selector] State update calls completed for API result.');
          } else {
             console.log('[Selector] API: No verses found, state not updated.');
          }
        } 
      } catch (error: any) {
        console.error('[Selector] Error during fetch/search:', error);
        const message = error.message || 'Could not find verse.';
        if ((useLocal && parsedRef) || !useLocal) {
            setErrorMsg(`Error: ${message}`);
        }
        setVerses([]); 
        setSelectedVerse(null); 
        setLocalMatchedBookName(null); 
        setLocalInputBookName(null);
        console.log('[Selector] State cleared due to error.');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, 500); 
    return () => clearTimeout(timeoutId);
  }, [searchTerm, bibleId]);

  const handleVerseSelect = (verse: BibleVerse) => {
    console.log('[Selector] Selected verse:', verse);
    setSelectedVerse(verse);
  };

  const handleInsert = () => {
    if (selectedVerse) {
      const content = selectedVerse.content || selectedVerse.text || '';
      console.log('[Selector] Inserting verse:', {
        reference: selectedVerse.reference,
        content
      });
      onInsertVerse(selectedVerse.reference, content);
      onClose();
    }
  };

  console.log('[Selector Render] State values:', { loading, verses, selectedVerse, errorMsg, localMatchedBookName, localInputBookName });

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Insert Bible Verse (Source: {shouldUseLocalSource(bibleId) ? 'Local' : 'API'} {bibleId ? ` - ${bibleId}` : ''})</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={shouldUseLocalSource(bibleId) 
                           ? "Type exact verse (e.g., John 3:16)"
                           : "Search verse or book (e.g., John 3:16)"}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : verses.length > 0 ? (
          <div className="max-h-60 overflow-y-auto mb-4">
            {(() => { console.log('[Selector Render] Rendering verse list, count:', verses.length); return null; })()}
            {verses.map((verse) => {
              const isLocalCorrection = shouldUseLocalSource(bibleId) && 
                                        localMatchedBookName && 
                                        localInputBookName;
              
              let displayReference = verse.reference;
              if (isLocalCorrection && localMatchedBookName && verse.reference.startsWith(localMatchedBookName)) {
                const versePartMatch = verse.reference.substring(localMatchedBookName.length).trim();
                displayReference = `${localInputBookName} (${localMatchedBookName}) ${versePartMatch}`.trim();
                 console.log(`[Selector Render] Corrected display ref for fuzzy match: "${displayReference}"`);
              }
              
              console.log(`[Selector Render] Mapping verse: ${verse.id}, Final DisplayRef: ${displayReference}, isLocalCorrection: ${isLocalCorrection}`);

              return (
                <div
                  key={verse.id}
                  className={`p-2 mb-2 rounded cursor-pointer ${
                    selectedVerse?.id === verse.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleVerseSelect(verse)}
                >
                  <div className="font-semibold">{displayReference}</div>
                  <div className="text-sm text-gray-700">
                    {verse.content || verse.text || 'No content available'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : errorMsg ? (
           <div className="text-center py-4 text-red-600">
            {(() => { console.log('[Selector Render] Rendering error message:', errorMsg); return null; })()}
            {errorMsg}
          </div>
        ) : !loading && verses.length === 0 && searchTerm.length >= 3 ? (
           <div className="text-center py-4 text-gray-500">
             {(() => { console.log('[Selector Render] Rendering no results/prompt message.'); return null; })()}
             {shouldUseLocalSource(bibleId) && !parseReference(searchTerm, getLanguageFromBibleId(bibleId))
               ? "Type an exact reference (e.g., John 3:16 or 1 Mos 1:1)" 
               : "No results found."}
           </div>
        ) : null}
        
        <div className="flex justify-end">
          <button
            onClick={handleInsert}
            disabled={!selectedVerse || loading}
            className={`px-4 py-2 rounded ${
              selectedVerse && !loading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Insert Verse
          </button>
        </div>
      </div>
    </div>
  );
}; 