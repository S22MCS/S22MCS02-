// Firebase Configuration & Shared Utilities
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAEbxYuAHu5stGx5c02VbgsUKBhoidTeA",
    authDomain: "informationpassmemberessystem.firebaseapp.com",
    projectId: "informationpassmemberessystem",
    storageBucket: "informationpassmemberessystem.appspot.com",
};

// Initialize Singleton
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin List (Centralized)
export const authorizedAdmins = [
    's22market@gmail.com',
    'adatealm@gmail.com',
    'adatshifa@gmail.com',
    'nourmt01@gmail.com',
    'yacinee474474@gmail.com'
];

export const isAdmin = (user) => {
    if (!user || !user.email) return false;
    return authorizedAdmins.includes(user.email.toLowerCase());
};

export { app, auth, db };
