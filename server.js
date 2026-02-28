
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/callback', async (req, res) => {
  const { phoneNumber } = req.body;
  const apiUrl = `https://api-b32.nice-incontact.com/incontactapi/services/v32.0/queuecallback?phoneNumber=${phoneNumber}&callerId=%2B61385610000&skill=25174628`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Authorization': `Bearer ${process.env.NICE_INCONTACT_API_KEY}`
      }
    });

    if (response.ok) {
      res.status(200).send('Callback request submitted successfully.');
    } else {
      res.status(response.status).send('Failed to request callback.');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/video-callback', async (req, res) => {
  const apiUrl = `https://api-b32.nice-incontact.com/incontactapi/services/v32.0/interactions/work-items?pointOfContact=53858778`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.NICE_INCONTACT_API_KEY}`
      }
    });

    if (response.ok) {
      res.status(200).send('Video callback request submitted successfully.');
    } else {
      res.status(response.status).send('Failed to request video callback.');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Middleware server listening at http://localhost:${port}`);
});
