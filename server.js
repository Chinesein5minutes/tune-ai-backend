// server.js
const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech'); // ✅ 修正路徑
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});

const wss = new WebSocket.Server({ server });

const iflytekClient = new IFLYTEK({
  appId: process.env.IFLYTEK_APP_ID,
  apiKey: process.env.IFLYTEK_API_KEY,
  apiSecret: process.env.IFLYTEK_API_SECRET,
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', async (audioData) => {
    try {
      const result = await iflytekClient.evaluateSpeech(audioData, {
        language: 'zh_cn',
        category: 'read_sentence',
      });
      ws.send(JSON.stringify(result));
    } catch (error) {
      ws.send(JSON.stringify({ error: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

app.get('/health', (req, res) => {
  res.send('Server is healthy');
});
