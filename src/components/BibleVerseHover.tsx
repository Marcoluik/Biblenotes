import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    
    // Store the initial position calculation target
    const rect = event.currentTarget.getBoundingClientRect();
    // We'll calculate the exact position later in the effect
    
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true); 
      // Position calculation will now happen in the position effect
      // triggered by isHovered becoming true
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

  // --- Refactored Position Calculation Logic ---
  const calculateAndSetPosition = useCallback(() => {
    if (!triggerRef.current || !isHovered || !showPopup) {
        // Don't calculate if the trigger isn't mounted, 
        // not hovered, or popup shouldn't be shown
        console.log('[Position Calc] Skipping calculation (trigger/hover/show state)', { isHovered, showPopup, hasTrigger: !!triggerRef.current });
        // Keep existing position if popup is closing but still faded out
        if (!isHovered) {
            setPopupPosition(null);
        }
        return;
    }
    
    const triggerEl = triggerRef.current;
    const triggerRect = triggerEl.getBoundingClientRect();
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const currentScrollY = window.scrollY;
    const currentScrollX = window.scrollX;
    const viewportPadding = 10;
    
    const estimatedPopupWidth = Math.min(320, viewportWidth * 0.9); 
    
    // For position: fixed, top/left are viewport-relative
    // We use the triggerRect values directly.
    let finalTop = triggerRect.bottom + 5; // Position below the element (viewport relative)
    let finalLeft = triggerRect.left;    // Position aligned with left edge (viewport relative)

    // --- Start Debug Logging ---
    console.log('[Position Calc] Running calculation...', {
      triggerRect: JSON.parse(JSON.stringify(triggerRect)), // Log plain object
      viewportWidth, viewportHeight, currentScrollY, currentScrollX,
      calculatedViewportTop: finalTop, // Renamed log field
      calculatedViewportLeft: finalLeft, // Renamed log field
    });
    // --- End Debug Logging ---

    // Adjust position based on viewport boundaries (using viewport-relative coordinates)
    let popupRightEdge = finalLeft + estimatedPopupWidth;

    // Check right boundary
    if (popupRightEdge > viewportWidth - viewportPadding) {
      const overflowRight = popupRightEdge - (viewportWidth - viewportPadding);
      finalLeft -= overflowRight; // Shift left
      console.log(`[Position Calc] Adjusted LEFT for right overflow. New finalLeft: ${finalLeft}`);
    }

    // Check left boundary
    if (finalLeft < viewportPadding) {
      finalLeft = viewportPadding; // Align with left padding
      console.log(`[Position Calc] Adjusted LEFT for left overflow. New finalLeft: ${finalLeft}`);
    }
    
    // Optional: Add vertical adjustment logic here if needed later (e.g., if popup goes off bottom)

    console.log(`[Position Calc] Setting final position (fixed):`, { top: finalTop, left: finalLeft });
    setPopupPosition({ top: finalTop, left: finalLeft });

  }, [isHovered, showPopup]); // Dependencies for the calculation logic itself

  // --- Effect for Handling Position and Scroll Listener ---
  useEffect(() => {
    // Define the scroll handler using the memoized calculation function
    const handleScroll = () => {
        console.log('[Scroll Handler] Fired');
        // Only recalculate if the popup should still be conceptually "open"
        if (isHovered && showPopup) { 
            calculateAndSetPosition();
        } else {
            console.log('[Scroll Handler] Skipped recalc (hover/show state)', { isHovered, showPopup });
        }
    };

    if (isHovered && showPopup) {
        console.log('[Position Effect] Adding scroll listener and calculating initial position.');
        // Calculate position immediately when popup becomes visible
        calculateAndSetPosition(); 
        
        // Add scroll listener
        window.addEventListener('scroll', handleScroll, { passive: true });
        // Optional: Add resize listener too?
        // window.addEventListener('resize', handleScroll, { passive: true });

        // Cleanup function for this effect instance
        return () => {
          window.removeEventListener('scroll', handleScroll);
          console.log('[Position Effect] Removed scroll listener.');
          // window.removeEventListener('resize', handleScroll);
        };
    } else {
        console.log('[Position Effect] Skipping listener setup (hover/show state)', { isHovered, showPopup });
        // If not hovered or shouldn't show, ensure no listener is active
        // The position state is managed within calculateAndSetPosition or the hover leave logic
        // Optional: Explicitly clear position here if desired, though handleMouseLeave also does it.
        // setPopupPosition(null); 
        
        // Ensure listener is removed if effect re-runs due to dependency change while !isHovered
         window.removeEventListener('scroll', handleScroll); 
         // window.removeEventListener('resize', handleScroll);
    }
    // This effect should run when hover state changes or popup visibility changes
  }, [isHovered, showPopup, calculateAndSetPosition]); // Add calculateAndSetPosition to dependencies

  // Log position state changes
  useEffect(() => {
      console.log('[State Update] popupPosition changed:', popupPosition);
  }, [popupPosition]);

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