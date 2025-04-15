FROM node:18-buster

# 安裝 ffmpeg

RUN apt-get update && apt-get install -y ffmpeg

# 檢查 node 命令是否存在

RUN which node || echo "node not found"

RUN node --version || echo "node version check failed"

# 建立 app 資料夾

WORKDIR /app

# 複製專案檔案

COPY . .

# 安裝相依套件

RUN npm install

# 啟動 server（使用完整路徑並在前台運行）

CMD \["sh", "-c", "/usr/local/bin/node server.js"\]