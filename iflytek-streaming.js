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
    const signatureSha = crypto.createHmac('sha256', this.apiSecret)
      .update(signatureOrigin)
      .digest('base64');

    const authorizationOrigin = `api_key=\"${this.apiKey}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signatureSha}\"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=ise-api-sg.xf-yun.com`;
  }

  evaluate(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const inputText = options.text;
      if (!inputText) return reject(new Error('缺少分析文字 text'));

      const ws = new WebSocket(this.createAuthUrl());

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

      let isFinished = false;

      ws.on('open', () => {
        console.log('🚪 WebSocket opened');

        // 第一個 frame：只送文字
        const textFrame = {
          common: {
            app_id: this.appId
          },
          business: {
            language,
            category,
            ent: engineType,
            aue: 'raw',
            text: Buffer.from(inputText).toString('base64'),
            text_type: 'plain'
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: ''
          }
        };

        console.log('📤 傳送首段文字 Frame');
        ws.send(JSON.stringify(textFrame));

        // 第二個 frame：傳送音訊（結尾）
        const audioFrame = {
          data: {
            status: 2,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: finalBuffer.toString('base64')
          }
        };

        console.log('📤 傳送音訊 Frame');
        setTimeout(() => ws.send(JSON.stringify(audioFrame)), 300);
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        if (res.code !== 0) {
          console.error('❌ WebSocket 返回錯誤：', res);
          if (!isFinished) {
            isFinished = true;
            reject(new Error(res.message || `Error ${res.code}`));
          }
        } else if (res.data && res.data.status === 2 && !isFinished) {
          isFinished = true;
          resolve(res.data);
          ws.close();
        }
      });

      ws.on('error', (err) => {
        if (!isFinished) {
          isFinished = true;
          reject(new Error('WebSocket error: ' + err.message));
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket closed');
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
