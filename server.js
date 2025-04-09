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

const port = parseInt(process.env.PORT) || 3000;
const wsPort = port + 1;

// ✅ 啟動 HTTP Server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ HTTP Server running on 0.0.0.0:${port}`);
});

// ✅ 啟動獨立 WebSocket Server
const wss = new WebSocket.Server({ port: wsPort }, () => {
  console.log(`✅ WebSocket server is running on port ${wsPort}`);
});

const iflytekClient = new IFLYTEK({
  appId: process.env.IFLYTEK_APP_ID,
  apiKey: process.env.IFLYTEK_API_KEY,
  apiSecret: process.env.IFLYTEK_API_SECRET,
});

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');

  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

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
    console.log('🔌 WebSocket client disconnected');
  });
});

// 🛡️ 保持 WebSocket 存活
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// 🛡️ 加入虛擬任務防止 Railway 誤判 container 閒置
setInterval(() => {}, 1000); // 👈 這一行很關鍵

// 捕捉未處理錯誤
process.on('uncaughtException', (err) => {
  console.error('⚠️ 未捕捉例外:', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('⚠️ 未處理拒絕:', reason);
});

console.log("🟢 Server 全面啟動，等待 WebSocket 與 HTTP 連線...");
