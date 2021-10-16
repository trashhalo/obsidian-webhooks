import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";

const app = firebase.initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "obsidian-buffer.firebaseapp.com",
  databaseURL: "https://obsidian-buffer-default-rtdb.firebaseio.com",
  projectId: "obsidian-buffer",
  storageBucket: "obsidian-buffer.appspot.com",
  messagingSenderId: "386398705772",
  appId: "1:386398705772:web:4ebb36001ad006dd632049",
  measurementId: "G-885V9M0N0C",
});
