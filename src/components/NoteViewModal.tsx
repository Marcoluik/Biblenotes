import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Note } from '../types';
import { BibleVerseHover } from './BibleVerseHover';

interface NoteViewModalProps {
  note: Note;
  onClose: () => void;
  bibleId: string;
}

export const NoteViewModal: React.FC<NoteViewModalProps> = ({ note, onClose, bibleId }) => {
  // Lock body scroll while open
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow:hidden;position:fixed;top:-${scrollY}px;width:100%`;
    return () => {
      document.body.style.cssText = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const renderContent = () => {
    const paragraphs = (note.content || '').trim().split(/\n\s*\n/);
    return paragraphs.map((paragraph, paraIndex) => {
      if (!paragraph.trim()) return <div key={paraIndex} className="h-4" />;
      const lines = paragraph.split('\n');
      return (
        <p key={paraIndex} className="mb-4 leading-relaxed">
          {lines.map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {line.split(/(\[.*?\])/g).filter(Boolean).map((part, partIndex) => {
                const verseMatch = part.match(/\[(.*?)\]/);
                if (verseMatch) {
                  return <BibleVerseHover key={partIndex} reference={verseMatch[1]} bibleId={bibleId} />;
                }
                return (
                  <ReactMarkdown
                    key={partIndex}
                    allowedElements={['strong', 'em', 'u', 'code', 'del']}
                    unwrapDisallowed={true}
                  >
                    {part}
                  </ReactMarkdown>
                );
              })}
              {lineIndex < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:bg-black/50 md:items-center md:justify-center md:p-4">
      <div className="bg-white flex-1 flex flex-col md:flex-initial md:rounded-2xl md:shadow-xl md:w-full md:max-w-3xl md:max-h-[90vh] md:overflow-hidden md:my-8">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="font-bold text-gray-900 text-lg leading-tight">{note.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {note.category && (
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                  {note.category}
                </span>
              )}
              {note.updated_at && (
                <span className="text-xs text-gray-400">
                  {new Date(note.updated_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-gray-700 text-sm">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium text-sm transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
