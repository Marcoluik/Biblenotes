# Bible Notes App

A modern web application for organizing Bible study notes with easy verse selection and reference, primarily using data sourced from JW.ORG.

## Features

- Create, edit, and organize Bible study notes
- Easy Bible verse selection and reference
- Clean and intuitive user interface
- Secure data storage and user authentication with Supabase
- Bible verse lookup using:
    - A Netlify function proxying requests to JW.ORG (for dynamic fetching)
    - Statically generated JSON files (for offline/faster access, e.g., `public/verse-data/en.json`, `public/verse-data/da.json`)
- Script for generating local verse data (`scripts/generate-danish-verses.mjs`)

## Tech Stack

- Frontend: React with TypeScript, Vite
- Backend: Supabase (Database & Auth)
- Serverless Functions: Netlify Functions (for JW.ORG proxy)
- Styling: Tailwind CSS
- Data Fetching: Axios, Fetch API

## Project Structure

```
.
├── netlify/
│   └── functions/        # Serverless functions (e.g., nwt-proxy)
├── public/
│   └── verse-data/       # Statically generated Bible verse JSON files (en.json, da.json)
├── scripts/              # Helper scripts (e.g., generate-danish-verses.mjs)
├── src/
│   ├── components/       # Reusable UI components
│   ├── lib/              # Core logic, utilities, API interactions (e.g., jwOrgApi.ts)
│   ├── types/            # TypeScript type definitions
│   ├── index.css         # Global styles
│   ├── main.tsx          # Application entry point
│   └── App.tsx           # Main application component
├── .env                  # Environment variables (Supabase keys, etc.)
├── package.json          # Project dependencies and scripts
└── README.md             # This file
```

*(Note: Add other top-level directories like `pages/` or `services/` if they exist)*

## Setup

1.  Clone the repository
2.  Install dependencies: `npm install`
3.  Create `.env` file with required environment variables (see below)
4.  Set up Supabase database (see Database Setup section)
5.  (Optional) Generate local verse data: `node scripts/generate-danish-verses.mjs` (verify command if needed)
6.  Set up Netlify CLI and deploy functions if using the proxy locally or for deployment.
7.  Run development server: `npm run dev`

## Environment Variables

```
# Necessary for Supabase connection
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Add any other environment variables required by your Netlify functions or other services
```

## Database Setup

1.  Create a new project in Supabase
2.  Enable Email Auth in the Authentication section
3.  Go to the SQL Editor in your Supabase dashboard
4.  *If you have a setup script:* Run the SQL script (e.g., `supabase_setup.sql`) to create the notes table and set up Row Level Security. *Otherwise, describe table creation manually.*
5.  Update your `.env` file with the Supabase URL and anon key from your project settings

## Data Sources

-   **JW.ORG Proxy:** The Netlify function in `netlify/functions/nwt-proxy` fetches verse data directly from undocumented JW.ORG endpoints. This is used by the `fetchVerseFromJwOrg` function in `src/lib/jwOrgApi.ts`.
-   **Local JSON:** The `fetchVerseLocally` function in `src/lib/jwOrgApi.ts` reads verse data from JSON files located in `public/verse-data/`. These files can be generated/updated using scripts like `scripts/generate-danish-verses.mjs`.

## Database Schema

### Notes Table (Example - verify actual schema)

-   id: uuid (primary key)
-   user_id: uuid (foreign key to auth.users)
-   title: text
-   content: text
-   bible_reference: text
-   created_at: timestamp
-   updated_at: timestamp

### Authentication

The app uses Supabase Auth for user authentication:

-   Email and password authentication
-   Row Level Security (RLS) ensures users can only access their own notes
-   Session management handled by Supabase 