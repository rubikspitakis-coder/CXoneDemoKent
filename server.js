const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));

// Site-wide cookie-based password protection
const crypto = require('crypto');
const AUTH_COOKIE = 'site_token';

function authToken(password) {
  return crypto.createHmac('sha256', password).update('site-auth').digest('hex').slice(0, 32);
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    cookies[k] = v.join('=');
  });
  return cookies;
}

// Rate limit login attempts — 5 attempts per 15 minutes per IP
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoint — must be before the middleware
app.post('/auth', authLimiter, (req, res) => {
  const password = process.env.CX1_PASSWORD;
  if (!password) return res.status(500).json({ error: 'Auth not configured' });

  if (req.body.password === password) {
    res.cookie(AUTH_COOKIE, authToken(password), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// Logout endpoint — must be before the auth middleware
app.get('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.redirect('/');
});

// Protect everything except the auth endpoint and login page assets
app.use((req, res, next) => {
  const password = process.env.CX1_PASSWORD;
  if (!password) return res.status(503).send('Site not configured');
  if (req.path === '/auth') return next();
  if (req.path === '/logout') return next();

  const cookies = parseCookies(req.headers.cookie);
  if (cookies[AUTH_COOKIE] === authToken(password)) return next();

  res.sendFile(path.join(__dirname, 'cx1-login.html'));
});

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// Shared assets
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// Demo static files
app.use('/demos', express.static(path.join(__dirname, 'demos')));

// CX1 Showcase SPA
app.use('/cx1', express.static(path.join(__dirname, 'cx1-static')));
app.get('/cx1/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'cx1-static', 'index.html'));
});

// Auto-detect thumbnail from demo folder
const THUMB_NAMES = ['thumbnail.png', 'thumbnail.jpg', 'screenshot.png', 'screenshot.jpg', 'logo.png', 'logo.jpg', 'logo.svg'];
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']);

function findThumbnail(slug, config) {
  if (config.thumbnail) return `/demos/${slug}/${config.thumbnail}`;
  if (config.branding?.logoUrl) return `/demos/${slug}/${config.branding.logoUrl}`;

  const demoDir = path.join(__dirname, 'demos', slug);
  // Check common names first
  for (const name of THUMB_NAMES) {
    if (fs.existsSync(path.join(demoDir, name))) return `/demos/${slug}/${name}`;
  }
  // Fall back to first image file found
  try {
    const file = fs.readdirSync(demoDir).find(f => IMG_EXTS.has(path.extname(f).toLowerCase()));
    if (file) return `/demos/${slug}/${file}`;
  } catch {}
  return null;
}

// List available demos
app.get('/api/demos', (req, res) => {
  const demosDir = path.join(__dirname, 'demos');
  if (!fs.existsSync(demosDir)) return res.json([]);

  const entries = fs.readdirSync(demosDir, { withFileTypes: true });
  const demos = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const configPath = path.join(demosDir, entry.name, 'demo.json');
    if (!fs.existsSync(configPath)) continue;
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      demos.push({
        name: config.name,
        slug: entry.name,
        description: config.description,
        thumbnail: findThumbnail(entry.name, config),
        branding: config.branding || {}
      });
    } catch (e) {
      console.error(`Error reading demo.json for ${entry.name}:`, e.message);
    }
  }

  res.json(demos);
});

