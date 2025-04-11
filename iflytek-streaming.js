const crypto = require('crypto');
const WebSocket = require('ws');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

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

    const url = `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(
      date
    )}&host=ise-api-sg.xf-yun.com`;
    return url;
  }

  evaluateSpeech(audioBuffer) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.createAuthUrl());

      ws.on('open', () => {
        const commonParams = {
          app_id: this.appId,
        };

        const businessParams = {
          category: 'read_sentence',
          language: 'zh_cn',
          ent: 'ise',
          aue: 'raw',
          text: '你好', // 你可以根據需求送入對應 text
          text_type: 'plain',
        };

        const frame = {
          common: commonParams,
          business: businessParams,
          data: {
            status: 0,
            audio: audioBuffer.toString('base64'),
            encoding: 'raw',
          },
        };

        ws.send(JSON.stringify(frame));
      });

      ws.on('message', (data) => {
        const res = JSON.parse(data);
        if (res.code !== 0) {
          reject(new Error(res.desc || `Error ${res.code}`));
        } else if (res.data && res.data.status === 2) {
          resolve(res.data);
          ws.close();
        }
      });

      ws.on('error', (err) => {
        reject(new Error('WebSocket error: ' + err.message));
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
