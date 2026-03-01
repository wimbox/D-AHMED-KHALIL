/**
 * Firebase Configuration Logic
 * Replace the placeholders below with your project credentials from Firebase Console
 */
const firebaseConfig = {
    apiKey: "AIzaSyCDXpDM1Q--_1FQb0KumpyiBU6_5oTKcuI",
    authDomain: "prescription-app-70fc7.firebaseapp.com",
    databaseURL: "https://prescription-app-70fc7-default-rtdb.firebaseio.com",
    projectId: "prescription-app-70fc7",
    storageBucket: "prescription-app-70fc7.appspot.com",
    messagingSenderId: "1052652776484",
    appId: "1:1052652776484:web:03d2ddbc1f08351b3afcb1",
    measurementId: "G-QGK4Z3MEKN"
};

// Initialize Firebase (Compat mode for easier integration)
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");

    // Global references
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    window.auth = firebase.auth();
} else {
    console.warn("Firebase SDK not loaded. Work in offline mode.");
}
