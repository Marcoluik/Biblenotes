-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  website TEXT,
  preferred_bible_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  bible_reference TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create shared_notes table for tracking note sharing
CREATE TABLE IF NOT EXISTS shared_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID NOT NULL REFERENCES auth.users(id),
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(note_id, shared_with)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_category_idx ON notes(category);
CREATE INDEX IF NOT EXISTS shared_notes_note_id_idx ON shared_notes(note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON shared_notes(shared_with);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can insert their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
    DROP POLICY IF EXISTS "Allow anonymous access" ON notes;
    DROP POLICY IF EXISTS "Users can view shared notes" ON notes;
    DROP POLICY IF EXISTS "Users can manage their shared notes" ON shared_notes;
    DROP POLICY IF EXISTS "Users can view notes shared with them" ON shared_notes;
END
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Notes policies
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared notes"
  ON notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_notes
      WHERE note_id = notes.id AND shared_with = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- Shared notes policies
CREATE POLICY "Users can manage their shared notes"
  ON shared_notes FOR ALL
  USING (auth.uid() = shared_by);

CREATE POLICY "Users can view notes shared with them"
  ON shared_notes FOR SELECT
  USING (auth.uid() = shared_with);
