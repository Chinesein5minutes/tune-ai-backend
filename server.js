const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech');
require('dotenv').config();

const app = express();

// 健康檢查端點
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

// 啟動 HTTP Server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

// WebSocket Server
const wss = new WebSocket.Server({ server });
console.log("✅ WebSocket server is running.");

const iflytekClient = new IFLYTEK({
  appId: process.env.IFLYTEK_APP_ID,
  apiKey: process.env.IFLYTEK_API_KEY,
  apiSecret: process.env.IFLYTEK_API_SECRET,
});

wss.on('connection', (ws) => {
  console.log('🔌 Client connected');

  ws.on('message', async (audioData) => {
    console.log("🎙️ 收到語音資料，準備送出分析...");
    try {
      const result = await iflytekClient.evaluateSpeech(audioData, {
        language: 'zh_cn',
        category: 'read_sentence',
      });
      console.log("📤 已送出語音分析回應");
      ws.send(JSON.stringify(result));
    } catch (error) {
      console.error('❌ 語音分析錯誤:', error.message);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});
