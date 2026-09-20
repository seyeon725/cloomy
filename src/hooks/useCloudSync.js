import { useEffect, useRef, useState } from 'react';
import { getCloudData, saveCloudData, subscribeCloudData } from '../services/cloudSync';
import { isFirebaseConfigured } from '../services/firebase';

export function useCloudSync({ user, itemsHook, room }) {
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error' | 'permission_denied'
  const [syncMessage, setSyncMessage] = useState('');
  const isApplyingRemoteRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const hasLoadedInitialCloudRef = useRef(false);
  const lastCloudTimestampRef = useRef(0);

  const userId = user?.uid;
  const isGuest = !user || user.isGuest;

  // 1. 로그인 시 초기 데이터 로드 및 마이그레이션 (PC -> Cloud or Cloud -> Mobile)
  useEffect(() => {
    if (!isFirebaseConfigured || !userId || isGuest) {
      setSyncStatus('idle');
      hasLoadedInitialCloudRef.current = false;
      return;
    }

    let isMounted = true;
    hasLoadedInitialCloudRef.current = false;
    setSyncStatus('syncing');

    async function initSync() {
      try {
        const cloudData = await getCloudData(userId);
        if (!isMounted) return;

        let currentLocalItems = itemsHook.items || [];
        if (currentLocalItems.length === 0) {
          try {
            const rawUser = localStorage.getItem(`cloomy_items_${userId}`);
            const rawGuest = localStorage.getItem('cloomy_items');
            const fallback = rawUser ? JSON.parse(rawUser) : (rawGuest ? JSON.parse(rawGuest) : []);
            if (Array.isArray(fallback) && fallback.length > 0) {
              currentLocalItems = fallback;
              itemsHook.setItems(fallback);
            }
          } catch {}
        }

        let currentLocalRooms = room.rooms || [];
        if (!currentLocalRooms || currentLocalRooms.length <= 1) {
          try {
            const rawUser = localStorage.getItem(`cloomy_rooms_${userId}`);
            const rawGuest = localStorage.getItem('cloomy_rooms');
            const fallback = rawUser ? JSON.parse(rawUser) : (rawGuest ? JSON.parse(rawGuest) : null);
            if (Array.isArray(fallback) && fallback.length > 0) {
              currentLocalRooms = fallback;
              room.setRooms(fallback);
            }
          } catch {}
        }
        const currentActiveRoomId = room.activeRoomId;

        // 물건 스마트 병합 함수: id 기준으로 중복 없이 합쳐서 물건 유실을 원천 방지!
        const mergeItemsSafely = (listA, listB) => {
          const map = new Map();
          (listA || []).forEach((item) => {
            if (item && item.id) map.set(item.id, item);
          });
          (listB || []).forEach((item) => {
            if (item && item.id && !map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        };

        const cloudItems = cloudData && Array.isArray(cloudData.items) ? cloudData.items : [];
        const mergedItems = mergeItemsSafely(currentLocalItems, cloudItems);

        // 방 목록도 더 많은 방(거실 등)을 보유한 쪽 우선 선택
        const cloudRooms = cloudData && Array.isArray(cloudData.rooms) ? cloudData.rooms : [];
        const mergedRooms =
          currentLocalRooms.length >= cloudRooms.length ? currentLocalRooms : cloudRooms;

        console.log(
          `[CloudSync] 로컬(${currentLocalItems.length}개) + 클라우드(${cloudItems.length}개) -> 통합 ${mergedItems.length}개 물건 확정`
        );

        isApplyingRemoteRef.current = true;
        itemsHook.setItems(mergedItems);
        if (mergedRooms.length > 0) {
          room.setRooms(mergedRooms);
        }
        if (cloudData?.activeRoomId) {
          room.setActiveRoomId(cloudData.activeRoomId);
        }
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 400);

        // 통합된 물건 수가 클라우드보다 많으면 클라우드로 즉시 업로드 반영!
        if (mergedItems.length > cloudItems.length || mergedRooms.length > cloudRooms.length) {
          console.log(`[CloudSync] 통합된 최신 데이터(${mergedItems.length}개) 클라우드로 저장.`);
          await saveCloudData(userId, {
            items: mergedItems,
            rooms: mergedRooms,
            activeRoomId: currentActiveRoomId,
          });
          lastCloudTimestampRef.current = Date.now();
        } else {
          lastCloudTimestampRef.current = cloudData?.deviceUpdatedAt || Date.now();
        }

        hasLoadedInitialCloudRef.current = true;
        setSyncStatus('synced');
      } catch (err) {
        if (!isMounted) return;
        if (err.code === 'permission-denied') {
          console.error('[CloudSync] Firestore 보안 규칙으로 인해 클라우드 접근이 거부되었습니다.');
          setSyncStatus('permission_denied');
          setSyncMessage('Firebase Firestore 보안 규칙 설정이 필요합니다.');
        } else {
          console.error('[CloudSync] 클라우드 동기화 초기화 실패:', err);
          setSyncStatus('error');
        }
        hasLoadedInitialCloudRef.current = true;
      }
    }

    initSync();

    // 2. 실시간 원격 변경사항 리스너 (다른 기기에서 수정한 내용 즉시 반영)
    const unsubscribe = subscribeCloudData(
      userId,
      (remoteData) => {
        if (!isMounted || !remoteData) return;
        if (!hasLoadedInitialCloudRef.current) return;

        // 자신이 방금 업로드한 변경사항이면 무시
        if (remoteData.deviceUpdatedAt && remoteData.deviceUpdatedAt <= lastCloudTimestampRef.current) {
          return;
        }

        console.log('[CloudSync] 다른 기기로부터 실시간 업데이트 수신.');
        isApplyingRemoteRef.current = true;
        if (Array.isArray(remoteData.items)) {
          itemsHook.setItems(remoteData.items);
        }
        if (Array.isArray(remoteData.rooms) && remoteData.rooms.length > 0) {
          room.setRooms(remoteData.rooms);
        }
        if (remoteData.activeRoomId) {
          room.setActiveRoomId(remoteData.activeRoomId);
        }
        lastCloudTimestampRef.current = remoteData.deviceUpdatedAt || Date.now();
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 400);
      },
      (err) => {
        if (err.code === 'permission-denied') {
          setSyncStatus('permission_denied');
          setSyncMessage('Firebase Firestore 보안 규칙 설정이 필요합니다.');
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId, isGuest]);

  // 3. 로컬 데이터 변경 시 클라우드로 자동 디바운스 업로드
  useEffect(() => {
    if (!isFirebaseConfigured || !userId || isGuest) return;
    if (!hasLoadedInitialCloudRef.current) return;
    if (isApplyingRemoteRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        const now = Date.now();
        lastCloudTimestampRef.current = now;
        await saveCloudData(userId, {
          items: itemsHook.items,
          rooms: room.rooms,
          activeRoomId: room.activeRoomId,
        });
        setSyncStatus('synced');
      } catch (err) {
        if (err.code === 'permission-denied') {
          setSyncStatus('permission_denied');
          setSyncMessage('Firebase Firestore 보안 규칙 설정이 필요합니다.');
        } else {
          setSyncStatus('error');
        }
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [itemsHook.items, room.rooms, room.activeRoomId, userId, isGuest]);

  return { syncStatus, syncMessage };
}
