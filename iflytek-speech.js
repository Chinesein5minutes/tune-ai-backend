const crypto = require("crypto-js");
const axios = require("axios");

class IFLYTEK {
  constructor({ appId, apiKey, apiSecret }) {
    this.appId = appId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async evaluateSpeech(audioData, options) {
    if (!Buffer.isBuffer(audioData)) {
      throw new Error("audioData 必須是 Buffer 類型，請確認前端送出的格式");
    }

    const base64Audio = audioData.toString("base64");
    const timestamp = Math.floor(Date.now() / 1000);
    const param = {
      engine_type: "ise_general",
      aue: "raw",
      language: options.language || "zh_cn",
      category: options.category || "read_sentence"
    };

    const xParam = Buffer.from(JSON.stringify(param)).toString("base64");
    const checksum = crypto.MD5(this.apiKey + timestamp + xParam).toString();

    console.log("\u2728 Debug iFLYTEK Header 組成：");
    console.log("X-Appid:", this.appId);
    console.log("X-CurTime:", timestamp);
    console.log("X-Param:", xParam);
    console.log("X-CheckSum 組成字串:", this.apiKey + timestamp + xParam);
    console.log("X-CheckSum:", checksum);

    const headers = {
      "X-Appid": this.appId,
      "X-CurTime": timestamp,
      "X-Param": xParam,
      "X-CheckSum": checksum,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const payload = `audio=${base64Audio}`;

    try {
      const response = await axios.post(
        "http://api.xfyun.cn/v1/service/v1/ise",
        payload,
        { headers }
      );
      console.log("iFLYTEK \u56de\u61c9：", response.data);
      return response.data;
    } catch (err) {
      console.error("iFLYTEK evaluateSpeech error:", err.response?.data || err.message);
      throw new Error(
        typeof err.response?.data === "string"
          ? err.response.data
          : JSON.stringify(err.response?.data || { message: err.message })
      );
    }
  }
}

module.exports = { IFLYTEK };
