/* ==========================================
   GAMEVAULT — FIREBASE CONFIGURATION
========================================== */

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   FIREBASE CONFIG
========================================== */

const firebaseConfig = {

    apiKey:
        "AIzaSyBQciGxv12SMNGP0dEdGyPzXPT9hMWIW8w",

    authDomain:
        "my-project-d6a7e.firebaseapp.com",

    projectId:
        "my-project-d6a7e",

    storageBucket:
        "my-project-d6a7e.firebasestorage.app",

    messagingSenderId:
        "778803216150",

    appId:
        "1:778803216150:web:381b65de69e42f23c09a37",

    measurementId:
        "G-5CB3FM6C2M"

};


/* ==========================================
   INITIALIZE FIREBASE
========================================== */

const app =
    initializeApp(firebaseConfig);


/* ==========================================
   AUTHENTICATION
========================================== */

const auth =
    getAuth(app);


/* ==========================================
   FIRESTORE DATABASE
========================================== */

const db =
    getFirestore(app);


/* ==========================================
   EXPORT
========================================== */

export {
    app,
    auth,
    db
};