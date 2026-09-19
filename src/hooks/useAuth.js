import { useState, useEffect, useCallback } from 'react';
import {
  auth,
  googleProvider,
  isFirebaseConfigured,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from '../services/firebase';

const GUEST_USER = { uid: 'guest', displayName: '게스트', isGuest: true, photoURL: null, email: null };
const USER_KEY = 'cloomy_current_user';

/**
 * 인증 훅 — Google Sign-In (Firebase) 또는 로컬 게스트 모드
 *
 * 반환값:
 *   user       – { uid, displayName, photoURL, email, isGuest }
 *   loading    – 초기 인증 상태 확인 중
 *   loginWithGoogle()   – Google 팝업 로그인
 *   logout()            – 로그아웃 → 게스트
 *   continueAsGuest()   – 게스트로 계속 사용
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firebase Auth 상태 감시 (실 구성 시)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Firebase 미설정 시 로컬 저장 사용자 또는 게스트
      try {
        const saved = JSON.parse(localStorage.getItem(USER_KEY));
        if (saved?.uid) {
          setUser(saved);
        } else {
          setUser(GUEST_USER);
        }
      } catch {
        setUser(GUEST_USER);
      }
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '사용자',
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
          isGuest: false,
        };
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } else {
        // 로그아웃 상태 — 이전 로컬 사용자 복원 또는 게스트
        try {
          const saved = JSON.parse(localStorage.getItem(USER_KEY));
          if (saved?.uid && saved.uid !== 'guest') {
            // 구글 세션 만료 후 — 게스트로 전환
            setUser(GUEST_USER);
          } else {
            setUser(GUEST_USER);
          }
        } catch {
          setUser(GUEST_USER);
        }
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  /** 기존 게스트 데이터를 새 사용자 키로 마이그레이션 */
  const migrateGuestData = useCallback((newUid) => {
    const keysToMigrate = ['cloomy_items', 'cloomy_room'];
    for (const key of keysToMigrate) {
      const guestData = localStorage.getItem(key);
      const userKey = `${key}_${newUid}`;
      // 신규 사용자 공간에 이미 데이터가 있으면 건드리지 않음
      if (guestData && !localStorage.getItem(userKey)) {
        localStorage.setItem(userKey, guestData);
      }
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      // Firebase 미설정 → 데모 Google 사용자로 로그인
      const demoUser = {
        uid: 'demo-google-' + Date.now(),
        displayName: 'Demo User',
        photoURL: null,
        email: 'demo@gmail.com',
        isGuest: false,
        isDemo: true,
      };
      migrateGuestData(demoUser.uid);
      setUser(demoUser);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      return demoUser;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const u = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '사용자',
        photoURL: firebaseUser.photoURL,
        email: firebaseUser.email,
        isGuest: false,
      };
      migrateGuestData(u.uid);
      setUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      return u;
    } catch (err) {
      console.error('Google 로그인 실패:', err);
      throw err;
    }
  }, [migrateGuestData]);

  const logout = useCallback(async () => {
    try {
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
    } catch { /* ignore */ }
    setUser(GUEST_USER);
    localStorage.setItem(USER_KEY, JSON.stringify(GUEST_USER));
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(GUEST_USER);
    localStorage.setItem(USER_KEY, JSON.stringify(GUEST_USER));
  }, []);

  return { user, loading, loginWithGoogle, logout, continueAsGuest, isFirebaseConfigured };
}
