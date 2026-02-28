const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Centralized token fetching — credentials stay server-side
async function getToken() {
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
    throw new Error(`Token fetch failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.access_token;
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
      const err = await response.text();
      res.status(response.status).json({ error: `API error: ${err}` });
    }
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create a Work Item (quote consultation callback)
app.post('/api/work-item', async (req, res) => {
  const { name, phone, email, from, to, date, size, notes } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const token = await getToken();
    const apiUrl = `${process.env.CXONE_API_BASE}/interactions/work-items?pointOfContact=${process.env.CXONE_WORKITEM_POC}`;

    const payload = {
      notes: JSON.stringify({ name, phone, email, from, to, date, size, notes, requestType: 'Quote Consultation Callback' }),
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
      const err = await response.text();
      res.status(response.status).json({ error: `API error: ${err}` });
    }
  } catch (error) {
    console.error('Work Item error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
      const err = await response.text();
      res.status(response.status).json({ error: `API error: ${err}` });
    }
  } catch (error) {
    console.error('Video callback error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
