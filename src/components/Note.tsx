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
  const [keyboardOffset, setKeyboardOffset] = useState(0);

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

  // Lock body scroll + track keyboard height to keep toolbar above keyboard
  useEffect(() => {
    if (!isEditing) return;
    const scrollY = window.scrollY;
    document.body.style.cssText = `overflow:hidden;position:fixed;top:-${scrollY}px;width:100%`;

    const vv = window.visualViewport;
    const update = () => {
      if (vv) setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);

    return () => {
      document.body.style.cssText = '';
      window.scrollTo(0, scrollY);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      setKeyboardOffset(0);
    };
  }, [isEditing]);

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
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const sel = content.substring(start, end);

    const markers: Record<string, [string, string]> = {
      bold:      ['**', '**'],
      italic:    ['*',  '*' ],
      underline: ['__', '__'],
      quote:     ['> ', ''  ],
    };
    const [open, close] = markers[format] ?? ['', ''];

    let newContent: string;
    let cursorA: number;
    let cursorB: number;

    if (sel) {
      // Toggle off if selection is already wrapped
      const wrapped = close
        ? sel.startsWith(open) && sel.endsWith(close) && sel.length > open.length + close.length
        : sel.startsWith(open);
      if (wrapped) {
        const inner = close ? sel.slice(open.length, -close.length) : sel.slice(open.length);
        newContent = content.substring(0, start) + inner + content.substring(end);
        cursorA = start; cursorB = start + inner.length;
      } else {
        const out = `${open}${sel}${close}`;
        newContent = content.substring(0, start) + out + content.substring(end);
        cursorA = start; cursorB = start + out.length;
      }
    } else {
      // No selection: insert markers and place cursor between them
      newContent = content.substring(0, start) + open + close + content.substring(end);
      cursorA = start + open.length;
      cursorB = start + open.length;
    }

    setContent(newContent);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorA, cursorB);
    }, 0);
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

      {/* Edit — full-screen on mobile, centred modal on desktop */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex flex-col md:bg-black/50 md:items-center md:justify-center md:p-4">
          <div className="bg-white flex-1 flex flex-col md:flex-initial md:rounded-2xl md:shadow-xl md:w-full md:max-w-5xl md:max-h-[90vh] md:overflow-hidden md:my-8">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate text-sm">{note.title}</h2>
                {saveStatus === 'saving' && (
                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </span>
                )}
                {saveStatus === 'saved' && <span className="text-xs text-emerald-600 font-medium shrink-0">✓ Saved</span>}
                {saveStatus === 'error' && <span className="text-xs text-red-500 shrink-0">Save failed</span>}
              </div>
              <button onClick={handleClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content — overscroll-contain stops the page behind from scrolling */}
            <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-3 px-4 pt-3 pb-2 min-h-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ fontSize: '16px' }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                placeholder="Note title"
              />
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ fontSize: '16px' }}
                className="flex-1 w-full min-h-[12rem] px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none leading-relaxed"
                placeholder="Write your note here…"
              />
            </div>

            {/* Verse selector overlay */}
            {showInlineSelector && (
              <InlineBibleVerseSelector
                onInsertVerse={handleInsertVerse}
                bibleId={bibleId}
                onClose={() => setShowInlineSelector(false)}
              />
            )}

            {/* Bottom bar — toolbar + save, always visible above keyboard */}
            <div className="shrink-0 border-t bg-white flex items-center gap-1 px-3 py-2" style={{ paddingBottom: keyboardOffset > 0 ? `${keyboardOffset + 8}px` : undefined }}>
              <button onMouseDown={(e) => { e.preventDefault(); applyFormatting('bold'); }}      className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-gray-600 hover:bg-gray-100 transition-colors text-sm" title="Bold">B</button>
              <button onMouseDown={(e) => { e.preventDefault(); applyFormatting('italic'); }}    className="w-8 h-8 flex items-center justify-center rounded-lg italic text-gray-600 hover:bg-gray-100 transition-colors text-sm" title="Italic">I</button>
              <button onMouseDown={(e) => { e.preventDefault(); applyFormatting('underline'); }} className="w-8 h-8 flex items-center justify-center rounded-lg underline text-gray-600 hover:bg-gray-100 transition-colors text-sm" title="Underline">U</button>
              <button onMouseDown={(e) => { e.preventDefault(); applyFormatting('quote'); }}     className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-lg leading-none" title="Quote">"</button>
              <button onClick={() => setShowInlineSelector(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" title="Insert Bible Verse">📖</button>
              <div className="flex-1" />
              <button onClick={handleSave} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors">
                Save & Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Share Modal — bottom sheet on mobile, centred on desktop */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b shrink-0">
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900">Share Note</h2>
                <p className="text-xs text-gray-400 truncate mt-0.5">{note.title}</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 ml-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Current shares */}
              {isLoadingSharedUsers ? (
                <p className="text-sm text-gray-400 text-center py-2">Loading…</p>
              ) : sharedWithUsers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Shared with</p>
                  <div className="space-y-2">
                    {sharedWithUsers.map(user => (
                      <div key={user.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                        <span className="flex-1 text-sm text-gray-700 truncate">{user.email}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${user.canEdit ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                          {user.canEdit ? 'Can edit' : 'View only'}
                        </span>
                        <button onClick={() => handleRemoveShare(user.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0" title="Remove">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add person */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add person</p>
                <input
                  type="email"
                  value={shareEmail}
                  onChange={(e) => { setShareEmail(e.target.value); setShareError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleShareNote()}
                  placeholder="Email address"
                  style={{ fontSize: '16px' }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowEditing}
                    onChange={(e) => setAllowEditing(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">Allow editing</span>
                    <p className="text-xs text-gray-500">They can modify the note content</p>
                  </div>
                </label>
                {shareError && <p className="text-sm text-red-500">{shareError}</p>}
                {shareSuccess && <p className="text-sm text-emerald-600 font-medium">✓ Note shared!</p>}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t shrink-0">
              <button onClick={handleShareNote} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm transition-colors">
                Share Note
              </button>
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