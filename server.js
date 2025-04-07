// server.js
const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech'); // ✅ 確保是相對路徑
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// 健康檢查端點
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

// 啟動 HTTP Server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

// 建立 WebSocket Server
const wss = new WebSocket.Server({ server });

const iflytekClient = new IFLYTEK({
  appId: process.env.IFLYTEK_APP_ID,
  apiKey: process.env.IFLYTEK_API_KEY,
  apiSecret: process.env.IFLYTEK_API_SECRET,
});

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  ws.on('message', async (audioData) => {
    try {
      const result = await iflytekClient.evaluateSpeech(audioData, {
        language: 'zh_cn',
        category: 'read_sentence',
      });
      ws.send(JSON.stringify(result));
    } catch (error) {
      console.error('❌ Error evaluating speech:', error.message);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});

// 捕捉未處理錯誤，防止 server crash
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
