// server.js
process.on('beforeExit', (code) => {
  console.log(`⚠️ process beforeExit event with code: ${code}`);
});

process.on('exit', (code) => {
  console.log(`⚠️ process exit event with code: ${code}`);
});

const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech'); // ✅ 確保是相對路徑
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: '*', // ✅ 加入 CORS，允許所有來源連線
}));

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
console.log("✅ WebSocket server is running."); // ✅ 除錯訊息

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

// 捕捉未處理錯誤，防止 server crash
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
console.log("🟢 Server 啟動完畢，等待連線中...");

