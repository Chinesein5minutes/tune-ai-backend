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

      const inputText = options.text || '你好';
      const engineType = options.engine_type || 'ise';
      const language = options.language || 'zh_cn';
      const category = options.category || 'read_sentence';

      let finalBuffer;
      if (Buffer.isBuffer(audioBuffer)) {
        finalBuffer = audioBuffer;
      } else if (audioBuffer instanceof Uint8Array) {
        finalBuffer = Buffer.from(audioBuffer);
      } else if (Array.isArray(audioBuffer)) {
        finalBuffer = Buffer.from(new Uint8Array(audioBuffer));
      } else {
        return reject(new Error('Invalid audio buffer type'));
      }

      ws.on('open', () => {
        // 1️⃣ 傳送文字 frame
        const textFrame = {
          common: {
            app_id: this.appId
          },
          business: {
            language,
            category,
            ent: engineType,
            aue: 'raw'
          },
          data: {
            status: 0,
            text: inputText,
            text_type: 'plain'
          }
        };
        console.log('📝 發送文字 frame');
        ws.send(JSON.stringify(textFrame));

        // 2️⃣ 等待 200ms 傳送音訊 frame
        setTimeout(() => {
          const audioFrame = {
            data: {
              status: 2,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: finalBuffer.toString('base64')
            }
          };
          console.log('🔊 發送音訊 frame');
          ws.send(JSON.stringify(audioFrame));
        }, 200);
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        console.log('📥 WebSocket 返回:', res);
        if (res.code !== 0) {
          return reject(new Error(res.message || `Error ${res.code}`));
        }
        if (res.data && res.data.status === 2) {
          resolve(res.data);
          ws.close();
        }
      });

      ws.on('error', (err) => {
        reject(new Error('WebSocket error: ' + err.message));
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
