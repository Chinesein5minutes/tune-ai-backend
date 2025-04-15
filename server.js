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
  const outputPath = 'output.wav';
  fs.writeFileSync(inputPath, inputBuffer);
  console.log('📝 已寫入輸入檔案:', inputPath);
  try {
    await execPromise(`ffmpeg -i ${inputPath} -ar 16000 -ac 1 -f wav ${outputPath}`);
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
    console.log('📩 收到 WebSocket message:', msg.toString());
    try {
      const { audio, text } = JSON.parse(msg);
      console.log('📋 收到前端資料：', { audio, text });
      console.log('🎙️ audio 類型：', Object.prototype.toString.call(audio));
      console.log('🎙️ audio 結構：', JSON.stringify(audio, null, 2));

      if (!audio || !text || typeof text !== 'string') {
        console.error('❗請求格式錯誤：audio 或 text 缺失');
        return ws.send(JSON.stringify({ error: '❗請求格式錯誤：audio 或 text 缺失' }));
      }

      let audioBuffer = (() => {
        if (audio instanceof Uint8Array) {
          console.log('✅ audio 是 Uint8Array，直接使用');
          return audio;
        } else if (Array.isArray(audio)) {
          console.log('✅ audio 是數組，轉為 Uint8Array');
          return new Uint8Array(audio);
        } else if (audio && audio.type === 'Buffer' && Array.isArray(audio.data)) {
          console.log('✅ audio 是 Buffer 物件，轉為 Uint8Array');
          return new Uint8Array(audio.data);
        } else if (audio instanceof ArrayBuffer) {
          console.log('✅ audio 是 ArrayBuffer，轉為 Uint8Array');
          return new Uint8Array(audio);
        } else if (audio && Array.isArray(audio.data)) {
          console.log('✅ audio 是物件且有 data 數組，轉為 Uint8Array');
          return new Uint8Array(audio.data);
        } else if (typeof audio === 'string') {
          console.log('✅ audio 是字串，嘗試解析為 JSON 並提取 data');
          try {
            const parsed = JSON.parse(audio);
            if (parsed && Array.isArray(parsed.data)) {
              console.log('✅ 解析成功，提取 data 數組');
              return new Uint8Array(parsed.data);
            }
          } catch (e) {
            console.error('❗無法解析 audio 字串:', e.message);
          }
        }
        console.error('❗無法辨識的音訊格式');
        throw new Error('❗無法辨識的音訊格式');
      })();

      console.log("🎧 收到語音資料與文字 (WebSocket streaming mode)", text, audioBuffer.length);

      // 儲存音訊以除錯
      fs.writeFileSync('debug.wav', audioBuffer);
      console.log('📝 已儲存音訊至 debug.wav');

      // 轉換為 PCM 格式
      audioBuffer = await convertToPCM(audioBuffer);

      const result = await iflytekClient.evaluate(audioBuffer, {
        text,
        language: 'zh_cn',
        category: 'read_sentence',
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

  ws.on('error', (error) => {
    console.error('❌ WebSocket 錯誤:', error.message);
  });
});

const interval = setInterval(() => {
  console.log('⏲️ 執行 WebSocket 心跳檢查');
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('🛑 終止不活躍的 WebSocket 客戶端');
      return ws.terminate();
    }
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
  console.log('⏲️ 執行自我健康檢查');
  http.get(`http://0.0.0.0:${port}/health`, (res) => {
    console.log("📡 自我 ping health:", res.statusCode);
  }).on("error", (err) => {
    console.error("❌ 自我 ping 失敗:", err.message);
  });
}, 1000 * 60 * 4);