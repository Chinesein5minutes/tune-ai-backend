const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));

// 健康檢查
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
});

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
    try {
      console.log("🎙️ 收到語音資料");
      const result = await iflytekClient.evaluateSpeech(audioData, {
        language: 'zh_cn',
        category: 'read_sentence',
      });
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

// 保護伺服器不中斷
process.on('uncaughtException', (err) => {
  console.error('⚠️ 未捕捉例外:', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('⚠️ 未處理拒絕:', reason);
});

console.log("🟢 Server 正常啟動等待連線...");

// 🛡️ 防止 Railway 誤判 container 閒置自動停用
setInterval(() => {
  console.log('🔄 保活 ping...');
}, 1000 * 60 * 4); // 每 4 分鐘 ping 一次
