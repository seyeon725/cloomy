import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PRELOADED_RECOVERY_DATA } from '../data/recoveryBackup';

const BASE_KEY = 'cloomy_items';
const LEGACY_STORAGE_KEY = 'jeongnijjang_items';
const RECOVERY_FLAG = 'cloomy_auto_recovered_v1';

/** userId에 따라 스토리지 키를 결정 */
function storageKey(userId) {
  if (!userId || userId === 'guest') return BASE_KEY;
  return `${BASE_KEY}_${userId}`;
}

function loadItems(userId) {
  const userKey = storageKey(userId);
  try {
    const rawUser = localStorage.getItem(userKey);
    if (rawUser !== null) {
      const parsed = JSON.parse(rawUser);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // userKey에 아직 데이터가 없는 첫 로그인 상태일 때만 게스트 키에서 1회 마이그레이션
    if (userKey !== BASE_KEY) {
      const guestData = localStorage.getItem(BASE_KEY);
      if (guestData) {
        const parsedGuest = JSON.parse(guestData);
        if (Array.isArray(parsedGuest) && parsedGuest.length > 0) {
          try {
            localStorage.setItem(userKey, JSON.stringify(parsedGuest));
          } catch {}
          return parsedGuest;
        }
      }
    }
  } catch (err) {
    console.warn('[useItems] loadItems 로드 중 에러:', err);
  }

  return [];
}

function saveItems(items, userId) {
  const key = storageKey(userId);
  try {
    // 직전 상태 1개를 임시 스냅샷으로 보존 (더미 누적 방지: 항상 단 1개만 덮어씀)
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        const prevList = JSON.parse(existing);
        if (Array.isArray(prevList) && prevList.length > 0) {
          localStorage.setItem(
            'cloomy_items_snapshot_prev',
            JSON.stringify({
              timestamp: Date.now(),
              userId,
              items: prevList,
            })
          );
        }
      } catch {}
    }

    // 거대한 원본 사진(photoUrl)은 제외하고, 최적화된 썸네일(imageUrl)과 메타데이터 저장
    const sanitized = items.map(({ photoUrl, ...rest }) => rest);
    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('localStorage 1차 저장 실패 (용량 초과 등), 썸네일 최적화 후 재시도:', err);
    try {
      // 용량 초과 시 최근 30개 물건의 썸네일만 유지하고 오래된 썸네일은 정리하여 안전하게 저장
      const trimmed = items.map(({ photoUrl, ...rest }, idx) => {
        if (idx >= 30) {
          const { imageUrl, ...withoutImg } = rest;
          return withoutImg;
        }
        return rest;
      });
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (fallbackErr) {
      console.warn('localStorage 2차 시도 실패, 텍스트 메타데이터만 저장:', fallbackErr);
      try {
        const textOnly = items.map(({ photoUrl, imageUrl, ...rest }) => rest);
        localStorage.setItem(key, JSON.stringify(textOnly));
      } catch (fatalErr) {
        console.error('localStorage 최종 저장 실패:', fatalErr);
      }
    }
  }
}

export const USAGE_CONFIG = {
  frequent: {
    id: 'frequent',
    label: '자주 / 최근 사용',
    shortLabel: '자주 사용',
    emoji: '⭐',
    badgeClass: 'bg-[#EAF5EC] text-[#3D7C4F] border-[#D4ECD8]',
  },
  unused_3m: {
    id: 'unused_3m',
    label: '3개월 미사용',
    shortLabel: '3개월 안 씀',
    emoji: '⏳',
    badgeClass: 'bg-[#FFF6E5] text-[#A66E22] border-[#FFE9BE]',
  },
  unused_1y: {
    id: 'unused_1y',
    label: '1년 이상 미사용',
    shortLabel: '1년+ 안 씀',
    emoji: '📦',
    badgeClass: 'bg-[#FFE9E7] text-[#B55B59] border-[#FFD3CF]',
  },
};

export function useItems(userId) {
  const [items, setItems] = useState(() => loadItems(userId));
  const [loading, setLoading] = useState(false);
  const prevUserId = useRef(userId);

  // userId 변경 시 해당 사용자의 데이터 로드
  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId;
      setItems(loadItems(userId));
    }
  }, [userId]);

  useEffect(() => {
    saveItems(items, userId);
  }, [items, userId]);

  const addItems = useCallback((newItems, location) => {
    const now = new Date().toISOString();
    const itemsWithMeta = newItems.map((item) => ({
      ...item,
      id: uuidv4(),
      location: location || '미분류',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      usage: item.usage || 'frequent',
    }));
    setItems((prev) => {
      const next = [...itemsWithMeta, ...prev];
      saveItems(next, userId);
      return next;
    });
    return itemsWithMeta;
  }, [userId]);

  const updateItem = useCallback((id, updates) => {
    const now = new Date().toISOString();
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: updates.updatedAt || now } : item
      );
      saveItems(next, userId);
      return next;
    });
  }, [userId]);

  const updateMultipleItems = useCallback((updatedItemsList) => {
    const now = new Date().toISOString();
    const updateMap = new Map(
      updatedItemsList.map((u) => [u.id, { ...u, updatedAt: u.updatedAt || now }])
    );
    setItems((prev) => {
      const next = prev.map((item) => {
        const updates = updateMap.get(item.id);
        return updates ? { ...item, ...updates } : item;
      });
      saveItems(next, userId);
      return next;
    });
  }, [userId]);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveItems(next, userId);
      return next;
    });
  }, [userId]);

  const removeMultipleItems = useCallback((ids) => {
    const idSet = new Set(ids);
    setItems((prev) => {
      const next = prev.filter((item) => !idSet.has(item.id));
      saveItems(next, userId);
      return next;
    });
  }, [userId]);

  const getItemsByLocation = useCallback(
    (location) => items.filter((item) => item.location === location),
    [items]
  );

  const getLocations = useCallback(() => {
    const locs = [...new Set(items.map((item) => item.location))];
    return locs;
  }, [items]);

  const getStats = useCallback(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === 'active').length;
    const archived = items.filter((i) => i.status === 'archived').length;
    const discarded = items.filter((i) => i.status === 'discarded').length;
    const trading = items.filter((i) => i.status === 'trading').length;
    const categories = {};
    items.forEach((i) => {
      categories[i.category] = (categories[i.category] || 0) + 1;
    });
    const locations = {};
    items.forEach((i) => {
      locations[i.location] = (locations[i.location] || 0) + 1;
    });
    const usages = { frequent: 0, unused_3m: 0, unused_1y: 0 };
    items.forEach((i) => {
      const u = i.usage || 'frequent';
      if (usages[u] !== undefined) usages[u]++;
      else usages.frequent++;
    });
    return { total, active, archived, discarded, trading, categories, locations, usages };
  }, [items]);

  const restorePreviousSnapshot = useCallback(() => {
    try {
      const raw = localStorage.getItem('cloomy_items_snapshot_prev');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
        saveItems(parsed.items, userId);
        return true;
      }
    } catch (err) {
      console.error('[useItems] 직전 스냅샷 복원 실패:', err);
    }
    return false;
  }, [userId]);

  return {
    items,
    setItems,
    loading,
    addItems,
    updateItem,
    updateMultipleItems,
    removeItem,
    removeMultipleItems,
    getItemsByLocation,
    getLocations,
    getStats,
    restorePreviousSnapshot,
  };
}
