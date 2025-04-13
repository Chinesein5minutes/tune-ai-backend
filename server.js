// ✅ 檢查環境變數與錯誤追蹤
console.log('✅ 檢查環境變數 APP_ID:', process.env.IFLYTEK_APP_ID);
console.log("\uD83E\uDEA5 \u555F\u52D5\u7A0B\u5F0F\u9032\u5165\u7B2C\u4E00\u884C");

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ unhandledRejection:', reason.stack || reason);
});

// ✅ 基本模組引入
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { IFLYTEK_WS } = require('./iflytek-streaming');
const cors = require('cors');
require('dotenv').config();

// ✅ Express 與 CORS 設定
const app = express();

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin', 'Accept'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send('Hello from TuneAI backend');
});

app.get('/health', (req, res) => {
  console.log('💓 收到 /health 檢查請求');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send('Server is healthy');
});

// ✅ 建立 HTTP + WebSocket Server
const port = parseInt(process.env.PORT) || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const iflytekClient = new IFLYTEK_WS({
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

  ws.on('message', async (msg) => {
    try {
      const { audio, text } = JSON.parse(msg);

      if (!audio || !text || typeof text !== 'string' || text.trim() === '') {
        return ws.send(JSON.stringify({ error: '❗請求格式錯誤：audio 或 text 缺失' }));
      }

      // ✅ 修正 audio buffer 處理（Uint8Array 轉 Buffer）
      const audioBuffer = Buffer.from(Object.values(audio));

      console.log("🎧 收到語音資料與文字 (WebSocket streaming mode)");
      const result = await iflytekClient.evaluate(audioBuffer, {
        text,
        language: 'zh_cn',
        category: 'read_sentence',
        engine_type: 'ise',
      });

      console.log('📦 分析結果:', result);
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

// ✅ WebSocket Keep-Alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

// ✅ 啟動 server 並執行自我 ping 保活
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
  console.log("🟢 Server 全面啟動，HTTP + WebSocket 等待連線中...");
});

setInterval(() => {}, 1000);

setInterval(() => {
  http.get(`http://0.0.0.0:${port}/health`, (res) => {
    console.log("📡 自我 ping health:", res.statusCode);
  }).on("error", (err) => {
    console.error("❌ 自我 ping 失敗:", err.message);
  });
}, 1000 * 60 * 4);
