import React, { useState } from 'react';
import { searchBibleVerses } from '../lib/bibleApi';
import { BibleVerse } from '../types';

export const BibleApiTest: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const verses = await searchBibleVerses(query);
      setResults(verses);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderVerseContent = (verse: BibleVerse) => {
    if (verse.content) {
      // For book searches (passages), content includes HTML
      return <div dangerouslySetInnerHTML={{ __html: verse.content }} />;
    }
    if (verse.text) {
      // For regular searches, text is plain text
      return <div className="text-sm text-gray-600">{verse.text}</div>;
    }
    return null;
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Bible API Test</h2>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter search query"
          className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 disabled:bg-blue-300"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}
      
      {results.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold">Results:</h3>
          {results.map((verse) => (
            <div key={verse.id} className="p-2 border rounded-lg">
              <div className="font-medium">{verse.reference}</div>
              {renderVerseContent(verse)}
            </div>
          ))}
        </div>
      ) : !loading && !error && (
        <div className="text-gray-500">No results found</div>
      )}
    </div>
  );
}; 