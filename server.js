// ✅ 啟動 log 與全域錯誤處理
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

// ✅ 根目錄路由 - 給 Railway 檢查是否存活
app.get('/', (req, res) => {
  console.log('📥 收到 / 預設檢查請求');
  res.send('Hello from TuneAI backend');
});

// ✅ /health 檢查路由 - 用來配合 UptimeRobot
app.get('/health', (req, res) => {
  console.log('💓 收到 /health 檢查請求');
  res.send('Server is healthy');
});

const port = parseInt(process.env.PORT) || 3000;
const server = http.createServer(app);

// ✅ 掛載 WebSocket Server
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

// ✅ 保持 WebSocket 存活
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

// ✅ 啟動伺服器
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
});

console.log("🟢 Server 全面啟動，HTTP + WebSocket 等待連線中...");

// ✅ 保持容器不會被 Railway 提前關閉
setInterval(() => {}, 1000);

// ✅ 自我 ping 避免 idle（Railway hobby 限制）
setInterval(() => {
  require("http").get(`http://localhost:${port}/health`, (res) => {
    console.log("📡 自我 ping health:", res.statusCode);
  }).on("error", (err) => {
    console.error("❌ 自我 ping 失敗:", err.message);
  });
}, 1000 * 60 * 4); // 每 4 分鐘 ping 一次
