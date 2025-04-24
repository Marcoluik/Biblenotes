import React from 'react';
// Keep ReactMarkdown import uncommented
import ReactMarkdown from 'react-markdown';
import { Note } from '../types';
import { BibleVerseHover } from './BibleVerseHover';

interface NoteViewModalProps {
  note: Note;
  onClose: () => void;
  bibleId: string;
}

export const NoteViewModal: React.FC<NoteViewModalProps> = ({ note, onClose, bibleId }) => {

  // Restore the renderContentWithStructure function
  const renderContentWithStructure = () => {
    const paragraphs = note.content.trim().split(/\n\s*\n/);

    return paragraphs.map((paragraph, paraIndex) => {
      if (!paragraph.trim()) {
        return <p key={`para-${paraIndex}`} className="mb-4"></p>; // Add margin for spacing
      }

      // Split paragraph into lines based on single newlines
      const lines = paragraph.split('\n');

      return (
        <p key={`para-${paraIndex}`} className="mb-4"> {/* Add margin to paragraph */}
          {lines.map((line, lineIndex) => (
            <React.Fragment key={`line-${lineIndex}`}>
              {line.split(/(\[.*?\])/g).filter(part => part).map((part, partIndex) => {
                const verseMatch = part.match(/\[(.*?)\]/);
                if (verseMatch) {
                  // Render verse component (inline)
                  return (
                    <BibleVerseHover 
                      key={`part-${partIndex}`}
                      reference={verseMatch[1]} 
                      bibleId={bibleId} 
                    />
                  );
                } else {
                  // Render text part using ReactMarkdown, disabling block elements like <p>
                  return (
                    <ReactMarkdown 
                      key={`part-${partIndex}`}
                      allowedElements={['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'a', 'code', 'span', 'br', 'sub', 'sup', 'del']} // Allow headings and common inline elements
                      unwrapDisallowed={true} // Render content of disallowed elements directly
                    >
                      {part}
                    </ReactMarkdown>
                  );
                }
              })}
              {/* Add <br /> if it's not the last line within the paragraph */}
              {lineIndex < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{note.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content - Call the restored function */}
        {/* Remove prose class unless specific styling is desired */} 
        <div className="p-6 overflow-y-auto flex-grow"> 
          {renderContentWithStructure()}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500 sticky bottom-0 bg-white z-10">
          <div>
            {note.category && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                {note.category}
              </span>
            )}
            <span>
              {new Date(note.created_at).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};