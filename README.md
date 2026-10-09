# Research Master

Research Master 是一個文獻整理網頁工具，用於搜尋研究文獻 metadata、建立個人 bibliography library，並輸出 APA / Chicago 等引用格式。

## 快速開始

需求：

- Node.js LTS

啟動本機完整模式：

```bash
npm start
```

開啟：

```text
http://localhost:4173/
```

檢查 JavaScript 語法：

```bash
npm run check
```

也可以使用既有啟動檔：

- macOS：`Start-Mac.command` 或 `啟動-Mac.command`
- Windows：`Start-Windows.bat` 或 `啟動-Windows.bat`

## 專案結構

- `index.html`：主頁面
- `app.js`：主要前端互動與文獻整理邏輯
- `styles.css`：介面樣式
- `server.mjs`：本機完整模式後端
- `api/`：Vercel serverless endpoints
- `data/`：本機預置 bibliography / library 資料
- `assets/`：圖示與靜態素材
- `firebase-config.js`：Firebase Web App 設定
- `firestore.rules`：Firestore 規則
- `vercel.json`：Vercel 部署設定

## 執行模式

### 本機完整模式

執行 `node server.mjs` 或 `npm start`，使用 Node backend 提供較完整的 metadata discovery、footnote parsing、reverse citation expansion，以及本機 `data/` 資料。

### 靜態部署模式

可參考 `README-GitHub-Pages.md`。靜態模式無法執行 `server.mjs`，瀏覽器會改用可直接呼叫的公開 API 或資料庫搜尋路由。

### Firebase 登入與雲端 library

啟用 Firebase Authentication Google provider 與 Firestore 後，使用者 bibliography 會儲存在：

```text
users/{uid}/libraries/default
```

若 Firebase 尚未設定，仍可使用瀏覽器 session storage 模式，但 bibliography 不會雲端同步。

## 其他文件

- `README-Start.txt`：使用者啟動說明
- `README-啟動說明.txt`：中文啟動說明
- `README-GitHub-Pages.md`：GitHub Pages 部署說明
- `FIREBASE-SETUP.md`：Firebase 設定摘要
