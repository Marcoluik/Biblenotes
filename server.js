import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BIBLE_API_BASE_URL = 'https://api.scripture.api.bible/v1';
const DEFAULT_BIBLE_ID = 'de4e12af7f28f599-02'; // King James Version (KJV)

if (!process.env.VITE_BIBLE_API_KEY) {
  console.error('ERROR: VITE_BIBLE_API_KEY is not set in environment variables');
  process.exit(1);
}

// Enable CORS
app.use(cors());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  next();
});

// Bible API proxy
app.get('/api/bible/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    // Check if the query is a book name
    const isBookSearch = /^[1-3]?\s*[A-Za-z]+$/.test(query); // Matches book names like "Genesis", "1 Kings", etc.
    
    if (isBookSearch) {
      console.log('[Search] Book search detected, fetching chapters');
      // First get the book ID
      const booksResponse = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/books`,
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      const books = booksResponse.data.data;
      const book = books.find(b => 
        b.name.toLowerCase() === query.toLowerCase() ||
        b.name.toLowerCase().includes(query.toLowerCase())
      );

      if (!book) {
        console.log('[Search] Book not found, falling back to search');
        // Fall back to regular search if book not found
        const searchResponse = await axios({
          method: 'get',
          url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/search`,
          params: { query, limit },
          headers: {
            'api-key': process.env.VITE_BIBLE_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        res.json(searchResponse.data);
        return;
      }

      // Get the first chapter of the book
      const chapterResponse = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/chapters/${book.id}.1`,
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      // Format the response to match our expected structure
      const formattedResponse = {
        data: {
          passages: [{
            id: chapterResponse.data.data.id,
            reference: `${book.name} 1`,
            content: chapterResponse.data.data.content
          }]
        }
      };

      res.json(formattedResponse);
    } else {
      console.log('[Search] Regular search, using search endpoint');
      // For regular searches, use the search endpoint
      const response = await axios({
        method: 'get',
        url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/search`,
        params: { query, limit },
        headers: {
          'api-key': process.env.VITE_BIBLE_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Search] Bible API response status:', response.status);
      res.json(response.data);
    }
  } catch (error) {
    console.error('[Search] Error proxying Bible API request:', error.message);
    if (error.response) {
      console.error('[Search] API Response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to fetch Bible verses' });
    }
  }
});

app.get('/api/bible/verses/:reference', async (req, res) => {
  try {
    console.log('[Verses] Proxying request to Bible API:', {
      url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/verses/${req.params.reference}`,
      params: req.query,
    });

    const response = await axios({
      method: 'get',
      url: `${BIBLE_API_BASE_URL}/bibles/${DEFAULT_BIBLE_ID}/verses/${req.params.reference}`,
      headers: {
        'api-key': process.env.VITE_BIBLE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Verses] Bible API response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('[Verses] Error proxying Bible API request:', error.message);
    if (error.response) {
      console.error('[Verses] API Response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to fetch Bible verse' });
    }
  }
});

// Handle all API routes that don't match
app.use('/api', (req, res) => {
  console.log(`[404] No route found for ${req.method} ${req.url}`);
  res.status(404).json({ error: `No API route found for ${req.method} ${req.url}` });
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all other routes by serving index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log(`Server running on port ${PORT}`);
  console.log(`Bible API proxy configured at ${BIBLE_API_BASE_URL}`);
  console.log(`API Key present: ${!!process.env.VITE_BIBLE_API_KEY}`);
  console.log(`Using Bible ID: ${DEFAULT_BIBLE_ID}`);
  console.log('='.repeat(80));
}); 