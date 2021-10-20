import { FirebaseOptions, initializeApp } from "firebase/app";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: "obsidian-buffer.firebaseapp.com",
  databaseURL: "https://obsidian-buffer-default-rtdb.firebaseio.com",
  projectId: "obsidian-buffer",
  storageBucket: "obsidian-buffer.appspot.com",
  messagingSenderId: "386398705772",
  appId: "1:386398705772:web:4ebb36001ad006dd632049",
  measurementId: "G-885V9M0N0C",
};

const app = initializeApp(firebaseConfig);

export default app;
