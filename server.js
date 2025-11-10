// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// CORS + JSON + static
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// ------------------------------------
// MySQL connection
// ------------------------------------
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Kavya@1356', // put the real password, do not commit
  database: 'dbms'
});

db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection error:', err);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

// ------------------------------------
// CSV loading for search
// ------------------------------------
let papers = [];

function loadCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    // Ensure this filename matches your repo: classified_papers.csv
    const csvPath = path.join(__dirname, 'classified_papers.csv');
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        results.push({
          title: row['Title'] || '',
          author: row['Authors'] || '',
          domain: row['Main Domain'] || 'Others',
          year: row['Year'] || '',
          // normalize both possible header keys
          keywords: (row['keywords_cleaned'] || row['keywordscleaned'] || '').toLowerCase(),
          doi: (row['DOI'] || '').toLowerCase()
        });
      })
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} papers from CSV`);
        resolve(results);
      })
      .on('error', reject);
  });
}

// ------------------------------------
// Auth helpers
// ------------------------------------
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ------------------------------------
// Search endpoint used by homepage/results/allpapers/domain
// ------------------------------------
app.get('/search', (req, res) => {
  const rawTerm = req.query.term || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;

  let filtered = papers;
  if (rawTerm.trim() !== '') {
    const terms = rawTerm.toLowerCase().split(',').map(t => t.trim());
    filtered = papers.filter(p => {
      const title = (p.title || '').toLowerCase();
      const author = (p.author || '').toLowerCase();
      const domain = (p.domain || '').toLowerCase();
      const keywords = (p.keywords || '').toLowerCase();
      const year = String(p.year || '');
      const doi = (p.doi || '').toLowerCase();
      return terms.some(term =>
        /^\d{4}$/.test(term)
          ? year === term
          : title.includes(term) ||
            author.includes(term) ||
            domain.includes(term) ||
            keywords.includes(term) ||
            doi.includes(term)
      );
    });
  }

  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);
  res.json({ papers: paginated, total: filtered.length });
});

// ------------------------------------
// Reviews
// Table expected:
// reviews(id PK AI, reviewer VARCHAR(100), review_text TEXT, review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// ------------------------------------
app.post('/submit-review', (req, res) => {
  const { name, review } = req.body;
  if (!name || !review) {
    return res.status(400).json({ error: 'Name and review are required' });
  }
  const sql = 'INSERT INTO reviews (reviewer, review_text) VALUES (?, ?)';
  db.query(sql, [name, review], (err) => {
    if (err) {
      console.error('❌ Failed to insert review:', err);
      return res.status(500).json({ error: 'Database insert error' });
    }
    res.status(200).json({ message: '✅ Review submitted successfully' });
  });
});

app.get('/get-reviews', (_req, res) => {
  const sql = 'SELECT id, reviewer AS name, review_text AS review, review_date AS timestamp FROM reviews ORDER BY review_date DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Failed to fetch reviews:', err);
      return res.status(500).json({ error: 'Failed to retrieve reviews' });
    }
    res.json(results);
  });
});

// ------------------------------------
// Contact
// Table expected:
// contact_messages(id PK AI, name, email, message, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// ------------------------------------
// REPLACE the existing /contact handler in server.js with this block

// Contact: allow client to omit email when logged in; show a consistent success payload
app.post('/contact', async (req, res) => {
  let { name, email, message } = req.body || {};
  if (!name || !message) return res.status(400).json({ error: 'All fields required' });

  // If no email provided, try to read from Authorization header
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!email && token) {
      const u = jwt.verify(token, JWT_SECRET);
      email = u?.email || email || null;
      if (!name && u?.username) name = u.username;
    }
  } catch (_) { /* ignore token errors; email remains as provided */ }

  db.query(
    'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
    [name, email || null, message],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.json({ ok: true, message: 'Your message was submitted. We will reach out to you ASAP.' });
    }
  );
});

// ------------------------------------
// Blogs
// Tables expected:
// blog_posts(id PK AI, title, content, image_url, created_by, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// blog_comments(id PK AI, post_id FK, username, comment, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// blog_likes(id PK AI, post_id FK, username, liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(post_id, username))
// ------------------------------------
app.get('/blogs', (_req, res) => {
  db.query('SELECT * FROM blog_posts ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'DB Fetch Error' });
    res.json(results);
  });
});

app.post('/blogs', (req, res) => {
  const { title, content, image_url, created_by } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  db.query(
    'INSERT INTO blog_posts (title, content, image_url, created_by) VALUES (?, ?, ?, ?)',
    [title, content, image_url || null, created_by || null],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.status(200).json({ message: 'Blog posted!' });
    }
  );
});

app.post('/blogs/:id/comment', (req, res) => {
  const { username, comment } = req.body || {};
  if (!username || !comment) return res.status(400).json({ error: 'All fields required' });
  db.query(
    'INSERT INTO blog_comments (post_id, username, comment) VALUES (?, ?, ?)',
    [req.params.id, username, comment],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.status(200).json({ message: 'Comment added!' });
    }
  );
});

app.post('/blogs/:id/like', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username required' });
  db.query(
    'INSERT INTO blog_likes (post_id, username) VALUES (?, ?)',
    [req.params.id, username],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.status(200).json({ message: 'Blog liked!' });
    }
  );
});

// ------------------------------------
// FAQ
// Tables expected:
// faq(id PK AI, question TEXT, answer TEXT NULL, asked_by VARCHAR(100) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// faq_comments(id PK AI, faq_id FK, username, comment, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// ------------------------------------
app.get('/faqs', (_req, res) => {
  db.query('SELECT * FROM faq ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'DB Fetch Error' });
    res.json(results);
  });
});

app.post('/faqs', (req, res) => {
  const { question, answer, asked_by } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Question required' });
  db.query(
    'INSERT INTO faq (question, answer, asked_by) VALUES (?, ?, ?)',
    [question, answer || null, asked_by || null],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.status(200).json({ message: 'FAQ added!' });
    }
  );
});

app.post('/faqs/:id/comment', (req, res) => {
  const { username, comment } = req.body || {};
  if (!username || !comment) return res.status(400).json({ error: 'All fields required' });
  db.query(
    'INSERT INTO faq_comments (faq_id, username, comment) VALUES (?, ?, ?)',
    [req.params.id, username, comment],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB Insert Error' });
      res.status(200).json({ message: 'FAQ Comment added!' });
    }
  );
});

// ------------------------------------
// Auth: secure signup/login + profile
// users(id PK AI, username UNIQUE, email UNIQUE, passwordhash, role, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
// Note: migrate from password_hash -> passwordhash column name if needed.
// ------------------------------------
app.post('/auth/signup', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

  db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (rows.length) return res.status(409).json({ error: 'User exists' });

    const hash = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (username, email, passwordhash, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, 'user'],
      (err2, result) => {
        if (err2) return res.status(500).json({ error: 'DB insert error' });
        const user = { id: result.insertId, username, email, role: 'user' };
        const token = signToken(user);
        res.status(201).json({ user, token });
      }
    );
  });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'All fields required' });

  db.query(
    'SELECT id, username, email, role, passwordhash FROM users WHERE username = ?',
    [username],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const u = rows[0];
      const ok = await bcrypt.compare(password, u.passwordhash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const user = { id: u.id, username: u.username, email: u.email, role: u.role };
      const token = signToken(user);
      res.json({ user, token });
    }
  );
});

app.post('/auth/logout', (_req, res) => {
  // Client deletes token; this endpoint is for symmetry
  res.json({ ok: true });
});

app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ------------------------------------
// Serve homepage explicitly
// ------------------------------------
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ------------------------------------
// Boot
// ------------------------------------
loadCSV()
  .then(data => {
    papers = data;
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to load CSV:', err);
  });
