export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  bible_reference: string;
  created_at: string;
  updated_at: string;
  category?: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface BibleVerse {
  id: string;
  reference: string;
  content?: string;
  text?: string;
  verse?: string;
} 