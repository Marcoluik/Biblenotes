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
  const [content, setContent] = useState(note.content || '');
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedRef = useRef({ title: note.title, content: note.content || '' });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const performSave = async (): Promise<boolean> => {
    const t = title.trim();
    const c = content.trim();
    if (!t || (isShared && !canEdit)) return false;
    if (t === lastSavedRef.current.title && c === lastSavedRef.current.content) return true;
    setSaveStatus('saving');
    try {
      onSave(note.id, t, c);
      lastSavedRef.current = { title: t, content: c };
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  };

  // Auto-save 1.5 s after the user stops typing
  useEffect(() => {
    if (!isEditing) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const dirty = title.trim() !== lastSavedRef.current.title || content.trim() !== lastSavedRef.current.content;
    if (dirty && title.trim()) {
      if (saveStatus === 'saved') setSaveStatus('idle');
      autoSaveTimerRef.current = setTimeout(() => { performSave(); }, 1500);
    }
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [title, content, isEditing]);

  const handleClose = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await performSave();
    setIsEditing(false);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your note');
      return;
    }
    const ok = await performSave();
    if (ok) { setIsEditing(false); setSaveStatus('idle'); }
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 leading-snug mb-1.5">{note.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {note.category && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {note.category}
              </span>
            )}
            {isShared && (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {isLoadingSharer ? 'Loading...' : canEdit ? `Collaborative${sharerEmail ? ' · ' + sharerEmail : ''}` : `Shared${sharerEmail ? ' by ' + sharerEmail : ''}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => setShowViewModal(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="View Note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors ${
              (isShared && !canEdit) ? 'opacity-40 cursor-not-allowed' : ''
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
                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Share Note"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        className="text-sm text-gray-600 leading-relaxed cursor-pointer hover:text-gray-800 transition-colors"
        onClick={() => setShowViewModal(true)}
      >
        {renderContent()}
      </div>
      {note.updated_at && (
        <div className="text-xs text-gray-300 pt-1 border-t border-gray-50">
          {new Date(note.updated_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}

      {/* Edit — full-screen on mobile, centered modal on desktop */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex flex-col md:bg-black md:bg-opacity-50 md:items-center md:justify-center md:p-4">
          <div className="bg-white flex-1 flex flex-col md:flex-initial md:rounded-2xl md:shadow-xl md:w-full md:max-w-5xl md:max-h-[90vh] md:overflow-hidden md:my-8">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b bg-white z-10 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-gray-900">{note.title}</h2>
                {saveStatus === 'saving' && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Saved</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-xs text-red-500">Save failed</span>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pt-3 pb-2 overflow-y-auto flex-grow flex flex-col min-h-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 mb-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="Note title"
              />

              <div className="mb-3 flex items-center gap-1 p-1.5 bg-gray-100 rounded-xl">
                <button onClick={() => applyFormatting('bold')} className="px-2.5 py-1 hover:bg-white rounded-lg text-sm font-bold text-gray-700 transition-colors" title="Bold">B</button>
                <button onClick={() => applyFormatting('italic')} className="px-2.5 py-1 hover:bg-white rounded-lg text-sm italic text-gray-700 transition-colors" title="Italic">I</button>
                <button onClick={() => applyFormatting('underline')} className="px-2.5 py-1 hover:bg-white rounded-lg text-sm underline text-gray-700 transition-colors" title="Underline">U</button>
                <button onClick={() => applyFormatting('quote')} className="px-2.5 py-1 hover:bg-white rounded-lg text-sm text-gray-700 transition-colors" title="Quote">"</button>
                <button onClick={() => setShowInlineSelector(true)} className="px-2.5 py-1 hover:bg-white rounded-lg text-sm transition-colors" title="Insert Bible Verse">📖</button>
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 w-full min-h-[16rem] px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
                placeholder="Write your note here…"
              />

              {showInlineSelector && (
                <div className="mt-3">
                  <InlineBibleVerseSelector
                    onInsertVerse={handleInsertVerse}
                    bibleId={bibleId}
                    onClose={() => setShowInlineSelector(false)}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex justify-end items-center gap-2 bg-white shrink-0">
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors"
              >
                Save & Close
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