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
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchVerse = async () => {
      if (!reference || !isHovered) return;
      
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

    if (isHovered) {
      fetchVerse();
    }

    return () => {
      isMounted = false;
    };
  }, [reference, isHovered, bibleId]);

  // Update popup position when hovered
  useEffect(() => {
    if (isHovered && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Calculate position to ensure popup is fully visible
      let top = rect.bottom + window.scrollY;
      let left = rect.left + window.scrollX;
      
      // Adjust if popup would go off the bottom of the screen
      if (top + 300 > window.scrollY + viewportHeight) {
        top = rect.top + window.scrollY - 300; // Position above the trigger
      }
      
      // Adjust if popup would go off the right of the screen
      if (left + 320 > window.scrollX + viewportWidth) {
        left = window.scrollX + viewportWidth - 340; // Position to the left
      }
      
      setPopupPosition({ top, left });
    }
  }, [isHovered]);

  return (
    <span 
      ref={containerRef}
      className="inline-block relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setVerseContent(null);
        setError(null);
      }}
    >
      <span 
        ref={triggerRef}
        className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md cursor-pointer hover:bg-blue-200 transition-colors"
      >
        {reference}
      </span>
      
      <div 
        className={`fixed z-[100] w-80 max-h-96 overflow-y-auto p-3 bg-white border rounded-lg shadow-lg transition-all duration-200 ease-in-out ${
          isHovered ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        style={{ 
          top: `${popupPosition.top}px`, 
          left: `${popupPosition.left}px` 
        }}
      >
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
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{verseContent}</div>
        )}
      </div>
    </span>
  );
}; 