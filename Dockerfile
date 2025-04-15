FROM node:18

# 建立 app 資料夾
WORKDIR /app

# 複製專案檔案
COPY . .

# 安裝相依套件
RUN npm install

# 啟動你的 server 並保持前台執行
CMD ["sh", "-c", "node server.js & tail -f /dev/null"]
