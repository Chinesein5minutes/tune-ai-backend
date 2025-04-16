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

    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=ise-api-sg.xf-yun.com`;
  }

  evaluate(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const inputText = options.text;
      if (!inputText) return reject(new Error('缺少分析文字 text'));

      const ws = new WebSocket(this.createAuthUrl());

      const language = options.language || 'zh_cn';
      const category = options.category || 'read_sentence';
      const sub = 'ise';
      const ent = language === 'zh_cn' ? 'cn_vip' : 'en_vip';

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

      const base64Text = Buffer.from(inputText).toString('base64');
      const base64Audio = finalBuffer.toString('base64');

      ws.on('open', () => {
        console.log('🚪 WebSocket opened');

        const initFrame = {
          common: {
            app_id: this.appId
          },
          business: {
            sub,
            ent,
            language,
            category,
            aue: 'raw',
            text: base64Text,
            text_type: 'plain'
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw'
          }
        };

        console.log('📤 傳送初始參數 frame');
        ws.send(JSON.stringify(initFrame));

        setTimeout(() => {
          const audioFrame = {
            cmd: 'auw',
            data: {
              status: 2,
              audio: base64Audio
            }
          };
          console.log('📤 傳送音訊 frame（結束）');
          ws.send(JSON.stringify(audioFrame));
        }, 200);
      });

      let isFinished = false;

      ws.on('message', (data) => {
        const res = JSON.parse(data.toString());
        if (res.code !== 0) {
          console.error('❌ WebSocket 錯誤:', res);
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
