import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { InlineBibleVerseSelector } from './InlineBibleVerseSelector';
import { BibleVerseHover } from './BibleVerseHover';
import { Note as NoteType } from '../types';
import { supabase } from '../lib/supabase';
import { NoteViewModal } from './NoteViewModal';

interface NoteProps {
  note: NoteType;
  onSave: (id: string, title: string, content: string) => void;
  onDelete: (id: string) => void;
  bibleId: string;
  isShared?: boolean;
  canEdit?: boolean;
}

export const Note: React.FC<NoteProps> = ({ note, onSave, onDelete, bibleId, isShared = false, canEdit = false }) => {
  console.log('Note component rendered:', { 
    noteId: note.id, 
    title: note.title, 
    isShared: isShared,
    userId: note.user_id
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showInlineSelector, setShowInlineSelector] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [sharedWithUsers, setSharedWithUsers] = useState<{ id: string; email: string; canEdit: boolean }[]>([]);
  const [isLoadingSharedUsers, setIsLoadingSharedUsers] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [sharerEmail, setSharerEmail] = useState<string | null>(null);
  const [isLoadingSharer, setIsLoadingSharer] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [allowEditing, setAllowEditing] = useState(false);

  // Fetch sharer information if this is a shared note
  useEffect(() => {
    const fetchSharerInfo = async () => {
      if (isShared && note.id) {
        setIsLoadingSharer(true);
        try {
          // Get the shared_notes entry to find who shared it
          const { data: sharedNoteData, error: sharedNoteError } = await supabase
            .from('shared_notes')
            .select('shared_by')
            .eq('note_id', note.id)
            .single();
            
          if (sharedNoteError) {
            console.error('Error fetching sharer info:', sharedNoteError);
            return;
          }
          
          if (sharedNoteData && sharedNoteData.shared_by) {
            // Get the user's email using the RPC function
            const { data: userData, error: userError } = await supabase
              .rpc('get_users_by_ids', { user_ids: [sharedNoteData.shared_by] });
              
            if (userError) {
              console.error('Error fetching user email:', userError);
              return;
            }
            
            if (userData && userData.length > 0 && userData[0].email) {
              setSharerEmail(userData[0].email);
            }
          }
        } catch (error) {
          console.error('Error in fetchSharerInfo:', error);
        } finally {
          setIsLoadingSharer(false);
        }
      }
    };
    
    fetchSharerInfo();
  }, [isShared, note.id]);

  useEffect(() => {
    if (showShareModal) {
      fetchSharedUsers();
    }
  }, [showShareModal]);

  const fetchSharedUsers = async () => {
    setIsLoadingSharedUsers(true);
    try {
      // First get the shared notes AND permission status
      const { data: sharedNotes, error: sharedError } = await supabase
        .from('shared_notes')
        .select('shared_with, can_edit') // Select can_edit
        .eq('note_id', note.id);

      if (sharedError) throw sharedError;

      if (!sharedNotes || sharedNotes.length === 0) {
        setSharedWithUsers([]);
        return;
      }

      // Then get the user emails using the RPC function
      const userIds = sharedNotes.map(note => note.shared_with);
      const { data: users, error: usersError } = await supabase
        .rpc('get_users_by_ids', { user_ids: userIds });

      if (usersError) throw usersError;

      interface UserWithEmail {
        id: string;
        email: string;
      }

      // Map permissions to user emails
      const usersWithDetails = (users as UserWithEmail[]).map(user => {
        const shareInfo = sharedNotes.find(sn => sn.shared_with === user.id);
        return {
          id: user.id,
          email: user.email,
          canEdit: shareInfo?.can_edit ?? false // Add canEdit status
        };
      });

      setSharedWithUsers(usersWithDetails);
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
      // Add check for edit permissions on shared notes
      if (isShared && !canEdit) {
        console.warn("Attempted to save a shared note without edit permissions.");
        alert("You do not have permission to edit this shared note.");
        return; // Prevent saving
      }
      
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
      // Use the admin API to find the user by email
      const { data: users, error: userError } = await supabase
        .rpc('get_user_by_email', { email_address: shareEmail.trim() });

      if (userError) {
        console.error('Error finding user:', userError);
        throw new Error('User not found. Make sure they have an account in the app.');
      }

      if (!users || users.length === 0) {
        throw new Error('User not found');
      }

      const userId = users[0].id;

      // Check if already shared with this user
      if (sharedWithUsers.some(user => user.id === userId)) {
        throw new Error('Note is already shared with this user');
      }

      // Share the note with the user
      const { error: shareError } = await supabase
        .from('shared_notes')
        .insert({
          note_id: note.id,
          shared_by: note.user_id,
          shared_with: userId,
          can_edit: allowEditing
        });

      if (shareError) {
        console.error('Error sharing note:', shareError);
        throw shareError;
      }

      // Update the shared users list
      setSharedWithUsers([...sharedWithUsers, { id: userId, email: shareEmail.trim(), canEdit: allowEditing }]);
      setShareEmail('');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    } catch (error: any) {
      console.error('Share error:', error);
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
      // Render a truncated version for the card view
      const truncatedContent = content.length > 150 ? content.substring(0, 150) + '...' : content;
      const lines = truncatedContent.split('\n');
      
      return lines.map((line, index) => {
        // Check if the line contains a Bible verse reference
        const verseMatch = line.match(/\[(.*?)\]/);
        if (verseMatch) {
          // If the line is just the verse reference, render it as a standalone component
          if (line.trim() === `[${verseMatch[1]}]`) {
            return (
              <div key={index} className="mb-1"> {/* Reduced margin for card view */}
                <BibleVerseHover reference={verseMatch[1]} bibleId={bibleId} />
              </div>
            );
          } else {
            // If the verse reference is inline with other text, split the line and render each part
            const parts = line.split(/(\[.*?\])/);
            return (
              <div key={index} className="mb-1"> {/* Reduced margin for card view */}
                {parts.filter(part => part).map((part, partIndex) => { // Added filter for empty parts
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
                  // Render text part using ReactMarkdown (inline only)
                  return (
                    <ReactMarkdown
                      key={`${index}-${partIndex}`}
                      allowedElements={['strong', 'em', 'u', 'code', 'span', 'del']} // Allow common inline elements
                      unwrapDisallowed={true} // Render content of disallowed elements directly
                    >
                      {part}
                    </ReactMarkdown>
                  );
                })}
              </div>
            );
          }
        }
        // Render plain line using ReactMarkdown (inline only)
        return (
          <div key={index} className="mb-1"> {/* Reduced margin for card view */}
            <ReactMarkdown
              allowedElements={['strong', 'em', 'u', 'code', 'span', 'del']} // Allow common inline elements
              unwrapDisallowed={true} // Render content of disallowed elements directly
            >
              {line}
            </ReactMarkdown>
          </div>
        );
      });
    }
    return (
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full h-[36rem] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Write your note here..."
      />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-800">{note.title}</h3>
          {isShared && (
            <div className="ml-2">
              {isLoadingSharer ? (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Loading...
                </span>
              ) : sharerEmail ? (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {canEdit ? 'Collaborative with' : 'Shared by'} {sharerEmail}
                </span>
              ) : (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {canEdit ? 'Collaborative' : 'Shared'}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => setShowViewModal(true)}
            className="text-blue-500 hover:text-blue-700 p-1"
            title="View Note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={`text-blue-500 hover:text-blue-700 p-1 ${
              (isShared && !canEdit) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Edit Note"
            disabled={isShared && !canEdit}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {!isShared && (
            <>
              <button
                onClick={() => setShowShareModal(true)}
                className="text-green-500 hover:text-green-700 p-1"
                title="Share Note"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Delete Note"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div 
        className={`text-gray-700 whitespace-pre-wrap mb-2 ${!isEditing ? 'cursor-pointer hover:bg-gray-50 rounded p-1' : ''}`}
        onClick={() => !isEditing && setShowViewModal(true)}
      >
        {renderContent()}
      </div>
      {note.category && (
        <div className="text-sm text-gray-500">
          Category: {note.category}
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col my-8">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">Edit Note</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto flex-grow flex flex-col min-h-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Note title"
              />
              
              <div className="mb-4 flex space-x-2 p-2 bg-gray-100 rounded-lg">
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
                className="w-full h-[36rem] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your note here..."
              />
              
              {showInlineSelector && (
                <div className="mt-4">
                  <InlineBibleVerseSelector 
                    onInsertVerse={handleInsertVerse} 
                    bibleId={bibleId} 
                    onClose={() => setShowInlineSelector(false)}
                  />
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t flex justify-between items-center sticky bottom-0 bg-white z-10">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
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
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${user.canEdit ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user.canEdit ? 'Collaborator' : 'Viewer'}
                      </span>
                      <button
                        onClick={() => handleRemoveShare(user.id)}
                        className="text-red-500 hover:text-red-700 ml-2"
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
                <div className="mb-4 flex items-center">
                  <input
                    id="allowEditing" 
                    type="checkbox"
                    checked={allowEditing}
                    onChange={(e) => setAllowEditing(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="allowEditing" className="ml-2 block text-sm text-gray-900">
                    Allow collaborator to edit
                  </label>
                </div>
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

      {/* View Modal */}
      {showViewModal && (
        <NoteViewModal
          note={note}
          onClose={() => setShowViewModal(false)}
          bibleId={bibleId}
        />
      )}
    </div>
  );
}; 