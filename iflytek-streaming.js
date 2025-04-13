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

  evaluate({ audio, text }) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.createAuthUrl());

      ws.on('open', () => {
        const payload = {
          common: {
            app_id: this.appId,
          },
          business: {
            language: 'zh_cn',
            category: 'read_sentence',
            ent: 'ise',
            aue: 'raw',
            text,
            text_type: 'plain',
          },
          data: {
            status: 2,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: Buffer.from(audio).toString('base64'),
          }
        };

        console.log('🚀 發送格式化資料給 iFLYTEK WebSocket...');
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        if (res.code !== 0) {
          console.error('❌ 錯誤回應：', res);
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
