const crypto = require("crypto");
const axios = require("axios");

class IFLYTEK {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async evaluateSpeech(audioData, options = {}) {
    if (!Buffer.isBuffer(audioData)) {
      throw new Error("audioData 必須是 Buffer 類型，請確認前端送出的格式");
    }

    // Step 1: 時間戳記
    const timestamp = Math.floor(Date.now() / 1000).toString(); // ✅ 確保是字串型態

    // Step 2: X-Param
    const param = {
      engine_type: "ise_general",
      aue: "raw",
      language: options.language || "zh_cn",
      category: options.category || "read_sentence"
    };
    const xParamJson = JSON.stringify(param);
    const xParam = Buffer.from(xParamJson).toString("base64").trim(); // ✅ 去除空白

    // Step 3: CheckSum
    const checksumRaw = this.apiSecret + timestamp + xParam;
    const checksum = crypto.createHash("md5").update(checksumRaw).digest("hex");

    // Step 4: Header
    const headers = {
      "X-Appid": this.appId,
      "X-CurTime": timestamp,
      "X-Param": xParam,
      "X-CheckSum": checksum,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    // Step 5: Payload
    const base64Audio = audioData.toString("base64");
    const payload = `audio=${encodeURIComponent(base64Audio)}`; // ✅ 確保 base64 是安全的 urlencoded 字串

    // Step 6: Debug Log
    console.log("📤 Headers to iFLYTEK:", headers);
    console.log("📤 Raw CheckSum Input:", checksumRaw);
    console.log("📤 Payload Length:", base64Audio.length);

    try {
      const response = await axios.post(
        "http://api.xfyun.cn/v1/service/v1/ise",
        payload,
        { headers }
      );

      console.log("✅ iFLYTEK 回應成功:", response.data);
      return response.data;
    } catch (err) {
      console.error("❌ iFLYTEK API 錯誤:", err.response?.data || err.message || err);
      throw new Error(
        typeof err.response?.data === "string"
          ? err.response.data
          : JSON.stringify(err.response?.data || { message: err.message })
      );
    }
  }
}

module.exports = { IFLYTEK };
