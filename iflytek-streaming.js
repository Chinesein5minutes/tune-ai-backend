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

      ws.on('open', () => {
        const initFrame = {
          common: {
            app_id: this.appId
          },
          business: {
            language,
            category,
            ent: engineType,
            aue: 'raw',
            text: inputText,
            text_type: 'plain'
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000', // ✅ 必須加上 format，不能省略
            encoding: 'raw',
            audio: audioBuffer.toString('base64')
          }
        };

        console.log('🚀 發送初始請求給 iFLYTEK WebSocket...');
        ws.send(JSON.stringify(initFrame));
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        if (res.code !== 0) {
          console.error('❌ WebSocket 返回錯誤：', res);
          reject(new Error(res.message || `Error ${res.code}`));
        } else if (res.data && res.data.status === 2) {
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
