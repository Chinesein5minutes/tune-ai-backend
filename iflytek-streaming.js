// iflytek-streaming.js
const WebSocket = require("ws");
const crypto = require("crypto");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");

class IFLYTEK_WS {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.hostUrl = "wss://ise-api.xfyun.cn/v2/open-ise";
  }

  createAuthUrl() {
    const date = moment.utc().format("ddd, DD MMM YYYY HH:mm:ss") + " GMT";
    const algorithm = "hmac-sha256";
    const headers = "host date request-line";
    const signatureOrigin = `host: ise-api.xfyun.cn\ndate: ${date}\nGET /v2/open-ise HTTP/1.1`;
    const signatureSha = crypto
      .createHmac("sha256", this.apiSecret)
      .update(signatureOrigin)
      .digest("base64");
    const authorization = Buffer.from(
      `api_key=\"${this.apiKey}\", algorithm=\"${algorithm}\", headers=\"${headers}\", signature=\"${signatureSha}\"`
    ).toString("base64");

    const url = `${this.hostUrl}?authorization=${authorization}&date=${encodeURIComponent(
      date
    )}&host=ise-api.xfyun.cn`;
    return url;
  }

  async send(audioBuffer, options) {
    return new Promise((resolve, reject) => {
      const url = this.createAuthUrl();
      const ws = new WebSocket(url);

      ws.on("open", () => {
        const business = {
          app_id: this.appId,
          language: options.language || "zh_cn",
          category: options.category || "read_sentence",
          rstcd: "utf8",
          aus: 1,
          ent: "cn_vip" // 語音模型，可調整
        };

        const data = {
          common: { app_id: this.appId },
          business,
          data: {
            status: 0,
            audio: audioBuffer.toString("base64")
          }
        };

        ws.send(JSON.stringify(data));
      });

      let result = "";

      ws.on("message", (msg) => {
        const res = JSON.parse(msg);
        if (res.code !== 0) {
          reject(new Error(`iFLYTEK returned error: ${res.code} - ${res.desc}`));
        } else if (res.data && res.data.status === 2) {
          result = res;
          ws.close();
        }
      });

      ws.on("close", () => {
        resolve(result);
      });

      ws.on("error", (err) => {
        reject(err);
      });
    });
  }
}

module.exports = { IFLYTEK_WS };
