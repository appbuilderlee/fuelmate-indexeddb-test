import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,           
  browserLocalPersistence   
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJwkvjfIIkBdrxRlDeEYOytI_6jZsU_yA",
  authDomain: "fuelmate-indexeddb-login.firebaseapp.com",
  projectId: "fuelmate-indexeddb-login",
  storageBucket: "fuelmate-indexeddb-login.firebasestorage.app",
  messagingSenderId: "786319675068",
  appId: "1:786319675068:web:3c08c1d061cbc6430b8ab9",
  measurementId: "G-BB447GW591"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();
const db = getFirestore(firebaseApp);

provider.setCustomParameters({ prompt: "select_account" });

const authState = { user: null };

const authManager = {
  auth,
  db,
  provider,
  currentUser: null,
  cloudState: { userName: "", preferences: "", updatedAt: null },
  syncMeta: { updatedAt: null },
  loading: false,
  setSyncStatus(message, isError = false) {
    const el = document.getElementById("cloud-sync-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("text-red-600", isError);
    el.classList.toggle("text-[11px]", true);
  },

  async init() {
    console.log("1. 應用程式啟動..."); 
    this.bindUI();
    
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      console.log("2. Firebase 持久性設定成功 (iOS Fix)");
    } catch (err) {
      console.error("2. 設定持久性失敗:", err);
    }

    this.handleRedirectResult();

    console.log("3. 開始監聽登入狀態...");
    onAuthStateChanged(this.auth, (user) => {
      console.log("4. Firebase 狀態改變! 使用者:", user ? user.email : "未登入");
      
      this.currentUser = user;
      authState.user = user;
      this.toggleScreens(!!user); 

      if (user) {
        this.showMessage("");
        this.loadSettings({ silent: true });
        this.checkEmailVerification();
        // 更新同步狀態文字（如果有既有的 syncMeta）
        if (this.syncMeta?.updatedAt) {
          const timeText = new Date(this.syncMeta.updatedAt).toLocaleString();
          this.setSyncStatus(`雲端同步時間：${timeText}`);
        } else {
          this.setSyncStatus("雲端同步時間：尚未同步");
        }
        if (window.ui) window.ui.render();
      } else {
        this.cloudState = { userName: "", preferences: "", updatedAt: null };
        this.clearAppView();
      }
    });
  },

  async handleRedirectResult() {
    try {
      const res = await getRedirectResult(this.auth);
      if (res?.user) {
        this.currentUser = res.user;
        this.showMessage("已使用 Google 登入", false);
      }
    } catch (err) {
      console.warn("redirect login failed", err);
    }
  },

  bindUI() {
    document.getElementById("signup-btn")?.addEventListener("click", () => this.handleSignup());
    document.getElementById("login-btn")?.addEventListener("click", () => this.handleLogin());
    document.getElementById("google-btn")?.addEventListener("click", () => this.handleGoogle());
    document.getElementById("reset-btn")?.addEventListener("click", () => this.handleResetPassword());
  },

  toggleScreens(isLoggedIn) {
    const authScreen = document.getElementById("auth-screen");
    const appScreen = document.getElementById("app");
    if (authScreen) authScreen.classList.toggle("hidden", isLoggedIn);
    if (appScreen) appScreen.classList.toggle("hidden", !isLoggedIn);
  },

  clearAppView() {
    const appScreen = document.getElementById("app");
    if (appScreen) appScreen.innerHTML = "";
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.add("hidden");
  },

  setLoading(isLoading) {
    this.loading = isLoading;
    
    // 修正：增加雲端同步按鈕的 ID
    const buttonIds = [
        "signup-btn", 
        "login-btn", 
        "google-btn",
        "sync-upload-btn", 
        "sync-download-btn"
    ];

    buttonIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = isLoading;
      el.classList.toggle("opacity-60", isLoading);
      el.classList.toggle("cursor-not-allowed", isLoading);
    });
  },

  showMessage(msg, isError = true) {
    const box = document.getElementById("auth-message");
    if (!box) return;
    if (!msg) {
      box.classList.add("hidden");
      return;
    }
    box.textContent = msg;
    box.classList.toggle("hidden", false);
    box.classList.toggle("text-red-600", isError);
    box.classList.toggle("bg-red-50", isError);
    box.classList.toggle("border-red-100", isError);
    box.classList.toggle("text-teal-700", !isError);
    box.classList.toggle("bg-teal-50", !isError);
    box.classList.toggle("border-teal-100", !isError);
  },

  async handleSignup() {
    if (this.loading) return;
    const email = document.getElementById("signup-email")?.value?.trim();
    const password = document.getElementById("signup-password")?.value;
    if (!email || !password) {
      this.showMessage("請輸入 Email 與密碼");
      return;
    }
    try {
      this.setLoading(true);
      this.showMessage("正在處理註冊請求...", false);
      
      await setPersistence(this.auth, browserLocalPersistence);
      await createUserWithEmailAndPassword(this.auth, email, password);
      
      this.showMessage("註冊成功，已自動登入", false);
      await this.sendVerificationEmail();
    } catch (err) {
      console.error("Signup Error:", err);
      this.showMessage(err?.message || "註冊失敗");
    } finally {
      this.setLoading(false);
    }
  },

  async handleLogin() {
    console.log("--- 1. 登入按鈕被點擊 ---"); 
    if (this.loading) {
      console.warn("登入已被跳過：系統正在處理中。");
      return;
    }
    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value;
    
    if (!email || !password) {
      this.showMessage("請輸入 Email 與密碼");
      console.error("--- 2. 登入被阻擋：Email 或密碼為空。 ---"); 
      return;
    }
    
    try {
      console.log("--- 3. 欄位檢查成功，準備載入 ---"); 
      this.setLoading(true);
      
      // 修正：加入即時訊息，解決無反應的視覺問題
      this.showMessage("正在處理登入請求...", false);
      
      await setPersistence(this.auth, browserLocalPersistence);
      
      console.log("--- 4. 發送 Firebase 登入請求 ---"); 
      await signInWithEmailAndPassword(this.auth, email, password);
      
      // onAuthStateChanged 會接管後續的 UI 渲染
      this.checkEmailVerification();
      
    } catch (err) {
      console.error("--- 5. 登入失敗！錯誤訊息：", err); 
      this.showMessage(err?.message || "登入失敗");
    } finally {
      this.setLoading(false);
    }
  },

  async handleGoogle() {
    if (this.loading) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    const useRedirect = isIOS || isStandalone;

    try {
      this.setLoading(true);
      this.showMessage("正在處理 Google 登入...", false);

      await setPersistence(this.auth, browserLocalPersistence);

      if (useRedirect) {
        await signInWithRedirect(this.auth, this.provider);
      } else {
        await signInWithPopup(this.auth, this.provider);
        this.showMessage("已使用 Google 登入", false);
        this.checkEmailVerification();
        this.setLoading(false);
      }
    } catch (err) {
      console.error(err);
      this.showMessage(err?.message || "Google 登入失敗");
      this.setLoading(false); 
    }
  },

  async handleResetPassword() {
    const email = document.getElementById("login-email")?.value?.trim() || document.getElementById("signup-email")?.value?.trim();
    if (!email) {
      this.showMessage("請先輸入 Email 再重設密碼");
      return;
    }
    try {
      await sendPasswordResetEmail(this.auth, email);
      this.showMessage("重設密碼信已寄出，請查收", false);
    } catch (err) {
      console.error("Reset Password Error:", err);
      this.showMessage(err?.message || "重設密碼失敗");
    }
  },

  async sendVerificationEmail() {
    if (!this.auth.currentUser) {
      this.showMessage("請先登入後再寄送驗證信");
      return;
    }
    try {
      await sendEmailVerification(this.auth.currentUser);
      this.showMessage("驗證郵件已寄出，請查收", false);
    } catch (err) {
      console.error("Verify Email Error:", err);
      this.showMessage(err?.message || "驗證信寄送失敗");
    }
  },

  async checkEmailVerification() {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      await user.reload();
      if (!user.emailVerified) {
        this.showMessage("電子郵件尚未驗證，請查收郵件完成驗證", true);
      }
    } catch (err) {
      console.warn("verify check failed", err);
    }
  },

  async handleSignOut() {
    try {
      await signOut(this.auth);
      this.showMessage("已登出", false);
    } catch (err) {
      console.error("Sign Out Error:", err);
      this.showMessage(err?.message || "登出失敗");
    }
  },

  async loadSettings(options = {}) {
    if (!this.currentUser) {
      this.showMessage("請先登入");
      return;
    }
    try {
      const ref = doc(this.db, "userSettings", this.currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        this.cloudState = {
          userName: data.userName || "",
          preferences: data.preferences || "",
          updatedAt: data.updatedAt || null
        };
        this.fillCloudForm();
        if (!options.silent) this.showMessage("已載入雲端設定", false);
        if (window.ui) window.ui.render();
      } else if (!options.silent) {
        this.showMessage("尚未建立設定，請先儲存", false);
      }
    } catch (err) {
      console.error("Load Settings Error:", err);
      this.showMessage(err?.message || "讀取設定失敗");
    }
  },

  fillCloudForm() {
    const nameInput = document.getElementById("cloud_user_name");
    const prefInput = document.getElementById("cloud_preferences");
    if (nameInput) nameInput.value = this.cloudState.userName || "";
    if (prefInput) prefInput.value = this.cloudState.preferences || "";
  },

  // (接續 fillCloudForm 函式之後)

  async saveSettings() {
    if (!this.currentUser) {
      this.showMessage("請先登入後再儲存");
      return;
    }
    const userName = document.getElementById("cloud_user_name")?.value?.trim() || "";
    const preferences = document.getElementById("cloud_preferences")?.value?.trim() || "";
    const payload = { userName, preferences, updatedAt: Date.now() };
    try {
      await setDoc(doc(this.db, "userSettings", this.currentUser.uid), payload, { merge: true });
      this.cloudState = payload;
      this.showMessage("設定已儲存到 Firestore", false);
      if (window.ui) window.ui.render();
    } catch (err) {
      console.error("Save Settings Error:", err);
      this.showMessage(err?.message || "儲存失敗");
    }
  },

 async syncUpload() {
    console.log("--- 1. 開始上傳同步請求 ---");
    this.setSyncStatus("雲端同步中（上傳）...");

    if (!this.currentUser) {
      this.showMessage("請先登入後再同步");
      this.setSyncStatus("請先登入後再同步", true);
      return;
    }
    if (!window.store) {
      this.showMessage("本機資料尚未就緒");
      this.setSyncStatus("本機資料尚未就緒", true);
      return;
    }
    try {
      this.setLoading(true); 
      
      const cleanData = JSON.parse(JSON.stringify(window.store.data)); 

      const payload = {
        vehicles: cleanData.vehicles || [],
        logs: cleanData.logs || [],
        settings: cleanData.settings || {},
        updatedAt: Date.now()
      };
      
      console.log("--- 2. 資料清洗完成，發送請求 ---"); // <-- 新增檢查點
      
      await setDoc(doc(this.db, "userData", this.currentUser.uid), payload, { merge: true });
      
      console.log("--- 3. Firestore 寫入成功！---"); // <-- 關鍵檢查點

      this.syncMeta = { updatedAt: payload.updatedAt };
      const timeText = new Date(payload.updatedAt).toLocaleString();
      this.setSyncStatus(`雲端同步時間：${timeText}`);
      this.showMessage("已上傳並同步雲端", false);
      if (window.ui) window.ui.render();
    } catch (err) {
      // 確保顯示出完整的錯誤堆棧
      console.error("🔥 Firestore Sync Upload CRITICAL Error:", err.code || err.name, err); 
      this.showMessage(err?.message || "上傳同步失敗 (請查看 Console)", true); 
      this.setSyncStatus(err?.message || "上傳同步失敗", true);
    } finally {
      this.setLoading(false); 
    }
  },
