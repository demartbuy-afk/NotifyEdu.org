// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBx9ew-4VrTSnfOE5hGY0Zvk3HlAZ7PHcc",
  authDomain: "education-7dfde.firebaseapp.com",
  databaseURL: "https://education-7dfde-default-rtdb.firebaseio.com",
  projectId: "education-7dfde",
  storageBucket: "education-7dfde.appspot.com",
  messagingSenderId: "34925851229",
  appId: "1:34925851229:web:21fffd67ecda242e7953b4",
  measurementId: "G-P2SDNCPCKT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the Firestore service
const db = getFirestore(app);

export { db };