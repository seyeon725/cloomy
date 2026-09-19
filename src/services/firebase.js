import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
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

/** Firebase가 실제 프로젝트 키로 구성되었는지 확인 */
export const isFirebaseConfigured =
  firebaseConfig.apiKey !== 'demo-key' && firebaseConfig.projectId !== 'demo-project';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = isFirebaseConfigured ? getFirestore(app) : null;

export { signInWithPopup, signOut, onAuthStateChanged };

/**
 * =========================================================================
 * Cloud Firestore Database Synchronization Helpers
 * =========================================================================
 */

/**
 * 물건(Items) 목록을 Firestore에 저장
 */
export async function saveItemsToCloud(userId, items) {
  if (!db || !userId || userId === 'guest') return false;
  try {
    // 5MB 이상의 거대한 photoUrl은 제외하고 안전하게 클라우드 저장
    const sanitized = items.map(({ photoUrl, ...rest }) => rest);
    const itemDocRef = doc(db, 'users', userId, 'data', 'items');
    await setDoc(
      itemDocRef,
      {
        items: sanitized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Firestore saveItemsToCloud error:', err);
    return false;
  }
}

/**
 * Firestore에서 물건(Items) 목록 로드
 */
export async function loadItemsFromCloud(userId) {
  if (!db || !userId || userId === 'guest') return null;
  try {
    const itemDocRef = doc(db, 'users', userId, 'data', 'items');
    const snap = await getDoc(itemDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.items) ? data.items : null;
    }
    return null;
  } catch (err) {
    console.error('Firestore loadItemsFromCloud error:', err);
    return null;
  }
}

/**
 * Firestore 물건(Items) 실시간 변경사항 구독
 */
export function subscribeItemsCloud(userId, onUpdate) {
  if (!db || !userId || userId === 'guest') return () => {};
  try {
    const itemDocRef = doc(db, 'users', userId, 'data', 'items');
    return onSnapshot(
      itemDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.items)) {
            onUpdate(data.items);
          }
        }
      },
      (err) => {
        console.warn('Firestore subscribeItemsCloud error:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore subscribeItemsCloud setup error:', err);
    return () => {};
  }
}

/**
 * 다중 방(Rooms) 데이터를 Firestore에 저장
 */
export async function saveRoomsToCloud(userId, rooms, activeRoomId) {
  if (!db || !userId || userId === 'guest') return false;
  try {
    const roomDocRef = doc(db, 'users', userId, 'data', 'rooms');
    await setDoc(
      roomDocRef,
      {
        rooms,
        activeRoomId: activeRoomId || rooms[0]?.id || 'room-1',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Firestore saveRoomsToCloud error:', err);
    return false;
  }
}

/**
 * Firestore에서 다중 방(Rooms) 데이터 로드
 */
export async function loadRoomsFromCloud(userId) {
  if (!db || !userId || userId === 'guest') return null;
  try {
    const roomDocRef = doc(db, 'users', userId, 'data', 'rooms');
    const snap = await getDoc(roomDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.rooms) && data.rooms.length > 0) {
        return {
          rooms: data.rooms,
          activeRoomId: data.activeRoomId || data.rooms[0]?.id || 'room-1',
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Firestore loadRoomsFromCloud error:', err);
    return null;
  }
}

/**
 * Firestore 다중 방(Rooms) 실시간 변경사항 구독
 */
export function subscribeRoomsCloud(userId, onUpdate) {
  if (!db || !userId || userId === 'guest') return () => {};
  try {
    const roomDocRef = doc(db, 'users', userId, 'data', 'rooms');
    return onSnapshot(
      roomDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.rooms) && data.rooms.length > 0) {
            onUpdate({
              rooms: data.rooms,
              activeRoomId: data.activeRoomId || data.rooms[0]?.id || 'room-1',
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore subscribeRoomsCloud error:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore subscribeRoomsCloud setup error:', err);
    return () => {};
  }
}
