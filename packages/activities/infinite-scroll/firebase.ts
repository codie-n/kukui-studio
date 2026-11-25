import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3kGrbBxAG9FzUvdMU5DW9K8wl3hyzrbY",
  authDomain: "kukui-infinite-scroll.firebaseapp.com",
  projectId: "kukui-infinite-scroll",
  storageBucket: "kukui-infinite-scroll.firebasestorage.app",
  messagingSenderId: "815210534272",
  appId: "1:815210534272:web:931a745bc4531873309d65"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function authenticate() {
    if (!auth.currentUser) {
        await signInAnonymously(auth);
    }
}