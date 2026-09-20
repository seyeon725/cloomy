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
  const idSet = new Set();

  const addParsed = (parsed) => {
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (item && item.id && !idSet.has(item.id)) {
          idSet.add(item.id);
          allFound.push(item);
        }
      });
    }
  };

  try {
    // 1. 현재 사용자 키
    const userKey = storageKey(userId);
    const userData = localStorage.getItem(userKey);
    if (userData) addParsed(JSON.parse(userData));

    // 2. 게스트 키 (게스트 상태에서 등록했던 42개 물건 누락 방지 및 자동 복원)
    const guestData = localStorage.getItem(BASE_KEY);
    if (guestData) addParsed(JSON.parse(guestData));

    // 3. 브라우저 내 다른 모든 cloomy_items_* 키 탐색하여 누락된 물건 모두 복원
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
          if (raw) addParsed(JSON.parse(raw));
        } catch {}
      }
    }

    // 4. 로컬 분실 상태이거나 백업 데이터보다 적은 경우 자동 복구
    if (allFound.length < (PRELOADED_RECOVERY_DATA?.items?.length || 0)) {
      addParsed(PRELOADED_RECOVERY_DATA.items);
      try {
        localStorage.setItem(RECOVERY_FLAG, 'true');
        localStorage.setItem(userKey, JSON.stringify(allFound));
        localStorage.setItem(BASE_KEY, JSON.stringify(allFound));
      } catch {}
    }
  } catch {}

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
    const itemsWithMeta = newItems.map((item) => ({
      ...item,
      id: uuidv4(),
      location: location || '미분류',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      usage: item.usage || 'frequent',
    }));
    setItems((prev) => [...itemsWithMeta, ...prev]);
    return itemsWithMeta;
  }, []);

  const updateItem = useCallback((id, updates) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const updateMultipleItems = useCallback((updatedItemsList) => {
    const updateMap = new Map(updatedItemsList.map((u) => [u.id, u]));
    setItems((prev) =>
      prev.map((item) => {
        const updates = updateMap.get(item.id);
        return updates ? { ...item, ...updates } : item;
      })
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const removeMultipleItems = useCallback((ids) => {
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((item) => !idSet.has(item.id)));
  }, []);

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
