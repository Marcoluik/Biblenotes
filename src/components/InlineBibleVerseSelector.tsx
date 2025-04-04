import React, { useState, useEffect, useRef } from 'react';
import { searchBibleVerses } from '../lib/bibleApi';
import { BibleVerse } from '../types';

interface InlineBibleVerseSelectorProps {
  onInsertVerse: (reference: string, verseContent: string) => void;
  onClose: () => void;
  bibleId?: string;
}

export const InlineBibleVerseSelector: React.FC<InlineBibleVerseSelectorProps> = ({ 
  onInsertVerse, 
  onClose,
  bibleId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
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
    const searchVerses = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      
      const cleanQuery = searchQuery.replace('@', '');
      
      console.log('🔎 Starting verse search with query:', cleanQuery);
      setIsLoading(true);
      
      try {
        console.log('📤 Sending search request...');
        const results = await searchBibleVerses(cleanQuery, bibleId);
        console.log('📦 Search results:', results);
        
        setSearchResults(results);
        if (results.length > 0) {
          console.log('✨ Auto-selecting first verse:', results[0]);
          setSelectedVerse(results[0]);
        } else {
          console.log('📭 No verses found for query:', cleanQuery);
        }
      } catch (error: any) {
        console.error('💥 Error in verse search:', {
          error,
          query: cleanQuery,
          errorMessage: error.message
        });
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    console.log('⏳ Debouncing search for query:', searchQuery);
    const timeoutId = setTimeout(searchVerses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, bibleId]);

  const handleVerseSelect = (verse: BibleVerse) => {
    console.log('🎯 Selected verse:', verse);
    setSelectedVerse(verse);
  };

  const handleInsert = () => {
    if (selectedVerse) {
      const content = selectedVerse.content || selectedVerse.text || '';
      console.log('📝 Inserting verse:', {
        reference: selectedVerse.reference,
        content
      });
      onInsertVerse(selectedVerse.reference, content);
      onClose();
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await searchBibleVerses(query, bibleId);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching for verses:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Insert Bible Verse</h3>
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a verse (e.g., John 3:16)"
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="max-h-60 overflow-y-auto mb-4">
            {searchResults.map((verse) => (
              <div
                key={verse.id}
                className={`p-2 mb-2 rounded cursor-pointer ${
                  selectedVerse?.id === verse.id ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'
                }`}
                onClick={() => handleVerseSelect(verse)}
              >
                <div className="font-semibold">{verse.reference}</div>
                <div className="text-sm text-gray-700">
                  {verse.content || verse.text || 'No content available'}
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.length >= 2 ? (
          <div className="text-center py-4 text-gray-500">
            Try searching for a book name (e.g., "John") or a specific verse (e.g., "John 3:16")
          </div>
        ) : null}
        
        <div className="flex justify-end">
          <button
            onClick={handleInsert}
            disabled={!selectedVerse}
            className={`px-4 py-2 rounded ${
              selectedVerse
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