// ...
// (之後是 async syncDownload() 函式的開頭)

  async syncDownload() { // 確保這裡有 async
    console.log("--- 1. 開始下載同步請求 ---"); // <-- 偵錯檢查點
    this.setSyncStatus("雲端同步中（下載）...");

    if (!this.currentUser) {
      this.showMessage("請先登入後再同步");
      this.setSyncStatus("請先登入後再同步", true);
      return;
    }
    if (!window.store) {
      this.showMessage("本機資料尚未就緒");
      this.setSyncStatus("本機資料尚未就緒", true);
      return;
    }
    try {
      this.setLoading(true); 
      
      console.log("--- 2. 發送 Firestore 讀取請求 ---"); // <-- 偵錯檢查點
      const snap = await getDoc(doc(this.db, "userData", this.currentUser.uid));
      
      if (!snap.exists()) {
        this.showMessage("雲端尚無資料，請先上傳", true);
        return;
      }
      
      const data = snap.data();
      await window.store.importData({
        vehicles: data.vehicles || [],
        logs: data.logs || [],
        settings: data.settings || window.store.data.settings
      });
      await window.store.loadAllData();
      this.syncMeta = { updatedAt: data.updatedAt || Date.now() };
      const timeText = new Date(this.syncMeta.updatedAt).toLocaleString();
      this.setSyncStatus(`雲端同步時間：${timeText}`);
      this.showMessage("已從雲端下載並同步", false);
      if (window.ui) window.ui.render();
    } catch (err) {
      console.error("Firestore Sync Download Error:", err); 
      this.showMessage(err?.message || "下載同步失敗");
      this.setSyncStatus(err?.message || "下載同步失敗", true);
    } finally {
      this.setLoading(false); 
    }
  }
}; // <--- 這裡是物件結尾！

window.authManager = authManager;
window.authState = authState;

document.addEventListener("DOMContentLoaded", () => authManager.init());
