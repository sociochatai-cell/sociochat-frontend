import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBLVyrtszUUEP6sXQzQm6fz4OXrzCgZAN8",
    authDomain: "sociochat-ai.firebaseapp.com",
    projectId: "sociochat-ai",
    storageBucket: "sociochat-ai.firebasestorage.app",
    messagingSenderId: "745521316533",
    appId: "1:745521316533:web:d1622dd2f3117d04d934fc",
    measurementId: "G-QS7C0F2FCM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export { app, analytics };
