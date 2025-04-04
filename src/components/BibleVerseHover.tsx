import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { searchBibleVerses } from '../lib/bibleApi';
import { fetchVerseFromJwOrg } from '../lib/jwOrgApi';

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

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchVerse = async () => {
      if (!reference || !isHovered) return;
      
      setShowPopup(true);
      setIsLoading(true);
      setError(null);
      setVerseContent(null);
      
      try {
        let fetchedContent: string | null = null;
        
        if (bibleId?.startsWith('nwtsty-')) {
          fetchedContent = await fetchVerseFromJwOrg(reference, bibleId);
        } else {
          const verses = await searchBibleVerses(reference, bibleId);
          if (verses && verses.length > 0) {
            fetchedContent = verses[0].content || verses[0].text || '';
          }
        }
        
        if (isMounted) {
          if (fetchedContent !== null && fetchedContent.trim() !== '') {
            setVerseContent(fetchedContent);
          } else {
            setError('Verse not found or failed to load');
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
    } else {
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
  }, [reference, isHovered, bibleId]);

  useEffect(() => {
    if (isHovered && triggerRef.current) {
      const triggerEl = triggerRef.current;
      const triggerRect = triggerEl.getBoundingClientRect();
      
      const viewportWidth = window.innerWidth;
      const viewportPadding = 10;
      
      const estimatedPopupWidth = Math.min(320, viewportWidth * 0.9);
      
      let finalTop = triggerRect.bottom + window.scrollY + 5;
      let finalLeft = triggerRect.left + window.scrollX;

      let popupLeftViewport = finalLeft - window.scrollX;
      let popupRightViewport = popupLeftViewport + estimatedPopupWidth;

      if (popupRightViewport > viewportWidth - viewportPadding) {
        const overflowRight = popupRightViewport - (viewportWidth - viewportPadding);
        const newLeftViewport = popupLeftViewport - overflowRight;
        finalLeft = newLeftViewport + window.scrollX;
        popupLeftViewport = newLeftViewport; 
      }

      if (popupLeftViewport < viewportPadding) {
        const overflowLeft = viewportPadding - popupLeftViewport;
        const newLeftViewport = popupLeftViewport + overflowLeft;
        finalLeft = newLeftViewport + window.scrollX;
      }
      
      setPopupPosition({ top: finalTop, left: finalLeft });

    } else {
      setPopupPosition(null);
    }
  }, [isHovered]);

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