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

// ✅ 強化 CORS 設定（支援前端）
app.use(cors({
  origin: 'https://tune.chinesein5minutes.com',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin', 'Accept'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());

// ✅ 健康檢查用路由
app.get('/', (req, res) => {
  console.log('📥 收到 / 檢查請求');
  res.send('Hello from TuneAI backend');
});

app.get('/health', (req, res) => {
  console.log('💓 收到 /health 檢查請求');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 額外保險
  res.send('Server is healthy');
});

const port = parseInt(process.env.PORT) || 3000;
const server = http.createServer(app);

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

// ✅ 保活 WebSocket
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

// ✅ 啟動 Server
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
  console.log("🟢 Server 全面啟動，HTTP + WebSocket 等待連線中...");
});

// ✅ 防止 Container idle
setInterval(() => {}, 1000);

// ✅ 自我 ping health
setInterval(() => {
  http.get(`http://0.0.0.0:${port}/health`, (res) => {
    console.log("📡 自我 ping health:", res.statusCode);
  }).on("error", (err) => {
    console.error("❌ 自我 ping 失敗:", err.message);
  });
}, 1000 * 60 * 4);
