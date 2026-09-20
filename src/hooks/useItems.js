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
  const allFound = [];
  const idMap = new Map();

  const addParsed = (parsed, isPrimary = false) => {
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (!item || !item.id) return;
        if (!idMap.has(item.id)) {
          idMap.set(item.id, item);
          allFound.push(item);
        } else if (isPrimary) {
          // 최우선 키(현재 사용자 데이터)는 무조건 우선 적용
          const existingIdx = allFound.findIndex((i) => i.id === item.id);
          if (existingIdx !== -1) {
            allFound[existingIdx] = item;
          }
          idMap.set(item.id, item);
        } else {
          // 보조 키와의 병합 시 updatedAt이 더 최신인 경우만 업데이트
          const existing = idMap.get(item.id);
          const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const incomingTime = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
          if (incomingTime > existingTime && incomingTime > 0) {
            const existingIdx = allFound.findIndex((i) => i.id === item.id);
            if (existingIdx !== -1) {
              allFound[existingIdx] = item;
            }
            idMap.set(item.id, item);
          }
        }
      });
    }
  };

  try {
    // 1. 현재 사용자 키 (최우선 순위)
    const userKey = storageKey(userId);
    const userData = localStorage.getItem(userKey);
    if (userData) addParsed(JSON.parse(userData), true);

    // 2. 게스트 키 (게스트 상태에서 등록했던 물건 누락 방지 및 마이그레이션)
    if (userKey !== BASE_KEY) {
      const guestData = localStorage.getItem(BASE_KEY);
      if (guestData) addParsed(JSON.parse(guestData), false);
    }

    // 3. 브라우저 내 다른 모든 cloomy_items_* 키 탐색하여 누락된 물건 복원
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('cloomy_items') || k.startsWith('jeongnijjang_items')) &&
        k !== userKey &&
        k !== BASE_KEY
      ) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) addParsed(JSON.parse(raw), false);
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[useItems] loadItems 로드 중 에러:', err);
  }

  return allFound;
}

function saveItems(items, userId) {
  const key = storageKey(userId);
  try {
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
  };
}
