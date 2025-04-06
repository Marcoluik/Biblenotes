import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchBibleVerses } from '../lib/bibleApi';
import { fetchVerseFromJwOrg, fetchVerseLocally } from '../lib/jwOrgApi';

interface BibleVerseHoverProps {
  reference: string;
  bibleId?: string;
}

export const BibleVerseHover: React.FC<BibleVerseHoverProps> = ({ reference, bibleId }) => {
  const [verseContent, setVerseContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [showPopup, setShowPopup] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
        top: rect.bottom + window.scrollY + 5, // Position below the element
        left: rect.left + window.scrollX
    });
    
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 500); // Delay before showing popup
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchVerse = async () => {
      if (!reference || !isHovered || !bibleId) { // Ensure bibleId is present
          // Optionally clear state if reference/hover changes while fetching is irrelevant
          // setVerseContent(null); setError(null); setIsLoading(false); setShowPopup(false);
          return;
      }
      
      setShowPopup(true);
      setIsLoading(true);
      setError(null);
      setVerseContent(null);
      
      console.log(`[Hover] Fetching verse: ${reference} with Bible ID: ${bibleId}`);

      try {
        let fetchedContent: string | null = null;
        
        // --- Logic to determine fetch method --- 
        if (bibleId.startsWith('nwt-local-')) {
            const lang = bibleId.endsWith('-da') ? 'da' : 'en';
            console.log(`[Hover] Using local fetch for lang: ${lang}`);
            fetchedContent = await fetchVerseLocally(reference, lang);
        } else if (bibleId.startsWith('nwtsty-')) {
            console.log(`[Hover] Using proxy fetch for bibleId: ${bibleId}`);
            fetchedContent = await fetchVerseFromJwOrg(reference, bibleId);
        } else {
            console.log(`[Hover] Using standard API fetch for bibleId: ${bibleId}`);
            // Assumes searchBibleVerses handles other Bible IDs via scripture.api.bible
            const verses = await searchBibleVerses(reference, bibleId);
            if (verses && verses.length > 0) {
              fetchedContent = verses[0].content || verses[0].text || '';
            } else {
                console.log(`[Hover] Standard API search returned no results for ${reference}`);
            }
        }
        // --- End Logic --- 
        
        if (isMounted) {
          if (fetchedContent !== null && fetchedContent.trim() !== '') {
            console.log(`[Hover] Successfully fetched content for ${reference}`);
            setVerseContent(fetchedContent);
          } else {
            console.warn(`[Hover] Verse not found or empty content for ${reference} using ID ${bibleId}`);
            setError('Verse not found or content is empty');
          }
        }
      } catch (err: any) { // Catch specific error type if possible
        if (isMounted) {
          console.error(`[Hover] Error fetching verse ${reference} using ID ${bibleId}:`, err);
          // Display a user-friendly message from the error if available
          setError(err.message || 'Failed to load verse'); 
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (isHovered) {
      fetchVerse();
    } else {
      // Reset state when not hovered
      setVerseContent(null);
      setError(null);
      setIsLoading(false);
      setShowPopup(false);
      setPopupPosition(null);
    }

    return () => {
      isMounted = false;
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [reference, isHovered, bibleId]); // Dependency array is correct

  useEffect(() => {
    if (isHovered && triggerRef.current) {
      const triggerEl = triggerRef.current;
      const triggerRect = triggerEl.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight; // Get height too
      const currentScrollY = window.scrollY;
      const currentScrollX = window.scrollX;
      const viewportPadding = 10;
      
      // Estimate based on current style, might need refinement
      const estimatedPopupWidth = Math.min(320, viewportWidth * 0.9); 
      // Estimate height too, although we don't adjust for it yet
      // const estimatedPopupHeight = 384; // From max-h-96 (24rem)
      
      let finalTop = triggerRect.bottom + currentScrollY + 5;
      let finalLeft = triggerRect.left + currentScrollX;

      // --- Start Debug Logging ---
      console.log('[Position Debug]', {
        triggerRect: JSON.parse(JSON.stringify(triggerRect)), // Log a plain object copy
        viewportWidth,
        viewportHeight,
        currentScrollY,
        currentScrollX,
        initialCalculatedTop: finalTop,
        initialCalculatedLeft: finalLeft,
      });
      // --- End Debug Logging ---

      let popupLeftViewport = finalLeft - currentScrollX;
      let popupRightViewport = popupLeftViewport + estimatedPopupWidth;

      if (popupRightViewport > viewportWidth - viewportPadding) {
        const overflowRight = popupRightViewport - (viewportWidth - viewportPadding);
        const newLeftViewport = popupLeftViewport - overflowRight;
        finalLeft = newLeftViewport + currentScrollX;
        popupLeftViewport = newLeftViewport; 
        console.log(`[Position Debug] Adjusted LEFT for right overflow. New finalLeft: ${finalLeft}`);
      }

      if (popupLeftViewport < viewportPadding) {
        const overflowLeft = viewportPadding - popupLeftViewport;
        const newLeftViewport = popupLeftViewport + overflowLeft;
        finalLeft = newLeftViewport + currentScrollX;
        console.log(`[Position Debug] Adjusted LEFT for left overflow. New finalLeft: ${finalLeft}`);
      }

      // Optional: Add vertical adjustment logic here if needed later
      // let popupTopViewport = finalTop - currentScrollY;
      // let popupBottomViewport = popupTopViewport + estimatedPopupHeight;
      // if (popupBottomViewport > viewportHeight - viewportPadding) { ... adjust finalTop ... }
      // if (popupTopViewport < viewportPadding) { ... adjust finalTop ... } 
      
      console.log(`[Position Debug] Setting final position:`, { top: finalTop, left: finalLeft });
      setPopupPosition({ top: finalTop, left: finalLeft });

    } else {
      // Only clear position if not hovered, 
      // otherwise it might clear position while content is loading
      if (!isHovered) { 
          setPopupPosition(null);
      }
    }
  }, [isHovered]); // Keep dependency array simple

  const popupContent = showPopup && popupPosition ? (
    <div 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
      className={`fixed z-[1000] w-80 max-w-[90vw] max-h-96 overflow-y-auto p-3 bg-white border rounded-lg shadow-lg transition-opacity duration-200 ease-in-out ${
        isHovered && (isLoading || error || verseContent) ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
      style={{ 
        top: `${popupPosition.top}px`, 
        left: `${popupPosition.left}px`,
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
  ) : null;

  return (
    <span 
      ref={containerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span 
        ref={triggerRef}
        className="px-1 py-0 bg-blue-100 text-blue-800 rounded-md cursor-pointer hover:bg-blue-200 transition-colors"
      >
        {reference}
      </span>
      
      {popupContent && createPortal(popupContent, document.body)}
    </span>
  );
}; 