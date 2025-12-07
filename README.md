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

## App Architecture & Sync

- Frontend shell: `index.html`（UI + IndexedDB 資料層） + `index.js`（Firebase Auth + Firestore + 同步）。純瀏覽器 PWA，無 bundler。
- Auth: Firebase CDN (email/password、Google popup/redirect)。註冊後自動寄送驗證信；未登入不渲染主畫面；忘記密碼按鈕寄送重設信。
- Local storage: IndexedDB (`store.data = { vehicles, logs, settings }`)，objectStores: `vehicles` / `logs` / `settings(global)`；初始化會搬移舊 localStorage，再載入資料。
- Cloud settings: Firestore `userSettings/{uid}`，欄位 `{ userName, preferences, updatedAt }`。操作在 `authManager.loadSettings/saveSettings`。
- Manual data sync: Firestore `userData/{uid}`，存整包本機資料 `{ vehicles, logs, settings, updatedAt }`。設定頁按鈕：
  - 上傳：`authManager.syncUpload()` 將 `store.data` merge 至雲端並更新同步時間。
  - 下載：`authManager.syncDownload()` 讀雲端並覆寫本機（透過 `store.importData` + `store.loadAllData`），再重新渲染。
- PWA: 動態 manifest + service worker（若存在），支援加入主畫面；未登入時僅顯示登入/註冊畫面。
