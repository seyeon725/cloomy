import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const USER_COLLECTION = 'users';
const DATA_DOC = 'cloomy';

/**
 * 물건 데이터 용량 최적화 (Firestore 1MB 한도 방지)
 * - 원본 무압축 사진(photoUrl)은 제외하고 썸네일(imageUrl) 및 메타데이터 유지
 */
function sanitizeItemsForCloud(items) {
  if (!Array.isArray(items)) return [];
  return items.map(({ photoUrl, ...rest }, idx) => {
    // 썸네일도 너무 많아져 1MB를 초과하지 않도록 최근 50개 썸네일만 유지
    if (idx >= 50 && rest.imageUrl && rest.imageUrl.length > 500) {
      const { imageUrl, ...withoutImg } = rest;
      return withoutImg;
    }
    return rest;
  });
}

/**
 * 클라우드(Firestore)에서 사용자의 데이터 읽기
 */
export async function getCloudData(userId) {
  if (!isFirebaseConfigured || !userId || userId === 'guest') {
    return null;
  }
  try {
    const docRef = doc(db, USER_COLLECTION, userId, 'data', DATA_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('[CloudSync] getCloudData 실패:', err);
    throw err;
  }
}

/**
 * 클라우드(Firestore)에 물건 및 방 데이터 저장
 */
export async function saveCloudData(userId, { items, rooms, activeRoomId }) {
  if (!isFirebaseConfigured || !userId || userId === 'guest') {
    return false;
  }
  try {
    const docRef = doc(db, USER_COLLECTION, userId, 'data', DATA_DOC);
    const sanitizedItems = sanitizeItemsForCloud(items);
    await setDoc(
      docRef,
      {
        items: sanitizedItems,
        rooms: rooms || [],
        activeRoomId: activeRoomId || 'room-1',
        updatedAt: serverTimestamp(),
        deviceUpdatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[CloudSync] saveCloudData 실패:', err);
    throw err;
  }
}

/**
 * 클라우드(Firestore) 실시간 변경사항 구독
 */
export function subscribeCloudData(userId, onData, onError) {
  if (!isFirebaseConfigured || !userId || userId === 'guest') {
    return () => {};
  }
  try {
    const docRef = doc(db, USER_COLLECTION, userId, 'data', DATA_DOC);
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          onData(snap.data());
        }
      },
      (err) => {
        console.warn('[CloudSync] Firestore 구독 에러:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('[CloudSync] subscribeCloudData 설정 실패:', err);
    if (onError) onError(err);
    return () => {};
  }
}
