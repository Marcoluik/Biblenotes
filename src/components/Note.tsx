import React, { useState, useRef, useEffect } from 'react';
import { InlineBibleVerseSelector } from './InlineBibleVerseSelector';
import { BibleVerseHover } from './BibleVerseHover';
import { Note as NoteType } from '../types';
import { supabase } from '../lib/supabase';

interface NoteProps {
  note: NoteType;
  onSave: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
  bibleId: string;
  isShared?: boolean;
}

export const Note: React.FC<NoteProps> = ({ note, onSave, onDelete, bibleId, isShared = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInlineSelector, setShowInlineSelector] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [sharedWithUsers, setSharedWithUsers] = useState<{ id: string; email: string }[]>([]);
  const [isLoadingSharedUsers, setIsLoadingSharedUsers] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showShareModal) {
      fetchSharedUsers();
    }
  }, [showShareModal]);

  const fetchSharedUsers = async () => {
    setIsLoadingSharedUsers(true);
    try {
      const { data, error } = await supabase
        .from('shared_notes')
        .select('shared_with, profiles:shared_with(email)')
        .eq('note_id', note.id);

      if (error) throw error;

      const users = data.map(item => ({
        id: item.shared_with,
        email: (item.profiles as unknown as { email: string }).email
      }));
      setSharedWithUsers(users);
    } catch (error) {
      console.error('Error fetching shared users:', error);
    } finally {
      setIsLoadingSharedUsers(false);
    }
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowInlineSelector(true);
    }
  };

  const handleInsertVerse = (reference: string) => {
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

  const handleShareNote = async () => {
    if (!shareEmail.trim()) {
      setShareError('Please enter an email address');
      return;
    }

    try {
      // First, find the user by email
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', shareEmail.trim())
        .single();

      if (userError) {
        throw new Error('User not found. Make sure they have an account in the app.');
      }

      if (!users) {
        throw new Error('User not found');
      }

      // Check if already shared with this user
      if (sharedWithUsers.some(user => user.id === users.id)) {
        throw new Error('Note is already shared with this user');
      }

      // Share the note with the user
      const { error: shareError } = await supabase
        .from('shared_notes')
        .insert({
          note_id: note.id,
          shared_by: note.user_id,
          shared_with: users.id
        });

      if (shareError) {
        throw shareError;
      }

      // Update the shared users list
      setSharedWithUsers([...sharedWithUsers, { id: users.id, email: shareEmail.trim() }]);
      setShareEmail('');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error: any) {
      setShareError(error.message);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('shared_notes')
        .delete()
        .eq('note_id', note.id)
        .eq('shared_with', userId);

      if (error) throw error;

      setSharedWithUsers(sharedWithUsers.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error removing share:', error);
    }
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
    if (!isEditing) {
      const lines = content.split('\n');
      return lines.map((line, index) => {
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
        return <div key={index} className="mb-2">{line}</div>;
      });
    }
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full h-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      {isEditing ? (
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 mb-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="flex justify-end mt-2 space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
          </div>
          {showInlineSelector && (
            <div className="mt-2">
              <InlineBibleVerseSelector 
                onInsertVerse={handleInsertVerse} 
                bibleId={bibleId} 
                onClose={() => setShowInlineSelector(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="flex space-x-1">
              {!isShared && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-1 text-gray-500 hover:text-blue-500"
                  title="Share note"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                </button>
              )}
              {!isShared && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-500 hover:text-blue-500"
                  title="Edit note"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}
              {!isShared && (
                <button
                  onClick={() => onDelete(note.id)}
                  className="p-1 text-gray-500 hover:text-red-500"
                  title="Delete note"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {note.category && (
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {note.category}
              </span>
            )}
            {sharedWithUsers.length > 0 && (
              <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Shared
              </span>
            )}
          </div>
          <div className="text-gray-700 whitespace-pre-wrap">{renderContent()}</div>
          {isShared && (
            <div className="mt-2 text-xs text-gray-500">
              Shared with you
            </div>
          )}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Share Note</h2>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Current Shares */}
            {isLoadingSharedUsers ? (
              <div className="text-center py-4">Loading...</div>
            ) : sharedWithUsers.length > 0 ? (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Currently shared with:</h3>
                <div className="space-y-2">
                  {sharedWithUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-600">{user.email}</span>
                      <button
                        onClick={() => handleRemoveShare(user.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-4">
              <label htmlFor="shareEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Share with (email)
              </label>
              <div className="flex gap-2">
                <input
                  id="shareEmail"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleShareNote}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Share
                </button>
              </div>
              {shareError && (
                <p className="mt-1 text-sm text-red-500">{shareError}</p>
              )}
              {shareSuccess && (
                <p className="mt-1 text-sm text-green-500">Note shared successfully!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 