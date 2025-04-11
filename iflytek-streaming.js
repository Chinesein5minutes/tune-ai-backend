const WebSocket = require("ws");
const crypto = require("crypto");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");

class IFLYTEK_WS {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.hostUrl = "wss://ise-api-sg.xf-yun.com/v2/ise";
  }

  getAuthUrl() {
    const date = moment().utc().format("ddd, DD MMM YYYY HH:mm:ss") + " GMT";
    const signatureOrigin = `host: ise-api-sg.xf-yun.com\ndate: ${date}\nGET /v2/ise HTTP/1.1`;
    const signatureSha = crypto
      .createHmac("sha256", this.apiSecret)
      .update(signatureOrigin)
      .digest("base64");
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString("base64");

    const url = `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=ise-api-sg.xf-yun.com`;
    return url;
  }

  evaluate(audioBuffer) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.getAuthUrl());
      const sid = uuidv4();
      let finalResult = "";

      ws.on("open", () => {
        const common = { app_id: this.appId };
        const business = {
          language: "zh_cn",
          category: "read_sentence",
          domain: "ise",
          accent: "mandarin"
        };
        const data = {
          status: 0,
          format: "audio/L16;rate=16000",
          encoding: "raw",
          audio: audioBuffer.toString("base64")
        };

        const frame = { common, business, data };
        ws.send(JSON.stringify(frame));
      });

      ws.on("message", (msg) => {
        try {
          const res = JSON.parse(msg);
          if (res.code !== 0) {
            return reject(new Error(`Error ${res.code}: ${res.message || res.desc}`));
          }
          if (res.data && res.data.status === 2) {
            finalResult = res.data;
            ws.close();
          }
        } catch (err) {
          reject(err);
        }
      });

      ws.on("close", () => resolve(finalResult));
      ws.on("error", (err) => reject(err));
    });
  }
}

module.exports = IFLYTEK_WS;
