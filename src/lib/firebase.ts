
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDQzoMbd1jAjEqmEzkk0uSrNbJ793yXljk",
  authDomain: "studio-6821761262-fdf39.firebaseapp.com",
  databaseURL: "https://studio-6821761262-fdf39-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studio-6821761262-fdf39",
  storageBucket: "studio-6821761262-fdf39.firebasestorage.app",
  messagingSenderId: "294831457703",
  appId: "1:294831457703:web:e1e149f283e4eb2418e282"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Messaging | null = null;

if (typeof window !== 'undefined') {
    isSupported().then(supported => {
        if (supported) {
            messaging = getMessaging(app);
        }
    });
}

export { app, messaging };
