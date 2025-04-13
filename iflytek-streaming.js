const crypto = require('crypto');
const WebSocket = require('ws');
const moment = require('moment');

class IFLYTEK_WS {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.host = 'ise-api-sg.xf-yun.com';
    this.path = '/v2/ise';
    this.url = `wss://${this.host}${this.path}`;
  }

  createAuthUrl() {
    const date = moment().utc().format('ddd, DD MMM YYYY HH:mm:ss') + ' GMT';
    const signatureOrigin = `host: ${this.host}\ndate: ${date}\nGET ${this.path} HTTP/1.1`;
    const signatureSha = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `${this.url}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${this.host}`;
  }

  evaluate(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.createAuthUrl());

      const text = options.text || '你好';
      const language = options.language || 'zh_cn';
      const category = options.category || 'read_sentence';
      const engineType = options.engine_type || 'ise';

      ws.on('open', () => {
        let buffer;
        if (Buffer.isBuffer(audioBuffer)) {
          buffer = audioBuffer;
        } else if (audioBuffer instanceof Uint8Array || Array.isArray(audioBuffer)) {
          buffer = Buffer.from(audioBuffer);
        } else {
          return reject(new Error('❗ audioBuffer 格式錯誤'));
        }

        const payload = {
          common: {
            app_id: this.appId
          },
          business: {
            language: language,
            category: category,
            ent: engineType,
            aue: 'raw',
            text: Buffer.from(text).toString('base64'),
            text_type: 'plain'
          },
          data: {
            status: 2,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: buffer.toString('base64')
          }
        };

        console.log('📤 送出發音分析 payload 給 iFLYTEK...');
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        if (res.code !== 0) {
          console.error('❌ iFLYTEK 返回錯誤:', res);
          reject(new Error(res.message || `Error ${res.code}`));
        } else if (res.data && res.data.status === 2) {
          resolve(res.data);
          ws.close();
        }
      });

      ws.on('error', (err) => {
        reject(new Error('WebSocket 錯誤: ' + err.message));
      });

      ws.on('close', () => {
        console.log('🔌 iFLYTEK WebSocket 已關閉');
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
