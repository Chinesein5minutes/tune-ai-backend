const crypto = require("crypto");
const moment = require("moment");
const WebSocket = require("ws");
const uuid = require("uuid");

class IFLYTEK_Stream {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  createAuthUrl() {
    const host = "ise-api.xfyun.cn";
    const path = "/v2/open-ise";
    const date = moment().utc().format("ddd, DD MMM YYYY HH:mm:ss") + " GMT";
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signatureSha = crypto.createHmac("sha256", this.apiSecret)
      .update(signatureOrigin)
      .digest("base64");
    const authorization = Buffer.from(`api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`).toString("base64");

    return `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
  }

  evaluate(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const url = this.createAuthUrl();
      const ws = new WebSocket(url);
      const sid = uuid.v4();

      ws.on("open", () => {
        const commonMsg = {
          common: {
            app_id: this.appId
          },
          business: {
            category: options.category || "read_sentence",
            language: options.language || "zh_cn",
            rstcd: "utf8",
            ent: "ise",
            aus: 1
          },
          data: {
            status: 0,
            format: "audio/L16;rate=16000",
            encoding: "raw",
            audio: audioBuffer.toString("base64")
          }
        };
        ws.send(JSON.stringify(commonMsg));

        // 結束訊號
        setTimeout(() => {
          ws.send(JSON.stringify({
            data: {
              status: 2,
              audio: ""
            }
          }));
        }, 500);
      });

      let result = "";
      ws.on("message", (msg) => {
        const res = JSON.parse(msg);
        if (res.code !== 0) {
          reject(new Error(res.desc || "iFLYTEK returned error"));
        } else {
          if (res.data && res.data.data) {
            result += res.data.data;
          }
          if (res.data && res.data.status === 2) {
            resolve({ code: 0, data: result });
            ws.close();
          }
        }
      });

      ws.on("error", (err) => reject(err));
    });
  }
}

module.exports = IFLYTEK_Stream; // ✅ 修正這裡
