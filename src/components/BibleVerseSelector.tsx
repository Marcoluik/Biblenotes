import React, { useState, useEffect } from 'react';
import { searchBibleVerses, BibleVerse } from '../lib/bibleApi';

interface BibleVerseSelectorProps {
  onSelect: (verse: BibleVerse) => void;
}

export const BibleVerseSelector: React.FC<BibleVerseSelectorProps> = ({ onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchVerses = async () => {
      if (searchQuery.length < 3) return;
      
      setIsLoading(true);
      const results = await searchBibleVerses(searchQuery);
      setVerses(results);
      setIsLoading(false);
    };

    const timeoutId = setTimeout(searchVerses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className="w-full">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search for a Bible verse..."
        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {isLoading && (
        <div className="mt-2 text-gray-500">Searching...</div>
      )}
      
      {verses.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto">
          {verses.map((verse) => (
            <div
              key={verse.id}
              onClick={() => onSelect(verse)}
              className="p-2 hover:bg-gray-100 cursor-pointer rounded-lg"
            >
              <div className="font-semibold">{verse.reference}</div>
              <div className="text-sm text-gray-600">{verse.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 