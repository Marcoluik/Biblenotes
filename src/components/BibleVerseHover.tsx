import React, { useState, useEffect, useRef } from 'react';
import { searchBibleVerses } from '../lib/bibleApi';

interface BibleVerseHoverProps {
  reference: string;
  bibleId?: string;
}

export const BibleVerseHover: React.FC<BibleVerseHoverProps> = ({ reference, bibleId }) => {
  const [verseContent, setVerseContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchVerse = async () => {
      if (!reference || (!isHovered && !isExpanded)) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const verses = await searchBibleVerses(reference, bibleId);
        
        if (isMounted) {
          if (verses && verses.length > 0) {
            const cleanedContent = verses[0].content || verses[0].text || '';
            setVerseContent(cleanedContent);
          } else {
            setError('Verse not found');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching verse:', err);
          setError('Failed to load verse');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (isHovered || isExpanded) {
      fetchVerse();
    }

    return () => {
      isMounted = false;
    };
  }, [reference, isHovered, isExpanded, bibleId]);

  // Handle clicks outside the component to close the expanded view
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <span 
      ref={containerRef}
      className="inline-block relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isExpanded) {
          setVerseContent(null);
          setError(null);
        }
      }}
    >
      <span 
        className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md cursor-pointer hover:bg-blue-200 transition-colors"
        onClick={handleToggle}
        onTouchStart={handleToggle}
      >
        {reference}
      </span>
      
      {(isHovered || isExpanded) && (
        <div className="absolute left-0 top-full mt-1 z-10 w-80 p-3 bg-white border rounded-lg shadow-lg">
          {isLoading && (
            <div className="text-sm text-gray-500 flex items-center space-x-2">
              <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading verse...</span>
            </div>
          )}
          
          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}
          
          {verseContent && (
            <div className="text-sm leading-relaxed">{verseContent}</div>
          )}
          
          {isExpanded && (
            <button 
              className="mt-2 text-xs text-blue-500 hover:text-blue-700"
              onClick={handleToggle}
            >
              Close
            </button>
          )}
        </div>
      )}
    </span>
  );
}; 