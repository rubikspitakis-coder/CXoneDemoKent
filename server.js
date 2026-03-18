const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ─── Prisma Client ───────────────────────────────────────────────────────────
let prisma = null;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  console.log('[Prisma] Client initialised');
} catch (e) {
  console.warn('[Prisma] Client not available — Cognigy Demo API will be disabled:', e.message);
}

// ─── SSE: Member Events ──────────────────────────────────────────────────────
// Stores active SSE response objects keyed by a unique connection ID
const sseClients = new Set();

function broadcastEvent(eventName, payload) {
  const data = JSON.stringify(payload);
  for (const res of sseClients) {
    try { res.write(`event: ${eventName}\ndata: ${data}\n\n`); } catch (_) {}
  }
}

// Seed data factory — always returns the canonical initial state
function seedMembers() {
  return [
    {
      phone: '+61416012160',
      firstName: 'Rubik',
      lastName: 'Pitakis',
      membershipType: 'FCPA',
      status: 'Overdue',
      cpdHours: 112,
      notes: 'Awaiting 2026 renewal.',
      email: 'rubik.pitakis@example.com.au',
      jobTitle: 'Chief Financial Officer',
      company: 'Pitakis Group Pty Ltd',
      renewalDate: '31 Mar 2026',
      outstandingBalance: 450.00,
      preferredChannel: 'Phone',
      lastContactDate: '12 Feb 2026'
    },
    {
      phone: '+61400000002',
      firstName: 'Sarah',
      lastName: 'Thompson',
      membershipType: 'CPA',
      status: 'Active',
      cpdHours: 45,
      notes: 'Enrolled in Ethics webinar.',
      email: 'sarah.thompson@example.com.au',
      jobTitle: 'Senior Accountant',
      company: 'Thompson & Associates',
      renewalDate: '30 Jun 2026',
      outstandingBalance: 0.00,
      preferredChannel: 'Email',
      lastContactDate: '28 Jan 2026'
    },
    {
      phone: '+61400000003',
      firstName: 'Michael',
      lastName: 'Chen',
      membershipType: 'ASA',
      status: 'Pending',
      cpdHours: 12,
      notes: 'Foundation exams in progress.',
      email: 'michael.chen@example.com.au',
      jobTitle: 'Graduate Accountant',
      company: 'Chen Advisory',
      renewalDate: '30 Sep 2026',
      outstandingBalance: 220.00,
      preferredChannel: 'SMS',
      lastContactDate: '05 Mar 2026'
    }
  ];
}

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

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'cx1-static', 'favicon.ico'));
});

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// Diagnostics page
app.get('/diagnostics', (req, res) => {
  res.sendFile(path.join(__dirname, 'diagnostics.html'));
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

app.post('/api/diagnostics', async (req, res) => {
  const results = { env: [], auth: [], api: [], demos: [] };
  
  // 1. Environment variable checks
  const requiredVars = [
    { key: 'CXONE_TOKEN_URL', label: 'Token URL' },
    { key: 'CXONE_CLIENT_ID', label: 'Client ID' },
    { key: 'CXONE_CLIENT_SECRET', label: 'Client Secret' },
    { key: 'CXONE_ACCESS_KEY', label: 'Access Key' },
    { key: 'CXONE_SECRET_KEY', label: 'Secret Key' },
    { key: 'CXONE_API_BASE', label: 'API Base URL' },
    { key: 'CXONE_CALLER_ID', label: 'Caller ID' },
    { key: 'CXONE_CALLBACK_SKILL', label: 'Callback Skill ID' },
    { key: 'CXONE_WORKITEM_POC', label: 'Work Item POC' },
    { key: 'CXONE_VIDEO_POC', label: 'Video POC' },
  ];
  
  for (const v of requiredVars) {
    const val = process.env[v.key];
    results.env.push({
      name: v.label,
      key: v.key,
      status: val ? 'pass' : 'fail',
      detail: val ? 'Configured' : 'Not set',
      ms: 0
    });
  }
  
  // 2. Authentication check
  const authStart = Date.now();
  let token = null;
  try {
    // Force fresh token for diagnostics
    cachedToken = null;
    tokenExpiresAt = 0;
    token = await getToken();
    results.auth.push({
      name: 'Token Fetch',
      status: 'pass',
      detail: 'Successfully authenticated with CXone',
      ms: Date.now() - authStart
    });
  } catch (e) {
    results.auth.push({
      name: 'Token Fetch',
      status: 'fail',
      detail: 'Authentication failed — check credentials',
      ms: Date.now() - authStart
    });
  }
  
  // 3. Token info
  results.tokenInfo = null;
  if (token) {
    results.tokenInfo = {
      expiresIn: Math.max(0, Math.round((tokenExpiresAt - Date.now()) / 1000)),
      cachedUntil: new Date(tokenExpiresAt).toISOString()
    };
  }

  // 4. API endpoint checks (only if we have a token)
  // Helper to check an endpoint with response time benchmarking
  async function checkEndpoint(name, url, warnMs) {
    const start = Date.now();
    try {
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const ms = Date.now() - start;
      if (resp.ok) {
        const status = (warnMs && ms > warnMs) ? 'warn' : 'pass';
        const detail = (warnMs && ms > warnMs) ? `OK but slow (${ms}ms > ${warnMs}ms threshold)` : `Validated`;
        return { name, status, detail, ms };
      }
      return { name, status: 'warn', detail: `Returned ${resp.status}`, ms };
    } catch (e) {
      return { name, status: 'fail', detail: 'Could not reach endpoint', ms: Date.now() - start };
    }
  }

  if (token) {
    const apiBase = process.env.CXONE_API_BASE;
    const SLOW_THRESHOLD = 2000;

    // Callback skill check
    const skill = process.env.CXONE_CALLBACK_SKILL;
    if (!skill) {
      results.api.push({ name: 'Callback Skill', status: 'warn', detail: 'Skill ID not configured', ms: 0 });
    } else {
      results.api.push(await checkEndpoint('Callback Skill', `${apiBase}/skills/${skill}`, SLOW_THRESHOLD));
    }

    // Skill status & activity check
    if (skill) {
      const actStart = Date.now();
      try {
        const resp = await fetch(`${apiBase}/skills/activity`, {
          headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const ms = Date.now() - actStart;
        if (resp.ok) {
          const data = await resp.json();
          const skills = data.skillActivity || [];
          const target = skills.find(s => String(s.skillId) === String(skill));
          if (target) {
            const isActive = target.isActive !== false && target.isActive !== 'False';
            results.api.push({
              name: 'Skill Status',
              status: isActive ? 'pass' : 'warn',
              detail: isActive ? `"${target.skillName}" is active` : `"${target.skillName}" is inactive`,
              ms
            });
          } else {
            results.api.push({ name: 'Skill Status', status: 'warn', detail: `Skill ${skill} not found in activity list`, ms });
          }
        } else {
          results.api.push({ name: 'Skill Status', status: 'warn', detail: `Activity endpoint returned ${resp.status}`, ms });
        }
      } catch (e) {
        results.api.push({ name: 'Skill Status', status: 'fail', detail: 'Could not check skill activity', ms: Date.now() - actStart });
      }
    }

    // Agent availability on callback skill
    if (skill) {
      const agStart = Date.now();
      try {
        const resp = await fetch(`${apiBase}/skills/${skill}/activity`, {
          headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const ms = Date.now() - agStart;
        if (resp.ok) {
          const data = await resp.json();
          const activity = data.skillActivity || data;
          const available = activity.agentsAvailable || activity.AgentsAvailable || 0;
          const loggedIn = activity.agentsLoggedIn || activity.AgentsLoggedIn || 0;
          if (available > 0) {
            results.api.push({ name: 'Agent Availability', status: 'pass', detail: `${available} agent(s) available, ${loggedIn} logged in`, ms });
          } else if (loggedIn > 0) {
            results.api.push({ name: 'Agent Availability', status: 'warn', detail: `${loggedIn} agent(s) logged in but none available`, ms });
          } else {
            results.api.push({ name: 'Agent Availability', status: 'fail', detail: 'No agents logged in on this skill', ms });
          }
        } else {
          results.api.push({ name: 'Agent Availability', status: 'warn', detail: `Agent check returned ${resp.status}`, ms });
        }
      } catch (e) {
        results.api.push({ name: 'Agent Availability', status: 'fail', detail: 'Could not check agent availability', ms: Date.now() - agStart });
      }
    }

    // Work item POC
    const poc = process.env.CXONE_WORKITEM_POC;
    if (!poc) {
      results.api.push({ name: 'Work Item POC', status: 'warn', detail: 'POC not configured', ms: 0 });
    } else {
      results.api.push(await checkEndpoint('Work Item POC', `${apiBase}/points-of-contact/${poc}`, SLOW_THRESHOLD));
    }

    // Video POC
    const vidPoc = process.env.CXONE_VIDEO_POC;
    if (!vidPoc) {
      results.api.push({ name: 'Video POC', status: 'warn', detail: 'Video POC not configured', ms: 0 });
    } else {
      results.api.push(await checkEndpoint('Video POC', `${apiBase}/points-of-contact/${vidPoc}`, SLOW_THRESHOLD));
    }
  } else {
    results.api.push({ name: 'Callback Skill', status: 'fail', detail: 'Skipped — no auth token', ms: 0 });
    results.api.push({ name: 'Skill Status', status: 'fail', detail: 'Skipped — no auth token', ms: 0 });
    results.api.push({ name: 'Agent Availability', status: 'fail', detail: 'Skipped — no auth token', ms: 0 });
    results.api.push({ name: 'Work Item POC', status: 'fail', detail: 'Skipped — no auth token', ms: 0 });
    results.api.push({ name: 'Video POC', status: 'fail', detail: 'Skipped — no auth token', ms: 0 });
  }

  // 5. CXone widget reachability
  results.widgets = [];
  const demosDir2 = path.join(__dirname, 'demos');
  if (fs.existsSync(demosDir2)) {
    const entries2 = fs.readdirSync(demosDir2, { withFileTypes: true });
    for (const entry of entries2) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const configPath = path.join(demosDir2, entry.name, 'demo.json');
      if (!fs.existsSync(configPath)) continue;
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.cxone?.loaderUrl) {
          const wStart = Date.now();
          try {
            const resp = await fetch(config.cxone.loaderUrl, { method: 'HEAD' });
            const ms = Date.now() - wStart;
            results.widgets.push({
              name: config.name || entry.name,
              status: resp.ok ? 'pass' : 'warn',
              detail: resp.ok ? `Widget loader reachable (${resp.status})` : `Widget loader returned ${resp.status}`,
              ms
            });
          } catch (e) {
            results.widgets.push({ name: config.name || entry.name, status: 'fail', detail: 'Widget loader unreachable', ms: Date.now() - wStart });
          }
        }
      } catch {}
    }
  }

  // 4. Demo page checks
  const demosDir = path.join(__dirname, 'demos');
  if (fs.existsSync(demosDir)) {
    const entries = fs.readdirSync(demosDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      const configPath = path.join(demosDir, entry.name, 'demo.json');
      if (!fs.existsSync(configPath)) {
        results.demos.push({ name: entry.name, slug: entry.name, status: 'fail', detail: 'Missing demo.json', ms: 0 });
        continue;
      }
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const issues = [];
        if (!config.name) issues.push('missing name');
        if (!config.cxone?.brandId) issues.push('missing brandId');
        if (!config.cxone?.guideId) issues.push('missing guideId');
        
        if (issues.length > 0) {
          results.demos.push({ name: config.name || entry.name, slug: entry.name, status: 'warn', detail: issues.join(', '), ms: 0 });
        } else {
          results.demos.push({ name: config.name, slug: entry.name, status: 'pass', detail: 'Configuration valid', ms: 0 });
        }
      } catch (e) {
        results.demos.push({ name: entry.name, slug: entry.name, status: 'fail', detail: 'Invalid demo.json: ' + e.message, ms: 0 });
      }
    }
  }

  res.json(results);
});

// ─── Cognigy Demo: SSE endpoint ─────────────────────────────────────────────
app.get('/api/member-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send a heartbeat comment every 25s to keep the connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 25000);

  sseClients.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ─── Cognigy Demo: GET member by phone ──────────────────────────────────────
app.get('/api/member/:phone', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not available' });
  try {
    const phone = decodeURIComponent(req.params.phone);
    const member = await prisma.member.findUnique({ where: { phone } });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    // Broadcast a read event so the dashboard can highlight fields
    const readFields = req.query.fields
      ? req.query.fields.split(',')
      : ['status', 'cpdHours', 'membershipType', 'renewalDate', 'outstandingBalance'];
    broadcastEvent('member-read', { phone, fields: readFields });

    res.json(member);
  } catch (e) {
    console.error('[GET /api/member]', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Cognigy Demo: PATCH member by phone ────────────────────────────────────
app.patch('/api/member/:phone', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not available' });

  // Accept any updatable field from the request body
  const ALLOWED = ['firstName', 'lastName', 'phone', 'email', 'jobTitle', 'company',
    'membershipType', 'status', 'cpdHours', 'notes',
    'renewalDate', 'outstandingBalance', 'preferredChannel', 'lastContactDate'];
  const updateData = {};
  const changes = {};
  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) {
      const val = field === 'cpdHours' ? parseInt(req.body[field], 10)
        : field === 'outstandingBalance' ? parseFloat(req.body[field])
        : req.body[field];
      updateData[field] = val;
      changes[field] = val;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const phone = decodeURIComponent(req.params.phone);
    const member = await prisma.member.update({
      where: { phone },
      data: updateData
    });
    // Broadcast named event with changed fields for targeted highlighting
    broadcastEvent('member-updated', { phone, member, changes });
    res.json(member);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Member not found' });
    console.error('[PATCH /api/member]', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Cognigy Demo: GET all members ──────────────────────────────────────────
app.get('/api/members', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not available' });
  try {
    const members = await prisma.member.findMany({ orderBy: { lastName: 'asc' } });
    res.json(members);
  } catch (e) {
    console.error('[GET /api/members]', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Cognigy Demo: POST reset ────────────────────────────────────────────────
app.post('/api/reset', async (req, res) => {
  if (!prisma) return res.status(503).json({ error: 'Database not available' });
  try {
    await prisma.member.deleteMany();
    const seeds = seedMembers();
    for (const s of seeds) {
      await prisma.member.create({ data: s });
    }
    const members = await prisma.member.findMany({ orderBy: { lastName: 'asc' } });
    // Broadcast a full reset event
    broadcastEvent('reset', members);
    res.json({ ok: true, members });
  } catch (e) {
    console.error('[POST /api/reset]', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── Cognigy Demo: Serve dashboard page ─────────────────────────────────────
app.get('/cognigy', (req, res) => {
  res.sendFile(path.join(__dirname, 'cognigy.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
