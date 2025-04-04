import React from 'react';
import { Note } from '../types';
import { BibleVerseHover } from './BibleVerseHover';

interface NoteViewModalProps {
  note: Note;
  onClose: () => void;
  bibleId: string;
}

export const NoteViewModal: React.FC<NoteViewModalProps> = ({ note, onClose, bibleId }) => {
  // Function to render content with Bible verse references
  const renderContent = () => {
    const lines = note.content.split('\n');
    return lines.map((line, index) => {
      // Check if the line contains a Bible verse reference
      const verseMatch = line.match(/\[(.*?)\]/);
      if (verseMatch) {
        // If the line is just the verse reference, render it as a standalone component
        if (line.trim() === `[${verseMatch[1]}]`) {
          return (
            <div key={index} className="mb-4">
              <BibleVerseHover reference={verseMatch[1]} bibleId={bibleId} />
            </div>
          );
        } else {
          // If the verse reference is inline with other text, split the line and render each part
          const parts = line.split(/(\[.*?\])/);
          return (
            <div key={index} className="mb-4">
              {parts.map((part, partIndex) => {
                const innerVerseMatch = part.match(/\[(.*?)\]/);
                if (innerVerseMatch) {
                  return (
                    <BibleVerseHover 
                      key={`${index}-${partIndex}`} 
                      reference={innerVerseMatch[1]} 
                      bibleId={bibleId} 
                    />
                  );
                }
                return <span key={`${index}-${partIndex}`}>{part}</span>;
              })}
            </div>
          );
        }
      }
      return <div key={index} className="mb-4">{line}</div>;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{note.title}</h2>
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
        
        {/* Content */}
        <div className="p-4 overflow-y-auto flex-grow">
          <div className="prose max-w-none">
            {renderContent()}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500">
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