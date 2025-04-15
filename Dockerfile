FROM node:18

# 安裝 ffmpeg

RUN apt-get update && apt-get install -y ffmpeg

# 建立 app 資料夾

WORKDIR /app

# 複製專案檔案

COPY . .

# 安裝相依套件

RUN npm install

# 啟動 server（前台運行）

CMD \["node", "server.js"\]