// Centralized token fetching — with caching
let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const { CXONE_TOKEN_URL, CXONE_CLIENT_ID, CXONE_CLIENT_SECRET, CXONE_ACCESS_KEY, CXONE_SECRET_KEY } = process.env;
  const authString = Buffer.from(`${CXONE_CLIENT_ID}:${CXONE_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(CXONE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: CXONE_ACCESS_KEY,
      password: CXONE_SECRET_KEY,
      scope: 'incontact.agent incontact.realtime incontact.admin'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`Token fetch failed: ${response.status} - ${err}`);
    throw new Error('Failed to authenticate with CXone');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Cache for 90% of expiry time (default 3600s), or 50 minutes as fallback
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 0.9 * 1000);
  return cachedToken;
}

// Queue a callback
app.post('/api/callback', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

  try {
    const token = await getToken();
    const apiUrl = `${process.env.CXONE_API_BASE}/queuecallback?phoneNumber=${encodeURIComponent(phoneNumber)}&callerId=${process.env.CXONE_CALLER_ID}&skill=${process.env.CXONE_CALLBACK_SKILL}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Accept': '*/*', 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      res.status(200).json({ message: 'Callback request submitted successfully.' });
    } else {
      console.error('Callback API error:', response.status, await response.text());
      res.status(502).json({ error: 'Callback request failed. Please try again.' });
    }
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const lastQuotes = new Map(); // session-scoped: token -> quote

// Create a Work Item (quote consultation callback)
app.post('/api/work-item', async (req, res) => {
  const { name, phone, email, from, to, date, size, notes, moveType } = req.body;
  
  // Save to memory scoped to session for the 'Magic' Agent Dashboard bypass
  const sessionToken = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  if (sessionToken) lastQuotes.set(sessionToken, { name, phone, email, from, to, date, size, notes, moveType });

  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const token = await getToken();
    const apiUrl = `${process.env.CXONE_API_BASE}/interactions/work-items?pointOfContact=${process.env.CXONE_WORKITEM_POC}`;

    // Encode as Base64 for the most reliable passing through Studio and URLs
    const rawData = JSON.stringify({
      name, phone, email, from, to, date, size, notes, moveType
    });
    const base64Data = Buffer.from(rawData).toString('base64');

    const payload = {
      payload: base64Data,
      mediaType: 'WorkItem'
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json(data);
    } else {
      console.error('Work Item API error:', response.status, await response.text());
      res.status(502).json({ error: 'Work item creation failed. Please try again.' });
    }
  } catch (error) {
    console.error('Work Item error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Studio trigger — GET endpoint so GETPAGE action can call it
app.get('/api/studio-callback', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).send('phone parameter is required');

  try {
    const token = await getToken();
    const apiUrl = `${process.env.CXONE_API_BASE}/queuecallback?phoneNumber=${encodeURIComponent(phone)}&callerId=${process.env.CXONE_CALLER_ID}&skill=${process.env.CXONE_CALLBACK_SKILL}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Accept': '*/*', 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      res.status(200).send('OK');
    } else {
      console.error('Studio callback API error:', response.status, await response.text());
      res.status(502).send('Callback failed');
    }
  } catch (error) {
    console.error('Studio callback error:', error);
    res.status(500).send('Error');
  }
});

app.get('/api/last-quote', (req, res) => {
  const sessionToken = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  const quote = sessionToken && lastQuotes.get(sessionToken);
  if (quote) res.json(quote);
  else res.status(404).send('No quotes found');
});

// Video call work item
app.post('/api/video-callback', async (req, res) => {
  const { surflyUrl } = req.body;

  try {
    const token = await getToken();
    const apiUrl = `${process.env.CXONE_API_BASE}/interactions/work-items?pointOfContact=${process.env.CXONE_VIDEO_POC}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        notes: `Surfly Video Call Requested: ${surflyUrl || 'N/A'}`,
        mediaType: 'WorkItem'
      })
    });

    if (response.ok) {
      res.status(200).json({ message: 'Video callback request submitted successfully.' });
    } else {
      console.error('Video callback API error:', response.status, await response.text());
      res.status(502).json({ error: 'Video callback request failed. Please try again.' });
    }
  } catch (error) {
    console.error('Video callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const token = await getToken();
    res.json({ status: 'ok', cxone: 'connected', env: process.env.NODE_ENV || 'development' });
  } catch (error) {
    res.json({ status: 'degraded', cxone: 'disconnected', env: process.env.NODE_ENV || 'development', error: 'CXone authentication failed' });
  }
});

app.get('/api/env', (req, res) => {
  res.json({ env: process.env.DEMO_ENV || process.env.NODE_ENV || 'development' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
