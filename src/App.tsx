import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Note as NoteComponent } from './components/Note';
import { Auth } from './components/Auth';
import { ErrorMessage } from './components/ErrorMessage';
import { Note } from './types';
import { DailyVerse } from './components/DailyVerse';
import { getAvailableBibles } from './lib/bibleApi';
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
  const newNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  
  // Bible selection state
  const [availableBibles, setAvailableBibles] = useState<{ id: string; name: string; language: { id: string; name: string } }[]>([]);
  const [selectedBibleId, setSelectedBibleId] = useState<string>('');
  const [bibleSearchTerm, setBibleSearchTerm] = useState<string>('');
  const [filteredBibles, setFilteredBibles] = useState<{ id: string; name: string; language: { id: string; name: string } }[]>([]);
  const [isBibleDropdownOpen, setIsBibleDropdownOpen] = useState(false);
  const bibleDropdownRef = useRef<HTMLDivElement>(null);

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

    // Fetch available Bibles
    const fetchBibles = async () => {
      try {
        const bibles = await getAvailableBibles();
        
        if (bibles.length === 0) {
          console.log('No Bibles found, using default Bible ID');
          // Set a default Bible ID if no Bibles are found
          setSelectedBibleId('9879dbb7cfe39e4d-01'); // ESV Bible ID
          return;
        }
        
        setAvailableBibles(bibles);
        setFilteredBibles(bibles);
        
        // Find ESV Bible and set it as default
        const esvBible = bibles.find(bible => 
          bible.name.toLowerCase().includes('english standard version') || 
          bible.name.toLowerCase().includes('esv') ||
          bible.id === '9879dbb7cfe39e4d-01'
        );
        
        if (esvBible) {
          console.log('Found ESV Bible:', esvBible); // Debug log
          setSelectedBibleId(esvBible.id);
        } else {
          // Fall back to King James Version
          const kjvBible = bibles.find(bible => 
            bible.name.toLowerCase().includes('king james version') || 
            bible.name.toLowerCase().includes('kjv') ||
            bible.id === 'de4e12af7f28f599-02'
          );
          
          if (kjvBible) {
            console.log('Found KJV Bible:', kjvBible); // Debug log
            setSelectedBibleId(kjvBible.id);
          } else if (bibles.length > 0) {
            console.log('Setting first Bible as default:', bibles[0]); // Debug log
            setSelectedBibleId(bibles[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching Bibles:', error);
        // Set a default Bible ID if there's an error
        setSelectedBibleId('9879dbb7cfe39e4d-01'); // ESV Bible ID
      }
    };
    
    fetchBibles();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Filter Bibles when search term changes
  useEffect(() => {
    console.log('Bible search term changed:', bibleSearchTerm);
    console.log('Available Bibles:', availableBibles);

    if (!bibleSearchTerm.trim()) {
      console.log('Empty search term, showing all Bibles');
      setFilteredBibles(availableBibles);
      return;
    }

    const searchTerm = bibleSearchTerm.toLowerCase();
    const filtered = availableBibles.filter(bible => {
      const nameMatch = bible.name.toLowerCase().includes(searchTerm);
      const languageMatch = bible.language.name.toLowerCase().includes(searchTerm);
      return nameMatch || languageMatch;
    });

    console.log('Filtered Bibles:', filtered);
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
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(
        data
          .map((note: Note) => note.category)
          .filter((category): category is string => typeof category === 'string')
      ));
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
      const updatedNotes = notes.map(note => {
        if (note.id === id) {
          return { 
            ...note, 
            title, 
            content, 
            updated_at: new Date().toISOString() 
          };
        }
        return note;
      });
      setNotes(updatedNotes);
      localStorage.setItem('notes', JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Error saving note:', error);
      throw error;
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
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
      setError(error.message);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteTitle.trim()) {
      alert('Please enter a title for your note');
      return;
    }

    try {
      const noteId = crypto.randomUUID();
      const newNote: Note = {
        id: noteId,
        user_id: user?.id || '',
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        category: newNoteCategory?.trim() || 'uncategorized',
        bible_reference: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to local state
      setNotes(prevNotes => [...prevNotes, newNote]);
      localStorage.setItem('notes', JSON.stringify([...notes, newNote]));

      // Save to Supabase if user is authenticated
      if (user) {
        const { error } = await supabase
          .from('notes')
          .insert([{
            id: noteId,
            user_id: user.id,
            title: newNote.title,
            content: newNote.content,
            category: newNote.category,
            bible_reference: '',
            created_at: newNote.created_at,
            updated_at: newNote.updated_at
          }]);

        if (error) throw error;
      }

      // Update categories if needed
      if (newNote.category && !categories.includes(newNote.category)) {
        setCategories(prev => [...prev, newNote.category as string]);
        localStorage.setItem('categories', JSON.stringify([...categories, newNote.category]));
      }

      // Reset form
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteCategory(undefined);
      setShowAddNoteForm(false);
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Failed to create note. Please try again.');
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
        setIsBibleDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation for Bible dropdown
  const handleBibleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isBibleDropdownOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsBibleDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsBibleDropdownOpen(false);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filteredBibles.findIndex(bible => bible.id === selectedBibleId);
      let newIndex;
      
      if (e.key === 'ArrowDown') {
        newIndex = currentIndex < filteredBibles.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : filteredBibles.length - 1;
      }
      
      if (newIndex >= 0 && newIndex < filteredBibles.length) {
        setSelectedBibleId(filteredBibles[newIndex].id);
      }
    }
  };

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
          <h1 className="mobile-header-title font-bold text-gray-800">Bible Notes</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCreateNote}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              Create Note
            </button>
            <div className="relative group">
              <button className="p-2 text-gray-600 hover:text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 hidden group-hover:block">
                <div className="px-4 py-2 text-sm text-gray-600 border-b">
                  {user.email}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Verse */}
      <DailyVerse bibleId={selectedBibleId} />
      
      {/* Filters Row */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Category Filter */}
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Notes</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Bible Selection */}
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Bible Translation
          </label>
          <div className="relative" ref={bibleDropdownRef}>
            <div 
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer flex justify-between items-center"
              onClick={() => setIsBibleDropdownOpen(!isBibleDropdownOpen)}
              onKeyDown={handleBibleKeyDown}
              tabIndex={0}
              role="combobox"
              aria-expanded={isBibleDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="bible-listbox"
            >
              <span>
                {availableBibles.find(bible => bible.id === selectedBibleId)?.name || 'Select Bible'}
              </span>
              <span>{isBibleDropdownOpen ? '▲' : '▼'}</span>
            </div>
            
            {isBibleDropdownOpen && (
              <div 
                className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                id="bible-listbox"
                role="listbox"
              >
                <div className="sticky top-0 bg-white p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search Bible translations..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={bibleSearchTerm}
                    onChange={(e) => setBibleSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="py-1">
                  {filteredBibles.length > 0 ? (
                    filteredBibles.map(bible => (
                      <div
                        key={bible.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${bible.id === selectedBibleId ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          setSelectedBibleId(bible.id);
                          setIsBibleDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={bible.id === selectedBibleId}
                      >
                        {bible.name} ({bible.language.name})
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500">No matching Bibles found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Note Form */}
      {showAddNoteForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Add Note</h2>
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
              className="w-full h-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="flex space-x-2">
            <button
              onClick={handleAddNote}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Add Note
            </button>
            <button
              onClick={() => setShowAddNoteForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancel
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
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredNotes.map((note) => (
          <NoteComponent
            key={note.id}
            note={note}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            bibleId={selectedBibleId}
          />
        ))}
      </div>
    </div>
  );
}

export default App; 