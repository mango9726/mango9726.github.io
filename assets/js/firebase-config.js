/* ============================================================
   Vocab Trainer — Firebase Configuration
   ============================================================
   วิธีตั้งค่า:
   1. ไป https://console.firebase.google.com
   2. สร้าง project ใหม่ (หรือใช้ project ที่มี)
   3. เปิด Authentication → Sign-in method → เปิด Google และ Email/Password
   4. สร้าง Firestore Database (เลือก "Start in test mode")
   5. ไป Project Settings → General → Your apps → เพิ่ม Web app
   6. คัดลอก config ด้านล่างมาวางแทนค่า placeholder
   7. ใน Authentication → Settings → Authorized domains → เพิ่ม domain ของ GitHub Pages
      (เช่น username.github.io)
   ============================================================ */

// ✅ Firebase config ของคุณ (จาก Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBfNwMY4ZQRE6AHgUW82ofLKA8QQEeTfgA",
  authDomain: "vocab-c8dba.firebaseapp.com",
  projectId: "vocab-c8dba",
  storageBucket: "vocab-c8dba.firebasestorage.app",
  messagingSenderId: "453170834432",
  appId: "1:453170834432:web:c24972e20d4aa63cadfce5",
  measurementId: "G-GKLEFNXRY7"
};

// ตรวจสอบว่า config ถูกตั้งค่าแล้วหรือยัง
const FIREBASE_CONFIGURED =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.indexOf("YOUR_") === -1 &&
  typeof firebase !== "undefined";

// เริ่มต้น Firebase (ถ้า config ถูกตั้งค่าแล้ว)
if (FIREBASE_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  // เปิดใช้งาน Google Auth provider
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  // Expose ให้ auth.js ใช้
  window.FIREBASE_CONFIGURED = true;
  window.firebaseAuth = firebase.auth();
  window.firebaseDb = firebase.firestore();
  window.googleProvider = googleProvider;

  // ตั้งค่า Firestore persistence (ให้ทำงาน offline ได้)
  try {
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
      .catch(function (err) {
        console.warn("[firebase] persistence ไม่พร้อม:", err.code);
      });
  } catch (e) {
    console.warn("[firebase] persistence init:", e);
  }

  console.log("[firebase] เริ่มต้นสำเร็จ — Google Login + Firestore sync พร้อมใช้");
} else {
  window.FIREBASE_CONFIGURED = false;
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("YOUR_") !== -1) {
    console.log("[firebase] ยังไม่ได้ตั้งค่า — ใช้ localStorage mode (แก้ไข firebase-config.js เพื่อเปิดใช้งาน)");
  }
}