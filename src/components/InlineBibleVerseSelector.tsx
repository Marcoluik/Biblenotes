import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (searchTerm.length < 2) {
        setVerses([]);
        return;
      }

      const cleanQuery = searchTerm.replace('@', '');
      setLoading(true);

      try {
        const results = await searchBibleVerses(cleanQuery, bibleId);
        setVerses(results);
        if (results.length > 0) {
          setSelectedVerse(results[0]);
        }
      } catch (error: any) {
        console.error('Verse search error:', error.message);
        setVerses([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchVerses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, bibleId]);

  const handleInsert = () => {
    if (selectedVerse) {
      const content = selectedVerse.content || selectedVerse.text || '';
      onInsertVerse(selectedVerse.reference, content);
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        ref={containerRef}
        className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[70vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-semibold text-gray-900">Insert Bible Verse</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsert()}
            placeholder={bibleId === 'nwt-local-da' ? 'F.eks. Johannes 3:16' : 'e.g. John 3:16'}
            style={{ fontSize: '16px' }}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          {bibleId === 'nwt-local-da' && (
            <p className="text-xs text-gray-400 mt-1.5">Skriv bognavnet og kapitel:vers — f.eks. "Johannes 3:16"</p>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 pb-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          ) : verses.length > 0 ? (
            <div className="space-y-1.5 py-1">
              {verses.map((verse) => (
                <div
                  key={verse.id}
                  className={`px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    selectedVerse?.id === verse.id
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => {
                    if (verse.id.startsWith('bookmatch-')) {
                      setSearchTerm(verse.reference + ' ');
                      setSelectedVerse(null);
                      setVerses([]);
                      inputRef.current?.focus();
                    } else {
                      setSelectedVerse(verse);
                    }
                  }}
                >
                  <div className="text-sm font-semibold text-gray-800">{verse.reference}</div>
                  <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {verse.content || verse.text || 'No content available'}
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.length >= 2 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {bibleId === 'nwt-local-da' ? 'Ingen vers fundet — prøv f.eks. "Johannes 3:16"' : 'No verses found — try e.g. "John 3:16"'}
            </p>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Start typing a reference…</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0">
          <button
            onClick={handleInsert}
            disabled={!selectedVerse}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${
              selectedVerse
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Insert Verse
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
