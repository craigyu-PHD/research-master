全功能文獻管理代理人：啟動說明

1. 需求
   - Windows 或 Mac
   - Node.js LTS：https://nodejs.org/

2. Mac 使用方式
   - 雙擊「啟動-Mac.command」
   - 瀏覽器會自動開啟 http://localhost:4173/
   - Terminal 視窗會保持開啟，代表本機伺服器正在執行；關閉該視窗會停止本機版。
   - 如果本機伺服器已經啟動，也可以直接雙擊「開啟本機版.html」

3. Windows 使用方式
   - 雙擊「啟動-Windows.bat」
   - 瀏覽器會自動開啟 http://localhost:4173/
   - 如果本機伺服器已經啟動，也可以直接雙擊「開啟本機版.html」或「本機網址.url」

4. 同步方式
   - 本機版與網頁版使用同一份 index.html、app.js、styles.css。
   - 修改功能時，先更新這個雲端資料夾，再發布到線上網站。

5. 雲端登入
   - 登入改用 Firebase Authentication 的 Google 登入供應商。
   - 本工具不會要求或保存 Google 密碼。
   - 設定 Firebase 後，每位使用者的文獻庫會同步至 Firestore：
     users/{uid}/libraries/default。

6. 使用邏輯
   - 搜尋與點選文獻只會預覽，不會自動保存。
   - 按下文獻卡片中的「複製」後，該文獻才會保存到個人文獻資料庫。
   - 在個人文獻資料庫編輯模式勾選文獻，按「套用到輸出列表」後，才會出現在參考文獻列表輸出區。
