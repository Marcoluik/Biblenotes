import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Note as NoteComponent } from './components/Note';
import { getAvailableBibles } from './lib/bibleApi';
import { Auth } from './components/Auth';
import { ErrorMessage } from './components/ErrorMessage';
import { Note } from './types';
import { DailyVerse } from './components/DailyVerse';
import { InlineBibleVerseSelector } from './components/InlineBibleVerseSelector';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [newNoteCategory, setNewNoteCategory] = useState<string | undefined>(undefined);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [showInlineSelector, setShowInlineSelector] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  
  // Bible selection state
  const [availableBibles, setAvailableBibles] = useState<{ id: string; name: string; language: { id: string; name: string } }[]>([]);
  const [selectedBibleId, setSelectedBibleId] = useState<string>('');
  const [bibleSearchTerm, setBibleSearchTerm] = useState<string>('');
  const [filteredBibles, setFilteredBibles] = useState<{ id: string; name: string; language: { id: string; name: string } }[]>([]);
  const bibleDropdownRef = useRef<HTMLDivElement>(null);
  const [showBibleModal, setShowBibleModal] = useState(false);

  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<'my-notes' | 'shared-notes'>('my-notes');

  // Manually define the NWT Study Bible entry
  const nwtStudyBibleEntry = {
    id: 'nwtsty-en', // Unique ID for our custom fetcher
    name: 'New World Translation (Study Bible) - English',
    language: { id: 'eng', name: 'English' },
    // Note: No actual API ID needed, our code handles this one specially
  };

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          fetchNotes(session.user.id);
        } else {
          setIsLoading(false);
        }
      } catch (error: any) {
        setError(error.message);
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setUser(session.user);
          fetchNotes(session.user.id);
        } else {
          setUser(null);
          setNotes([]);
          setIsLoading(false);
        }
      }
    );

    // Fetch available Bibles from the official API
    const fetchBibles = async () => {
      let fetchedBibles: { id: string; name: string; language: { id: string; name: string } }[] = [];
      try {
        fetchedBibles = await getAvailableBibles();
        console.log("Fetched Available Bibles from API:", fetchedBibles);
      } catch (error) {
        console.error('Error fetching Bibles from API:', error);
      }

      const combinedBibles = [
        nwtStudyBibleEntry,
        ...fetchedBibles.filter(b => b.id !== nwtStudyBibleEntry.id && b.name !== nwtStudyBibleEntry.name)
      ];
      combinedBibles.sort((a, b) => a.name.localeCompare(b.name));

      console.log("Combined Bibles list (before setting state):", JSON.stringify(combinedBibles, null, 2));

      setAvailableBibles(combinedBibles);
      setFilteredBibles(combinedBibles);

      // Set default selection logic
      // Prioritize NWT if available, then KJV, then ESV, then first in list
      let defaultBibleId = '';
      if (combinedBibles.some(b => b.id === nwtStudyBibleEntry.id)) {
        defaultBibleId = nwtStudyBibleEntry.id;
      } else {
          const kjvBible = combinedBibles.find(bible => 
            bible.id === 'de4e12af7f28f599-02' || // KJV ID
            bible.name.toLowerCase().includes('king james version') || 
            bible.name.toLowerCase().includes('kjv')
          );
          if (kjvBible) {
            defaultBibleId = kjvBible.id;
          } else {
              const esvBible = combinedBibles.find(bible => 
                bible.id === '9879dbb7cfe39e4d-01' || // ESV ID
                bible.name.toLowerCase().includes('english standard version') || 
                bible.name.toLowerCase().includes('esv')
              );
              if (esvBible) {
                defaultBibleId = esvBible.id;
              } else if (combinedBibles.length > 0) {
                  // Fallback to the first available bible if others aren't found
                  defaultBibleId = combinedBibles[0].id;
              }
          }
      }

      if (defaultBibleId) {
        console.log(`Setting default Bible ID to: ${defaultBibleId}`);
        setSelectedBibleId(defaultBibleId);
      } else {
          console.warn("Could not determine a default Bible ID.");
          // Handle case where no bibles are available at all?
      }
    };
    
    fetchBibles();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter Bibles when search term changes
  useEffect(() => {
    console.log('Filtering Bibles based on search term:', bibleSearchTerm);
    console.log('Filtering from availableBibles:', JSON.stringify(availableBibles, null, 2));
    if (!bibleSearchTerm.trim()) {
      console.log('Empty search term, showing all availableBibles');
      setFilteredBibles(availableBibles);
      return;
    }
    const searchTerm = bibleSearchTerm.toLowerCase();
    const filtered = availableBibles.filter(bible => {
      const nameMatch = bible.name.toLowerCase().includes(searchTerm);
      const languageMatch = bible.language.name.toLowerCase().includes(searchTerm);
      return nameMatch || languageMatch;
    });
    console.log('Filtered Bibles result:', JSON.stringify(filtered, null, 2));
    setFilteredBibles(filtered);
  }, [bibleSearchTerm, availableBibles]);

  useEffect(() => {
    // Load notes from localStorage
    const savedNotes = localStorage.getItem('notes');
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes) as Note[];
      setNotes(parsedNotes);
      
      // Extract unique categories and filter out undefined values
      const uniqueCategories = Array.from(new Set(
        parsedNotes
          .map((note: Note) => note.category)
          .filter((category): category is string => typeof category === 'string')
      ));
      setCategories(uniqueCategories);
    }
    setIsLoading(false);
  }, []);

  const fetchNotes = async (userId: string) => {
    try {
      console.log('Fetching notes for user:', userId);
      
      // Fetch user's own notes
      const { data: userNotes, error: userNotesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (userNotesError) throw userNotesError;
      console.log('User notes fetched:', userNotes?.length || 0);
      setNotes(userNotes || []);
      
      // First get the shared note IDs
      console.log('Fetching shared note IDs for user:', userId);
      const { data: sharedNoteIds, error: sharedIdsError } = await supabase
        .from('shared_notes')
        .select('note_id')
        .eq('shared_with', userId);

      if (sharedIdsError) {
        console.error('Error fetching shared note IDs:', sharedIdsError);
        throw sharedIdsError;
      }
      
      console.log('Shared note IDs found:', sharedNoteIds?.length || 0);
      console.log('Shared note IDs:', sharedNoteIds);

      // Then fetch the actual notes
      let sharedNotesList: Note[] = [];
      if (sharedNoteIds && sharedNoteIds.length > 0) {
        const noteIds = sharedNoteIds.map(item => item.note_id);
        console.log('Fetching notes with IDs:', noteIds);
        
        const { data: sharedNotes, error: sharedNotesError } = await supabase
          .from('notes')
          .select('*')
          .in('id', noteIds);

        if (sharedNotesError) {
          console.error('Error fetching shared notes:', sharedNotesError);
          throw sharedNotesError;
        }

        console.log('Shared notes fetched:', sharedNotes?.length || 0);
        console.log('Shared notes data:', sharedNotes);
        sharedNotesList = sharedNotes || [];
      } else {
        console.log('No shared notes found for user');
      }
      
      console.log('Setting shared notes state:', sharedNotesList.length);
      setSharedNotes(sharedNotesList);
      
      // Extract unique categories from both user notes and shared notes
      const allNotes = [...(userNotes || []), ...sharedNotesList];
      console.log('Total notes (user + shared):', allNotes.length);
      
      const uniqueCategories = Array.from(new Set(
        allNotes
          .map((note: Note) => note.category)
          .filter((category): category is string => typeof category === 'string')
      ));
      console.log('Unique categories:', uniqueCategories);
      setCategories(uniqueCategories);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNote = async (id: string, title: string, content: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ title, content })
        .eq('id', id);

      if (error) throw error;

      setNotes(notes.map(note => 
        note.id === id ? { ...note, title, content } : note
      ));
    } catch (error: any) {
      console.error('Error saving note:', error);
      setError(error.message);
    }
  };

  const handleDeleteNote = async (id: string) => {
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Delete from local state
      const updatedNotes = notes.filter(note => note.id !== id);
      setNotes(updatedNotes);
      localStorage.setItem('notes', JSON.stringify(updatedNotes));

      // Delete from Supabase if user is authenticated
      if (user) {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  const handleCreateNote = () => {
    setShowAddNoteForm(true);
    // Reset form fields
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteCategory(undefined);
    setIsNewCategory(false);
    // Focus on the title input after a short delay
    setTimeout(() => {
      const titleInput = document.querySelector('input[placeholder="Note title"]') as HTMLInputElement;
      if (titleInput) {
        titleInput.focus();
      }
    }, 100);
  };

  const handleAddNote = async () => {
    if (!newNoteTitle.trim()) {
      setError('Please enter a title for your note');
      return;
    }

    try {
      const noteId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            id: noteId,
            title: newNoteTitle.trim(),
            content: newNoteContent.trim(),
            user_id: user.id,
            category: newNoteCategory
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setNotes([...notes, data]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteCategory(undefined);
      setShowAddNoteForm(false);
    } catch (error: any) {
      console.error('Error creating note:', error);
      setError(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      // Use the Supabase client's signOut method
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        // If there's an error, still sign out locally
        setUser(null);
        setNotes([]);
        return;
      }
      
      // The auth state change listener will handle setting user to null
      // and clearing notes if signOut is successful
    } catch (error: any) {
      console.error('Error signing out:', error);
      // Still set user to null to allow the app to continue
      setUser(null);
      setNotes([]);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'new') {
      setIsNewCategory(true);
      setNewNoteCategory('');
      // Focus the input after the state updates
      setTimeout(() => {
        if (newCategoryInputRef.current) {
          newCategoryInputRef.current.focus();
        }
      }, 0);
    } else {
      setIsNewCategory(false);
      setNewNoteCategory(value);
    }
  };

  const filteredNotes = selectedCategory === 'all'
    ? notes
    : notes.filter(note => note.category === selectedCategory);

  const applyFormatting = (format: string) => {
    const textarea = newNoteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newNoteContent;
    const selectedText = text.substring(start, end);

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
    }

    const newText = text.substring(0, start) + formattedText + text.substring(end);
    setNewNoteContent(newText);

    // Set cursor position after the formatted text
    const newCursorPos = start + formattedText.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleNewNoteKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = newNoteContent;
      const newText = text.substring(0, start) + '  ' + text.substring(end);
      setNewNoteContent(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    } else if (event.key === '@') {
      setShowInlineSelector(true);
    }
  };

  const handleInsertVerse = (reference: string) => {
    const textarea = newNoteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = newNoteContent;
    const verseReference = `[${reference}]`;
    const newText = text.substring(0, start) + verseReference + text.substring(start);
    setNewNoteContent(newText);

    // Set cursor position after the inserted verse
    const newCursorPos = start + verseReference.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    setShowInlineSelector(false);
  };

  // Handle click outside to close Bible dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bibleDropdownRef.current && !bibleDropdownRef.current.contains(event.target as Node)) {
        // No need to close anything here anymore
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add a function to refresh notes
  const refreshNotes = async () => {
    if (user) {
      await fetchNotes(user.id);
    }
  };

  // Set up a subscription to listen for changes to shared_notes
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('shared_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_notes',
          filter: `shared_with=eq.${user.id}`
        },
        (payload) => {
          console.log('Shared notes change detected:', payload);
          refreshNotes();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {
      // This will trigger a re-render and the useEffect will handle the auth state change
      console.log('Authentication successful');
    }} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-full">
      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      )}
      
      {/* Mobile-friendly header */}
      <div className="mobile-header bg-white rounded-lg shadow-md p-4 mb-8">
        <div className="flex justify-between items-center">
          <h1 className="mobile-header-title font-bold text-gray-800 flex items-center">
            <span className="mr-2">📖</span> Bible Notes
          </h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowBibleModal(true)}
              className="flex items-center justify-center w-10 h-10 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg transition-all duration-200 hover:bg-gray-100 active:scale-95"
              title="Select Bible Translation"
            >
              📖
            </button>
            <button
              onClick={handleCreateNote}
              className="hidden md:flex items-center justify-center px-4 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-all duration-200 hover:shadow-md active:scale-95"
            >
              Create Note
            </button>
            <div className="relative group">
              <button className="flex items-center justify-center w-10 h-10 text-gray-700 hover:text-gray-900 transition-all duration-200 hover:bg-gray-100 rounded-lg active:scale-95 border border-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-in-out border border-gray-200">
                <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                  {user.email}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Create Note Button (Mobile) */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={handleCreateNote}
          className="flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-sm transition-all duration-200 hover:shadow-xl active:scale-95"
          aria-label="Create Note"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Bible Translation Modal */}
      {showBibleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Select Bible Translation</h2>
              <button
                onClick={() => setShowBibleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search Bible translations..."
                className="w-full px-3 py-2 border rounded-lg mb-4"
                value={bibleSearchTerm}
                onChange={(e) => setBibleSearchTerm(e.target.value)}
              />
              <div className="max-h-60 overflow-y-auto">
                {filteredBibles.length === 0 ? (
                  <p className="text-gray-500 px-4 py-2">No Bibles found matching your search.</p>
                ) : (
                  filteredBibles.map(bible => (
                    <button
                      key={bible.id}
                      onClick={() => {
                        setSelectedBibleId(bible.id);
                        setShowBibleModal(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        bible.id === selectedBibleId ? 'bg-blue-50 font-semibold' : ''
                      }`}
                    >
                      {bible.name} ({bible.language.name})
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Verse */}
      <DailyVerse bibleId={selectedBibleId} />
      
      {/* Tabs for My Notes and Shared Notes */}
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('my-notes')}
              className={`inline-block p-4 rounded-t-lg ${
                activeTab === 'my-notes'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              My Notes
            </button>
          </li>
          <li className="mr-2">
            <button
              onClick={() => setActiveTab('shared-notes')}
              className={`inline-block p-4 rounded-t-lg ${
                activeTab === 'shared-notes'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              Shared with Me
              {sharedNotes.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {sharedNotes.length}
                </span>
              )}
            </button>
            {activeTab === 'shared-notes' && (
              <button
                onClick={refreshNotes}
                className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                title="Refresh shared notes"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </li>
        </ul>
      </div>
      
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Notes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeTab === 'my-notes' ? (
          filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <NoteComponent
                key={note.id}
                note={note}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
                bibleId={selectedBibleId}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500 mb-4">No notes yet</p>
              <button
                onClick={handleCreateNote}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create Your First Note
              </button>
            </div>
          )
        ) : (
          sharedNotes.length > 0 ? (
            sharedNotes.map((note) => (
              <NoteComponent
                key={note.id}
                note={note}
                onSave={handleSaveNote}
                onDelete={handleDeleteNote}
                bibleId={selectedBibleId}
                isShared={true}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-500">No notes shared with you yet</p>
            </div>
          )
        )}
      </div>

      {/* New Note Modal */}
      {showAddNoteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Note</h2>
              <button
                onClick={() => setShowAddNoteForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <input
                type="text"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
            <div className="mb-4">
              <textarea
                ref={newNoteTextareaRef}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                onKeyDown={handleNewNoteKeyDown}
                placeholder="Write your note here..."
                className="w-full h-64 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              {isNewCategory ? (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    ref={newCategoryInputRef}
                    value={newNoteCategory || ''}
                    onChange={(e) => setNewNoteCategory(e.target.value)}
                    placeholder="Enter new category"
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setIsNewCategory(false)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={newNoteCategory || ''}
                  onChange={handleCategoryChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category (optional)</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                  <option value="new">+ Add new category</option>
                </select>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddNoteForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create Note
              </button>
            </div>
            {showInlineSelector && (
              <InlineBibleVerseSelector
                onInsertVerse={handleInsertVerse}
                onClose={() => setShowInlineSelector(false)}
                bibleId={selectedBibleId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 