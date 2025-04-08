// 捕捉應用結束事件（除錯用途）
process.on('beforeExit', (code) => {
  console.log(`⚠️ process beforeExit event with code: ${code}`);
});

process.on('exit', (code) => {
  console.log(`⚠️ process exit event with code: ${code}`);
});

const express = require('express');
const WebSocket = require('ws');
const { IFLYTEK } = require('./iflytek-speech');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ CORS 設定：允許所有來源
app.use(cors({ origin: '*' }));

// ✅ 健康檢查端點（供 Railway / 瀏覽器測試使用）
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

// ✅ 啟動 HTTP Server，綁定 0.0.0.0 是關鍵
const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on 0.0.0.0:${port}`);
});

// ✅ 建立 WebSocket Server
const wss = new WebSocket.Server({ server });
console.log("✅ WebSocket server is running.");

// ✅ 初始化 iFLYTEK 語音評測客戶端
const iflytekClient = new IFLYTEK({
  appId: process.env.IFLYTEK_APP_ID,
  apiKey: process.env.IFLYTEK_API_KEY,
  apiSecret: process.env.IFLYTEK_API_SECRET,
});

// ✅ WebSocket 連線處理
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

// ✅ 捕捉未處理錯誤
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

console.log("🟢 Server 啟動完畢，等待連線中...");
