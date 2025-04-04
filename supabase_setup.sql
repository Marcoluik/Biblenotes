-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(note_id, shared_with)
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS notes_category_idx ON notes(category);

-- Create index on shared_notes for faster queries
CREATE INDEX IF NOT EXISTS shared_notes_note_id_idx ON shared_notes(note_id);
CREATE INDEX IF NOT EXISTS shared_notes_shared_with_idx ON shared_notes(shared_with);

-- Enable Row Level Security (RLS)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can insert their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
    DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
    DROP POLICY IF EXISTS "Allow anonymous access" ON notes;
    DROP POLICY IF EXISTS "Users can view shared notes" ON notes;
    DROP POLICY IF EXISTS "Users can manage their shared notes" ON shared_notes;
END
$$;

-- Create policy to allow users to see their own notes
CREATE POLICY "Users can view their own notes" 
  ON notes FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy to allow users to see notes shared with them
CREATE POLICY "Users can view shared notes" 
  ON notes FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM shared_notes 
      WHERE note_id = notes.id AND shared_with = auth.uid()
    )
  );

-- Create policy to allow users to insert their own notes
CREATE POLICY "Users can insert their own notes" 
  ON notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own notes
CREATE POLICY "Users can update their own notes" 
  ON notes FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own notes
CREATE POLICY "Users can delete their own notes" 
  ON notes FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policy to allow users to manage their shared notes
CREATE POLICY "Users can manage their shared notes" 
  ON shared_notes FOR ALL 
  USING (auth.uid() = shared_by); 