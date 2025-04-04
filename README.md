# Bible Notes App

A modern web application for organizing Bible study notes with easy verse selection and reference.

## Features

- Create, edit, and organize Bible study notes
- Easy Bible verse selection and reference
- Clean and intuitive user interface
- Secure data storage with Supabase
- Bible verse lookup using API.Bible
- User authentication with email and password

## Tech Stack

- Frontend: React with TypeScript
- Backend: Supabase
- Bible API: API.Bible
- Styling: Tailwind CSS

## Project Structure

```
src/
├── components/         # Reusable UI components
├── pages/             # Main application pages
├── services/          # API and database services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── App.tsx            # Main application component
```

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with required environment variables
4. Set up Supabase database (see Database Setup section)
5. Run development server: `npm run dev`

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BIBLE_API_KEY=your_bible_api_key
```

## Database Setup

1. Create a new project in Supabase
2. Enable Email Auth in the Authentication section
3. Go to the SQL Editor in your Supabase dashboard
4. Run the SQL script in `supabase_setup.sql` to create the notes table and set up Row Level Security
5. Update your `.env` file with the Supabase URL and anon key from your project settings

## Database Schema

### Notes Table
- id: uuid (primary key)
- user_id: uuid (foreign key to auth.users)
- title: text
- content: text
- bible_reference: text
- created_at: timestamp
- updated_at: timestamp

### Authentication
The app uses Supabase Auth for user authentication:
- Email and password authentication
- Row Level Security (RLS) ensures users can only access their own notes
- Session management handled by Supabase 