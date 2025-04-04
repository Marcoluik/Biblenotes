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
    if (isHovered && triggerRef.current && containerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect(); // Parent is position: relative

      // Calculate position relative to the container element
      // Place the top of the popup at the bottom of the trigger
      let top = triggerRect.height; // Start right below the trigger, within the container's coord system
      let left = triggerRect.left - containerRect.left; // Align left edges

      // --- Simplified Viewport Adjustments ---
      // We still need some basic checks, but let's simplify them drastically.
      // Note: These checks are still relative to the viewport, which might be the issue.
      // A more robust solution might need a library like Floating UI, but let's try this.

      const popupEstimatedHeight = 200; // Use a smaller estimate just in case
      const popupWidth = 320;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Check if it goes significantly off the bottom
      // triggerRect.bottom is viewport-relative position of trigger's bottom
      if (triggerRect.bottom + popupEstimatedHeight > viewportHeight) {
        // Position *above* the trigger instead: negative top relative to trigger's top
        top = -popupEstimatedHeight;
      }

      // Check if it goes off the right
      if (triggerRect.left + popupWidth > viewportWidth) {
        // Try to align the right edge of the popup with the right edge of the trigger
        left = (triggerRect.right - containerRect.left) - popupWidth;
      }

      // Check if it goes off the left
      if (triggerRect.left < 0) {
         // Align left edge of popup with left edge of container
         left = 0;
      }

      setPopupPosition({ top, left });
    } else {
      // Reset position when not hovered or refs aren't ready
      // This might help if there's a stale position calculation
      setPopupPosition({ top: 0, left: 0 });
    }
  }, [isHovered]); // Dependency array remains the same

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
        className={`absolute z-[100] w-80 max-h-96 overflow-y-auto p-3 bg-white border rounded-lg shadow-lg transition-all duration-200 ease-in-out ${
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