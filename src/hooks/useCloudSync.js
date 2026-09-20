import { useEffect, useRef, useState } from 'react';
import { getCloudData, saveCloudData, subscribeCloudData } from '../services/cloudSync';
import { isFirebaseConfigured } from '../services/firebase';
import { PRELOADED_RECOVERY_DATA } from '../data/recoveryBackup';

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
            const fallback = rawUser ? JSON.parse(rawUser) : [];
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
            const fallback = rawUser ? JSON.parse(rawUser) : null;
            if (Array.isArray(fallback) && fallback.length > 0) {
              currentLocalRooms = fallback;
              room.setRooms(fallback);
            }
          } catch {}
        }
        const currentActiveRoomId = room.activeRoomId;

        let finalItems = currentLocalItems;
        let finalRooms = currentLocalRooms;
        let targetActiveRoomId = currentActiveRoomId || 'room-1';

        if (currentLocalItems.length === 0) {
          // 1. 로컬이 완전히 빈 상태(새 기기/첫 접속)인 경우에만 클라우드 데이터 다운로드
          if (cloudData && Array.isArray(cloudData.items) && cloudData.items.length > 0) {
            finalItems = cloudData.items;
            isApplyingRemoteRef.current = true;
            itemsHook.setItems(finalItems);
          }
          if (cloudData && Array.isArray(cloudData.rooms) && cloudData.rooms.length > 0) {
            finalRooms = cloudData.rooms;
            room.setRooms(finalRooms);
          }
          if (cloudData?.activeRoomId) {
            targetActiveRoomId = cloudData.activeRoomId;
            room.setActiveRoomId(targetActiveRoomId);
          }
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 400);
          console.log(`[CloudSync] 새 기기 감지: 클라우드에서 ${finalItems.length}개 물건, ${finalRooms.length}개 방 다운로드 완료`);
        } else {
          // 2. 로컬에 데이터가 있는 경우: 로컬이 절대적 기준(Source of Truth)!
          // 삭제나 위치 분류 등 사용자의 로컬 작업을 100% 보존하고, 이를 클라우드로 즉시 업로드 반영
          console.log(
            `[CloudSync] 로컬 최신 데이터 우선 확정 (${finalItems.length}개 물건, ${finalRooms.length}개 방) -> 클라우드로 동기화 업로드`
          );
          await saveCloudData(userId, {
            items: finalItems,
            rooms: finalRooms,
            activeRoomId: targetActiveRoomId,
          });
          lastCloudTimestampRef.current = Date.now();
        }

        hasLoadedInitialCloudRef.current = true;
        setSyncStatus('synced');
      } catch (err) {
        if (!isMounted) return;
        const isPermission =
          err?.code === 'permission-denied' ||
          err?.code === 'firestore/permission-denied' ||
          err?.message?.includes('permission') ||
          err?.message?.includes('Missing or insufficient permissions');

        if (isPermission) {
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
          const remoteHasAnbang = remoteData.rooms.some(r => r.name === '안방');
          if (!remoteHasAnbang) {
            room.setRooms(remoteData.rooms);
            if (remoteData.activeRoomId && remoteData.rooms.some(r => r.id === remoteData.activeRoomId)) {
              room.setActiveRoomId(remoteData.activeRoomId);
            }
          }
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

    const performSync = async () => {
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
        const isPermission =
          err?.code === 'permission-denied' ||
          err?.code === 'firestore/permission-denied' ||
          err?.message?.includes('permission') ||
          err?.message?.includes('Missing or insufficient permissions');

        if (isPermission) {
          setSyncStatus('permission_denied');
          setSyncMessage('Firebase Firestore 보안 규칙 설정이 필요합니다.');
        } else {
          setSyncStatus('error');
        }
      }
    };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(performSync, 800);

    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        performSync();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [itemsHook.items, room.rooms, room.activeRoomId, userId, isGuest]);

  return { syncStatus, syncMessage };
}
