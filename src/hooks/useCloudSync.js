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

        // 물건 스마트 병합 함수: id 기준으로 타임스탬프(updatedAt)를 비교하여 최신 변경사항 보존!
        const mergeItemsSafely = (localList, cloudList) => {
          const map = new Map();
          // 1. 클라우드 아이템 기본 등록
          (cloudList || []).forEach((item) => {
            if (item && item.id) map.set(item.id, item);
          });

          // 2. 로컬 아이템 병합: 동일 id인 경우 타임스탬프 비교
          (localList || []).forEach((localItem) => {
            if (!localItem || !localItem.id) return;
            if (!map.has(localItem.id)) {
              map.set(localItem.id, localItem);
            } else {
              const cloudItem = map.get(localItem.id);
              const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
              const cloudTime = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;

              // 로컬이 더 최신이거나 타임스탬프가 동일한 경우 로컬 속성 우선
              if (localTime >= cloudTime || localTime === 0) {
                map.set(localItem.id, {
                  ...cloudItem,
                  ...localItem,
                  imageUrl: localItem.imageUrl || cloudItem.imageUrl,
                });
              }
            }
          });
          return Array.from(map.values());
        };

        const cloudItems = cloudData && Array.isArray(cloudData.items) ? cloudData.items : [];
        const mergedItems = mergeItemsSafely(currentLocalItems, cloudItems);

        // 방 목록 동기화: 클라우드에 데이터가 있으면 클라우드 방 목록 우선 (또는 로컬이 더 많을 시 로컬 유지)
        const cloudRooms = cloudData && Array.isArray(cloudData.rooms) ? cloudData.rooms : [];
        let mergedRooms =
          cloudRooms.length > 0
            ? (currentLocalRooms.length > cloudRooms.length ? currentLocalRooms : cloudRooms)
            : currentLocalRooms;

        // 구버전 '안방'이 감지된 경우에만 호환 마이그레이션
        const hasAnbang = mergedRooms.some(r => r.name === '안방');
        if (hasAnbang && PRELOADED_RECOVERY_DATA?.rooms?.length > 0) {
          mergedRooms = PRELOADED_RECOVERY_DATA.rooms;
        }

        console.log(
          `[CloudSync] 로컬(${currentLocalItems.length}개) + 클라우드(${cloudItems.length}개) -> 통합 ${mergedItems.length}개 물건, ${mergedRooms.length}개 방 확정`
        );

        isApplyingRemoteRef.current = true;
        itemsHook.setItems(mergedItems);
        if (mergedRooms.length > 0) {
          room.setRooms(mergedRooms);
        }
        const targetActiveRoomId =
          cloudData?.activeRoomId && mergedRooms.some(r => r.id === cloudData.activeRoomId)
            ? cloudData.activeRoomId
            : (mergedRooms[0]?.id || 'room-1');
        room.setActiveRoomId(targetActiveRoomId);

        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 400);

        // 최신 마이그레이션이 발생했거나 로컬 변경사항(상태/위치/사용도 변경)이 있으면 클라우드로 즉시 업로드 반영!
        const hasLocalChanges = mergedItems.some((item) => {
          const cloudItem = cloudItems.find((c) => c.id === item.id);
          if (!cloudItem) return true;
          return (
            item.status !== cloudItem.status ||
            item.location !== cloudItem.location ||
            item.usage !== cloudItem.usage ||
            item.name !== cloudItem.name
          );
        });

        const needsCloudUpdate =
          mergedItems.length > cloudItems.length ||
          mergedRooms.length > cloudRooms.length ||
          hasAnbang ||
          hasLocalChanges;

        if (needsCloudUpdate) {
          console.log(`[CloudSync] 통합된 최신 데이터(${mergedItems.length}개 물건, ${mergedRooms.length}개 방) 클라우드로 저장.`);
          await saveCloudData(userId, {
            items: mergedItems,
            rooms: mergedRooms,
            activeRoomId: targetActiveRoomId,
          });
          lastCloudTimestampRef.current = Date.now();
        } else {
          lastCloudTimestampRef.current = cloudData?.deviceUpdatedAt || Date.now();
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
