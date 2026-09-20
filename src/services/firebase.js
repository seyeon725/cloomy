import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB2p36GeS3iErlpX4ob1Eo6qpQJfyrOfPk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cloody-acc46.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cloody-acc46',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'cloody-acc46.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '404524065203',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:404524065203:web:5e428a22968b4dc30e6bc6',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2K2NLW0KSE',
};

/** Firebase가 실제 프로젝트 키로 구성되었는지 확인 */
export const isFirebaseConfigured =
  firebaseConfig.apiKey !== 'demo-key' && firebaseConfig.projectId !== 'demo-project';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
