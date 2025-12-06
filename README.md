<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1c_Lv-XlGBGYCJyu0tLCdXpEj74f-JZSK

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

儲存邏輯概要

本機為主：IndexedDB：資料模型 store.data = { vehicles, logs, settings }，透過 objectStore vehicles / logs / settings（key global）維持，操作方法在 index.html 內的 store 物件（open, runTransaction, add/update/delete, import/export）。初始化會嘗試從 localStorage 舊資料遷移，再讀入 IndexedDB。
UI 存取：ui 直接讀寫 store.data，新增/編輯紀錄後寫回 IndexedDB；匯出/匯入（JSON、CSV）仍是本機操作。
雲端設定 (Profile fields)：userSettings/{uid} 存 { userName, preferences, updatedAt }，API 在 index.js 的 authManager.loadSettings/saveSettings。
手動同步資料集：userData/{uid} 存本機完整資料 { vehicles, logs, settings, updatedAt }，需使用者手動觸發：
上傳：authManager.syncUpload() → 將目前 store.data merge 至 Firestore。
下載：authManager.syncDownload() → 讀 Firestore 覆寫本機資料（透過 store.importData + store.loadAllData），再重新渲染。
驗證/登入保護：未登入不渲染主頁；註冊後寄驗證信，登入/Google 登入會檢查 emailVerified 並提示未驗證狀態。忘記密碼按鈕寄送 reset email。