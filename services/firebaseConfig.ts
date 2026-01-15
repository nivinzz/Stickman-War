
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC9dOf8-6FPRF51yAqCHNgsabf1-_UZdSU",
  authDomain: "interior-hub2025.firebaseapp.com",
  // CRITICAL FIX: Added databaseURL so the app can find your data
  databaseURL: "https://interior-hub2025-default-rtdb.firebaseio.com",
  projectId: "interior-hub2025",
  storageBucket: "interior-hub2025.firebasestorage.app",
  messagingSenderId: "144174899730",
  appId: "1:144174899730:web:84ed0fd0bb68ff50696ecb",
  measurementId: "G-8VZQXZS1FP"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };
