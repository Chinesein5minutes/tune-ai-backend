const crypto = require('crypto');
const WebSocket = require('ws');
const moment = require('moment');

class IFLYTEK_WS {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.hostUrl = 'wss://ise-api-sg.xf-yun.com/v2/ise';
  }

  createAuthUrl() {
    const date = moment().utc().format('ddd, DD MMM YYYY HH:mm:ss') + ' GMT';
    const signatureOrigin = `host: ise-api-sg.xf-yun.com\ndate: ${date}\nGET /v2/ise HTTP/1.1`;
    const signatureSha = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=ise-api-sg.xf-yun.com`;
  }

  evaluate(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.createAuthUrl());

      const inputText = options.text;
      const engineType = options.engine_type || 'ise';
      const language = options.language || 'zh_cn';
      const category = options.category || 'read_sentence';

      let sid = '';

      ws.on('open', () => {
        const initFrame = {
          common: {
            app_id: this.appId,
          },
          business: {
            language,
            category,
            ent: engineType,
            aue: 'raw',
            text: inputText,
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: audioBuffer.slice(0, 1280).toString('base64'),
          },
        };

        console.log('🚀 發送初始設定 frame 給 iFLYTEK WebSocket...');
        ws.send(JSON.stringify(initFrame));

        // 模擬分段傳送 audio buffer
        let offset = 1280;
        const chunkSize = 1280;
        const interval = setInterval(() => {
          if (offset >= audioBuffer.length) {
            // 最後結束訊號
            const endFrame = {
              data: {
                status: 2,
                audio: '',
              },
            };
            ws.send(JSON.stringify(endFrame));
            clearInterval(interval);
            return;
          }

          const chunk = audioBuffer.slice(offset, offset + chunkSize);
          const frame = {
            data: {
              status: 1,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: chunk.toString('base64'),
            },
          };
          ws.send(JSON.stringify(frame));
          offset += chunkSize;
        }, 40); // 每 40ms 傳一次 chunk
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        sid = res.sid || '';
        if (res.code !== 0) {
          console.error('❌ WebSocket 返回錯誤：', res);
          reject(new Error(res.message || `Error ${res.code}`));
        } else if (res.data && res.data.status === 2) {
          console.log('✅ 收到最終分析結果');
          resolve(res.data);
          ws.close();
        }
      });

      ws.on('error', (err) => {
        reject(new Error('WebSocket error: ' + err.message));
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket connection closed (sid: ${sid})`);
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
