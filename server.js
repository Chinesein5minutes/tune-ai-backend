console.log("🪵 啟動程式進入第一行");
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ unhandledRejection:', reason.stack || reason);
});


const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));

// ✅ 新增首頁路由
app.get('/', (req, res) => {
  console.log('🏠 收到 / 首頁請求');
  res.send('TuneAI backend is up!');
});

// ✅ 健康檢查，加入 log
app.get('/health', (req, res) => {
  console.log('💓 收到 /health 檢查請求');
  res.send('Server is healthy');
});

const port = parseInt(process.env.PORT) || 3000;
const server = http.createServer(app);

// ✅ 在 HTTP Server 上掛載 WebSocket
const wss = new WebSocket.Server({ server });

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

// ✅ 啟動 HTTP + WS Server
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
});

// ✅ 保持 Container 存活
setInterval(() => {}, 1000);

// 捕捉錯誤
process.on('uncaughtException', (err) => {
  console.error('⚠️ 未捕捉例外:', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('⚠️ 未處理拒絕:', reason);
});

console.log("🟢 Server 全面啟動，HTTP + WebSocket 等待連線中...");
