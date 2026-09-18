import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000:web:000',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Items collection helpers
export const itemsRef = collection(db, 'items');

export async function addItem(item) {
  return addDoc(itemsRef, {
    ...item,
    createdAt: serverTimestamp(),
    lastUsedAt: null,
    status: 'active', // active | archived | discarded
  });
}

export async function getItems() {
  const snap = await getDocs(query(itemsRef, orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getItemsByLocation(location) {
  const snap = await getDocs(
    query(itemsRef, where('location', '==', location))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateItem(id, data) {
  return updateDoc(doc(db, 'items', id), data);
}

export async function deleteItem(id) {
  return deleteDoc(doc(db, 'items', id));
}

export { db };
