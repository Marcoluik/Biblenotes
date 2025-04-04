import React, { useState, useEffect } from 'react';
import { searchBibleVerses } from '../lib/bibleApi';
import { BibleVerse } from '../types';

interface DailyVerseProps {
  bibleId?: string;
}

export const DailyVerse: React.FC<DailyVerseProps> = ({ bibleId }) => {
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDailyVerse = async () => {
      try {
        setIsLoading(true);
        const results = await searchBibleVerses('John 3:16', bibleId);
        if (results && results.length > 0) {
          setVerse(results[0]);
        }
      } catch (err) {
        console.error('Error fetching daily verse:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyVerse();
  }, [bibleId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!verse) {
    return (
      <div className="text-center p-4 text-gray-500">
        No verse available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-2">Daily Verse</h3>
      <div className="text-gray-700">
        <p className="font-medium mb-1">{verse.reference}</p>
        <p className="italic">{verse.content || verse.text || 'No content available'}</p>
      </div>
    </div>
  );
}; 