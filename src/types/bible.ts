export interface ParsedReference {
  bookName: string; // The book name as extracted from the input string
  bookNumber: number | null; // Add bookNumber, can be null
  chapter: number | null;    // Allow null
  startVerse: number | null; // Allow null
  endVerse?: number;
} 