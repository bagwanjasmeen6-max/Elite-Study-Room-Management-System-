window.firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

window.isFirebaseConfigured = !Object.values(window.firebaseConfig).some((value) =>
  String(value).startsWith("PASTE_")
);
