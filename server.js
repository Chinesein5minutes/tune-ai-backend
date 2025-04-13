console.log('✅ 檢查環境變數 APP_ID:', process.env.IFLYTEK_APP_ID);
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
const { IFLYTEK_WS } = require('./iflytek-streaming');
const cors = require('cors');
require('dotenv').config();

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

      // ✅ 關鍵修正：確保 audio 是正確格式的 Uint8Array
      const audioBuffer = new Uint8Array(Object.values(audio));
      console.log("🎧 收到語音資料與文字", text, audioBuffer.length);

      const result = await iflytekClient.evaluate(audioBuffer, {
        text,
        language: 'zh_cn',
        category: 'read_sentence',
        engine_type: 'ise_general',
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

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

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
