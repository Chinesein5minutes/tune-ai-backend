// server.js
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
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    console.log('📥 收到 CORS 請求，來源:', origin);
    callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin', 'Accept'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json());

app.get('/', (req, res) => {
  console.log('📥 收到 GET / 請求');
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

async function convertToPCM(inputBuffer) {
  console.log('🔄 開始將音訊轉換為 PCM 格式');
  const inputPath = 'input.webm';
  const outputPath = 'output.pcm';
  fs.writeFileSync(inputPath, inputBuffer);
  console.log('📝 已寫入輸入檔案:', inputPath);
  try {
    await execPromise(`ffmpeg -i ${inputPath} -f s16le -acodec pcm_s16le -ac 1 -ar 16000 ${outputPath}`);
    console.log('✅ ffmpeg 轉換成功，輸出檔案:', outputPath);
  } catch (error) {
    console.error('❌ ffmpeg 轉換失敗:', error.message);
    throw error;
  }
  const pcmBuffer = fs.readFileSync(outputPath);
  console.log('📖 已讀取 PCM 檔案，大小:', pcmBuffer.length);
  fs.unlinkSync(inputPath);
  fs.unlinkSync(outputPath);
  return pcmBuffer;
}

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  ws.isAlive = true;

  ws.on('pong', () => {
    console.log('🏓 收到 WebSocket pong');
    ws.isAlive = true;
  });

  ws.on('message', async (msg) => {
    console.log('📩 收到 WebSocket message，原始格式:', typeof msg);
    console.log('📩 原始訊息內容:', msg.toString());

    let data;
    try {
      data = JSON.parse(msg.toString());
      const { audio, text } = data;

      if (!audio || !text || typeof text !== 'string') {
        return ws.send(JSON.stringify({ error: '❗請求格式錯誤：audio 或 text 缺失' }));
      }

      if (typeof audio === 'string' && audio === '[object Uint8Array]') {
        return ws.send(JSON.stringify({ error: '❗audio 被序列化為字串 "[object Uint8Array]"，請修正前端格式' }));
      }

      let audioBuffer = (() => {
        if (audio instanceof Uint8Array) return audio;
        if (Array.isArray(audio)) return new Uint8Array(audio);
        if (audio && audio.type === 'Buffer' && Array.isArray(audio.data)) return new Uint8Array(audio.data);
        if (audio instanceof ArrayBuffer) return new Uint8Array(audio);
        if (audio && Array.isArray(audio.data)) return new Uint8Array(audio.data);
        if (typeof audio === 'string') {
          try {
            const parsed = JSON.parse(audio);
            if (parsed && Array.isArray(parsed.data)) return new Uint8Array(parsed.data);
          } catch (e) {}
        }
        throw new Error('❗無法辨識的音訊格式');
      })();

      if (!(audioBuffer instanceof Uint8Array) || audioBuffer.length === 0) {
        return ws.send(JSON.stringify({ error: '❗audioBuffer 是空的或無效' }));
      }

      fs.writeFileSync('debug.wav', audioBuffer);
      console.log('📝 已儲存音訊至 debug.wav');

      const pcmBuffer = await convertToPCM(audioBuffer);

      const result = await iflytekClient.evaluate(pcmBuffer, {
        text,
        language: 'zh_cn',
        category: 'read_sentence',
      });

      console.log('📦 分析結果:', result);
      ws.send(JSON.stringify({ success: true, result, text }));
    } catch (error) {
      console.error('❌ 語音分析錯誤:', error.message);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });

  ws.on('close', () => console.log('🔌 WebSocket client disconnected'));
  ws.on('error', (err) => console.error('❌ WebSocket 錯誤:', err.message));
});

const interval = setInterval(() => {
  console.log('⏲️ 執行 WebSocket 心跳檢查');
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

wss.on('close', () => {
  console.log('🛑 WebSocket 伺服器關閉');
  clearInterval(interval);
});

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
