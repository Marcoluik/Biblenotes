import React, { useState, useRef } from 'react';
import { InlineBibleVerseSelector } from './InlineBibleVerseSelector';
import { BibleVerseHover } from './BibleVerseHover';

interface NoteProps {
  note: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    category?: string;
  };
  onSave: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
  bibleId?: string;
}

export const Note: React.FC<NoteProps> = ({ note, onSave, onDelete, bibleId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInlineSelector, setShowInlineSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async () => {
    if (title.trim() === '') {
      alert('Please enter a title for your note');
      return;
    }
    
    try {
      console.log('Attempting to save note:', {
        id: note.id,
        title: title.trim(),
        contentLength: content.trim().length
      });
      
      await new Promise<void>((resolve, reject) => {
        try {
          onSave(note.id, title.trim(), content.trim());
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      console.log('Note saved successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error saving note:', error);
      console.error('Error details:', {
        errorName: error?.name || 'Unknown',
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack || 'No stack trace'
      });
      alert(`Failed to save note: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      onDelete(note.id);
    }
  };

  const handleCancel = () => {
    if (title !== note.title || content !== note.content) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        setTitle(note.title);
        setContent(note.content);
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowInlineSelector(true);
    }
  };

  const handleInsertVerse = (reference: string, verseContent: string) => {
    if (textareaRef.current) {
      const cursorPosition = textareaRef.current.selectionStart;
      const textBeforeCursor = content.substring(0, cursorPosition);
      const textAfterCursor = content.substring(cursorPosition);
      
      const verseReference = `[${reference}]`;
      
      const newContent = textBeforeCursor + verseReference + textAfterCursor;
      setContent(newContent);
      
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPosition = cursorPosition + verseReference.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    }
    
    setShowInlineSelector(false);
  };

  const applyFormatting = (format: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const selectedText = content.substring(start, end);
      
      let formattedText = '';
      switch (format) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `*${selectedText}*`;
          break;
        case 'underline':
          formattedText = `__${selectedText}__`;
          break;
        case 'quote':
          formattedText = `> ${selectedText}`;
          break;
        default:
          formattedText = selectedText;
      }
      
      const newContent = content.substring(0, start) + formattedText + content.substring(end);
      setContent(newContent);
      
      // Update cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPosition = start + formattedText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    }
  };

  const renderContent = () => {
    return content.split('\n').map((line, index) => {
      // Check if the line contains a Bible verse reference
      const verseMatch = line.match(/\[(.*?)\]/);
      if (verseMatch) {
        const reference = verseMatch[1];
        return (
          <div key={index} className="mb-2">
            <BibleVerseHover reference={reference} bibleId={bibleId} />
          </div>
        );
      }
      return <div key={index}>{line}</div>;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {isEditing ? (
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-bold mb-2 px-2 py-1 border rounded"
            placeholder="Note title"
          />
          <div className="mb-2 flex space-x-2 p-2 bg-gray-100 rounded-lg">
            <button
              onClick={() => applyFormatting('bold')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              onClick={() => applyFormatting('italic')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              onClick={() => applyFormatting('underline')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Underline"
            >
              <u>U</u>
            </button>
            <button
              onClick={() => applyFormatting('quote')}
              className="p-1 hover:bg-gray-200 rounded"
              title="Quote"
            >
              "
            </button>
            <button
              onClick={() => setShowInlineSelector(true)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Insert Bible Verse"
            >
              📖
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-32 px-2 py-1 border rounded mb-2"
            placeholder="Write your note here..."
          />
          <div className="flex justify-between">
            <button
              onClick={handleSave}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
          {showInlineSelector && (
            <InlineBibleVerseSelector
              onInsertVerse={handleInsertVerse}
              onClose={() => setShowInlineSelector(false)}
              bibleId={bibleId}
            />
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold">{title}</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-500 hover:text-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
          {note.category && (
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-gray-500">
                Last updated: {new Date(note.updated_at).toLocaleString()}
              </div>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {note.category}
              </span>
            </div>
          )}
          <div className="text-gray-700 whitespace-pre-wrap">{renderContent()}</div>
          {showSuccess && (
            <div className="text-green-500 text-sm mt-2">Note saved successfully!</div>
          )}
        </div>
      )}
    </div>
  );
}; 